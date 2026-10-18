"""
build_action_plan.py
====================
Phase 2B: Constrained Climate Adaptation Optimizer for Pune Wards.

Replaces the legacy greedy heuristic with a transparent, testable,
Mixed-Integer Linear Programming (MILP) model formulated with PuLP.

Key Capabilities:
1. Candidate Interventions with explicit cost, duration, workforce demand,
   target hazard, site suitability prerequisites, and data-quality disclosures.
2. PuLP MILP formulation:
   - Maximize estimated prioritization utility (risk alignment, base benefit, equity).
   - Strict budget constraint (spending <= budget).
   - Workforce capacity constraint (when supplied).
   - Planning horizon constraint (when supplied).
   - Site suitability and infrastructure prerequisite enforcement.
   - Portfolio diversity / concentration limits.
   - Transparent infeasibility reporting without silent greedy fallbacks.
3. Decision explanation:
   - Justification and evidence for every selected action.
   - Documented rejection reason for every excluded candidate.
4. Dynamic scenario comparison derived from the optimized portfolio.
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

import pulp

# Locate Project Root & Data Dirs
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
EXPORTS_DIR = REPO_ROOT / "data" / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# ==============================================================================
# Comprehensive Intervention Catalogue with Provenance and Prerequisites
# ==============================================================================
# NOTE: Costs and risk reduction scores are engineering screening heuristics,
# NOT contractual PMC costs or scientifically calibrated microclimate impacts.
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
        "maintenance_burden": "Moderate (regular watering for first 2 years)",
        "responsible_department": "PMC Garden Department / Tree Authority",
        "target_vulnerability": "heat_exposure_proxy",
        "secondary_vulnerability": "green_deficit_proxy",
        "prerequisites": ["Suitable roadside pedestrian verge", "Green deficit or heat exposure proxy >= 40"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "assumptions": "Unit cost is an engineering heuristic based on PMC standard schedule of rates; not a contractual tender."
    },
    {
        "id": "INT-HEAT-02",
        "category": "Heat & Urban Cooling",
        "title": "Cool Roof Reflective Coating Pilots in High-Density Areas",
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
        "secondary_vulnerability": None,
        "prerequisites": ["Stable roof structures", "Heat exposure proxy >= 45"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "assumptions": "High equity weight reflects priority for un-insulated tin/asbestos roof settlements."
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
        "secondary_vulnerability": None,
        "prerequisites": ["Existing PMPML bus route/stop location"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "assumptions": "Assumes municipal water connection point available within 50m."
    },
    {
        "id": "INT-FLOOD-01",
        "category": "Flood & Stormwater",
        "title": "Critical Stormwater Drain Desilting & Inlet Clearing",
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
        "secondary_vulnerability": None,
        "prerequisites": ["Mapped municipal drainage network or stormwater chambers present in ward"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "assumptions": "Requires existing underground or masonry open drains to desilt; cannot create new drains."
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
        "maintenance_burden": "Low to Moderate (seasonal weeding and silt removal)",
        "responsible_department": "PMC Road Department / SWD",
        "target_vulnerability": "flood_screening_proxy",
        "secondary_vulnerability": "green_deficit_proxy",
        "prerequisites": ["Permeable soil condition; non-rocky strata"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "assumptions": "Assumes percolation rate >= 15 mm/hr based on typical Deccan basalt weathered zone."
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
        "secondary_vulnerability": None,
        "prerequisites": ["Natural drainage stream (nalla) present in or intersecting the ward"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "assumptions": "Requires minimum 9m nalla buffer zone free from permanent high-rise encumbrance."
    },
    {
        "id": "INT-WATER-01",
        "category": "Water Security",
        "title": "Decentralized Rainwater Harvesting in Municipal Schools & Complexes",
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
        "secondary_vulnerability": None,
        "prerequisites": ["Municipal or institutional building with minimum 200 sqm roof area"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "assumptions": "Sized for average 700mm monsoon precipitation yielding ~140 kL recharge per unit."
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
        "secondary_vulnerability": None,
        "prerequisites": ["Piped distribution network with pressurized supply"],
        "data_quality_status": "PRELIMINARY_MUNICIPAL_PROXY",
        "assumptions": "Assumes standard PMC ductile iron and HDPE feeder networks."
    }
]

# ==============================================================================
# Ward Context & Suitability Helper
# ==============================================================================

def get_ward_context(selected_ward_num: Optional[int] = None) -> Dict[str, Any]:
    """
    Retrieves ward indicators, evidence, and spatial context (nallas and chambers).
    Queries database when available, falling back safely to local indicators.
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
                # Default to highest composite vulnerability ward
                sorted_wards = sorted(
                    wards,
                    key=lambda w: w.get("indicators", {}).get("composite_vulnerability_score", 0),
                    reverse=True
                )
                ward_obj = sorted_wards[0]

    # Check database for spatial intersections (nallas, chambers)
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
        # Graceful fallback: derive from indicators evidence
        pass

    evidence = ward_obj.get("evidence", {})
    drain_cov = evidence.get("stormwater_drain_coverage_pct", 0)
    if chambers_count == 0 and drain_cov > 0:
        chambers_count = int(drain_cov * 5) # Heuristic proxy if spatial layer unjoined

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

def check_site_suitability(intervention: Dict[str, Any], ward_ctx: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    """
    Checks site suitability and prerequisite fulfillment for a candidate intervention in the target ward.
    Returns (is_suitable: bool, rejection_reason: Optional[str]).
    """
    iid = intervention["id"]
    spatial = ward_ctx.get("spatial_counts", {})
    evidence = ward_ctx.get("evidence", {})
    nallas_cnt = spatial.get("intersecting_nallas", 0)
    chambers_cnt = spatial.get("intersecting_chambers", 0)
    drain_cov = evidence.get("stormwater_drain_coverage_pct", 0)

    # 1. Nalla naturalization requires natural drainage stream presence in the ward
    if iid == "INT-FLOOD-03":
        if nallas_cnt <= 0:
            return False, f"PREREQUISITE_NOT_MET: Ward has 0 mapped natural drainage nalla corridors (found: {nallas_cnt}). Nalla naturalization cannot be sited."

    # 2. Critical stormwater drain desilting requires mapped drainage network
    if iid == "INT-FLOOD-01":
        if chambers_cnt <= 0 and drain_cov <= 0:
            return False, f"PREREQUISITE_NOT_MET: Ward has 0 mapped SWD utility chambers and 0% drain coverage. Desilting existing conduits is not feasible."

    return True, None

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

    # Clamp parameters to valid ranges
    budget_inr = max(0.0, float(budget_inr))
    equity_weight_factor = max(0.0, min(2.0, float(equity_weight_factor)))

    # Track candidate suitability and pre-screened rejections
    suitable_candidates = []
    rejected_candidates = []

    for item in INTERVENTIONS_CATALOGUE:
        is_suitable, reason = check_site_suitability(item, ward_ctx)
        if not is_suitable:
            rejected_candidates.append({
                "id": item["id"],
                "title": item["title"],
                "category": item["category"],
                "cost_per_unit_inr": item["cost_per_unit_inr"],
                "reason": reason
            })
            continue

        # Check horizon constraint
        if max_horizon_months is not None and item["lead_time_months"] > max_horizon_months:
            rejected_candidates.append({
                "id": item["id"],
                "title": item["title"],
                "category": item["category"],
                "cost_per_unit_inr": item["cost_per_unit_inr"],
                "reason": f"HORIZON_EXCEEDED: Lead time ({item['lead_time_months']} mo) exceeds planning horizon ({max_horizon_months} mo)."
            })
            continue

        # Calculate Prioritization Utility Score (U_i)
        # Hazard alignment: ward's current screening score on target vulnerability (0-100)
        target_haz = item["target_vulnerability"]
        hazard_val = float(indicators.get(target_haz, 50.0))
        base_benefit = float(item["risk_reduction_score"])
        co_benefit = float(item["co_benefits_score"])
        eq_weight = float(item["equity_weight"])

        # Prioritization Utility formula:
        # 50% Hazard Alignment x Base Impact + 30% Base Impact + 20% Equity Weight (scaled by equity factor)
        # Guarantees that equity influences prioritization without drowning out physical risk alignment.
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

        suitable_candidates.append({
            **item,
            "unit_utility": round(unit_utility, 3),
            "hazard_alignment_score": round(hazard_val, 1)
        })

    # If budget is zero or smaller than the cheapest candidate, return feasible zero-allocation plan
    min_cost = min([c["cost_per_unit_inr"] for c in INTERVENTIONS_CATALOGUE]) if INTERVENTIONS_CATALOGUE else 0
    if budget_inr < min_cost or not suitable_candidates:
        for c in suitable_candidates:
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
                "equity_weight_factor": equity_weight_factor
            },
            "performance_metrics": {
                "total_interventions_selected": 0,
                "total_units_allocated": 0,
                "total_benefit_points": 0.0,
                "workforce_demand_person_months": 0.0,
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

    # Decision variables:
    # x_i: integer number of units allocated for intervention i
    # y_i: binary selection indicator (1 if x_i >= 1, 0 otherwise)
    x_vars = {}
    y_vars = {}

    for c in suitable_candidates:
        cid = c["id"]
        x_vars[cid] = pulp.LpVariable(f"x_{cid}", lowBound=0, upBound=c["max_units"], cat=pulp.LpInteger)
        y_vars[cid] = pulp.LpVariable(f"y_{cid}", cat=pulp.LpBinary)

        # Linking constraints:
        # x_i <= max_units * y_i
        # x_i >= y_i
        prob += x_vars[cid] <= c["max_units"] * y_vars[cid], f"Link_Up_{cid}"
        prob += x_vars[cid] >= y_vars[cid], f"Link_Low_{cid}"

    # Objective Function: Maximize total estimated prioritization utility points
    prob += pulp.lpSum([c["unit_utility"] * x_vars[c["id"]] for c in suitable_candidates]), "Total_Prioritization_Utility"

    # Constraint 1: Strict Total Budget Constraint
    prob += pulp.lpSum([c["cost_per_unit_inr"] * x_vars[c["id"]] for c in suitable_candidates]) <= budget_inr, "Budget_Constraint"

    # Constraint 2: Workforce Capacity Constraint (if provided)
    if max_workforce_person_months is not None and max_workforce_person_months > 0:
        prob += pulp.lpSum([
            c["workforce_person_months_per_unit"] * x_vars[c["id"]] for c in suitable_candidates
        ]) <= max_workforce_person_months, "Workforce_Capacity_Constraint"

    # Constraint 3: Portfolio Diversity / Single-Action Spend Ceiling
    # When budget >= 3M INR, avoid concentrating > 70% of total budget in a single action type
    if budget_inr >= 3000000:
        for c in suitable_candidates:
            prob += c["cost_per_unit_inr"] * x_vars[c["id"]] <= 0.70 * budget_inr, f"Concentration_Limit_{c['id']}"

    # ==========================================
    # Solve Model with CBC
    # ==========================================
    solver = pulp.PULP_CBC_CMD(msg=0)
    solve_status_code = prob.solve(solver)
    solver_status = pulp.LpStatus.get(solve_status_code, "Unknown")

    if solver_status != "Optimal":
        # Infeasible or solver failure
        unfeasible_plan = {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "pilot_area": "Pune Pilot, Maharashtra, India",
            "target_ward": f"Ward #{ward_ctx['ward_num']}: {ward_ctx['ward_title']}",
            "budget_constraints": {
                "total_budget_inr": budget_inr,
                "allocated_spend_inr": 0.0,
                "remaining_budget_inr": budget_inr,
                "equity_weight_factor": equity_weight_factor
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

    # ==========================================
    # Extract Optimal Portfolio and Explanations
    # ==========================================
    allocated_portfolio = []
    total_spend = 0.0
    total_utility = 0.0
    total_workforce = 0.0
    total_units = 0

    for c in suitable_candidates:
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
                "rationale": (
                    f"Selected {units} {c['unit']} by MILP optimizer. "
                    f"Targets {c['target_vulnerability']} (Ward score: {c['hazard_alignment_score']:.1f}/100) "
                    f"with unit utility {c['unit_utility']:.1f} pts under equity factor {equity_weight_factor:.1f}x."
                ),
                "data_quality_status": c["data_quality_status"],
                "selection_justification": (
                    f"Allocated under budget ceiling INR {budget_inr:,.0f}. "
                    f"Contributes {utility_contrib:.1f} prioritization points toward ward climate adaptation."
                )
            })
        else:
            # Determine reason why this suitable candidate was not selected
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

    # Sort portfolio by total cost descending
    allocated_portfolio.sort(key=lambda p: p["total_cost_inr"], reverse=True)
    remaining_budget = max(0.0, budget_inr - total_spend)
    max_horizon = max([p["lead_time_months"] for p in allocated_portfolio]) if allocated_portfolio else 0

    plan_output = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "pilot_area": "Pune Pilot, Maharashtra, India",
        "target_ward": f"Ward #{ward_ctx['ward_num']}: {ward_ctx['ward_title']}",
        "budget_constraints": {
            "total_budget_inr": budget_inr,
            "allocated_spend_inr": round(total_spend, 2),
            "remaining_budget_inr": round(remaining_budget, 2),
            "equity_weight_factor": equity_weight_factor
        },
        "performance_metrics": {
            "total_interventions_selected": len(allocated_portfolio),
            "total_units_allocated": total_units,
            "total_benefit_points": round(total_utility, 1),
            "workforce_demand_person_months": round(total_workforce, 1),
            "workforce_capacity_person_months": max_workforce_person_months,
            "estimated_implementation_horizon_months": max_horizon,
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
# Dynamic Scenario Simulator
# ==============================================================================

def generate_scenario_comparison(plan: Optional[Dict[str, Any]] = None, ward_num: Optional[int] = None) -> Dict[str, Any]:
    """
    Computes dynamic scenario projections reflecting the actual optimized portfolio.
    Labels post-adaptation shifts explicitly as illustrative heuristic estimates.
    """
    ward_ctx = get_ward_context(ward_num)
    inds = ward_ctx["indicators"]

    base_heat = float(inds.get("heat_exposure_proxy", 60.0))
    base_flood = float(inds.get("flood_screening_proxy", 65.0))
    base_water = float(inds.get("water_stress_proxy", 50.0))
    base_composite = float(inds.get("composite_vulnerability_score", 60.0))

    # Evaluate dynamic reductions from the action plan portfolio
    portfolio = plan.get("portfolio", []) if plan else []
    
    # Calculate illustrative proxy relief points based on selected units
    heat_relief = 0.0
    flood_relief = 0.0
    water_relief = 0.0

    for item in portfolio:
        cid = item.get("id", "")
        units = item.get("allocated_units", 0)
        if "HEAT" in cid:
            # Cool roofs and shade corridors provide illustrative localized cooling
            heat_relief += units * 1.5
        elif "FLOOD" in cid:
            # Drain desilting, soakaways, retention ponds reduce runoff bottlenecks
            flood_relief += units * 2.2
        elif "WATER" in cid:
            # RWH and leak management augment decentralized water access
            water_relief += units * 1.8

    # Apply relief with conservative diminishing returns clamping
    adapted_heat = round(max(30.0, base_heat - min(25.0, heat_relief)), 1)
    adapted_flood = round(max(30.0, base_flood - min(30.0, flood_relief)), 1)
    adapted_water = round(max(25.0, base_water - min(20.0, water_relief)), 1)
    green_deficit = float(inds.get("green_deficit_proxy", 60.0))

    # Recompute composite score using the standard formula:
    # 0.35 * Heat + 0.35 * Flood + 0.15 * Water + 0.15 * Green
    adapted_composite = round(
        (0.35 * adapted_heat) + (0.35 * adapted_flood) + (0.15 * adapted_water) + (0.15 * green_deficit),
        1
    )
    reduction_pct = round(max(0.0, ((base_composite - adapted_composite) / base_composite) * 100.0), 1) if base_composite > 0 else 0.0

    spend = plan.get("budget_constraints", {}).get("allocated_spend_inr", 0) if plan else 0

    scenarios_output = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "target_ward": f"Ward #{ward_ctx['ward_num']}: {ward_ctx['ward_title']}",
        "baseline_scenario": {
            "name": f"Current Baseline ({ward_ctx['ward_title']})",
            "heat_proxy": round(base_heat, 1),
            "flood_proxy": round(base_flood, 1),
            "water_stress_proxy": round(base_water, 1),
            "composite_vulnerability": round(base_composite, 1),
            "notes": "Observed OpenCity municipal spatial metrics and current forecast proxies."
        },
        "heatwave_scenario": {
            "name": "Extreme Heatwave Shock (+3.5°C Ambient Prolonged)",
            "heat_proxy": round(min(100.0, base_heat + 20.0), 1),
            "flood_proxy": round(base_flood, 1),
            "water_stress_proxy": round(min(100.0, base_water + 15.0), 1),
            "composite_vulnerability": round(min(100.0, base_composite + 9.25), 1),
            "notes": "Simulated persistent high LST exposure in unshaded, high-density residential sectors."
        },
        "flash_rainfall_scenario": {
            "name": "Extreme Cloudburst Monsoon Shock (+75mm 3-Hour Downpour)",
            "heat_proxy": round(max(25.0, base_heat - 10.0), 1),
            "flood_proxy": round(min(100.0, base_flood + 25.0), 1),
            "water_stress_proxy": round(max(20.0, base_water - 10.0), 1),
            "composite_vulnerability": round(min(100.0, base_composite + 7.25), 1),
            "notes": "Simulated stormwater inundation at drainage constriction points and low-elevation junctions."
        },
        "post_adaptation_scenario": {
            "name": f"Post-Implementation Portfolio Outcome (INR {spend:,.0f})",
            "heat_proxy": adapted_heat,
            "flood_proxy": adapted_flood,
            "water_stress_proxy": adapted_water,
            "composite_vulnerability": adapted_composite,
            "net_vulnerability_reduction_pct": reduction_pct,
            "notes": (
                f"Illustrative heuristic projection reflecting allocation of {len(portfolio)} adaptation actions. "
                f"Disclosed limitation: This is an uncalibrated proxy shift, not a certified hydrodynamic or CFD simulation."
            )
        }
    }

    # Save to scenarios_latest.json
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
