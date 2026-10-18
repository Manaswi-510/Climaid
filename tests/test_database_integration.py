"""
test_database_integration.py
============================
Phase 2A Integration Test Suite for Climaid:
- PostgreSQL / PostGIS database connectivity & connection pool health
- SQLAlchemy session factory and lifecycle cleanup
- ORM models: ElectoralWard (76), Nalla (283), SWDChamber (1,532)
- PostGIS spatial queries, ST_IsValid, ST_SRID, and GIST indexed bbox queries
- Empty bbox and boundary edge conditions
- FastAPI REST endpoints serving GeoJSON FeatureCollections from database
- Database-unavailable fallback behavior ensuring no runtime crashes
"""

import json
import unittest
from pathlib import Path
import requests
from sqlalchemy import text, func
from sqlalchemy.orm import Session

from backend.app.database import engine, SessionLocal, get_db, check_db_connectivity
from backend.app.models import ElectoralWard, Nalla, SWDChamber

API_BASE = "http://127.0.0.1:8000"


class TestDatabaseConnectionAndLifecycle(unittest.TestCase):
    def test_engine_connectivity_and_ping(self):
        """Engine connects and responds to SELECT 1 ping."""
        self.assertIsNotNone(engine, "Database engine must not be None")
        with engine.connect() as conn:
            res = conn.execute(text("SELECT 1")).scalar()
            self.assertEqual(res, 1)

    def test_postgis_extension_enabled(self):
        """PostGIS extension must be installed and active."""
        with engine.connect() as conn:
            version = conn.execute(text("SELECT PostGIS_Version()")).scalar()
            self.assertIsNotNone(version)
            self.assertIn("3.", version)

    def test_session_lifecycle_and_cleanup(self):
        """Session factory opens, executes, and closes properly without leak."""
        session_gen = get_db()
        session = next(session_gen)
        self.assertIsNotNone(session)
        self.assertIsInstance(session, Session)
        
        # Test query in session
        ward_count = session.query(ElectoralWard).count()
        self.assertEqual(ward_count, 76)
        
        # Trigger cleanup
        try:
            next(session_gen)
        except StopIteration:
            pass # Expected behavior for generator cleanup

    def test_health_check_function(self):
        """check_db_connectivity returns True and structured diagnostic details."""
        connected, msg, details = check_db_connectivity()
        self.assertTrue(connected)
        self.assertEqual(msg, "Database online and responsive")
        self.assertIn("postgis_version", details)
        self.assertEqual(details["verified_tables"].get("pune_electoral_wards"), 76)
        self.assertEqual(details["verified_tables"].get("pune_nallas"), 283)
        self.assertEqual(details["verified_tables"].get("pune_swd_chambers"), 1532)


class TestSpatialDatabaseQueries(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_exact_row_counts_across_spatial_tables(self):
        """All three migrated spatial tables must have exact expected row counts."""
        self.assertEqual(self.db.query(ElectoralWard).count(), 76)
        self.assertEqual(self.db.query(Nalla).count(), 283)
        self.assertEqual(self.db.query(SWDChamber).count(), 1532)

    def test_geometry_validity_and_srid_4326(self):
        """100% of rows must possess valid EPSG:4326 PostGIS geometry."""
        for model, expected_cnt in [
            (ElectoralWard, 76),
            (Nalla, 283),
            (SWDChamber, 1532)
        ]:
            total = self.db.query(model).count()
            valid_cnt = self.db.query(model).filter(func.ST_IsValid(model.geom)).count()
            srid_cnt = self.db.query(model).filter(func.ST_SRID(model.geom) == 4326).count()
            
            self.assertEqual(total, expected_cnt)
            self.assertEqual(valid_cnt, expected_cnt, f"{model.__tablename__} has invalid geometries")
            self.assertEqual(srid_cnt, expected_cnt, f"{model.__tablename__} has non-4326 geometries")

    def test_postgis_bbox_envelope_filtering(self):
        """ST_Intersects with ST_MakeEnvelope correctly filters geometries."""
        # Pilot Core Bounding Box: [73.84, 18.51, 73.87, 18.54]
        envelope = func.ST_MakeEnvelope(73.84, 18.51, 73.87, 18.54, 4326)
        
        w_matches = self.db.query(ElectoralWard).filter(func.ST_Intersects(ElectoralWard.geom, envelope)).count()
        n_matches = self.db.query(Nalla).filter(func.ST_Intersects(Nalla.geom, envelope)).count()
        c_matches = self.db.query(SWDChamber).filter(func.ST_Intersects(SWDChamber.geom, envelope)).count()

        self.assertEqual(w_matches, 19, "Wards bbox count mismatch")
        self.assertEqual(n_matches, 81, "Nallas bbox count mismatch")
        self.assertEqual(c_matches, 83, "Chambers bbox count mismatch")

    def test_empty_bbox_query_returns_zero(self):
        """Bbox outside Pune (0,0) returns exactly 0 rows without exception."""
        envelope = func.ST_MakeEnvelope(0.0, 0.0, 0.1, 0.1, 4326)
        w_cnt = self.db.query(ElectoralWard).filter(func.ST_Intersects(ElectoralWard.geom, envelope)).count()
        n_cnt = self.db.query(Nalla).filter(func.ST_Intersects(Nalla.geom, envelope)).count()
        c_cnt = self.db.query(SWDChamber).filter(func.ST_Intersects(SWDChamber.geom, envelope)).count()
        
        self.assertEqual(w_cnt, 0)
        self.assertEqual(n_cnt, 0)
        self.assertEqual(c_cnt, 0)


class TestFastAPIDatabaseEndpoints(unittest.TestCase):
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

    def test_health_reports_database_connected(self):
        r = requests.get(f"{API_BASE}/health", timeout=5)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertTrue(data.get("database_connected"))
        self.assertEqual(data.get("database_details", {}).get("verified_tables", {}).get("pune_electoral_wards"), 76)

    def test_wards_endpoint_returns_database_source_and_76_features(self):
        r = requests.get(f"{API_BASE}/api/map-layers/pune-electoral-wards", timeout=5)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data.get("type"), "FeatureCollection")
        self.assertEqual(data.get("source"), "postgresql+postgis")
        self.assertEqual(len(data.get("features", [])), 76)
        
        # Verify required property keys for Leaflet choropleth & indicators
        feat0 = data["features"][0]
        props = feat0.get("properties", {})
        self.assertIn("wardnum", props)
        self.assertIn("ward_no", props)
        self.assertIn("name", props)
        self.assertIn("composite_score", props)
        self.assertIn("heat_proxy", props)

    def test_nallas_endpoint_returns_database_source_and_283_features(self):
        r = requests.get(f"{API_BASE}/api/map-layers/nallas", timeout=5)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data.get("type"), "FeatureCollection")
        self.assertEqual(data.get("source"), "postgresql+postgis")
        self.assertEqual(len(data.get("features", [])), 283)

    def test_swd_chambers_endpoint_returns_database_source_and_1532_features(self):
        r = requests.get(f"{API_BASE}/api/map-layers/swd-chambers", timeout=5)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data.get("type"), "FeatureCollection")
        self.assertEqual(data.get("source"), "postgresql+postgis")
        self.assertEqual(len(data.get("features", [])), 1532)

    def test_endpoint_bbox_filtering(self):
        """Endpoints with bbox query filter accurately using PostGIS GIST index."""
        bbox_str = "73.84,18.51,73.87,18.54"
        r = requests.get(f"{API_BASE}/api/map-layers/pune-electoral-wards?bbox={bbox_str}", timeout=5)
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertEqual(d.get("source"), "postgresql+postgis")
        self.assertEqual(len(d.get("features", [])), 19)

    def test_endpoint_empty_bbox_query(self):
        """Endpoints with bbox having no features return empty FeatureCollection."""
        bbox_str = "0.0,0.0,0.1,0.1"
        r = requests.get(f"{API_BASE}/api/map-layers/pune-electoral-wards?bbox={bbox_str}", timeout=5)
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertEqual(d.get("type"), "FeatureCollection")
        self.assertEqual(len(d.get("features", [])), 0)


class TestDatabaseUnavailableFallback(unittest.TestCase):
    def test_fallback_to_file_when_db_is_none(self):
        """
        Simulate get_map_layer_geojson when database session is None.
        Must fall back to file without error and return 76 wards.
        """
        from backend.app.main import get_map_layer_geojson
        # Call with db=None
        resp = get_map_layer_geojson(layer_name="pune-electoral-wards", bbox=None, limit=None, db=None)
        
        # Resp is FileResponse for backward compatibility
        self.assertTrue(hasattr(resp, "path") or hasattr(resp, "body"))
        if hasattr(resp, "path"):
            path = Path(resp.path)
            self.assertTrue(path.exists())
            with open(path, "r", encoding="utf-8") as f:
                d = json.load(f)
            self.assertEqual(len(d.get("features", [])), 76)


if __name__ == "__main__":
    unittest.main()
