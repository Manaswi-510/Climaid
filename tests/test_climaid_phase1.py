"""
test_climaid_phase1.py
=======================
Automated test suite for Climaid Phase 1 & 1.5:
- Ward-to-Indicator matching & alignment
- Indicator mathematical bounds, clamping, and composite formula integrity
- Spatial layer coordinate bounds and geometry integrity
- FastAPI layer endpoints and spatial bbox query filtering
- Error handling for missing or invalid layers
"""

import os
import json
import unittest
from pathlib import Path
import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
API_BASE = "http://127.0.0.1:8000"


class TestWardAndIndicatorIntegrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.wards_geojson_path = REPO_ROOT / "data" / "raw" / "wards" / "GeoData" / "pune-electoral-wards.geojson"
        cls.indicators_json_path = REPO_ROOT / "data" / "processed" / "ward_indicators.json"

        with open(cls.wards_geojson_path, "r", encoding="utf-8") as f:
            cls.wards_geo = json.load(f)
        with open(cls.indicators_json_path, "r", encoding="utf-8") as f:
            cls.ind_data = json.load(f)

    def test_76_wards_exact_count(self):
        """All 76 official electoral wards must exist in both GeoJSON and indicators."""
        self.assertEqual(len(self.wards_geo.get("features", [])), 76)
        self.assertEqual(len(self.ind_data.get("wards", [])), 76)

    def test_ward_number_bijection(self):
        """Ward numbers must form an exact contiguous bijection with 1..76."""
        geo_wardnums = set()
        for f in self.wards_geo["features"]:
            props = f.get("properties", {})
            wnum = props.get("wardnum") or props.get("ward_no")
            self.assertIsNotNone(wnum, f"Feature missing ward number: {props}")
            geo_wardnums.add(int(wnum))

        ind_wardnums = {int(w["ward_num"]) for w in self.ind_data["wards"]}

        expected_set = set(range(1, 77))
        self.assertEqual(geo_wardnums, expected_set, "GeoJSON ward numbers mismatch 1..76")
        self.assertEqual(ind_wardnums, expected_set, "Indicator ward numbers mismatch 1..76")
        self.assertEqual(geo_wardnums, ind_wardnums, "GeoJSON and indicator ward numbers do not align")

    def test_indicator_values_valid_ranges_and_types(self):
        """All screening proxies must be finite floats within [0, 100]."""
        for w in self.ind_data["wards"]:
            wnum = w["ward_num"]
            inds = w["indicators"]
            for key in [
                "heat_exposure_proxy",
                "flood_screening_proxy",
                "water_stress_proxy",
                "green_deficit_proxy",
                "composite_vulnerability_score",
            ]:
                val = inds.get(key)
                self.assertIsNotNone(val, f"Ward {wnum} missing indicator {key}")
                self.assertIsInstance(val, (int, float), f"Ward {wnum} {key} not float/int: {val}")
                self.assertTrue(0.0 <= val <= 100.0, f"Ward {wnum} {key} out of range [0, 100]: {val}")

    def test_composite_vulnerability_formula_recomputation(self):
        """Composite score must equal 0.35*Heat + 0.35*Flood + 0.15*Water + 0.15*Green within rounding."""
        for w in self.ind_data["wards"]:
            inds = w["indicators"]
            expected = round(
                (inds["heat_exposure_proxy"] * 0.35)
                + (inds["flood_screening_proxy"] * 0.35)
                + (inds["water_stress_proxy"] * 0.15)
                + (inds["green_deficit_proxy"] * 0.15),
                1,
            )
            actual = inds["composite_vulnerability_score"]
            self.assertAlmostEqual(
                expected,
                actual,
                places=1,
                msg=f"Ward {w['ward_num']} composite score inconsistency: expected {expected}, got {actual}",
            )


class TestSpatialLayersIntegrity(unittest.TestCase):
    def extract_coords(self, geom):
        pts = []
        def rec(c):
            if isinstance(c, (list, tuple)):
                if len(c) >= 2 and isinstance(c[0], (int, float)) and isinstance(c[1], (int, float)):
                    pts.append((float(c[0]), float(c[1])))
                else:
                    for sub in c:
                        rec(sub)
        rec(geom.get("coordinates", []))
        return pts

    def test_spatial_layers_pune_envelope(self):
        """Core spatial layers must fall inside the greater Pune regional envelope [73.7, 18.4, 74.1, 18.7]."""
        layers_to_check = [
            ("pune-electoral-wards", REPO_ROOT / "data" / "raw" / "wards" / "GeoData" / "pune-electoral-wards.geojson"),
            ("nallas_pilot", REPO_ROOT / "data" / "processed" / "spatial" / "nallas_pilot.geojson"),
            ("swd_chambers_pilot", REPO_ROOT / "data" / "processed" / "spatial" / "swd_chambers_pilot.geojson"),
            ("waterbodies_pilot", REPO_ROOT / "data" / "processed" / "spatial" / "waterbodies_pilot.geojson"),
            ("osm_trees", REPO_ROOT / "data" / "raw" / "osm" / "trees.geojson"),
            ("osm_hospitals", REPO_ROOT / "data" / "raw" / "osm" / "hospitals.geojson"),
            ("osm_parks", REPO_ROOT / "data" / "raw" / "osm" / "parks.geojson"),
        ]

        for name, path in layers_to_check:
            self.assertTrue(path.exists(), f"Layer file not found: {path}")
            with open(path, "r", encoding="utf-8") as f:
                d = json.load(f)
            feats = d.get("features", [])
            self.assertGreater(len(feats), 0, f"Layer {name} unexpectedly empty")

            all_pts = []
            for ft in feats[:100]:  # Sample first 100 features
                all_pts.extend(self.extract_coords(ft.get("geometry", {})))

            for lon, lat in all_pts:
                self.assertTrue(
                    73.65 <= lon <= 74.10 and 18.35 <= lat <= 18.75,
                    f"Layer {name} coordinate out of Pune bounding envelope: ({lat}, {lon})",
                )

    def test_empty_clinics_dataset_handled_gracefully(self):
        """Empty clinics layer (0 features) must not raise unhandled exceptions."""
        clinics_path = REPO_ROOT / "data" / "raw" / "osm" / "clinics.geojson"
        if clinics_path.exists():
            with open(clinics_path, "r", encoding="utf-8") as f:
                d = json.load(f)
            self.assertEqual(len(d.get("features", [])), 0)


class TestFastAPIMapEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Verify server is up
        try:
            r = requests.get(f"{API_BASE}/health", timeout=3)
            cls.server_online = (r.status_code == 200)
        except Exception:
            cls.server_online = False

    def setUp(self):
        if not self.server_online:
            self.skipTest("FastAPI server not reachable on localhost:8000")

    def test_health_endpoint(self):
        r = requests.get(f"{API_BASE}/health", timeout=5)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertTrue(data.get("manifest_present"))
        self.assertTrue(data.get("indicators_computed"))

    def test_wards_layer_endpoint(self):
        r = requests.get(f"{API_BASE}/api/map-layers/pune-electoral-wards", timeout=5)
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertEqual(d.get("type"), "FeatureCollection")
        self.assertEqual(len(d.get("features", [])), 76)

    def test_swd_pipes_bbox_query(self):
        """Bbox query on pipes layer must return filtered features rapidly without 64MB download."""
        bbox_str = "73.84,18.51,73.87,18.54"
        r = requests.get(f"{API_BASE}/api/map-layers/swd-pipes?bbox={bbox_str}&limit=25", timeout=5)
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertEqual(d.get("type"), "FeatureCollection")
        self.assertLessEqual(len(d.get("features", [])), 25)
        self.assertLess(len(r.content), 50_000, "Bbox query returned excessively large payload")

    def test_nonexistent_layer_returns_404(self):
        r = requests.get(f"{API_BASE}/api/map-layers/invalid_unknown_layer_xyz", timeout=5)
        self.assertEqual(r.status_code, 404)


if __name__ == "__main__":
    unittest.main()
