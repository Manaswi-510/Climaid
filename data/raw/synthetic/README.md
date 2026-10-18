# ClimateAdapt Pune - Synthetic Prototype Data
## data/raw/synthetic/

> **IMPORTANT:** Every file in this directory contains synthetic,
> computationally generated data. None of these files represent
> real field measurements, official PMC records, Census enumerations,
> satellite imagery, or any other primary source.
> All rows carry is_synthetic = True.

## Purpose

The ClimateAdapt Pune implementation guide identifies several data gaps:

| Gap | Synthetic placeholder |
|-----|-----------------------|
| NRSC / Bhuvan 30 m DEM | elevation_grid.csv |
| PMC SWD pipe-condition survey | drainage_segments.csv + drainage_junctions.csv |
| Sentinel-2 NDVI land-cover | green_cover_grid.csv |
| Land Surface Temperature raster | heat_indicators.csv |
| GSDA / MIDC demand-supply ledger | water_stress_scenarios.csv |

## Generation method

Script  : backend/scripts/generate_synthetic_data.py
Language: Python 3, NumPy + pandas (no new dependencies)
Random seed: 42 (matches the project KMeans random_state)

## Grid layout

| Parameter | Value |
|-----------|-------|
| Pilot bbox | lat 18.50-18.60, lon 73.80-73.90 |
| Grid rows | 10 |
| Grid cols | 10 |
| Total cells | 100 |
| Cell spacing | ~0.01 deg (approx 1.1 km N-S, 0.97 km E-W) |
| Cell-ID format | GCELL_RRR_CCC |

Pilot bounding box taken verbatim from clean_and_process_data.py Phase 1.

## Spatial coherence

Fields use iterative box-smoothing (4-5 passes, 3x3 kernel) rather than
i.i.d. noise, so neighbouring cells have correlated values. Not calibrated
to any real DEM or remote-sensing product.

## File summaries

### elevation_grid.csv
- elevation_m: synthetic surface elevation (565 +/- 20 m, plateau range)
- slope_deg: derived from finite-difference gradient of elevation grid

### drainage_junctions.csv
- One junction per grid cell (100 total). IDs referenced by segments.

### drainage_segments.csv
- Dendritic (tree) topology routing south-west (echoing Mula-Mutha direction)
- capacity_m3s: simplified rectangular-channel approximation, NOT HEC-RAS
- condition: {Good, Fair, Poor, Critical} with realistic proportions (35/35/20/10%)
- status: {Active, Partially_blocked, Blocked, Unknown}
- Real PMC SWD network (60,741 segments) is in data/processed/spatial/swd_pipes_pilot.geojson

### green_cover_grid.csv
- vegetation_fraction: 0.05-0.55
- canopy_fraction: 0.02-0.35, always <= vegetation_fraction
- NOT from Sentinel-2 NDVI

### heat_indicators.csv
- simulated_surface_temp_c: Land Surface Temperature proxy, NOT 2m air temperature
- Model: base 35C + 10C*built_up - 6C*canopy - 4C*shade + N(0, 0.8)
- Real Open-Meteo air temperature in data/raw/weather/

### water_stress_scenarios.csv
- 3 scenarios x 100 cells = 300 rows
- shortage_ml_per_day = max(0, demand - supply), always consistent
- NOT from GSDA / MIDC / PMRDA supply ledgers

## Limitations

1. No physical simulation - statistically plausible but not calibrated
2. No temporal dimension - single snapshot
3. Coarse resolution - 100 cells at ~1 km2
4. Drainage topology - simple dendritic graph, not real PMC SWD

## Real data sources (when available)

| Dataset | Provider | Status |
|---------|----------|--------|
| 30 m DEM | NRSC / Bhuvan | Not yet acquired |
| Cloud-screened NDVI | Copernicus Sentinel-2 | Not yet acquired |
| Pipe-condition survey | PMC SWD division | Not yet acquired |
| Well hydrographs | GSDA observation wells | Not yet acquired |
| Demand-supply ledger | MIDC / PMRDA | Not yet acquired |
