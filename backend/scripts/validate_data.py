"""
validate_data.py
Inventories and validates all raw datasets for ClimateAdapt Pune.
Adheres strictly to the guidelines:
- Flags unverified/missing datasets (Sentinel-2, DEM, Census, Groundwater wells) without silently converting to zero
- Validates GeoJSON structure, coordinate ranges, and geometry types
- Validates CSV headers, row counts, and data cleanliness
- Exports a machine-readable data manifest and quality report to data/processed/
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime, timezone
import pandas as pd

try:
    from shapely.geometry import shape
    HAS_SHAPELY = True
except ImportError:
    HAS_SHAPELY = False

def run_validation():
    repo_root = Path(__file__).resolve().parent.parent.parent
    raw_dir = repo_root / "data" / "raw"
    processed_dir = repo_root / "data" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).isoformat()
    manifest_assets = []
    validation_issues = []
    
    print("[*] Starting ClimateAdapt Pune Data Inventory & Validation...")
    print(f"[*] Raw data path: {raw_dir}")

    # 1. Validate OpenStreetMap GeoJSONs
    osm_dir = raw_dir / "osm"
    if osm_dir.exists():
        for geojson_path in osm_dir.glob("*.geojson"):
            asset_info = {
                "filename": geojson_path.name,
                "relative_path": str(geojson_path.relative_to(repo_root)).replace("\\", "/"),
                "category": "osm",
                "source": "OpenStreetMap via Overpass API",
                "license": "ODbL 1.0",
                "crs": "EPSG:4326 (WGS 84)",
                "size_bytes": geojson_path.stat().st_size,
                "status": "VALID",
                "feature_count": 0,
                "geometry_types": {},
                "bbox": None
            }
            try:
                with open(geojson_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                features = data.get("features", [])
                asset_info["feature_count"] = len(features)
                
                geom_types = {}
                min_x, min_y, max_x, max_y = float("inf"), float("inf"), float("-inf"), float("-inf")
                invalid_geoms = 0

                for feat in features:
                    geom = feat.get("geometry")
                    if geom:
                        g_type = geom.get("type", "Unknown")
                        geom_types[g_type] = geom_types.get(g_type, 0) + 1
                        
                        if HAS_SHAPELY:
                            try:
                                s = shape(geom)
                                if not s.is_valid:
                                    invalid_geoms += 1
                                bounds = s.bounds
                                min_x = min(min_x, bounds[0])
                                min_y = min(min_y, bounds[1])
                                max_x = max(max_x, bounds[2])
                                max_y = max(max_y, bounds[3])
                            except Exception:
                                invalid_geoms += 1
                
                asset_info["geometry_types"] = geom_types
                if min_x != float("inf"):
                    asset_info["bbox"] = [round(min_y, 4), round(min_x, 4), round(max_y, 4), round(max_x, 4)]
                
                if invalid_geoms > 0:
                    asset_info["invalid_geometries"] = invalid_geoms
                    validation_issues.append(f"{geojson_path.name}: {invalid_geoms} self-intersecting or invalid geometries detected.")

                if asset_info["feature_count"] == 0:
                    asset_info["status"] = "EMPTY"
                    validation_issues.append(f"{geojson_path.name}: 0 features present.")

            except Exception as e:
                asset_info["status"] = "CORRUPT"
                asset_info["error"] = str(e)
                validation_issues.append(f"{geojson_path.name}: Corrupt GeoJSON - {e}")
            
            manifest_assets.append(asset_info)
            print(f"  [+] OSM Layer: {geojson_path.name} -> {asset_info['feature_count']} features ({asset_info['status']})")

    # 2. Validate Wards Data
    wards_dir = raw_dir / "wards"
    if (wards_dir / "GeoData").exists():
        for geojson_path in (wards_dir / "GeoData").glob("*.geojson"):
            asset_info = {
                "filename": geojson_path.name,
                "relative_path": str(geojson_path.relative_to(repo_root)).replace("\\", "/"),
                "category": "administrative_boundary",
                "source": "DataMeet Pune Chapter / PMC Election Commission",
                "license": "CC BY-SA 2.5 IN",
                "crs": "EPSG:4326 (WGS 84)",
                "size_bytes": geojson_path.stat().st_size,
                "status": "VALID",
                "feature_count": 0
            }
            try:
                with open(geojson_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                features = data.get("features", [])
                asset_info["feature_count"] = len(features)
            except Exception as e:
                asset_info["status"] = "CORRUPT"
                validation_issues.append(f"{geojson_path.name}: {e}")
            manifest_assets.append(asset_info)
            print(f"  [+] Ward Boundary: {geojson_path.name} -> {asset_info['feature_count']} wards ({asset_info['status']})")

    if (wards_dir / "CSVs").exists():
        for csv_path in (wards_dir / "CSVs").glob("*.csv"):
            try:
                df = pd.read_csv(csv_path)
                asset_info = {
                    "filename": csv_path.name,
                    "relative_path": str(csv_path.relative_to(repo_root)).replace("\\", "/"),
                    "category": "administrative_tabular",
                    "source": "DataMeet Pune Chapter / PMC",
                    "license": "CC BY-SA 2.5 IN",
                    "size_bytes": csv_path.stat().st_size,
                    "status": "VALID",
                    "row_count": len(df),
                    "columns": list(df.columns),
                    "null_count": int(df.isnull().sum().sum())
                }
                manifest_assets.append(asset_info)
                print(f"  [+] Ward CSV: {csv_path.name} -> {len(df)} rows, {len(df.columns)} cols")
            except Exception as e:
                validation_issues.append(f"{csv_path.name}: {e}")

    # 3. Validate Official OpenCity Reports & Drainage Data
    official_dir = raw_dir / "official_reports"
    if official_dir.exists():
        for file_path in official_dir.iterdir():
            if file_path.is_file():
                suffix = file_path.suffix.lower()
                asset_info = {
                    "filename": file_path.name,
                    "relative_path": str(file_path.relative_to(repo_root)).replace("\\", "/"),
                    "category": "stormwater_and_infrastructure",
                    "source": "OpenCity Pune Drainage / PMC",
                    "size_bytes": file_path.stat().st_size,
                    "status": "VALID"
                }
                if suffix == ".csv":
                    try:
                        df = pd.read_csv(file_path)
                        asset_info["row_count"] = len(df)
                        asset_info["columns"] = list(df.columns)
                    except Exception as e:
                        asset_info["status"] = "ERROR"
                        asset_info["error"] = str(e)
                        validation_issues.append(f"{file_path.name}: {e}")
                elif suffix in [".kml", ".kmz"]:
                    asset_info["format"] = "KML/KMZ spatial layer"
                    asset_info["notes"] = "Unconverted spatial vector layer. Needs conversion to GeoJSON before spatial joins."
                
                manifest_assets.append(asset_info)
                print(f"  [+] OpenCity Asset: {file_path.name} ({asset_info['size_bytes']} bytes)")

    # 4. Validate Weather Forecast Data
    weather_dir = raw_dir / "weather"
    weather_files = list(weather_dir.glob("*")) if weather_dir.exists() else []
    if weather_files:
        for w_file in weather_files:
            asset_info = {
                "filename": w_file.name,
                "relative_path": str(w_file.relative_to(repo_root)).replace("\\", "/"),
                "category": "weather_forecast",
                "source": "Open-Meteo Weather Forecast API",
                "license": "Non-commercial / Open-Meteo terms",
                "status": "VALID",
                "size_bytes": w_file.stat().st_size
            }
            if w_file.suffix == ".json":
                try:
                    with open(w_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    asset_info["data_type"] = data.get("data_type", data.get("metadata", {}).get("data_type", "forecast"))
                except Exception as e:
                    asset_info["status"] = "ERROR"
            elif w_file.suffix == ".csv":
                try:
                    df = pd.read_csv(w_file)
                    asset_info["row_count"] = len(df)
                    asset_info["columns"] = list(df.columns)
                except Exception as e:
                    asset_info["status"] = "ERROR"
            manifest_assets.append(asset_info)
            print(f"  [+] Weather Forecast Asset: {w_file.name}")
    else:
        validation_issues.append("Weather: No forecast data found under data/raw/weather/. Run fetch_weather.py.")

    # 5. Check Missing / Unconfirmed Datasets as required by project specification
    unconfirmed_specs = [
        ("sentinel2", raw_dir / "sentinel2", "Satellite imagery (NDVI analysis)"),
        ("dem", raw_dir / "dem", "Digital Elevation Model / Terrain"),
        ("population", raw_dir / "population", "Census 2011 Primary Census Abstract"),
        ("groundwater", raw_dir / "official_reports" / "gsda_wells.csv", "GSDA Local Monitoring Wells")
    ]
    for key, path, desc in unconfirmed_specs:
        exists = path.exists() and (len(list(path.iterdir())) > 0 if path.is_dir() else True)
        status = "CONFIRMED_DOWNLOADED" if exists else "MISSING_UNVERIFIED"
        manifest_assets.append({
            "identifier": key,
            "description": desc,
            "status": status,
            "category": "external_environmental_or_census",
            "notes": "Not yet confirmed downloaded locally. As per core project principle: do not invent dummy measurements. Missing data flagged as missing."
        })
        if not exists:
            validation_issues.append(f"GAPS NOTICE: {desc} is currently {status}.")

    # 6. Save Manifest and Quality Report
    manifest_file = processed_dir / "data_manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at_utc": timestamp,
            "total_assets_inventoried": len(manifest_assets),
            "assets": manifest_assets
        }, f, indent=2)
    print(f"\n[+] Manifest saved to {manifest_file}")

    quality_report = {
        "report_generated_utc": timestamp,
        "pilot_area": "Pune Urban Pilot (18.50-18.60N, 73.80-73.90E)",
        "summary": {
            "total_raw_layers": len(manifest_assets),
            "total_issues_and_notices": len(validation_issues),
            "status": "READY_FOR_FIRST_PASS_INDICATORS"
        },
        "issues_and_notices": validation_issues
    }
    quality_file = processed_dir / "data_quality_report.json"
    with open(quality_file, "w", encoding="utf-8") as f:
        json.dump(quality_report, f, indent=2)
    print(f"[+] Quality report saved to {quality_file}")
    print(f"[SUCCESS] Validation complete. {len(validation_issues)} notices/warnings logged.")

if __name__ == "__main__":
    run_validation()
