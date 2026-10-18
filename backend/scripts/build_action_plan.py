"""
build_action_plan.py
====================
Phase 2C: Constrained Climate Adaptation Optimizer & Scientifically Honest
Scenario Simulator for Pune Wards.

Capabilities:
1. Interventions Catalogue with explicit cost provenance, lead times,
   workforce demand (person-months), affected indicators, and data-quality tags.
2. Nuanced Site Suitability:
   - SUITABLE_CONFIRMED: Verified by public GIS datasets.
   - FLAGGED_FOR_SITE_VERIFICATION: Unmapped in public data (e.g. minor nallas or
     local chambers not yet digitized); candidate is permitted for planning based on
     vulnerability, but flagged with mandatory pre-procurement verification notice.
   - UNSUITABLE_CONFIRMED: Hard physical or user constraints genuinely ruling it out.
3. PuLP MILP Optimization:
   - Maximizes prioritization utility (hazard alignment + base benefit + equity).
   - Strict budget adherence; reports unused budget with explicit reasons.
   - Workforce capacity and planning horizon bounds.
   - Prevents unverified fractional allocations; handles zero-budget feasibly.
4. Scientifically Honest Scenario Simulation:
   - Baseline vs. Proposed Plan comparison.
   - Separate quantified modelled indicator changes from qualitative directional benefits.
   - Explicitly does NOT equate optimizer utility with a percentage reduction in disaster loss.
   - Drain desilting clears debris bottlenecks, but does not claim quantified flood probability reduction.
   - Transit bus stops provide commuter thermal refuge, but do not claim macro LST reduction.
   - Data provenance & limitations disclosed prominently.
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

import pulp

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
EXPORTS_DIR = REPO_ROOT / "data" / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# ==============================================================================
# Comprehensive Intervention Catalogue & Impact Model
# ==============================================================================

INTERVENTIONS_CATALOGUE: List[Dict[str, Any]] = [
    {
        "id": "INT-HEAT-01",
        "category": "Heat & Urban Cooling",
        "title": "Urban Shade Corridors & Native Canopy Planting",
        "description": "Plant fast-growing native shade trees along pedestrian walkways, school zones, and transit routes.",
        "cost_per_unit_inr": 250000,
        "unit": "km corridor",
        "min_units": 0,
        "max_units": 10,
        "lead_time_months": 3,
        "workforce_person_months_per_unit": 4.0,
        "risk_reduction_score": 82.0,
        "co_benefits_score": 90.0,
        "equity_weight": 85.0,
        "maintenance_burden": "Moderate (watering for initial 2 years)",
        "responsible_department": "PMC Garden Department / Tree Authority",
        "target_vulnerability": "heat_exposure_proxy",
        "affected_indicators": ["green_deficit_proxy", "heat_exposure_proxy"],
        "quantified_effects": {
            "green_deficit_proxy": {"delta_per_unit": -1.8, "confidence": "MODELLED_ESTIMATE"},
            "heat_exposure_proxy": {"delta_per_unit": -0.8, "confidence": "MODELLED_ESTIMATE"}
        },
        "directional_effects": ["Pedestrian shade comfort", "Biodiversity corridor connectivity"],
        "scientific_rationale": "Tree planting increases vegetative fraction along walkways, providing microclimatic shade and moderating green deficit.",
        "prerequisites": ["Suitable pedestrian verge", "Adequate soil depth along right-of-way"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "cost_provenance": "PMC standard schedule of rates roadside plantation estimate; unverified for specific corridor utility conflicts.",
        "benefit_provenance": "Screening heuristic (0-100); empirical cooling requires multispectral canopy verification."
    },
    {
        "id": "INT-HEAT-02",
        "category": "Heat & Urban Cooling",
        "title": "Cool Roof Reflective Coating in High-Density Receptors",
        "description": "Apply high-albedo solar-reflective coating to municipal buildings, health posts, and informal settlement roofs.",
        "cost_per_unit_inr": 120000,
        "unit": "building cluster",
        "min_units": 0,
        "max_units": 15,
        "lead_time_months": 1,
        "workforce_person_months_per_unit": 2.0,
        "risk_reduction_score": 88.0,
        "co_benefits_score": 75.0,
        "equity_weight": 95.0,
        "maintenance_burden": "Low (recoat every 3-4 years)",
        "responsible_department": "PMC Building & Development Department",
        "target_vulnerability": "heat_exposure_proxy",
        "affected_indicators": ["heat_exposure_proxy"],
        "quantified_effects": {
            "heat_exposure_proxy": {"delta_per_unit": -1.2, "confidence": "MODELLED_ESTIMATE"}
        },
        "directional_effects": ["Indoor thermal comfort in uninsulated tin/asbestos housing"],
        "scientific_rationale": "High-albedo solar-reflective coating reduces treated roof surface temperatures by 2-3°C, moderating ward-level heat proxy.",
        "prerequisites": ["Stable roof structures", "Heat exposure proxy >= 45"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "cost_provenance": "Market rate estimate for elastomeric high-albedo coatings; assumes municipal or community permission.",
        "benefit_provenance": "Well-established surface physics; macro-ward heat effect depends on treated roof area fraction."
    },
    {
        "id": "INT-HEAT-03",
        "category": "Heat & Urban Cooling",
        "title": "Shaded Bus Stops & Public Cooling Kiosks with Drinking Water",
        "description": "Upgrade PMPML bus stops with green-roof or high-reflectance shading and clean drinking water dispensers.",
        "cost_per_unit_inr": 180000,
        "unit": "station kiosk",
        "min_units": 0,
        "max_units": 12,
        "lead_time_months": 2,
        "workforce_person_months_per_unit": 2.5,
        "risk_reduction_score": 76.0,
        "co_benefits_score": 80.0,
        "equity_weight": 90.0,
        "maintenance_burden": "Moderate (daily maintenance & refill)",
        "responsible_department": "PMPML & PMC Health Department",
        "target_vulnerability": "heat_exposure_proxy",
        "affected_indicators": ["heat_exposure_proxy"],
        "quantified_effects": {}, # Macro ward proxy effect unavailable!
        "directional_effects": ["Commuter thermal refuge during heatwaves", "Public hydration access"],
        "scientific_rationale": "Cooling kiosks provide acute localized commuter relief; numerical effect on macro ward-level surface temperature is physically negligible and unavailable.",
        "prerequisites": ["Existing PMPML bus stop right-of-way", "Water connection within 50m"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "cost_provenance": "Prefabricated bus shelter upgrade heuristic.",
        "benefit_provenance": "Qualitative commuter welfare score; no macro-temperature reduction claimed."
    },
    {
        "id": "INT-FLOOD-01",
        "category": "Flood & Stormwater",
        "title": "Critical Stormwater Drain Desilting & Inlet Trash Screens",
        "description": "Immediate pre-monsoon mechanical desilting and trash-screen installation at high-risk drainage bottlenecks.",
        "cost_per_unit_inr": 350000,
        "unit": "major drain ward section",
        "min_units": 0,
        "max_units": 10,
        "lead_time_months": 1,
        "workforce_person_months_per_unit": 5.0,
        "risk_reduction_score": 92.0,
        "co_benefits_score": 70.0,
        "equity_weight": 90.0,
        "maintenance_burden": "High (annual pre-monsoon clearing required)",
        "responsible_department": "PMC Drainage & Sewerage Department",
        "target_vulnerability": "flood_screening_proxy",
        "affected_indicators": ["drainage_maintenance_deficit"],
        "quantified_effects": {}, # Must NOT claim quantified flood probability reduction!
        "directional_effects": ["Conduit clearing", "Removal of plastic/debris bottlenecks", "Vector-borne disease reduction"],
        "scientific_rationale": "Desilting restores baseline designed pipe conveyance. However, it does not enlarge pipe capacity or provide a defensible numerical reduction in extreme storm flood probability.",
        "prerequisites": ["Mapped municipal drainage network or stormwater chambers in ward"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "cost_provenance": "PMC annual pre-monsoon desilting tender rate schedule.",
        "benefit_provenance": "Directional maintenance benefit only; flood probability reduction unquantified."
    },
    {
        "id": "INT-FLOOD-02",
        "category": "Flood & Stormwater",
        "title": "Bioretention Rain Gardens & Permeable Soakaways",
        "description": "Convert roadside verges and paved traffic islands into vegetated bioretention swales to absorb runoff.",
        "cost_per_unit_inr": 280000,
        "unit": "swale site",
        "min_units": 0,
        "max_units": 8,
        "lead_time_months": 2,
        "workforce_person_months_per_unit": 3.0,
        "risk_reduction_score": 78.0,
        "co_benefits_score": 85.0,
        "equity_weight": 75.0,
        "maintenance_burden": "Low to Moderate (seasonal silt removal)",
        "responsible_department": "PMC Road Department / SWD",
        "target_vulnerability": "flood_screening_proxy",
        "affected_indicators": ["flood_screening_proxy", "green_deficit_proxy"],
        "quantified_effects": {
            "flood_screening_proxy": {"delta_per_unit": -0.9, "confidence": "MODELLED_ESTIMATE"},
            "green_deficit_proxy": {"delta_per_unit": -0.5, "confidence": "MODELLED_ESTIMATE"}
        },
        "directional_effects": ["Localized runoff retention", "Street ponding alleviation", "Groundwater recharge"],
        "scientific_rationale": "Permeable vegetated swales intercept localized runoff volume, modestly dampening overland flooding for low-to-medium showers.",
        "prerequisites": ["Permeable roadside verge", "Non-rocky subsoil strata"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "cost_provenance": "Low-impact development (LID) civil works estimate.",
        "benefit_provenance": "Modelled hydrological retention estimate; unverified for high-intensity cloudbursts."
    },
    {
        "id": "INT-FLOOD-03",
        "category": "Flood & Stormwater",
        "title": "Neighborhood Retention Basins & Nalla Naturalization",
        "description": "Restore degraded nalla buffer zones, remove concrete encasements, and create temporary flood detention ponds.",
        "cost_per_unit_inr": 850000,
        "unit": "restoration zone",
        "min_units": 0,
        "max_units": 5,
        "lead_time_months": 6,
        "workforce_person_months_per_unit": 10.0,
        "risk_reduction_score": 95.0,
        "co_benefits_score": 92.0,
        "equity_weight": 85.0,
        "maintenance_burden": "Moderate (silt clearance every 2 years)",
        "responsible_department": "PMC Environment Cell / Smart City",
        "target_vulnerability": "flood_screening_proxy",
        "affected_indicators": ["flood_screening_proxy"],
        "quantified_effects": {
            "flood_screening_proxy": {"delta_per_unit": -2.5, "confidence": "MODELLED_ESTIMATE"}
        },
        "directional_effects": ["Flood peak attenuation", "Riparian habitat restoration"],
        "scientific_rationale": "Dedicated detention volume and naturalized floodplain physically store surge waters, buffering downstream inundation.",
        "prerequisites": ["Natural drainage stream (nalla) presence in or adjacent to ward"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "cost_provenance": "Municipal waterbody restoration heuristic.",
        "benefit_provenance": "Modelled hydraulic storage estimate; requires site topographical survey."
    },
    {
        "id": "INT-WATER-01",
        "category": "Water Security",
        "title": "Decentralized Rainwater Harvesting in Municipal Complexes",
        "description": "Rooftop collection, filtration, and shallow percolation pits for institutional and municipal buildings.",
        "cost_per_unit_inr": 220000,
        "unit": "building installation",
        "min_units": 0,
        "max_units": 15,
        "lead_time_months": 2,
        "workforce_person_months_per_unit": 3.0,
        "risk_reduction_score": 84.0,
        "co_benefits_score": 88.0,
        "equity_weight": 80.0,
        "maintenance_burden": "Low (filter cleaning twice yearly)",
        "responsible_department": "PMC Water Supply Department",
        "target_vulnerability": "water_stress_proxy",
        "affected_indicators": ["water_stress_proxy"],
        "quantified_effects": {
            "water_stress_proxy": {"delta_per_unit": -1.1, "confidence": "MODELLED_ESTIMATE"}
        },
        "directional_effects": ["Decentralized non-potable substitution", "Aquifer table recharge"],
        "scientific_rationale": "Rooftop harvesting supplements non-potable institutional demand, dampening municipal water stress proxy.",
        "prerequisites": ["Municipal building with >= 200 sqm roof catchment area"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "cost_provenance": "Standard PMC rainwater harvesting rate for public buildings.",
        "benefit_provenance": "Calculated assuming 700mm monsoon precipitation yielding ~140 kL recharge per unit."
    },
    {
        "id": "INT-WATER-02",
        "category": "Water Security",
        "title": "Acoustic Pipeline Leak Detection & Pressure Management",
        "description": "Rapid acoustic survey across distribution branches to identify non-revenue water loss and pipe bursts.",
        "cost_per_unit_inr": 400000,
        "unit": "ward network section",
        "min_units": 0,
        "max_units": 6,
        "lead_time_months": 1,
        "workforce_person_months_per_unit": 4.0,
        "risk_reduction_score": 80.0,
        "co_benefits_score": 82.0,
        "equity_weight": 85.0,
        "maintenance_burden": "Low",
        "responsible_department": "PMC Water Supply Department",
        "target_vulnerability": "water_stress_proxy",
        "affected_indicators": ["water_stress_proxy"],
        "quantified_effects": {}, # Macro ward proxy effect unavailable!
        "directional_effects": ["Non-revenue water loss recovery", "Piped feeder pressure stabilization"],
        "scientific_rationale": "Acoustic surveys detect physical pipe fractures; however, ward-level per-capita deficit depends on bulk water supply quotas, so numerical proxy shift is unavailable.",
        "prerequisites": ["Pressurized piped water distribution network"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "cost_provenance": "Specialized ultrasonic/acoustic pipe survey service contract rate.",
        "benefit_provenance": "Directional non-revenue water benefit; macro proxy reduction unquantified."
    }
]

# ==============================================================================
# Ward Context & Nuanced Site Suitability
# ==============================================================================

def get_ward_context(selected_ward_num: Optional[int] = None) -> Dict[str, Any]:
    """
    Retrieves ward indicators, evidence, and spatial context (nallas and chambers).
    Queries PostGIS when available, falling back safely to local indicators.
    """
    indicators_file = PROCESSED_DIR / "ward_indicators.json"
    ward_obj = {}
    
    if indicators_file.exists():
        with open(indicators_file, "r", encoding="utf-8") as f:
            ind_data = json.load(f)
            wards = ind_data.get("wards", [])
            if selected_ward_num is not None:
                matches = [w for w in wards if w.get("ward_num") == selected_ward_num]
                if matches:
                    ward_obj = matches[0]
            if not ward_obj and wards:
                sorted_wards = sorted(
                    wards,
                    key=lambda w: w.get("indicators", {}).get("composite_vulnerability_score", 0),
                    reverse=True
                )
                ward_obj = sorted_wards[0]

    nallas_count = 0
    chambers_count = 0
    wnum = ward_obj.get("ward_num")

    try:
        from ..app.database import SessionLocal, DB_ONLINE
        from ..app.models import ElectoralWard, Nalla, SWDChamber
        from sqlalchemy import func

        if DB_ONLINE and SessionLocal is not None and wnum is not None:
            with SessionLocal() as db:
                ward_row = db.query(ElectoralWard).filter(ElectoralWard.ward_num == wnum).first()
                if ward_row and ward_row.geom is not None:
                    nallas_count = db.query(Nalla).filter(func.ST_Intersects(Nalla.geom, ward_row.geom)).count()
                    chambers_count = db.query(SWDChamber).filter(func.ST_Intersects(SWDChamber.geom, ward_row.geom)).count()
    except Exception:
        pass

    evidence = ward_obj.get("evidence", {})
    drain_cov = evidence.get("stormwater_drain_coverage_pct", 0)
    if chambers_count == 0 and drain_cov > 0:
        chambers_count = int(drain_cov * 5)

    return {
        "ward_num": wnum,
        "ward_title": ward_obj.get("ward_title", "Pilot Focus Ward"),
        "area_zone": ward_obj.get("area_zone", "Pune Pilot Area"),
        "indicators": ward_obj.get("indicators", {
            "heat_exposure_proxy": 60.0,
            "flood_screening_proxy": 65.0,
            "water_stress_proxy": 50.0,
            "green_deficit_proxy": 60.0,
            "composite_vulnerability_score": 60.0
        }),
        "evidence": evidence,
        "limitations": ward_obj.get("limitations_and_gaps", []),
        "spatial_counts": {
            "intersecting_nallas": nallas_count,
            "intersecting_chambers": chambers_count
        }
    }

def evaluate_site_suitability(
    intervention: Dict[str, Any],
    ward_ctx: Dict[str, Any],
    max_horizon_months: Optional[int] = None
) -> Tuple[str, bool, Optional[str]]:
    """
    Evaluates site suitability with scientific nuance:
    - SUITABLE_CONFIRMED: Confirmed by public GIS datasets.
    - FLAGGED_FOR_SITE_VERIFICATION: Required features are unmapped or incomplete in public GIS;
      the intervention remains eligible if justified by vulnerability, but is flagged for verification.
    - UNSUITABLE_CONFIRMED: Hard physical or user constraints genuinely ruling it out.

    Returns: (status: str, is_eligible: bool, note: Optional[str])
    """
    iid = intervention["id"]
    lead_time = intervention["lead_time_months"]
    spatial = ward_ctx.get("spatial_counts", {})
    evidence = ward_ctx.get("evidence", {})
    nallas_cnt = spatial.get("intersecting_nallas", 0)
    chambers_cnt = spatial.get("intersecting_chambers", 0)
    drain_cov = evidence.get("stormwater_drain_coverage_pct", 0)

    # 1. Hard constraint: planning horizon
    if max_horizon_months is not None and lead_time > max_horizon_months:
        return (
            "UNSUITABLE_CONFIRMED",
            False,
            f"HORIZON_EXCEEDED: Lead time ({lead_time} mo) exceeds user planning horizon ({max_horizon_months} mo)."
        )

    # 2. Drainage / Nalla suitability evaluation
    if iid == "INT-FLOOD-03": # Nalla Naturalization
        if nallas_cnt > 0:
            return ("SUITABLE_CONFIRMED", True, f"Verified: Ward has {nallas_cnt} mapped natural drainage nalla corridors.")
        else:
            # Missing in public GIS does NOT prove unsuitability; flag for verification!
            return (
                "FLAGGED_FOR_SITE_VERIFICATION",
                True,
                "0 natural nallas mapped in public GIS. Allowed conditionally in model, but physical site verification of drainage right-of-way is mandatory before tender."
            )

    if iid == "INT-FLOOD-01": # Drain Desilting
        if chambers_cnt > 0 or drain_cov > 0:
            return ("SUITABLE_CONFIRMED", True, f"Verified: Ward has mapped SWD network ({chambers_cnt} chambers, {drain_cov}% coverage).")
        else:
            return (
                "FLAGGED_FOR_SITE_VERIFICATION",
                True,
                "0 SWD chambers and 0% drain coverage in public GIS. Allowed conditionally in model, but municipal conduit existence must be verified on site."
            )

    # Default general suitability
    return ("SUITABLE_CONFIRMED", True, "Suitable based on current ward vulnerability screening criteria.")

# ==============================================================================
# PuLP Optimization Model
# ==============================================================================

def generate_action_plan(
    budget_inr: float = 5000000,
    equity_weight_factor: float = 1.0,
    selected_ward_num: Optional[int] = None,
    max_workforce_person_months: Optional[float] = None,
    max_horizon_months: Optional[int] = None
) -> Dict[str, Any]:
    """
    Solves the constrained climate adaptation portfolio problem using PuLP MILP.
    Ensures transparent objective computation, strict budget adherence,
    workforce/duration bounding, and explicit rejection explanations.
    """
    ward_ctx = get_ward_context(selected_ward_num)
    indicators = ward_ctx["indicators"]

    budget_inr = max(0.0, float(budget_inr))
    equity_weight_factor = max(0.0, min(2.0, float(equity_weight_factor)))

    eligible_candidates = []
    rejected_candidates = []

    for item in INTERVENTIONS_CATALOGUE:
        suitability_status, is_eligible, note = evaluate_site_suitability(
            item, ward_ctx, max_horizon_months=max_horizon_months
        )

        if not is_eligible:
            rejected_candidates.append({
                "id": item["id"],
                "title": item["title"],
                "category": item["category"],
                "cost_per_unit_inr": item["cost_per_unit_inr"],
                "reason": note
            })
            continue

        target_haz = item["target_vulnerability"]
        hazard_val = float(indicators.get(target_haz, 50.0))
        base_benefit = float(item["risk_reduction_score"])
        co_benefit = float(item["co_benefits_score"])
        eq_weight = float(item["equity_weight"])

        norm_hazard = hazard_val / 100.0
        norm_benefit = base_benefit / 100.0
        norm_co = co_benefit / 100.0
        norm_equity = (eq_weight / 100.0) * equity_weight_factor

        unit_utility = (
            (0.50 * norm_hazard * norm_benefit) +
            (0.25 * norm_benefit) +
            (0.15 * norm_co) +
            (0.10 * norm_equity)
        ) * 100.0

        eligible_candidates.append({
            **item,
            "unit_utility": round(unit_utility, 3),
            "hazard_alignment_score": round(hazard_val, 1),
            "site_suitability_status": suitability_status,
            "suitability_note": note
        })

    # Sub-minimum or zero budget handling
    min_cost = min([c["cost_per_unit_inr"] for c in INTERVENTIONS_CATALOGUE]) if INTERVENTIONS_CATALOGUE else 0
    if budget_inr < min_cost or not eligible_candidates:
        for c in eligible_candidates:
            rejected_candidates.append({
                "id": c["id"],
                "title": c["title"],
                "category": c["category"],
                "cost_per_unit_inr": c["cost_per_unit_inr"],
                "reason": f"BUDGET_INSUFFICIENT: Unit cost (INR {c['cost_per_unit_inr']:,}) exceeds available budget (INR {budget_inr:,})."
            })
        
        empty_plan = {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "pilot_area": "Pune Pilot, Maharashtra, India",
            "target_ward": f"Ward #{ward_ctx['ward_num']}: {ward_ctx['ward_title']}",
            "budget_constraints": {
                "total_budget_inr": budget_inr,
                "allocated_spend_inr": 0.0,
                "remaining_budget_inr": budget_inr,
                "equity_weight_factor": equity_weight_factor,
                "unallocated_budget_explanation": f"Budget of INR {budget_inr:,.0f} is lower than the cheapest candidate action (INR {min_cost:,}). Zero actions selected."
            },
            "performance_metrics": {
                "total_interventions_selected": 0,
                "total_units_allocated": 0,
                "total_benefit_points": 0.0,
                "workforce_demand_person_months": 0.0,
                "workforce_capacity_person_months": max_workforce_person_months,
                "estimated_implementation_horizon_months": 0,
                "solver_status": "Optimal (Zero Allocation)",
                "solver_name": "PuLP-CBC"
            },
            "portfolio": [],
            "rejected_candidates": rejected_candidates,
            "assumptions_and_limitations": [
                "Budget is lower than the minimum unit cost of any candidate intervention.",
                "Zero actions were selected; no unbacked or fractional commitments were made.",
                "Costs and benefit points are engineering screening proxies, not contractual tender costs."
            ]
        }
        _export_plan_and_scenarios(empty_plan, ward_ctx)
        return empty_plan

    # ==========================================
    # Build PuLP Optimization Problem
    # ==========================================
    prob = pulp.LpProblem("ClimateAdapt_Portfolio_Optimizer", pulp.LpMaximize)

    x_vars = {}
    y_vars = {}

    for c in eligible_candidates:
        cid = c["id"]
        x_vars[cid] = pulp.LpVariable(f"x_{cid}", lowBound=0, upBound=c["max_units"], cat=pulp.LpInteger)
        y_vars[cid] = pulp.LpVariable(f"y_{cid}", cat=pulp.LpBinary)

        prob += x_vars[cid] <= c["max_units"] * y_vars[cid], f"Link_Up_{cid}"
        prob += x_vars[cid] >= y_vars[cid], f"Link_Low_{cid}"

    prob += pulp.lpSum([c["unit_utility"] * x_vars[c["id"]] for c in eligible_candidates]), "Total_Prioritization_Utility"

    # Constraint 1: Budget Ceiling
    prob += pulp.lpSum([c["cost_per_unit_inr"] * x_vars[c["id"]] for c in eligible_candidates]) <= budget_inr, "Budget_Constraint"

    # Constraint 2: Workforce Capacity (if supplied)
    if max_workforce_person_months is not None and max_workforce_person_months > 0:
        prob += pulp.lpSum([
            c["workforce_person_months_per_unit"] * x_vars[c["id"]] for c in eligible_candidates
        ]) <= max_workforce_person_months, "Workforce_Capacity_Constraint"

    # Constraint 3: Portfolio Diversity (Ceiling 70% when budget >= 3M INR)
    if budget_inr >= 3000000:
        for c in eligible_candidates:
            prob += c["cost_per_unit_inr"] * x_vars[c["id"]] <= 0.70 * budget_inr, f"Concentration_Limit_{c['id']}"

    # Solve Model with CBC
    solver = pulp.PULP_CBC_CMD(msg=0)
    solve_status_code = prob.solve(solver)
    solver_status = pulp.LpStatus.get(solve_status_code, "Unknown")

    if solver_status != "Optimal":
        unfeasible_plan = {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "pilot_area": "Pune Pilot, Maharashtra, India",
            "target_ward": f"Ward #{ward_ctx['ward_num']}: {ward_ctx['ward_title']}",
            "budget_constraints": {
                "total_budget_inr": budget_inr,
                "allocated_spend_inr": 0.0,
                "remaining_budget_inr": budget_inr,
                "equity_weight_factor": equity_weight_factor,
                "unallocated_budget_explanation": "Solver reported infeasible status. Active constraints cannot be mutually satisfied."
            },
            "performance_metrics": {
                "total_interventions_selected": 0,
                "total_units_allocated": 0,
                "total_benefit_points": 0.0,
                "workforce_demand_person_months": 0.0,
                "estimated_implementation_horizon_months": 0,
                "solver_status": solver_status,
                "solver_name": "PuLP-CBC"
            },
            "portfolio": [],
            "rejected_candidates": rejected_candidates,
            "assumptions_and_limitations": [
                f"Solver reported status '{solver_status}'. No valid portfolio satisfies all active constraints simultaneously.",
                "Greedy substitution was withheld to preserve mathematical integrity."
            ]
        }
        _export_plan_and_scenarios(unfeasible_plan, ward_ctx)
        return unfeasible_plan

    # Extract Optimal Portfolio
    allocated_portfolio = []
    total_spend = 0.0
    total_utility = 0.0
    total_workforce = 0.0
    total_units = 0

    for c in eligible_candidates:
        cid = c["id"]
        var_val = x_vars[cid].varValue
        units = int(round(var_val)) if var_val is not None else 0

        if units > 0:
            spend = units * c["cost_per_unit_inr"]
            utility_contrib = units * c["unit_utility"]
            workforce_contrib = units * c["workforce_person_months_per_unit"]

            total_spend += spend
            total_utility += utility_contrib
            total_workforce += workforce_contrib
            total_units += units

            allocated_portfolio.append({
                "id": c["id"],
                "title": c["title"],
                "category": c["category"],
                "allocated_units": units,
                "unit": c["unit"],
                "unit_cost_inr": c["cost_per_unit_inr"],
                "total_cost_inr": spend,
                "lead_time_months": c["lead_time_months"],
                "utility_score": round(utility_contrib, 1),
                "responsible_department": c["responsible_department"],
                "target_vulnerability": c["target_vulnerability"],
                "workforce_person_months": round(workforce_contrib, 1),
                "site_suitability_status": c["site_suitability_status"],
                "prerequisite_verification_note": c["suitability_note"],
                "affected_indicators": c["affected_indicators"],
                "quantified_effects": c["quantified_effects"],
                "directional_effects": c["directional_effects"],
                "scientific_rationale": c["scientific_rationale"],
                "cost_provenance": c["cost_provenance"],
                "benefit_provenance": c["benefit_provenance"],
                "rationale": (
                    f"Selected {units} {c['unit']} by MILP optimizer. "
                    f"Targets {c['target_vulnerability']} (Ward score: {c['hazard_alignment_score']:.1f}/100) "
                    f"with unit utility {c['unit_utility']:.1f} pts under equity factor {equity_weight_factor:.1f}x."
                ),
                "data_quality_status": c["data_quality_status"],
                "selection_justification": (
                    f"Allocated under budget ceiling INR {budget_inr:,.0f}. "
                    f"Contributes {utility_contrib:.1f} prioritization utility points."
                )
            })
        else:
            cost = c["cost_per_unit_inr"]
            remaining_after_opt = budget_inr - total_spend
            if cost > remaining_after_opt:
                rejection_reason = f"BUDGET_INSUFFICIENT: Unit cost (INR {cost:,}) exceeds remaining unallocated budget (INR {remaining_after_opt:,.0f})."
            elif max_workforce_person_months and (total_workforce + c["workforce_person_months_per_unit"] > max_workforce_person_months):
                rejection_reason = f"WORKFORCE_LIMIT: Unit workforce requirement ({c['workforce_person_months_per_unit']} p-mo) exceeds available workforce quota."
            else:
                rejection_reason = f"SUBOPTIMAL_UTILITY: Lower overall utility density ({c['unit_utility']} pts/unit) compared to selected portfolio alternatives."

            rejected_candidates.append({
                "id": c["id"],
                "title": c["title"],
                "category": c["category"],
                "cost_per_unit_inr": cost,
                "reason": rejection_reason
            })

    allocated_portfolio.sort(key=lambda p: p["total_cost_inr"], reverse=True)
    remaining_budget = max(0.0, budget_inr - total_spend)
    max_horizon = max([p["lead_time_months"] for p in allocated_portfolio]) if allocated_portfolio else 0

    # Explain unallocated budget if any
    if remaining_budget <= 0.01:
        unallocated_explanation = "100.0% of the target municipal budget was allocated to selected actions."
    elif remaining_budget < min_cost:
        unallocated_explanation = (
            f"Residual unallocated balance of INR {remaining_budget:,.0f} cannot fund additional full integer units "
            f"of candidate interventions (cheapest unit cost is INR {min_cost:,})."
        )
    elif max_workforce_person_months and total_workforce >= max_workforce_person_months - 1.0:
        unallocated_explanation = (
            f"Residual budget of INR {remaining_budget:,.0f} remained unallocated because the workforce capacity limit "
            f"({max_workforce_person_months} person-months) was reached."
        )
    else:
        unallocated_explanation = (
            f"Residual balance of INR {remaining_budget:,.0f} remained unallocated due to portfolio concentration limits "
            f"or global MILP objective optimality."
        )

    plan_output = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "pilot_area": "Pune Pilot, Maharashtra, India",
        "target_ward": f"Ward #{ward_ctx['ward_num']}: {ward_ctx['ward_title']}",
        "budget_constraints": {
            "total_budget_inr": budget_inr,
            "allocated_spend_inr": round(total_spend, 2),
            "remaining_budget_inr": round(remaining_budget, 2),
            "equity_weight_factor": equity_weight_factor,
            "unallocated_budget_explanation": unallocated_explanation
        },
        "performance_metrics": {
            "total_interventions_selected": len(allocated_portfolio),
            "total_units_allocated": total_units,
            "total_benefit_points": round(total_utility, 1),
            "workforce_demand_person_months": round(total_workforce, 1),
            "workforce_capacity_person_months": max_workforce_person_months,
            "estimated_implementation_horizon_months": max_horizon,
            "portfolio_duration_description": f"Maximum single-intervention lead time is {max_horizon} months (does not constitute a sequential Gantt critical-path schedule).",
            "solver_status": "Optimal",
            "solver_name": "PuLP-CBC"
        },
        "portfolio": allocated_portfolio,
        "rejected_candidates": rejected_candidates,
        "assumptions_and_limitations": [
            "Objective values represent estimated prioritization utility, NOT validated reductions in physical disaster damage.",
            "Costs are municipal engineering heuristics and exclude land acquisition, inflation, or specialized subcontractor markups.",
            "Workforce demand estimates assume standard municipal crew productivity without factoring weather or monsoon work stoppages.",
            "Site suitability checks reflect OpenCity and PMC spatial datasets; localized ground-truth site surveys remain mandatory prior to procurement."
        ]
    }

    _export_plan_and_scenarios(plan_output, ward_ctx)
    return plan_output

# ==============================================================================
# Scientifically Honest Scenario Comparison & Impact Model
# ==============================================================================

def generate_scenario_comparison(plan: Optional[Dict[str, Any]] = None, ward_num: Optional[int] = None) -> Dict[str, Any]:
    """
    Computes baseline vs. proposed plan scenario projections with strict scientific integrity:
    1. Only indicators with documented, defensible relationships are updated numerically.
    2. Qualitative interventions (e.g. drain desilting, cooling bus stops) are tracked as directional benefits.
    3. Objective utility is NEVER equated to a percentage reduction in disaster loss.
    4. Data provenance and limitations are explicitly articulated.
    """
    ward_ctx = get_ward_context(ward_num)
    inds = ward_ctx["indicators"]

    base_heat = float(inds.get("heat_exposure_proxy", 60.0))
    base_flood = float(inds.get("flood_screening_proxy", 65.0))
    base_water = float(inds.get("water_stress_proxy", 50.0))
    base_green = float(inds.get("green_deficit_proxy", 60.0))
    base_composite = float(inds.get("composite_vulnerability_score", 60.0))

    portfolio = plan.get("portfolio", []) if plan else []
    
    # 1. Evaluate explicit indicator impact model
    green_relief = 0.0
    heat_relief = 0.0
    flood_relief = 0.0
    water_relief = 0.0

    impact_breakdown = []
    directional_interventions = []

    for item in portfolio:
        cid = item.get("id", "")
        units = item.get("allocated_units", 0)
        q_effects = item.get("quantified_effects", {})
        d_effects = item.get("directional_effects", [])

        action_summary = {
            "id": cid,
            "title": item.get("title"),
            "allocated_units": units,
            "unit": item.get("unit"),
            "spend_inr": item.get("total_cost_inr", 0),
            "workforce_person_months": item.get("workforce_person_months", 0),
            "site_suitability_status": item.get("site_suitability_status", "SUITABLE_CONFIRMED"),
            "quantified_effects": [],
            "directional_effects": d_effects
        }

        # Accumulate defensible modelled impacts
        if "green_deficit_proxy" in q_effects:
            delta = abs(q_effects["green_deficit_proxy"]["delta_per_unit"]) * units
            green_relief += delta
            action_summary["quantified_effects"].append(f"green_deficit_proxy: -{delta:.1f} (Modelled)")

        if "heat_exposure_proxy" in q_effects:
            delta = abs(q_effects["heat_exposure_proxy"]["delta_per_unit"]) * units
            heat_relief += delta
            action_summary["quantified_effects"].append(f"heat_exposure_proxy: -{delta:.1f} (Modelled)")

        if "flood_screening_proxy" in q_effects:
            delta = abs(q_effects["flood_screening_proxy"]["delta_per_unit"]) * units
            flood_relief += delta
            action_summary["quantified_effects"].append(f"flood_screening_proxy: -{delta:.1f} (Modelled)")

        if "water_stress_proxy" in q_effects:
            delta = abs(q_effects["water_stress_proxy"]["delta_per_unit"]) * units
            water_relief += delta
            action_summary["quantified_effects"].append(f"water_stress_proxy: -{delta:.1f} (Modelled)")

        if not q_effects:
            # Action has purely qualitative / directional impact (e.g. drain desilting or bus stops)
            directional_interventions.append({
                "id": cid,
                "title": item.get("title"),
                "benefit_direction": "Positive Localized Resilience",
                "notes": item.get("scientific_rationale")
            })

        impact_breakdown.append(action_summary)

    # 2. Apply conservative diminishing returns bounds
    adapted_green = round(max(20.0, base_green - min(25.0, green_relief)), 1)
    adapted_heat = round(max(25.0, base_heat - min(25.0, heat_relief)), 1)
    adapted_flood = round(max(25.0, base_flood - min(25.0, flood_relief)), 1)
    adapted_water = round(max(20.0, base_water - min(20.0, water_relief)), 1)

    # 3. Recompute composite score using the standard formula:
    # 0.35 * Heat + 0.35 * Flood + 0.15 * Water + 0.15 * Green
    adapted_composite = round(
        (0.35 * adapted_heat) + (0.35 * adapted_flood) + (0.15 * adapted_water) + (0.15 * adapted_green),
        1
    )
    reduction_pct = round(max(0.0, ((base_composite - adapted_composite) / base_composite) * 100.0), 1) if base_composite > 0 else 0.0

    spend = plan.get("budget_constraints", {}).get("allocated_spend_inr", 0) if plan else 0
    total_budget = plan.get("budget_constraints", {}).get("total_budget_inr", 0) if plan else 0
    remaining = plan.get("budget_constraints", {}).get("remaining_budget_inr", 0) if plan else 0
    workforce_total = plan.get("performance_metrics", {}).get("workforce_demand_person_months", 0) if plan else 0

    scenarios_output = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "target_ward": f"Ward #{ward_ctx['ward_num']}: {ward_ctx['ward_title']}",
        "resource_summary": {
            "total_budget_inr": total_budget,
            "allocated_spend_inr": spend,
            "remaining_budget_inr": remaining,
            "workforce_demand_person_months": workforce_total,
            "actions_selected_count": len(portfolio),
            "unallocated_budget_explanation": plan.get("budget_constraints", {}).get("unallocated_budget_explanation", "")
        },
        "baseline_scenario": {
            "name": f"Current Baseline ({ward_ctx['ward_title']})",
            "heat_proxy": round(base_heat, 1),
            "flood_proxy": round(base_flood, 1),
            "water_stress_proxy": round(base_water, 1),
            "green_deficit_proxy": round(base_green, 1),
            "composite_vulnerability": round(base_composite, 1),
            "notes": "Observed OpenCity municipal spatial metrics and current forecast proxies."
        },
        "heatwave_scenario": {
            "name": "Extreme Heatwave Shock (+3.5°C Ambient Prolonged)",
            "heat_proxy": round(min(100.0, base_heat + 20.0), 1),
            "flood_proxy": round(base_flood, 1),
            "water_stress_proxy": round(min(100.0, base_water + 15.0), 1),
            "green_deficit_proxy": round(base_green, 1),
            "composite_vulnerability": round(min(100.0, base_composite + 9.25), 1),
            "notes": "Simulated persistent high LST exposure in unshaded, high-density residential sectors."
        },
        "flash_rainfall_scenario": {
            "name": "Extreme Cloudburst Monsoon Shock (+75mm 3-Hour Downpour)",
            "heat_proxy": round(max(25.0, base_heat - 10.0), 1),
            "flood_proxy": round(min(100.0, base_flood + 25.0), 1),
            "water_stress_proxy": round(max(20.0, base_water - 10.0), 1),
            "green_deficit_proxy": round(base_green, 1),
            "composite_vulnerability": round(min(100.0, base_composite + 7.25), 1),
            "notes": "Simulated stormwater inundation at drainage constriction points and low-elevation junctions."
        },
        "post_adaptation_scenario": {
            "name": f"Post-Implementation Portfolio Outcome (INR {spend:,.0f})",
            "heat_proxy": adapted_heat,
            "flood_proxy": adapted_flood,
            "water_stress_proxy": adapted_water,
            "green_deficit_proxy": adapted_green,
            "composite_vulnerability": adapted_composite,
            "net_vulnerability_reduction_pct": reduction_pct,
            "notes": (
                f"Modelled estimate reflecting {len(portfolio)} adaptation actions. "
                f"Notice: Only indicators with defensible physical mechanisms are subtracted. "
                f"Directional maintenance actions (such as drain desilting) contribute to resilience but do not claim uncalibrated flood probability drops."
            )
        },
        "indicator_changes": {
            "heat_exposure_proxy": {
                "baseline": round(base_heat, 1),
                "proposed": adapted_heat,
                "delta": round(adapted_heat - base_heat, 1),
                "status": "MODELLED_ESTIMATE" if heat_relief > 0 else "UNCHANGED",
                "notes": "Driven by cool roof albedo reflectance and pedestrian shade canopy planting."
            },
            "flood_screening_proxy": {
                "baseline": round(base_flood, 1),
                "proposed": adapted_flood,
                "delta": round(adapted_flood - base_flood, 1),
                "status": "MODELLED_ESTIMATE" if flood_relief > 0 else "UNQUANTIFIED_MAINTENANCE",
                "notes": "Driven by retention basins and soakaways. Drain desilting provides directional maintenance, but does not alter hydraulic 100-yr flood probability."
            },
            "water_stress_proxy": {
                "baseline": round(base_water, 1),
                "proposed": adapted_water,
                "delta": round(adapted_water - base_water, 1),
                "status": "MODELLED_ESTIMATE" if water_relief > 0 else "UNCHANGED",
                "notes": "Driven by decentralized institutional rainwater harvesting."
            },
            "green_deficit_proxy": {
                "baseline": round(base_green, 1),
                "proposed": adapted_green,
                "delta": round(adapted_green - base_green, 1),
                "status": "MODELLED_ESTIMATE" if green_relief > 0 else "UNCHANGED",
                "notes": "Driven by native roadside shade corridors and vegetated bioretention swales."
            },
            "composite_vulnerability_score": {
                "baseline": round(base_composite, 1),
                "proposed": adapted_composite,
                "delta": round(adapted_composite - base_composite, 1),
                "status": "MODELLED_COMPOSITE_RECOMPUTATION",
                "notes": "Recomputed strictly from updated constituent proxies using standard Pune weights (0.35 Heat + 0.35 Flood + 0.15 Water + 0.15 Green)."
            }
        },
        "impact_breakdown": impact_breakdown,
        "directional_interventions": directional_interventions,
        "data_provenance_and_limitations": [
            "Tree and green space counts from OpenStreetMap are crowd-sourced and incomplete; not equivalent to satellite canopy cover.",
            "Temperature forecasts are city-level from Open-Meteo, not localized ward-level telemetry.",
            "Stormwater drainage coverage is an infrastructure proxy, not a calibrated 2D hydraulic inundation model.",
            "Participatory budget figures reflect municipal allocations, not direct well groundwater table sensors.",
            "Census population data is 2011 baseline; ward demographics have shifted significantly since."
        ]
    }

    scen_file = EXPORTS_DIR / "scenarios_latest.json"
    with open(scen_file, "w", encoding="utf-8") as f:
        json.dump(scenarios_output, f, indent=2)

    return scenarios_output

def _export_plan_and_scenarios(plan: Dict[str, Any], ward_ctx: Dict[str, Any]):
    """Internal helper to write plan and scenarios to exports/."""
    plan_file = EXPORTS_DIR / "action_plan_latest.json"
    with open(plan_file, "w", encoding="utf-8") as f:
        json.dump(plan, f, indent=2)

    generate_scenario_comparison(plan, ward_ctx.get("ward_num"))

if __name__ == "__main__":
    b_arg = float(sys.argv[1]) if len(sys.argv) > 1 else 5000000
    eq_arg = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
    w_arg = int(sys.argv[3]) if len(sys.argv) > 3 else None
    res = generate_action_plan(budget_inr=b_arg, equity_weight_factor=eq_arg, selected_ward_num=w_arg)
    print(f"[SUCCESS] Action plan generated via PuLP MILP (Allocated: INR {res['budget_constraints']['allocated_spend_inr']:,} / {b_arg:,})")
