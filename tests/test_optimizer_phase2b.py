"""
test_optimizer_phase2b.py
=========================
Phase 2B Test Suite for Climaid:
- Strict budget adherence across varying budget magnitudes
- Zero and sub-minimum budget handling (clean empty plan without crash)
- Workforce capacity constraint enforcement
- Planning horizon constraint enforcement
- Site suitability & prerequisite enforcement (e.g., nalla presence)
- Traceable impact of equity weighting factor
- Solver status reporting and transparent objective calculation
- Mandatory disclosure of data limitations and assumptions
- FastAPI API compatibility with React frontend contracts
"""

import unittest
import requests
from pathlib import Path

from backend.scripts.build_action_plan import (
    generate_action_plan,
    generate_scenario_comparison,
    INTERVENTIONS_CATALOGUE
)

API_BASE = "http://127.0.0.1:8000"


class TestConstrainedOptimizer(unittest.TestCase):
    def test_budget_never_exceeded_across_magnitudes(self):
        """Total allocated spend must never exceed the specified budget constraint."""
        test_budgets = [200000, 500000, 1200000, 3500000, 5000000, 12000000, 20000000]
        for budget in test_budgets:
            plan = generate_action_plan(budget_inr=budget, equity_weight_factor=1.0)
            allocated = plan["budget_constraints"]["allocated_spend_inr"]
            remaining = plan["budget_constraints"]["remaining_budget_inr"]
            
            self.assertLessEqual(allocated, budget, f"Allocated {allocated} exceeded budget {budget}")
            self.assertGreaterEqual(remaining, 0.0, f"Remaining budget {remaining} cannot be negative")
            self.assertAlmostEqual(allocated + remaining, budget, delta=1.0)

    def test_zero_and_sub_minimum_budget_returns_valid_empty_plan(self):
        """Zero budget or budget below cheapest action returns valid empty plan without crash."""
        # Zero budget
        plan_zero = generate_action_plan(budget_inr=0, equity_weight_factor=1.0)
        self.assertEqual(plan_zero["budget_constraints"]["allocated_spend_inr"], 0.0)
        self.assertEqual(len(plan_zero["portfolio"]), 0)
        self.assertEqual(plan_zero["performance_metrics"]["total_units_allocated"], 0)
        self.assertIn("Zero Allocation", plan_zero["performance_metrics"]["solver_status"])

        # Sub-minimum budget (INR 50,000, less than cheapest action INR 120,000)
        plan_small = generate_action_plan(budget_inr=50000, equity_weight_factor=1.0)
        self.assertEqual(plan_small["budget_constraints"]["allocated_spend_inr"], 0.0)
        self.assertEqual(len(plan_small["portfolio"]), 0)
        self.assertGreater(len(plan_small["rejected_candidates"]), 0)
        reasons = [rej["reason"] for rej in plan_small["rejected_candidates"]]
        self.assertTrue(any("BUDGET_INSUFFICIENT" in r for r in reasons))

    def test_workforce_capacity_constraint_respected(self):
        """Optimizer strictly enforces workforce person-month quota when supplied."""
        quota = 15.0  # Limit to 15 person-months
        plan = generate_action_plan(
            budget_inr=8000000,
            equity_weight_factor=1.0,
            max_workforce_person_months=quota
        )
        total_workforce = plan["performance_metrics"]["workforce_demand_person_months"]
        self.assertLessEqual(
            total_workforce,
            quota,
            f"Workforce demand {total_workforce} exceeded quota {quota}"
        )

    def test_planning_horizon_constraint_respected(self):
        """Interventions with lead times exceeding max_horizon_months are excluded."""
        # 1-month horizon: actions requiring > 1 month (e.g. 2mo, 3mo, 6mo) cannot be selected
        plan = generate_action_plan(
            budget_inr=5000000,
            equity_weight_factor=1.0,
            max_horizon_months=1
        )
        for item in plan["portfolio"]:
            self.assertLessEqual(
                item["lead_time_months"],
                1,
                f"Action {item['id']} lead time {item['lead_time_months']} exceeded horizon 1 mo"
            )

    def test_site_suitability_nuanced_nalla_flagging(self):
        """
        Phase 2C nuanced suitability: INT-FLOOD-03 in a 0-nalla ward must be
        FLAGGED_FOR_SITE_VERIFICATION (eligible for planning), NOT hard-rejected.
        Mandatory pre-procurement verification note must be attached.
        """
        plan = generate_action_plan(
            budget_inr=10000000,
            equity_weight_factor=1.0,
            selected_ward_num=19
        )
        # If selected, INT-FLOOD-03 must carry a FLAGGED_FOR_SITE_VERIFICATION status
        portfolio_item = next(
            (p for p in plan["portfolio"] if p["id"] == "INT-FLOOD-03"), None
        )
        if portfolio_item is not None:
            self.assertEqual(
                portfolio_item["site_suitability_status"],
                "FLAGGED_FOR_SITE_VERIFICATION",
                "INT-FLOOD-03 in 0-nalla ward must be flagged, not confirmed"
            )
            self.assertIn(
                "verification",
                portfolio_item.get("prerequisite_verification_note", "").lower(),
                "Flagged item must carry a mandatory verification notice"
            )
        else:
            # If not selected, it must be in rejected_candidates due to budget/utility,
            # NOT because of PREREQUISITE_NOT_MET (the Phase 2C rule)
            rejected_reasons = {r["id"]: r["reason"] for r in plan["rejected_candidates"]}
            if "INT-FLOOD-03" in rejected_reasons:
                self.assertNotIn(
                    "PREREQUISITE_NOT_MET",
                    rejected_reasons["INT-FLOOD-03"],
                    "Phase 2C must not hard-reject INT-FLOOD-03 purely for missing GIS nalla data"
                )

    def test_equity_weighting_traceably_influences_objective(self):
        """Varying equity factor between 0.0 and 2.0 changes utility and priority traceably."""
        plan_eq0 = generate_action_plan(budget_inr=2000000, equity_weight_factor=0.0)
        plan_eq2 = generate_action_plan(budget_inr=2000000, equity_weight_factor=2.0)

        # High-equity intervention (INT-HEAT-02, equity weight 95)
        eq0_utility = next((p["utility_score"] for p in plan_eq0["portfolio"] if p["id"] == "INT-HEAT-02"), None)
        eq2_utility = next((p["utility_score"] for p in plan_eq2["portfolio"] if p["id"] == "INT-HEAT-02"), None)

        if eq0_utility and eq2_utility:
            self.assertGreater(
                eq2_utility,
                eq0_utility,
                "Equity factor 2.0 must produce higher utility for high-equity action than factor 0.0"
            )

    def test_mandatory_disclosures_and_limitations_present(self):
        """Assumptions, limitations, and data quality tags are explicitly returned."""
        plan = generate_action_plan(budget_inr=5000000)
        self.assertIn("assumptions_and_limitations", plan)
        self.assertGreater(len(plan["assumptions_and_limitations"]), 0)
        for item in plan["portfolio"]:
            self.assertIn("data_quality_status", item)
            self.assertIn("selection_justification", item)

    def test_dynamic_scenario_generation(self):
        """Scenarios dynamically reflect the selected portfolio rather than hardcoded statics."""
        plan = generate_action_plan(budget_inr=5000000)
        scen = generate_scenario_comparison(plan=plan)

        self.assertIn("baseline_scenario", scen)
        self.assertIn("heatwave_scenario", scen)
        self.assertIn("flash_rainfall_scenario", scen)
        self.assertIn("post_adaptation_scenario", scen)

        # Post-adaptation vulnerability must be lower than or equal to baseline
        base_comp = scen["baseline_scenario"]["composite_vulnerability"]
        post_comp = scen["post_adaptation_scenario"]["composite_vulnerability"]
        self.assertLessEqual(post_comp, base_comp)
        # Notes must include the scientific-honesty disclosure about directional maintenance actions
        post_notes = scen["post_adaptation_scenario"]["notes"].lower()
        self.assertTrue(
            "directional" in post_notes or "drain" in post_notes or "uncalibrated" in post_notes,
            "Post-adaptation notes must contain scientific-honesty disclosure about directional/uncalibrated impacts"
        )


class TestFastAPIActionPlanEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            r = requests.get(f"{API_BASE}/health", timeout=3)
            cls.server_online = (r.status_code == 200)
        except Exception:
            cls.server_online = False

    def setUp(self):
        if not self.server_online:
            self.skipTest("FastAPI server not reachable on localhost:8000")

    def test_post_action_plans_endpoint(self):
        """POST /api/action-plans executes optimizer and conforms to Pydantic schema."""
        payload = {
            "budget_inr": 6000000,
            "equity_weight_factor": 1.2,
            "selected_ward_num": 1
        }
        r = requests.post(f"{API_BASE}/api/action-plans", json=payload, timeout=5)
        self.assertEqual(r.status_code, 200)
        data = r.json()

        self.assertIn("budget_constraints", data)
        self.assertIn("performance_metrics", data)
        self.assertIn("portfolio", data)
        self.assertEqual(data["performance_metrics"]["solver_status"], "Optimal")
        self.assertLessEqual(data["budget_constraints"]["allocated_spend_inr"], 6000000)

    def test_post_scenarios_compare_endpoint(self):
        """POST /api/scenarios/compare returns dynamic scenarios."""
        r = requests.post(f"{API_BASE}/api/scenarios/compare", timeout=5)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("baseline_scenario", data)
        self.assertIn("post_adaptation_scenario", data)


if __name__ == "__main__":
    unittest.main()
