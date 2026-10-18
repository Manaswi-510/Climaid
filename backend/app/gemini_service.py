"""
gemini_service.py
=================
Integration with Google Gemini API (gemini-3.8-flash) for Climaid.
Produces practical, non-technical, easy-to-understand climate resilience
reports and resource allocation tables for everyday citizens and municipal ward officers.
"""

import os
import json
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import requests
from dotenv import load_dotenv

# Load environment
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(REPO_ROOT / "backend" / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "models/gemini-3.8-flash")
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
EXPORTS_DIR = REPO_ROOT / "data" / "exports"


def generate_gemini_content(prompt: str, model: str = None) -> str:
    """
    Direct call to Google Gemini REST API using the configured GEMINI_API_KEY.
    """
    api_key = GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in backend/.env")

    model_name = model or GEMINI_MODEL
    url = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 4096,
            "thinkingConfig": {
                "thinkingBudget": 0
            }
        }
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"Gemini API returned HTTP {resp.status_code}: {resp.text}")

    data = resp.json()
    candidates = data.get("candidates", [])
    if not candidates:
        raise RuntimeError("Gemini returned zero candidates.")

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts:
        raise RuntimeError("Gemini candidate content has no text parts.")

    return parts[0].get("text", "").strip()


def analyze_ward_with_gemini(
    ward_num: int,
    custom_budget_inr: Optional[float] = None,
    max_workforce: Optional[float] = None,
    max_horizon_months: Optional[int] = None,
    plan_data: Optional[Dict[str, Any]] = None,
    force_refresh: bool = False
) -> Dict[str, Any]:
    """
    Performs comprehensive ward-specific climate risk analysis in plain, easy-to-understand language.
    Produces simple tables for problems & solutions, as well as budget/manpower division.
    """
    cache_file = EXPORTS_DIR / f"gemini_analysis_ward_{ward_num}.json"
    if not force_refresh and cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached = json.load(f)
                return cached
        except Exception:
            pass

    # 1. Load Ward Indicators
    indicators_file = PROCESSED_DIR / "ward_indicators.json"
    if not indicators_file.exists():
        raise FileNotFoundError(f"Indicators file not found at {indicators_file}")

    with open(indicators_file, "r", encoding="utf-8") as f:
        all_wards = json.load(f).get("wards", [])

    ward = next((w for w in all_wards if w.get("ward_num") == ward_num), None)
    if not ward:
        raise ValueError(f"Ward number {ward_num} not found in indicator dataset.")

    # 2. Load or Compute Action Plan
    if plan_data is None:
        from ..scripts.build_action_plan import generate_action_plan
        budget = custom_budget_inr if custom_budget_inr is not None else 5000000
        plan_data = generate_action_plan(
            budget_inr=budget,
            max_workforce_person_months=max_workforce,
            max_horizon_months=max_horizon_months,
            selected_ward_num=ward_num
        )

    indicators = ward.get("indicators", {})
    evidence = ward.get("evidence", {})
    portfolio = plan_data.get("portfolio", [])
    budget_info = plan_data.get("budget_constraints", {})
    perf_metrics = plan_data.get("performance_metrics", {})

    total_budget_val = budget_info.get("total_budget_inr", 5000000)
    allocated_spend_val = budget_info.get("allocated_spend_inr", 0)
    remaining_budget_val = budget_info.get("remaining_budget_inr", 0)
    workforce_demand_val = perf_metrics.get("workforce_demand_person_months", 0)
    workforce_cap_val = perf_metrics.get("workforce_capacity_person_months") or "Flexible / As needed"
    time_horizon_val = perf_metrics.get("estimated_implementation_horizon_months", 3)

    # Construct portfolio summary for prompt
    portfolio_summary = []
    for item in portfolio:
        portfolio_summary.append(
            f"- {item.get('title')}: {item.get('allocated_units')} {item.get('unit')} | "
            f"Cost: Rs. {item.get('total_cost_inr'):,} | "
            f"Workers needed: {item.get('workforce_person_months')} person-months | "
            f"Time: {item.get('lead_time_months')} months | "
            f"Dept in charge: {item.get('responsible_department')}"
        )
    portfolio_text = "\n".join(portfolio_summary) if portfolio_summary else "No interventions could be allocated with the current budget."

    swd_pct = evidence.get("stormwater_drainage_coverage_pct", evidence.get("stormwater_drain_coverage_pct", 0))
    slum_ug_pct = evidence.get("underground_drainage_slums_pct", 0)
    trees_cnt = evidence.get("mapped_trees_osm", 0)
    parks_cnt = evidence.get("mapped_parks_osm", 0)
    max_temp = round(evidence.get("forecast_max_temp_c", 34.0), 1)
    rain_sum = round(evidence.get("forecast_precipitation_sum_mm", 0.0), 1)

    # Construct Plain-Language Non-Technical Prompt
    prompt = f"""
You are a friendly neighbourhood advisor helping normal people and ward officers in Pune understand their ward's climate risks and what to do about them.

LANGUAGE RULES — FOLLOW THESE STRICTLY:
- Write as if explaining to a shopkeeper, auto driver, or homemaker — NOT to an engineer.
- Use short sentences. Use everyday Hindi-English words where natural (e.g. "naala" for drain, "pani bharaav" for waterlogging).
- BANNED WORDS: Do NOT use any of these words or phrases: hydrometeorological, pluvial, conveyance, albedo, elastomeric, subsurface infiltration, SRI index, thermal sink, thermal inertia, evapotranspirative, hydraulic conductivity, operative temperature, solar reflectance, biohazard, soakaway, microclimatic, insolation, MILP, ROI, KPI, proxy, receptor, collocation, delineation, morphology, empirical, precarity.
- Instead of "hydrometeorological flash flooding" → say "sudden heavy rain causing water to fill up streets"
- Instead of "high-albedo cool roof coatings" → say "white heat-reflecting paint for rooftops"
- Instead of "decentralized rainwater harvesting" → say "rooftop rainwater collection tanks"
- Instead of "subsurface infiltration" → say "letting rainwater soak into the ground"
- Instead of "stormwater conveyance" → say "drains that carry rainwater away"

=== WARD DATA ===
Ward: #{ward.get('ward_num')} — {ward.get('ward_title')}
Zone: {ward.get('area_zone')}
Population: About {ward.get('population_voters_proxy'):,} people
Facts:
- Only {swd_pct}% of roads have working rainwater drains. That means {round(100 - swd_pct, 1)}% of roads have NO drains at all.
- Only {slum_ug_pct}% of slum homes have underground sewer pipes. {round(100 - slum_ug_pct, 1)}% are not connected.
- {trees_cnt} trees and {parks_cnt} parks are officially recorded.
- Expected weather ahead: up to {max_temp}°C heat, about {rain_sum} mm rain.

=== BUDGET & RESOURCES GIVEN ===
- Money available: Rs. {total_budget_val:,.0f}
- Workers available: {workforce_cap_val}
- Time available: {time_horizon_val} months

=== PLANNED WORK (from optimizer) ===
{portfolio_text}

Totals: Rs. {allocated_spend_val:,.0f} spent out of Rs. {total_budget_val:,.0f} | Workers needed: {workforce_demand_val} person-months | Timeline: {time_horizon_val} months | Unspent: Rs. {remaining_budget_val:,.0f}

=== YOUR OUTPUT — USE THESE EXACT SECTION HEADINGS ===

### 1. What's Life Like in This Ward?
Write 3 simple sentences a resident would nod along to. Describe what summer heat and monsoon rain actually feel like here — roads flooding, no shade, hot tin roofs, etc. Use the real numbers above naturally.

### 2. Problems and What We Can Do About Them
Make a markdown table with EXACTLY these columns:
| Problem | How Bad Is It? | Why Does This Happen Here? | What Can Be Done? |
|:---|:---|:---|:---|
Fill in 4-5 rows covering: street flooding, extreme heat, no trees/shade, dirty water/drainage, and water shortage. Write each cell in 1-2 plain sentences max. Use the real ward numbers (like "{swd_pct}% drains" or "{trees_cnt} trees").

### 3. How Will the Money, Workers and Time Be Used?
Make a CLEAR markdown table showing the division:
| Work To Be Done | How Many? | Money (Rs.) | Workers Needed | Time Needed | Who Is Responsible? |
|:---|:---|:---|:---|:---|:---|
Fill one row per intervention from the planned work above. Keep descriptions simple (e.g. "White roof paint for 15 buildings" not "High-Albedo Cool Roof Coatings for 15 Clusters").

After the table, add a simple summary:
- **Total money being used:** Rs. {allocated_spend_val:,.0f} out of Rs. {total_budget_val:,.0f}
- **Money left over:** Rs. {remaining_budget_val:,.0f}
- **Workers needed:** {workforce_demand_val} person-months
- **Everything done in:** {time_horizon_val} months

### 4. What Should the Ward Officer Do? (Step by Step)
Give 4 simple numbered steps with rough timelines. Example format:
1. **Week 1-2:** Do this first...
2. **Month 1:** Then do this...
Write as instructions to a ward officer who doesn't have an engineering degree.

### 5. How Will Residents Know Things Are Getting Better?
Give 3 simple checkpoints that any normal person can see:
- ✅ After rain, streets should drain within 30-45 minutes instead of staying flooded for hours
- ✅ Homes with white-painted roofs should feel cooler in the afternoon
- ✅ (third point based on the ward's specific work)
"""

    try:
        gemini_markdown = generate_gemini_content(prompt)
    except Exception as e:
        print(f"[!] Gemini call failed: {e}. Generating rule-based fallback.")
        gemini_markdown = _generate_rule_based_fallback(
            ward, indicators, evidence, portfolio,
            total_budget_val, allocated_spend_val, remaining_budget_val,
            workforce_demand_val, time_horizon_val
        )

    result = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "ward_num": ward_num,
        "ward_title": ward.get("ward_title"),
        "area_zone": ward.get("area_zone"),
        "gemini_model_used": GEMINI_MODEL,
        "content_markdown": gemini_markdown,
        "indicators_snapshot": indicators,
        "portfolio_summary": portfolio_summary
    }

    # Save to cache
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    return result


def _generate_rule_based_fallback(
    ward, indicators, evidence, portfolio,
    total_budget, allocated_spend, remaining_budget,
    workforce_demand, time_horizon
):
    title = ward.get("ward_title", f"Ward {ward.get('ward_num')}")
    swd = evidence.get("stormwater_drainage_coverage_pct", evidence.get("stormwater_drain_coverage_pct", 10))
    trees = evidence.get("mapped_trees_osm", 0)

    rows = []
    for item in portfolio:
        rows.append(
            f"| **{item.get('title')}** | {item.get('allocated_units')} {item.get('unit')} | "
            f"Rs. {item.get('total_cost_inr'):,} | {item.get('workforce_person_months')} workers | "
            f"{item.get('lead_time_months')} mo | {item.get('responsible_department')} |"
        )
    rows_text = "\n".join(rows) if rows else "| No actions allocated | — | Rs. 0 | 0 | 0 mo | — |"

    return f"""### 1. What's Life Like in This Ward?
In {title}, everyday life gets really tough during extreme weather. In summer, the streets and houses turn into heat traps because there are barely any shade trees or parks. During monsoon, even light rain quickly fills up the roads because {100 - swd:.0f}% of streets have absolutely no drains to carry the water away.

### 2. Problems and What We Can Do About Them

| Problem | How Bad Is It? | Why Does This Happen Here? | What Can Be Done? |
| :--- | :--- | :--- | :--- |
| **Streets flooding with rainwater** | Very Bad | Only {swd}% of roads have drains. Rain has nowhere to go. | Clean out clogged drains and put iron trash guards so water keeps flowing. |
| **Unbearable summer heat** | Bad | No shade trees, hot tin and concrete roofs trap the sun's heat all day. | Paint roofs white with heat-reflecting paint. Set up shaded bus stops with drinking water. |
| **No trees or greenery** | Bad | Only {trees} trees and very few parks recorded in this area. | Plant fast-growing local shade trees (Neem, Peepal) along footpaths and busy roads. |
| **Dirty water mixing with rainwater** | Medium | Many homes in slum areas don't have proper sewer pipes. | Seal and clean open drains so dirty water doesn't mix with rainwater during monsoon. |

### 3. How Will the Money, Workers and Time Be Used?

| Work To Be Done | How Many? | Money (Rs.) | Workers Needed | Time Needed | Who Is Responsible? |
| :--- | :--- | :--- | :--- | :--- | :--- |
{rows_text}

**Summary:**
- **Total money being used:** Rs. {allocated_spend:,.0f} out of Rs. {total_budget:,.0f}
- **Money left over:** Rs. {remaining_budget:,.0f}
- **Workers needed:** {workforce_demand} person-months
- **Everything done in:** {time_horizon} months

### 4. What Should the Ward Officer Do? (Step by Step)

1. **Week 1-2:** The ward engineer should visit the worst waterlogging spots and get the mud and garbage cleared from major drain channels.
2. **Month 1:** Work with local community leaders to identify tin-roof buildings and get them painted with white heat-reflecting coating.
3. **Month 2:** Coordinate with PMPML to set up shaded bus shelters with clean drinking water taps at the busiest stops.
4. **Month 3:** The Garden Department plants hardy local shade trees (Neem, Peepal) along road edges with protective tree guards.

### 5. How Will Residents Know Things Are Getting Better?

- ✅ **Streets clear up quickly:** After heavy rain, water should drain away within 30-45 minutes instead of staying for hours.
- ✅ **Homes feel cooler:** Rooms under white-painted roofs should feel noticeably more comfortable during hot afternoons.
- ✅ **Bus stops with shade and water:** Commuters and pedestrians can use shaded bus stops and new tree saplings are alive and growing.
"""
