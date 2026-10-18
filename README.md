# ClimateAdapt Pune 🌦️🏛️

> **From Climate Data to Climate Action**  
> *An evidence-backed, AI-assisted climate adaptation action planner for Pune, Maharashtra, India.*

---

## 📌 Executive Summary

**ClimateAdapt Pune** combines localized atmospheric forecasts (Open-Meteo), OpenStreetMap spatial infrastructure (5,779 trees, 267 hospitals, waterways), and verified municipal drainage records (OpenCity Pune) across 76 electoral wards. 

### ⚖️ Core Scientific & Governance Principle
The system rigorously adheres to the **Principle of Evidence Distinction**:
- **Measured Administrative Facts** (e.g. OpenCity 2015-16 municipal stormwater and underground drainage coverage) are preserved with exact values.
- **Atmospheric Model Forecasts** (e.g. Open-Meteo 7-day NWP forecasts) are explicitly tagged and separated from historical normals.
- **Spatial Proxies** (e.g. green canopy deficit, heat exposure screening) are clearly distinguished from physical flood simulations or medical outcomes.
- **Missing or Unverified Data** (e.g. uncalibrated DEMs, local monitoring wells, historical flood complaint logs) are **never fabricated or assumed**—they are treated transparently as *missing* with explicit roadmap disclosures.

---

## 🗺️ Pilot Scope & Geography
- **Pilot Study Area**: Pune Urban Core, Maharashtra, India
- **Bounding Box**: `18.50°N` – `18.60°N` Latitude, `73.80°E` – `73.90°E` Longitude
- **Center Coordinates**: `18.523726°N, 73.868760°E`
- **Coordinate Reference System**: WGS 84 (`EPSG:4326`) | Projected for planar analysis: UTM Zone 43N (`EPSG:32643`)
- **Timezone**: `Asia/Kolkata`

---

## 🏗️ Project Architecture

```
climateadapt-pune/
├── .gitignore                      # Git ignore rules for Python, Node, .env, .cache
├── README.md                       # Comprehensive project & demo documentation
├── data/
│   ├── raw/                        # Immutable raw source assets
│   │   ├── osm/                    # 13 OSM GeoJSON layers (trees, roads, waterways, etc.)
│   │   ├── wards/                  # Electoral & admin boundaries (76 wards) and CSV metadata
│   │   ├── official_reports/       # OpenCity Pune SWD & underground drainage CSVs + KML/KMZs
│   │   ├── weather/                # Ingested Open-Meteo raw JSON, hourly & daily CSVs
│   │   ├── dem/                    # [Placeholder] Unconfirmed DEMs
│   │   ├── sentinel2/              # [Placeholder] Unconfirmed satellite products
│   │   └── population/             # [Placeholder] 2011 Census PCA
│   ├── processed/                  # Standardized data manifests & computed ward indicators
│   │   ├── data_manifest.json      # Machine-readable asset inventory
│   │   ├── data_quality_report.json# Data quality and missing dataset disclosures
│   │   ├── ward_indicators.json    # Computed screening proxies for all 76 wards
│   │   └── indicators_summary.json # Metric definitions and formulas
│   └── exports/                    # Portfolio plans & scenario comparisons
│       ├── action_plan_latest.json # Knapsack-optimized budget portfolio
│       └── scenarios_latest.json   # Baseline vs Heatwave vs Cloudburst scenarios
├── backend/
│   ├── .env                        # Local database & pilot configuration
│   ├── requirements.txt            # Python dependencies
│   ├── app/
│   │   ├── main.py                 # FastAPI application with REST endpoints
│   │   ├── database.py             # PostgreSQL / PostGIS SQLAlchemy connection
│   │   ├── models.py               # ORM database models
│   │   └── schemas.py              # Pydantic request/response schemas
│   └── scripts/
│       ├── fetch_weather.py        # Ingests Open-Meteo forecast with retry & cache
│       ├── validate_data.py        # Inventories datasets & outputs manifest
│       ├── process_indicators.py   # Computes heat, flood, water, & green proxies
│       ├── build_action_plan.py    # Knapsack portfolio optimization & scenarios
│       ├── generate_report.py      # Produces official PDF report
│       └── download_osm_notes.md   # OSM provenance & attribution documentation
├── frontend/                       # Modern React + Vite Dashboard
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx                 # Interactive tabs (Overview, Map, Evidence, Planner, Scenarios, Reports)
│       ├── main.jsx
│       └── index.css               # Vanilla CSS design system with glassmorphism
└── reports/
    └── ClimateAdapt_Pune_Action_Report.pdf  # Generated executive PDF report
```

---

## ⚡ Quickstart Guide

### 1. Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL (running on `localhost:5432`)

### 2. Backend & Data Pipeline Setup

```powershell
# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r backend/requirements.txt

# 1. Fetch live Open-Meteo weather forecast for Pune center
python backend/scripts/fetch_weather.py

# 2. Run data inventory & validation
python backend/scripts/validate_data.py

# 3. Calculate evidence-backed indicators across 76 wards
python backend/scripts/process_indicators.py

# 4. Generate budget-aware action plan & scenarios
python backend/scripts/build_action_plan.py

# 5. Compile official PDF action report
python backend/scripts/generate_report.py
```

### 3. Launch Backend API Server
```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive API docs available at: `http://127.0.0.1:8000/docs`

### 4. Launch Frontend Dashboard
```powershell
cd frontend
npm install
npm run dev
```
Open your browser to: **`http://127.0.0.1:5173/`**

---

## 📊 Core API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | `GET` | Health status of DB, manifest, indicator pipeline, and PDF report |
| `/api/project` | `GET` | Pilot extent, CRS, center coordinates, and core governance charter |
| `/api/data-sources` | `GET` | Full data inventory, freshness dates, and missing dataset warnings |
| `/api/indicators` | `GET` | 76 Pune wards with heat, flood, water, and green deficit proxies |
| `/api/weather` | `GET` | Current conditions and 7-day Open-Meteo atmospheric forecast |
| `/api/map-layers` | `GET` | Spatial layers register (wards, trees, waterways, hospitals) |
| `/api/map-layers/{id}` | `GET` | GeoJSON download endpoint for spatial layers |
| `/api/interventions` | `GET` | Adaptation action catalogue with unit costs and lead times |
| `/api/action-plans` | `POST` | Knapsack-optimized portfolio under configurable budget & equity weights |
| `/api/scenarios/compare`| `POST` | Comparative impact of heatwave, monsoon cloudburst, and post-plan |
| `/api/reports/latest/download` | `GET` | Stream download the executive PDF report |

---

## 📜 Attribution & Data Sources
- **Open-Meteo Forecast API**: Non-commercial atmospheric models ([Open-Meteo](https://open-meteo.com/))
- **OpenCity Pune**: Stormwater & underground drainage datasets ([OpenCity Pune](https://data.opencity.in/))
- **DataMeet Pune Chapter**: Electoral ward boundaries & administrative metadata under [CC BY-SA 2.5 IN](http://creativecommons.org/licenses/by-sa/2.5/in/)
- **OpenStreetMap Contributors**: Infrastructure layers under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/)
