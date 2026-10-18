import unittest
from backend.scripts.build_action_plan import (
    generate_action_plan,
    generate_scenario_comparison,
    INTERVENTIONS_CATALOGUE,
    evaluate_site_suitability,
)


class TestScenarioStructure(unittest.TestCase):
    def setUp(self):
        self.plan = generate_action_plan(budget_inr=5000000, equity_weight_factor=1.0)
        self.scen = generate_scenario_comparison(plan=self.plan)

    def test_all_scenario_keys_present(self):
        for key in ["baseline_scenario", "heatwave_scenario", "flash_rainfall_scenario",
                    "post_adaptation_scenario", "indicator_changes", "resource_summary",
                    "data_provenance_and_limitations"]:
            self.assertIn(key, self.scen)

    def test_each_scenario_has_required_fields(self):
        for key in ["baseline_scenario", "heatwave_scenario", "flash_rainfall_scenario"]:
            s = self.scen[key]
            for field in ["name", "composite_vulnerability", "notes"]:
                self.assertIn(field, s)

    def test_post_adaptation_has_net_reduction_field(self):
        post = self.scen["post_adaptation_scenario"]
        self.assertIn("net_vulnerability_reduction_pct", post)
        self.assertGreaterEqual(post["net_vulnerability_reduction_pct"], 0.0)

    def test_post_composite_lte_baseline(self):
        base = self.scen["baseline_scenario"]["composite_vulnerability"]
        post = self.scen["post_adaptation_scenario"]["composite_vulnerability"]
        self.assertLessEqual(post, base)

    def test_heatwave_elevates_heat_and_composite(self):
        base = self.scen["baseline_scenario"]
        hw = self.scen["heatwave_scenario"]
        self.assertGreater(hw["heat_proxy"], base["heat_proxy"])
        self.assertGreater(hw["composite_vulnerability"], base["composite_vulnerability"])

    def test_flash_rainfall_elevates_flood_and_composite(self):
        base = self.scen["baseline_scenario"]
        fr = self.scen["flash_rainfall_scenario"]
        self.assertGreater(fr["flood_proxy"], base["flood_proxy"])
        self.assertGreater(fr["composite_vulnerability"], base["composite_vulnerability"])


class TestIndicatorChanges(unittest.TestCase):
    def setUp(self):
        self.plan = generate_action_plan(budget_inr=6000000, equity_weight_factor=1.2)
        self.scen = generate_scenario_comparison(plan=self.plan)
        self.changes = self.scen["indicator_changes"]

    def test_four_indicators_in_breakdown(self):
        for ind in ["heat_exposure_proxy", "flood_screening_proxy",
                    "water_stress_proxy", "green_deficit_proxy"]:
            self.assertIn(ind, self.changes)

    def test_each_indicator_has_all_subfields(self):
        for ind, rec in self.changes.items():
            with self.subTest(indicator=ind):
                for field in ["baseline", "proposed", "delta", "status", "notes"]:
                    self.assertIn(field, rec)

    def test_delta_matches_proposed_minus_baseline(self):
        for ind, rec in self.changes.items():
            expected = round(rec["proposed"] - rec["baseline"], 1)
            self.assertAlmostEqual(rec["delta"], expected, places=1)

    def test_composite_status_is_recomputed(self):
        comp = self.changes.get("composite_vulnerability_score", {})
        self.assertIn(comp.get("status", ""), ["MODELLED_COMPOSITE_RECOMPUTATION", "UNCHANGED"])

    def test_composite_weights_formula(self):
        post = self.scen["post_adaptation_scenario"]
        ch = self.changes
        expected = round(
            0.35 * ch["heat_exposure_proxy"]["proposed"] +
            0.35 * ch["flood_screening_proxy"]["proposed"] +
            0.15 * ch["water_stress_proxy"]["proposed"] +
            0.15 * ch["green_deficit_proxy"]["proposed"], 1
        )
        self.assertAlmostEqual(post["composite_vulnerability"], expected, delta=0.2)


class TestScientificHonesty(unittest.TestCase):
    def setUp(self):
        self.plan = generate_action_plan(budget_inr=8000000, equity_weight_factor=1.0)
        self.scen = generate_scenario_comparison(plan=self.plan)

    def test_drain_desilting_no_numeric_flood_claim(self):
        for item in self.scen.get("impact_breakdown", []):
            if item["id"] == "INT-FLOOD-01":
                self.assertEqual(item.get("quantified_effects", []), [])
                self.assertGreater(len(item.get("directional_effects", [])), 0)

    def test_bus_stop_no_macro_lst_claim(self):
        for item in self.scen.get("impact_breakdown", []):
            if item["id"] == "INT-HEAT-03":
                self.assertEqual(item.get("quantified_effects", []), [])

    def test_water_leak_no_proxy_shift_claim(self):
        for item in self.scen.get("impact_breakdown", []):
            if item["id"] == "INT-WATER-02":
                self.assertEqual(item.get("quantified_effects", []), [])

    def test_post_adaptation_notes_disclosure(self):
        notes = self.scen["post_adaptation_scenario"].get("notes", "").lower()
        self.assertTrue("directional" in notes or "drain" in notes or "uncalibrated" in notes)

    def test_utility_not_labelled_vulnerability_reduction(self):
        perf = self.plan.get("performance_metrics", {})
        self.assertNotIn("vulnerability_reduction_pct", perf)

    def test_data_provenance_minimum_entries(self):
        prov = self.scen.get("data_provenance_and_limitations", [])
        self.assertGreaterEqual(len(prov), 3)


class TestNuancedSiteSuitability(unittest.TestCase):
    def _ctx(self, nallas=0, chambers=0, drain_cov=0):
        return {
            "ward_num": 99,
            "indicators": {"heat_exposure_proxy": 60.0, "flood_screening_proxy": 65.0,
                           "water_stress_proxy": 50.0, "green_deficit_proxy": 60.0,
                           "composite_vulnerability_score": 60.0},
            "evidence": {"stormwater_drain_coverage_pct": drain_cov},
            "spatial_counts": {"intersecting_nallas": nallas, "intersecting_chambers": chambers}
        }

    def _get(self, iid):
        return next(i for i in INTERVENTIONS_CATALOGUE if i["id"] == iid)

    def test_nalla_naturalization_flagged_when_zero_nallas(self):
        status, eligible, note = evaluate_site_suitability(self._get("INT-FLOOD-03"), self._ctx(nallas=0))
        self.assertEqual(status, "FLAGGED_FOR_SITE_VERIFICATION")
        self.assertTrue(eligible)
        self.assertIn("verification", note.lower())

    def test_nalla_naturalization_confirmed_when_nallas_present(self):
        status, eligible, _ = evaluate_site_suitability(self._get("INT-FLOOD-03"), self._ctx(nallas=3))
        self.assertEqual(status, "SUITABLE_CONFIRMED")
        self.assertTrue(eligible)

    def test_drain_desilting_flagged_when_zero_network(self):
        status, eligible, _ = evaluate_site_suitability(self._get("INT-FLOOD-01"), self._ctx(chambers=0, drain_cov=0))
        self.assertEqual(status, "FLAGGED_FOR_SITE_VERIFICATION")
        self.assertTrue(eligible)

    def test_drain_desilting_confirmed_when_chambers_present(self):
        status, eligible, _ = evaluate_site_suitability(self._get("INT-FLOOD-01"), self._ctx(chambers=5, drain_cov=50))
        self.assertEqual(status, "SUITABLE_CONFIRMED")
        self.assertTrue(eligible)

    def test_horizon_exceeded_gives_unsuitable_confirmed(self):
        status, eligible, note = evaluate_site_suitability(
            self._get("INT-FLOOD-03"), self._ctx(nallas=5), max_horizon_months=2)
        self.assertEqual(status, "UNSUITABLE_CONFIRMED")
        self.assertFalse(eligible)
        self.assertIn("HORIZON_EXCEEDED", note)

    def test_heat_interventions_always_confirmed(self):
        status, eligible, _ = evaluate_site_suitability(self._get("INT-HEAT-01"), self._ctx())
        self.assertEqual(status, "SUITABLE_CONFIRMED")
        self.assertTrue(eligible)

    def test_portfolio_items_carry_suitability_status(self):
        plan = generate_action_plan(budget_inr=8000000)
        valid = {"SUITABLE_CONFIRMED", "FLAGGED_FOR_SITE_VERIFICATION", "UNSUITABLE_CONFIRMED"}
        for item in plan["portfolio"]:
            self.assertIn("site_suitability_status", item)
            self.assertIn(item["site_suitability_status"], valid)


class TestUnallocatedBudgetTransparency(unittest.TestCase):
    def test_explanation_present_when_budget_not_fully_spent(self):
        plan = generate_action_plan(budget_inr=1000000000)
        remaining = plan["budget_constraints"]["remaining_budget_inr"]
        explanation = plan["budget_constraints"].get("unallocated_budget_explanation", "")
        if remaining > 0:
            self.assertGreater(len(explanation), 10)

    def test_explanation_present_on_zero_budget(self):
        plan = generate_action_plan(budget_inr=0)
        explanation = plan["budget_constraints"].get("unallocated_budget_explanation", "")
        self.assertGreater(len(explanation), 10)

    def test_resource_summary_matches_plan(self):
        plan = generate_action_plan(budget_inr=5000000)
        scen = generate_scenario_comparison(plan=plan)
        self.assertEqual(scen["resource_summary"]["allocated_spend_inr"],
                         plan["budget_constraints"]["allocated_spend_inr"])
        self.assertEqual(scen["resource_summary"]["workforce_demand_person_months"],
                         plan["performance_metrics"]["workforce_demand_person_months"])


class TestCatalogueIntegrity(unittest.TestCase):
    def test_all_items_have_required_fields(self):
        required = ["id", "category", "title", "description",
                    "cost_per_unit_inr", "unit", "min_units", "max_units",
                    "lead_time_months", "workforce_person_months_per_unit",
                    "risk_reduction_score", "co_benefits_score", "equity_weight",
                    "target_vulnerability", "affected_indicators",
                    "quantified_effects", "directional_effects",
                    "scientific_rationale", "data_quality_status"]
        for item in INTERVENTIONS_CATALOGUE:
            for field in required:
                self.assertIn(field, item)

    def test_qualitative_items_have_directional_effects(self):
        for item in INTERVENTIONS_CATALOGUE:
            if not item.get("quantified_effects"):
                self.assertGreater(len(item.get("directional_effects", [])), 0, item["id"])

    def test_quantified_effects_have_confidence_tag(self):
        for item in INTERVENTIONS_CATALOGUE:
            for ind, effect in item.get("quantified_effects", {}).items():
                self.assertIn("confidence", effect)
                self.assertIn(effect["confidence"], ["MODELLED_ESTIMATE", "EMPIRICAL", "EXPERT_ELICITATION"])

    def test_ids_unique(self):
        ids = [i["id"] for i in INTERVENTIONS_CATALOGUE]
        self.assertEqual(len(ids), len(set(ids)))

    def test_max_units_geq_min_units(self):
        for item in INTERVENTIONS_CATALOGUE:
            self.assertGreaterEqual(item["max_units"], item["min_units"])

    def test_scores_in_valid_range(self):
        for item in INTERVENTIONS_CATALOGUE:
            for field in ["risk_reduction_score", "co_benefits_score", "equity_weight"]:
                val = item[field]
                self.assertGreaterEqual(val, 0.0)
                self.assertLessEqual(val, 100.0)


if __name__ == "__main__":
    unittest.main()