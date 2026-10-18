"""
test_map_and_navigation.py
==========================
Regression and functional test suite for:
- Initial unselected map state and ward selection switching
- Ward details endpoint data consistency and plain-language factors
- Map layer endpoints stability (no API key required)
- Vulnerability metric categorization consistency
- Action plan context transition from map selection
"""

import json
import unittest
from pathlib import Path
import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
API_BASE = "http://127.0.0.1:8000"


class TestMapAndWardNavigation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.indicators_path = REPO_ROOT / "data" / "processed" / "ward_indicators.json"
        with open(cls.indicators_path, "r", encoding="utf-8") as f:
            cls.ind_data = json.load(f)

    def test_initial_ward_selection_can_be_null(self):
        """The indicators dataset must provide a full catalog of 76 wards without imposing an active default."""
        wards = self.ind_data.get("wards", [])
        self.assertEqual(len(wards), 76)
        # Verify ward 1 (Vadgaon Sheri) is not marked as default or selected
        first_ward = wards[0]
        self.assertNotIn("is_selected", first_ward)
        self.assertNotIn("is_default", first_ward)

    def test_ward_details_available_for_all_76_wards(self):
        """Every ward must have all 4 indicators and evidence fields for plain language display."""
        for w in self.ind_data["wards"]:
            wnum = w["ward_num"]
            ind = w.get("indicators", {})
            evidence = w.get("evidence", {})

            # 4 Indicators must exist and be in 0-100
            for key in ["composite_vulnerability_score", "heat_exposure_proxy",
                        "flood_screening_proxy", "water_stress_proxy", "green_deficit_proxy"]:
                self.assertIn(key, ind, f"Ward {wnum} missing indicator {key}")
                val = ind[key]
                self.assertTrue(0 <= val <= 100, f"Ward {wnum} {key} out of bounds: {val}")

            # Evidence fields
            self.assertIn("stormwater_drain_coverage_pct", evidence, f"Ward {wnum} missing swd coverage")
            self.assertIn("forecast_max_temp_c", evidence, f"Ward {wnum} missing temperature forecast")

    def test_ward_lookup_by_number_endpoint(self):
        """Calling /api/indicators?ward_num=X returns exactly that ward's details."""
        try:
            r = requests.get(f"{API_BASE}/api/indicators?ward_num=14", timeout=5)
            self.assertEqual(r.status_code, 200)
            data = r.json()
            self.assertEqual(data.get("total_wards_analyzed"), 1)
            self.assertEqual(len(data.get("wards", [])), 1)
            self.assertEqual(data["wards"][0]["ward_num"], 14)
        except requests.exceptions.ConnectionError:
            self.skipTest("Backend server not running on port 8000")

    def test_map_layer_endpoints_require_no_api_key(self):
        """Core spatial layer endpoints must return 200 GeoJSON with zero external API key requirements."""
        try:
            endpoints = ["pune-electoral-wards", "nallas", "swd-chambers", "waterbodies-official"]
            for ep in endpoints:
                r = requests.get(f"{API_BASE}/api/map-layers/{ep}", timeout=5)
                self.assertEqual(r.status_code, 200, f"Endpoint {ep} failed with {r.status_code}")
                geo = r.json()
                self.assertIn("features", geo, f"GeoJSON missing features in {ep}")
                self.assertNotIn("api_key", geo)
                self.assertNotIn("error", geo)
        except requests.exceptions.ConnectionError:
            self.skipTest("Backend server not running on port 8000")

    def test_action_plan_transition_with_ward_context(self):
        """Action plan optimizer succeeds when target_ward_num is specified from map selection."""
        try:
            payload = {
                "budget_inr": 5000000,
                "equity_weight": 1.0,
                "target_ward_num": 14
            }
            r = requests.post(f"{API_BASE}/api/action-plans", json=payload, timeout=8)
            self.assertEqual(r.status_code, 200)
            plan = r.json()
            self.assertIn("portfolio", plan)
            self.assertIn("budget_constraints", plan)
            allocated = plan["budget_constraints"]["allocated_spend_inr"]
            self.assertLessEqual(allocated, 5000000)
        except requests.exceptions.ConnectionError:
            self.skipTest("Backend server not running on port 8000")


if __name__ == "__main__":
    unittest.main()
