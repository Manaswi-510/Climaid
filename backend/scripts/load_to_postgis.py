"""
load_to_postgis.py
Populates the PostgreSQL / PostGIS database with ClimateAdapt Pune spatial layers and indicator tables.
Usage:
  1. Set your PostgreSQL password in backend/.env:
     DATABASE_URL=postgresql+psycopg2://postgres:<YOUR_PASSWORD>@localhost:5432/climateadapt_pune
  2. Run:
     python backend/scripts/load_to_postgis.py
"""

import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# Load .env
repo_root = Path(__file__).resolve().parent.parent.parent
env_file = repo_root / "backend" / ".env"
load_dotenv(dotenv_path=env_file)

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "climateadapt_pune")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

def setup_postgis_database():
    print(f"[*] Connecting to PostgreSQL at {DB_HOST}:{DB_PORT} as user '{DB_USER}'...")
    
    # 1. Connect to default 'postgres' database to create 'climateadapt_pune' if not exists
    try:
        conn = psycopg2.connect(
            dbname="postgres",
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        
        # Check if DB exists
        cur.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{DB_NAME}'")
        exists = cur.fetchone()
        if not exists:
            print(f"[+] Creating database '{DB_NAME}'...")
            cur.execute(f'CREATE DATABASE "{DB_NAME}"')
        else:
            print(f"[+] Database '{DB_NAME}' already exists.")
        
        cur.close()
        conn.close()
    except psycopg2.OperationalError as e:
        print("\n[!] AUTHENTICATION / CONNECTION ERROR:", file=sys.stderr)
        print(f"    {e}", file=sys.stderr)
        print("\n[-->] Please check your PostgreSQL password in backend/.env:\n      DB_PASSWORD=your_actual_password\n", file=sys.stderr)
        return False

    # 2. Connect to the project database and create PostGIS extension + tables
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        print("[*] Enabling PostGIS extension...")
        try:
            cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
            print("[✓] PostGIS extension enabled.")
        except Exception as e:
            print(f"[!] Note on PostGIS: {e} (Standard tables will still be created)")

        # Create wards table
        print("[*] Creating table 'pune_electoral_wards'...")
        cur.execute("DROP TABLE IF EXISTS pune_electoral_wards CASCADE;")
        cur.execute("""
            CREATE TABLE pune_electoral_wards (
                id SERIAL PRIMARY KEY,
                ward_num INT,
                ward_title VARCHAR(200),
                area_zone VARCHAR(100),
                heat_proxy FLOAT,
                flood_proxy FLOAT,
                water_stress_proxy FLOAT,
                green_deficit_proxy FLOAT,
                composite_score FLOAT,
                ai_archetype VARCHAR(255),
                pca_x FLOAT,
                pca_y FLOAT,
                geom_geojson JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Create nallas table
        print("[*] Creating table 'pune_nallas'...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS pune_nallas (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200),
                geom_geojson JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Create chambers table
        print("[*] Creating table 'pune_swd_chambers'...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS pune_swd_chambers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200),
                geom_geojson JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Load calculated indicators with AI archetypes
        ind_file = repo_root / "data" / "processed" / "ward_indicators.json"
        wards_geojson_file = repo_root / "data" / "raw" / "wards" / "GeoData" / "pune-electoral-wards.geojson"
        
        if ind_file.exists() and wards_geojson_file.exists():
            with open(ind_file, "r", encoding="utf-8") as f:
                ind_data = json.load(f)
            with open(wards_geojson_file, "r", encoding="utf-8") as f:
                geo_data = json.load(f)

            geom_by_ward = {}
            for feat in geo_data.get("features", []):
                props = feat.get("properties", {})
                wnum = props.get("ward_no") or props.get("wardno") or props.get("wardnum") or 0
                try:
                    wnum = int(str(wnum).replace("Ward", "").strip())
                    geom_by_ward[wnum] = json.dumps(feat.get("geometry", {}))
                except Exception:
                    continue

            cur.execute("TRUNCATE TABLE pune_electoral_wards;")
            inserted = 0
            for w in ind_data.get("wards", []):
                wnum = w.get("ward_num")
                inds = w.get("indicators", {})
                ai = w.get("ai_archetype", {})
                geom_json = geom_by_ward.get(wnum, None)
                cur.execute("""
                    INSERT INTO pune_electoral_wards (
                        ward_num, ward_title, area_zone, heat_proxy, flood_proxy,
                        water_stress_proxy, green_deficit_proxy, composite_score,
                        ai_archetype, pca_x, pca_y, geom_geojson
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    wnum,
                    w.get("ward_title"),
                    w.get("area_zone"),
                    inds.get("heat_exposure_proxy"),
                    inds.get("flood_screening_proxy"),
                    inds.get("water_stress_proxy"),
                    inds.get("green_deficit_proxy"),
                    inds.get("composite_vulnerability_score"),
                    ai.get("archetype_name", "Unassigned"),
                    ai.get("pca_x", 0.0),
                    ai.get("pca_y", 0.0),
                    geom_json
                ))
                inserted += 1

            print(f"[✓] Loaded {inserted} electoral wards with AI archetypes into 'pune_electoral_wards'!")

        # Load nallas
        nallas_file = repo_root / "data" / "processed" / "spatial" / "nallas_pilot.geojson"
        if nallas_file.exists():
            with open(nallas_file, "r", encoding="utf-8") as f:
                nallas_data = json.load(f)
            cur.execute("TRUNCATE TABLE pune_nallas;")
            n_ins = 0
            for feat in nallas_data.get("features", []):
                cur.execute("INSERT INTO pune_nallas (name, geom_geojson) VALUES (%s, %s)", (
                    feat.get("properties", {}).get("name", "Nalla Stream"),
                    json.dumps(feat.get("geometry", {}))
                ))
                n_ins += 1
            print(f"[✓] Loaded {n_ins} natural drainage streams into 'pune_nallas'!")

        # Load chambers
        chambers_file = repo_root / "data" / "processed" / "spatial" / "swd_chambers_pilot.geojson"
        if chambers_file.exists():
            with open(chambers_file, "r", encoding="utf-8") as f:
                chambers_data = json.load(f)
            cur.execute("TRUNCATE TABLE pune_swd_chambers;")
            c_ins = 0
            for feat in chambers_data.get("features", []):
                cur.execute("INSERT INTO pune_swd_chambers (name, geom_geojson) VALUES (%s, %s)", (
                    feat.get("properties", {}).get("name", "SWD Utility Chamber"),
                    json.dumps(feat.get("geometry", {}))
                ))
                c_ins += 1
            print(f"[✓] Loaded {c_ins} SWD utility chambers into 'pune_swd_chambers'!")

        cur.close()
        conn.close()
        print("\n[SUCCESS] PostgreSQL setup complete. You can now view tables in pgAdmin 4 or psql!")
        return True

    except Exception as e:
        print(f"[!] Error setting up tables: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    setup_postgis_database()
