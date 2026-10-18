"""
main.py
FastAPI application for ClimateAdapt Pune.
Provides all API endpoints required by the specification:
- /health
- /api/project
- /api/data-sources
- /api/indicators
- /api/weather
- /api/map-layers
- /api/map-layers/{layer_name}
- /api/interventions
- /api/action-plans
- /api/scenarios/compare
- /api/reports
- /api/reports/latest/download
"""

import os
import json
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from .schemas import (
    ProjectInfo, DataSourcesResponse, IndicatorsResponse,
    InterventionItem, ActionPlanRequest, ActionPlanResponse,
    ScenarioComparisonResponse
)
from .database import init_db, get_db, check_db_connectivity, DB_ONLINE
from .models import ElectoralWard, Nalla, SWDChamber

# Locate Project Root & Data Dirs
APP_DIR = Path(__file__).resolve().parent
REPO_ROOT = APP_DIR.parent.parent
DATA_DIR = REPO_ROOT / "data"
PROCESSED_DIR = DATA_DIR / "processed"
EXPORTS_DIR = DATA_DIR / "exports"
RAW_DIR = DATA_DIR / "raw"
REPORTS_DIR = REPO_ROOT / "reports"

app = FastAPI(
    title="ClimateAdapt Pune API",
    version="1.0.0",
    description="Evidence-backed AI climate adaptation action planner for Pune, Maharashtra."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    print("[*] Initializing ClimateAdapt Pune API...")
    init_db()

@app.get("/health", tags=["System"])
def get_health():
    db_online, db_msg, db_details = check_db_connectivity()
    return {
        "status": "healthy",
        "service": "ClimateAdapt Pune API",
        "database_connected": db_online,
        "database_message": db_msg,
        "database_details": db_details,
        "manifest_present": (PROCESSED_DIR / "data_manifest.json").exists(),
        "indicators_computed": (PROCESSED_DIR / "ward_indicators.json").exists(),
        "pdf_report_ready": (REPORTS_DIR / "ClimateAdapt_Pune_Action_Report.pdf").exists()
    }

@app.get("/api/project", response_model=ProjectInfo, tags=["Project"])
def get_project_metadata():
    return ProjectInfo(
        name="ClimateAdapt Pune",
        version="1.0.0",
        status="Active Pilot",
        pilot_area="Pune Urban Core, Maharashtra, India",
        bounding_box={
            "min_lat": 18.50,
            "max_lat": 18.60,
            "min_lon": 73.80,
            "max_lon": 73.90
        },
        center_coordinates={
            "latitude": 18.523726,
            "longitude": 73.868760
        },
        timezone="Asia/Kolkata",
        crs="EPSG:4326 (WGS 84) / Projected UTM 43N",
        data_quality_disclaimer=(
            "The system distinguishes measured facts (OpenCity municipal datasets) from model forecasts "
            "(Open-Meteo) and spatial proxies. Unverified data (such as local groundwater wells and uncalibrated DEMs) "
            "are preserved as missing rather than assumed or synthesized."
        )
    )

@app.get("/api/data-sources", tags=["Data Inventory"])
def get_data_sources():
    manifest_file = PROCESSED_DIR / "data_manifest.json"
    quality_file = PROCESSED_DIR / "data_quality_report.json"
    
    if not manifest_file.exists():
        raise HTTPException(status_code=404, detail="Data manifest not found. Run validate_data.py first.")
    
    with open(manifest_file, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    
    issues = []
    if quality_file.exists():
        with open(quality_file, "r", encoding="utf-8") as f:
            q_data = json.load(f)
            issues = q_data.get("issues_and_notices", [])

    return {
        "generated_at_utc": manifest.get("generated_at_utc"),
        "total_assets": manifest.get("total_assets_inventoried", len(manifest.get("assets", []))),
        "assets": manifest.get("assets", []),
        "issues_and_notices": issues
    }

@app.get("/api/indicators", response_model=IndicatorsResponse, tags=["Indicators"])
def get_indicators(ward_num: Optional[int] = Query(None, description="Optional filter by ward number")):
    indicators_file = PROCESSED_DIR / "ward_indicators.json"
    if not indicators_file.exists():
        raise HTTPException(status_code=404, detail="Indicators not yet generated. Run process_indicators.py first.")
    
    with open(indicators_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    if ward_num is not None:
        filtered = [w for w in data.get("wards", []) if w.get("ward_num") == ward_num]
        return {
            **data,
            "total_wards_analyzed": len(filtered),
            "wards": filtered
        }
    
    return data

@app.get("/api/weather", tags=["Climate & Forecast"])
def get_weather():
    curr_file = RAW_DIR / "weather" / "pune_forecast_current.json"
    daily_file = RAW_DIR / "weather" / "pune_forecast_daily.csv"
    
    current_data = {}
    if curr_file.exists():
        with open(curr_file, "r", encoding="utf-8") as f:
            current_data = json.load(f)
    
    daily_records = []
    if daily_file.exists():
        import pandas as pd
        df = pd.read_csv(daily_file)
        daily_records = df.to_dict(orient="records")
        
    return {
        "status": "success",
        "data_type": "forecast",
        "current": current_data,
        "daily_forecast": daily_records
    }

@app.get("/api/ai-clusters", tags=["AI Modeling"])
def get_ai_vulnerability_clusters():
    ai_file = PROCESSED_DIR / "ai_clustering_results.json"
    if not ai_file.exists():
        from ..scripts.ai_vulnerability_clustering import run_clustering
        run_clustering()
    
    with open(ai_file, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/ai/ward-analysis/{ward_num}", tags=["AI Modeling"])
def get_gemini_ward_analysis(
    ward_num: int,
    budget_inr: Optional[float] = Query(None, description="Optional custom budget in INR"),
    force_refresh: bool = Query(False, description="Force re-generation via Gemini API")
):
    from .gemini_service import analyze_ward_with_gemini
    try:
        res = analyze_ward_with_gemini(
            ward_num=ward_num,
            custom_budget_inr=budget_inr,
            force_refresh=force_refresh
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/map-layers", tags=["Spatial Layers"])
def get_available_map_layers():
    return {
        "available_layers": [
            {"id": "pune-electoral-wards", "name": "Pune Electoral Wards (76 Wards)", "type": "polygon", "category": "boundary"},
            {"id": "pune-admin-wards", "name": "Pune Admin Wards (15 Wards)", "type": "polygon", "category": "boundary"},
            {"id": "nallas", "name": "Natural Drainage Nallas (OpenCity)", "type": "line", "category": "drainage"},
            {"id": "swd-chambers", "name": "Stormwater Utility Chambers (1,532 Inlets)", "type": "point", "category": "drainage"},
            {"id": "waterbodies-official", "name": "Rivers & Waterbodies (PMC/OpenCity)", "type": "polygon", "category": "water"},
            {"id": "trees", "name": "Mapped Trees (5,779 Points)", "type": "point", "category": "greenery"},
            {"id": "parks", "name": "Parks & Public Gardens", "type": "polygon", "category": "greenery"},
            {"id": "waterways", "name": "Rivers & Waterways (OSM)", "type": "line", "category": "water"},
            {"id": "water_bodies", "name": "Lakes & Water Bodies (OSM)", "type": "polygon", "category": "water"},
            {"id": "hospitals", "name": "Hospitals & Clinics", "type": "point", "category": "infrastructure"},
            {"id": "schools", "name": "Schools & Colleges", "type": "point", "category": "infrastructure"}
        ]
    }

_GEOJSON_CACHE = {}

def _feature_intersects_bbox(geom, min_lon, min_lat, max_lon, max_lat):
    if not geom:
        return False
    g_type = geom.get("type", "")
    coords = geom.get("coordinates", [])
    if g_type == "Point":
        if len(coords) >= 2:
            return min_lon <= coords[0] <= max_lon and min_lat <= coords[1] <= max_lat
        return False
    elif g_type in ("LineString", "MultiPoint"):
        return any(min_lon <= pt[0] <= max_lon and min_lat <= pt[1] <= max_lat for pt in coords if len(pt) >= 2)
    elif g_type in ("Polygon", "MultiLineString"):
        for ring in coords:
            if any(min_lon <= pt[0] <= max_lon and min_lat <= pt[1] <= max_lat for pt in ring if len(pt) >= 2):
                return True
        return False
    elif g_type == "MultiPolygon":
        for poly in coords:
            for ring in poly:
                if any(min_lon <= pt[0] <= max_lon and min_lat <= pt[1] <= max_lat for pt in ring if len(pt) >= 2):
                    return True
        return False
    return True

@app.get("/api/map-layers/{layer_name}", tags=["Spatial Layers"])
def get_map_layer_geojson(
    layer_name: str,
    bbox: Optional[str] = Query(None, description="Optional bounding box: min_lon,min_lat,max_lon,max_lat"),
    limit: Optional[int] = Query(None, description="Optional maximum features to return"),
    db: Optional[Session] = Depends(get_db)
):
    # 1. Database-backed queries via SQLAlchemy & PostGIS (Phase 2A)
    if db is not None:
        try:
            if layer_name in ["pune-electoral-wards", "wards"]:
                query = db.query(ElectoralWard, func.ST_AsGeoJSON(ElectoralWard.geom).label("geom_str"))
                if bbox:
                    parts = [float(x.strip()) for x in bbox.split(",")]
                    if len(parts) == 4:
                        envelope = func.ST_MakeEnvelope(parts[0], parts[1], parts[2], parts[3], 4326)
                        query = query.filter(func.ST_Intersects(ElectoralWard.geom, envelope))
                query = query.order_by(ElectoralWard.ward_num.asc())
                if limit and limit > 0:
                    query = query.limit(limit)
                rows = query.all()
                features = []
                for ward, geom_str in rows:
                    geom = json.loads(geom_str) if geom_str else (ward.geom_geojson or {})
                    features.append({
                        "type": "Feature",
                        "id": ward.id,
                        "geometry": geom,
                        "properties": {
                            "id": ward.id,
                            "wardnum": ward.ward_num,
                            "ward_no": ward.ward_num,
                            "name": ward.ward_title or f"Ward {ward.ward_num}",
                            "ward_title": ward.ward_title,
                            "area_zone": ward.area_zone,
                            "heat_proxy": ward.heat_proxy,
                            "flood_proxy": ward.flood_proxy,
                            "water_stress_proxy": ward.water_stress_proxy,
                            "green_deficit_proxy": ward.green_deficit_proxy,
                            "composite_score": ward.composite_score,
                            "ai_archetype": ward.ai_archetype,
                            "pca_x": ward.pca_x,
                            "pca_y": ward.pca_y
                        }
                    })
                return JSONResponse({
                    "type": "FeatureCollection",
                    "source": "postgresql+postgis",
                    "layer": layer_name,
                    "total_matched": len(features),
                    "features": features
                })

            elif layer_name == "nallas":
                query = db.query(Nalla, func.ST_AsGeoJSON(Nalla.geom).label("geom_str"))
                if bbox:
                    parts = [float(x.strip()) for x in bbox.split(",")]
                    if len(parts) == 4:
                        envelope = func.ST_MakeEnvelope(parts[0], parts[1], parts[2], parts[3], 4326)
                        query = query.filter(func.ST_Intersects(Nalla.geom, envelope))
                if limit and limit > 0:
                    query = query.limit(limit)
                rows = query.all()
                features = []
                for nalla, geom_str in rows:
                    geom = json.loads(geom_str) if geom_str else (nalla.geom_geojson or {})
                    features.append({
                        "type": "Feature",
                        "id": nalla.id,
                        "geometry": geom,
                        "properties": {
                            "id": nalla.id,
                            "name": nalla.name or "Natural Drainage Nalla"
                        }
                    })
                return JSONResponse({
                    "type": "FeatureCollection",
                    "source": "postgresql+postgis",
                    "layer": layer_name,
                    "total_matched": len(features),
                    "features": features
                })

            elif layer_name in ["swd-chambers", "swd_chambers"]:
                query = db.query(SWDChamber, func.ST_AsGeoJSON(SWDChamber.geom).label("geom_str"))
                if bbox:
                    parts = [float(x.strip()) for x in bbox.split(",")]
                    if len(parts) == 4:
                        envelope = func.ST_MakeEnvelope(parts[0], parts[1], parts[2], parts[3], 4326)
                        query = query.filter(func.ST_Intersects(SWDChamber.geom, envelope))
                if limit and limit > 0:
                    query = query.limit(limit)
                rows = query.all()
                features = []
                for chamber, geom_str in rows:
                    geom = json.loads(geom_str) if geom_str else (chamber.geom_geojson or {})
                    features.append({
                        "type": "Feature",
                        "id": chamber.id,
                        "geometry": geom,
                        "properties": {
                            "id": chamber.id,
                            "name": chamber.name or "SWD Utility Chamber"
                        }
                    })
                return JSONResponse({
                    "type": "FeatureCollection",
                    "source": "postgresql+postgis",
                    "layer": layer_name,
                    "total_matched": len(features),
                    "features": features
                })
        except Exception as e:
            # Fall back safely to file system read if database query encounters an issue
            print(f"[!] Database read error for {layer_name}: {type(e).__name__}. Falling back to file read.")

    # 2. File-based fallback and resolution for remaining layers
    candidate_paths = [
        PROCESSED_DIR / "spatial" / f"{layer_name}_pilot.geojson",
        PROCESSED_DIR / "spatial" / f"{layer_name}.geojson",
        RAW_DIR / "wards" / "GeoData" / f"{layer_name}.geojson",
        RAW_DIR / "osm" / f"{layer_name}.geojson",
        RAW_DIR / "osm" / f"{layer_name.replace('-', '_')}.geojson"
    ]
    if layer_name == "nallas":
        candidate_paths.insert(0, PROCESSED_DIR / "spatial" / "nallas_pilot.geojson")
    elif layer_name in ["swd-chambers", "swd_chambers"]:
        candidate_paths.insert(0, PROCESSED_DIR / "spatial" / "swd_chambers_pilot.geojson")
    elif layer_name in ["waterbodies-official", "waterbodies"]:
        candidate_paths.insert(0, PROCESSED_DIR / "spatial" / "waterbodies_pilot.geojson")
    elif layer_name in ["swd-pipes", "swd_pipes"]:
        candidate_paths.insert(0, PROCESSED_DIR / "spatial" / "swd_pipes_pilot.geojson")

    for p in candidate_paths:
        if p.exists():
            # If no bbox or limit requested, serve file directly (full backward compatibility)
            if not bbox and not limit:
                return FileResponse(p, media_type="application/geo+json")
            
            # Load and filter by bbox/limit
            cache_key = str(p)
            if cache_key not in _GEOJSON_CACHE:
                with open(p, "r", encoding="utf-8") as f:
                    _GEOJSON_CACHE[cache_key] = json.load(f)
            
            cached_data = _GEOJSON_CACHE[cache_key]
            features = cached_data.get("features", [])

            if bbox:
                try:
                    parts = [float(x.strip()) for x in bbox.split(",")]
                    if len(parts) == 4:
                        min_lon, min_lat, max_lon, max_lat = parts
                        features = [ft for ft in features if _feature_intersects_bbox(ft.get("geometry"), min_lon, min_lat, max_lon, max_lat)]
                except ValueError:
                    pass
            
            if limit and limit > 0:
                features = features[:limit]

            return JSONResponse({
                "type": "FeatureCollection",
                "crs": cached_data.get("crs"),
                "total_matched": len(features),
                "features": features
            })
    
    raise HTTPException(status_code=404, detail=f"Layer '{layer_name}' not found.")

@app.get("/api/interventions", tags=["Action Planning"])
def get_interventions():
    # Load from build_action_plan module
    from ..scripts.build_action_plan import INTERVENTIONS_CATALOGUE
    return {"interventions": INTERVENTIONS_CATALOGUE}

@app.post("/api/action-plans", response_model=ActionPlanResponse, tags=["Action Planning"])
def create_action_plan(req: ActionPlanRequest):
    from ..scripts.build_action_plan import generate_action_plan
    plan = generate_action_plan(
        budget_inr=req.budget_inr,
        equity_weight_factor=req.equity_weight_factor,
        selected_ward_num=req.selected_ward_num,
        max_workforce_person_months=req.max_workforce_person_months,
        max_horizon_months=req.max_horizon_months
    )
    return plan

@app.post("/api/scenarios/compare", response_model=ScenarioComparisonResponse, tags=["Scenario Simulation"])
def compare_scenarios(ward_num: Optional[int] = Query(None, description="Optional target ward number")):
    from ..scripts.build_action_plan import generate_scenario_comparison, generate_action_plan
    if ward_num is not None:
        plan = generate_action_plan(selected_ward_num=ward_num)
        return generate_scenario_comparison(plan=plan, ward_num=ward_num)

    scen_file = EXPORTS_DIR / "scenarios_latest.json"
    if not scen_file.exists():
        plan = generate_action_plan()
        return generate_scenario_comparison(plan=plan)
    
    with open(scen_file, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/reports", tags=["Reports"])
def list_reports():
    pdf_path = REPORTS_DIR / "ClimateAdapt_Pune_Action_Report.pdf"
    reports_list = []
    if pdf_path.exists():
        stat = pdf_path.stat()
        reports_list.append({
            "id": "latest",
            "title": "ClimateAdapt Pune Climate Action & Resilience Report",
            "format": "PDF",
            "size_bytes": stat.st_size,
            "modified_time": stat.st_mtime,
            "download_url": "/api/reports/latest/download"
        })
    return {"reports": reports_list}

@app.get("/api/reports/latest/download", tags=["Reports"])
def download_latest_report(ward_num: Optional[int] = Query(None, description="Optional target ward number for AI report")):
    from ..scripts.generate_report import generate_pdf_report
    pdf_path = generate_pdf_report(ward_num=ward_num)
    
    filename = f"ClimateAdapt_Pune_Action_Report_Ward{ward_num}.pdf" if ward_num else "ClimateAdapt_Pune_Action_Report.pdf"
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=filename
    )
