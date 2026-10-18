"""
migrate_spatial_columns.py
==========================
Adds native PostGIS geometry columns (EPSG:4326) and spatial GIST indexes
to the existing tables:
- pune_electoral_wards (76 rows)
- pune_nallas (283 rows)
- pune_swd_chambers (1,532 rows)

Features:
- Preserves existing geom_geojson JSONB columns completely.
- Creates pre-migration JSON backups in data/exports/.
- Validates CRS (EPSG:4326) and ST_IsValid for 100% of rows.
- Creates GIST spatial indexes.
- Provides --rollback flag to drop native geometry columns and indexes cleanly.
"""

import os
import sys
import json
import argparse
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
load_dotenv(BACKEND_DIR / ".env")

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "climateadapt_pune")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

BACKUP_DIR = REPO_ROOT / "data" / "exports" / "backups_pre_migration"

TABLES_CONFIG = [
    {
        "table": "pune_electoral_wards",
        "expected_count": 76,
        "geom_type": "MultiPolygon, Polygon",
        "index_name": "idx_pune_electoral_wards_geom"
    },
    {
        "table": "pune_nallas",
        "expected_count": 283,
        "geom_type": "MultiLineString, LineString",
        "index_name": "idx_pune_nallas_geom"
    },
    {
        "table": "pune_swd_chambers",
        "expected_count": 1532,
        "geom_type": "Point",
        "index_name": "idx_pune_swd_chambers_geom"
    }
]

def get_connection():
    return psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )

def backup_tables(conn):
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    for cfg in TABLES_CONFIG:
        table = cfg["table"]
        backup_file = BACKUP_DIR / f"{table}_backup.json"
        print(f"[*] Backing up {table} to {backup_file.name}...")
        cur.execute(f"SELECT * FROM {table};")
        rows = cur.fetchall()
        # Convert non-serializable objects (like timestamps) to string
        serializable_rows = []
        for r in rows:
            clean_r = {}
            for k, v in r.items():
                if hasattr(v, "isoformat"):
                    clean_r[k] = v.isoformat()
                else:
                    clean_r[k] = v
            serializable_rows.append(clean_r)
        
        with open(backup_file, "w", encoding="utf-8") as f:
            json.dump(serializable_rows, f, indent=2)
        print(f"    [+] Backed up {len(serializable_rows)} rows.")
    cur.close()

def rollback(conn):
    print("\n[!] Rolling back native PostGIS geometry columns and indexes...")
    cur = conn.cursor()
    for cfg in TABLES_CONFIG:
        table = cfg["table"]
        idx = cfg["index_name"]
        print(f"[*] Dropping index {idx} and column geom from {table}...")
        cur.execute(f"DROP INDEX IF EXISTS {idx};")
        cur.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS geom;")
    conn.commit()
    cur.close()
    print("[+] Rollback completed successfully.")

def migrate(conn):
    print("\n[*] Starting safe PostGIS native geometry migration...")
    cur = conn.cursor()

    # Verify PostGIS is enabled
    cur.execute("SELECT PostGIS_Version();")
    pgis_ver = cur.fetchone()[0]
    print(f"[+] PostGIS extension confirmed active: {pgis_ver}")

    for cfg in TABLES_CONFIG:
        table = cfg["table"]
        expected = cfg["expected_count"]
        idx = cfg["index_name"]

        print(f"\n--- Migrating {table} ---")

        # 1. Add column if not exists
        cur.execute(f"""
            ALTER TABLE {table} 
            ADD COLUMN IF NOT EXISTS geom geometry(Geometry, 4326);
        """)
        conn.commit()
        print(f"    [+] Column 'geom geometry(Geometry, 4326)' ensured.")

        # 2. Populate geom from geom_geojson using ST_Force2D to handle 3D source geometries
        cur.execute(f"""
            UPDATE {table}
            SET geom = ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(geom_geojson::text), 4326))
            WHERE geom IS NULL;
        """)
        updated_rows = cur.rowcount
        conn.commit()
        print(f"    [+] Populated {updated_rows} rows from geom_geojson.")

        # 3. Validate geometries
        cur.execute(f"""
            SELECT 
                count(*) as total,
                count(geom) as non_null_geom,
                count(CASE WHEN ST_IsValid(geom) THEN 1 END) as valid_geom,
                count(CASE WHEN ST_SRID(geom) = 4326 THEN 1 END) as valid_srid
            FROM {table};
        """)
        total, non_null, valid_cnt, srid_cnt = cur.fetchone()
        print(f"    [+] Validation: total={total}, geom_present={non_null}, valid={valid_cnt}, srid_4326={srid_cnt}")

        if non_null != expected or valid_cnt != expected or srid_cnt != expected:
            raise RuntimeError(f"Validation failed for table {table}: expected {expected}, got valid={valid_cnt}")

        # 4. Create GIST index
        print(f"    [*] Creating GIST spatial index {idx}...")
        cur.execute(f"""
            CREATE INDEX IF NOT EXISTS {idx} ON {table} USING GIST (geom);
        """)
        conn.commit()
        print(f"    [+] Index {idx} created.")

    cur.close()
    print("\n[SUCCESS] PostGIS spatial migration completed with 100% validity and GIST indexes.")

def main():
    parser = argparse.ArgumentParser(description="Migrate spatial layers to native PostGIS geometries.")
    parser.add_argument("--rollback", action="store_true", help="Drop native geometry columns and indexes")
    parser.add_argument("--skip-backup", action="store_true", help="Skip pre-migration JSON backup")
    args = parser.parse_args()

    conn = get_connection()
    try:
        if args.rollback:
            rollback(conn)
        else:
            if not args.skip_backup:
                backup_tables(conn)
            migrate(conn)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
