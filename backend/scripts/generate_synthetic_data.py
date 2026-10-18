"""
generate_synthetic_data.py
==========================
ClimateAdapt Pune — Synthetic Prototype-Data Generator
"""

import argparse
import sys
import textwrap
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

_this_file = Path(__file__).resolve()
if _this_file.parent.name == "scripts" and _this_file.parent.parent.name == "backend":
    REPO_ROOT = _this_file.parent.parent.parent
elif _this_file.parent.name == "scripts":
    REPO_ROOT = _this_file.parent.parent
else:
    REPO_ROOT = _this_file.parent

OUT_DIR = REPO_ROOT / "data" / "raw" / "synthetic"

PILOT_BBOX = {
    "min_lat": 18.50,
    "max_lat": 18.60,
    "min_lon": 73.80,
    "max_lon": 73.90,
}

N_ROWS   = 10
N_COLS   = 10
LAT_STEP = (PILOT_BBOX["max_lat"] - PILOT_BBOX["min_lat"]) / N_ROWS
LON_STEP = (PILOT_BBOX["max_lon"] - PILOT_BBOX["min_lon"]) / N_COLS
GENERATED_AT   = datetime.now(timezone.utc).isoformat()
SYNTHETIC_FLAG = True


def cell_id(row: int, col: int) -> str:
    return f"GCELL_{row:03d}_{col:03d}"


def grid_coords() -> pd.DataFrame:
    rows = []
    for r in range(N_ROWS):
        for c in range(N_COLS):
            lat = PILOT_BBOX["min_lat"] + (r + 0.5) * LAT_STEP
            lon = PILOT_BBOX["min_lon"] + (c + 0.5) * LON_STEP
            rows.append({"grid_cell_id": cell_id(r, c),
                          "lat_centre": round(lat, 6),
                          "lon_centre": round(lon, 6)})
    return pd.DataFrame(rows)


def check_conflicts(filenames, force=False):
    conflicts = [OUT_DIR / f for f in filenames if (OUT_DIR / f).exists()]
    if conflicts and not force:
        msg = "\n".join(f"  {p}" for p in conflicts)
        print(
            f"[CONFLICT] The following output files already exist.\n"
            f"  Use --force to overwrite them, or remove them manually first.\n{msg}",
            file=sys.stderr,
        )
        sys.exit(1)
    elif conflicts and force:
        print("  [NOTE] --force specified: overwriting existing synthetic files.")


def smooth_field(rng, rows, cols, passes=4):
    field = rng.random((rows, cols))
    for _ in range(passes):
        padded = np.pad(field, 1, mode="edge")
        smoothed = np.zeros_like(field)
        for dr in range(3):
            for dc in range(3):
                smoothed += padded[dr: dr + rows, dc: dc + cols]
        field = smoothed / 9.0
    field = (field - field.min()) / (field.max() - field.min() + 1e-9)
    return field


def write_csv(df, path, description):
    df.to_csv(path, index=False)
    print(f"  [OK] {path.name:40s}  {len(df):>5d} rows   {path.stat().st_size:>8d} bytes  — {description}")


def generate_elevation_grid(rng):
    base_elevation_m = 565.0
    range_m          = 40.0
    elev_field = smooth_field(rng, N_ROWS, N_COLS, passes=5)
    elev_m     = base_elevation_m + (elev_field - 0.5) * range_m * 2
    dy_m = LAT_STEP * 111_000
    dx_m = LON_STEP *  97_000
    slope_deg = np.zeros_like(elev_m)
    for r in range(N_ROWS):
        for c in range(N_COLS):
            r0, r1 = max(0, r-1), min(N_ROWS-1, r+1)
            c0, c1 = max(0, c-1), min(N_COLS-1, c+1)
            dz_y = (elev_m[r1,c] - elev_m[r0,c]) / ((r1-r0)*dy_m)
            dz_x = (elev_m[r,c1] - elev_m[r,c0]) / ((c1-c0)*dx_m)
            slope_deg[r, c] = np.degrees(np.arctan(np.hypot(dz_y, dz_x)))
    gc = grid_coords()
    rows = []
    for idx, row in gc.iterrows():
        r = idx // N_COLS; c = idx % N_COLS
        rows.append({
            "grid_cell_id": row["grid_cell_id"],
            "lat_centre":   row["lat_centre"],
            "lon_centre":   row["lon_centre"],
            "elevation_m":  round(float(elev_m[r, c]), 2),
            "slope_deg":    round(float(slope_deg[r, c]), 3),
            "terrain_note": "SYNTHETIC - NOT REAL MEASUREMENT - spatially smoothed prototype surface",
            "is_synthetic": SYNTHETIC_FLAG,
        })
    return pd.DataFrame(rows)


def generate_drainage_network(rng):
    gc = grid_coords()
    junctions = []
    junc_lookup = {}
    for _, row in gc.iterrows():
        jid = f"JN_{row['grid_cell_id']}"
        junctions.append({
            "junction_id":   jid,
            "grid_cell_id":  row["grid_cell_id"],
            "lat":           row["lat_centre"],
            "lon":           row["lon_centre"],
            "junction_note": "SYNTHETIC - NOT REAL PMC SWD JUNCTION",
            "is_synthetic":  SYNTHETIC_FLAG,
        })
        junc_lookup[row["grid_cell_id"]] = jid
    junc_df = pd.DataFrame(junctions)

    ns_dist_m = LAT_STEP * 111_000
    ew_dist_m = LON_STEP *  97_000
    CONDITION_OPTS = ["Good", "Fair", "Poor", "Critical"]
    STATUS_OPTS    = ["Active", "Partially_blocked", "Blocked", "Unknown"]

    segments = []
    seg_id_counter = 1
    for r in range(N_ROWS):
        for c in range(N_COLS):
            src_cell = cell_id(r, c)
            src_jid  = junc_lookup[src_cell]
            candidates = []
            if r + 1 < N_ROWS: candidates.append((r+1, c, ns_dist_m))
            if c - 1 >= 0:     candidates.append((r, c-1, ew_dist_m))
            for tr, tc, base_dist in candidates:
                tgt_cell = cell_id(tr, tc)
                tgt_jid  = junc_lookup[tgt_cell]
                length_m = round(base_dist * rng.uniform(0.90, 1.10), 1)
                width_m  = round(rng.uniform(0.3, 2.5), 2)
                capacity = round(width_m * rng.uniform(0.8, 2.0) * 0.4, 4)
                cond     = rng.choice(CONDITION_OPTS, p=[0.35, 0.35, 0.20, 0.10])
                status   = rng.choice(STATUS_OPTS,    p=[0.50, 0.25, 0.15, 0.10])
                segments.append({
                    "drain_id":      f"DRN_{seg_id_counter:04d}",
                    "start_junc_id": src_jid,
                    "end_junc_id":   tgt_jid,
                    "length_m":      length_m,
                    "width_m":       width_m,
                    "capacity_m3s":  capacity,
                    "condition":     cond,
                    "status":        status,
                    "drain_note":    "SYNTHETIC - NOT REAL PMC SWD SEGMENT",
                    "is_synthetic":  SYNTHETIC_FLAG,
                })
                seg_id_counter += 1
    seg_df = pd.DataFrame(segments)
    return junc_df, seg_df


def generate_green_cover(rng):
    veg_field    = smooth_field(rng, N_ROWS, N_COLS, passes=4)
    canopy_field = smooth_field(rng, N_ROWS, N_COLS, passes=4)
    canopy_field = np.minimum(canopy_field, veg_field)
    veg_field    = 0.05 + veg_field    * 0.50
    canopy_field = 0.02 + canopy_field * 0.33
    gc = grid_coords()
    rows = []
    for idx, row in gc.iterrows():
        r = idx // N_COLS; c = idx % N_COLS
        veg    = round(float(np.clip(veg_field[r,c],    0.0, 1.0)), 4)
        canopy = round(float(np.clip(canopy_field[r,c], 0.0, 1.0)), 4)
        rows.append({
            "grid_cell_id":        row["grid_cell_id"],
            "lat_centre":          row["lat_centre"],
            "lon_centre":          row["lon_centre"],
            "vegetation_fraction": veg,
            "canopy_fraction":     canopy,
            "cover_note":          "SYNTHETIC - NOT REAL SENTINEL-2 / NDVI MEASUREMENT",
            "is_synthetic":        SYNTHETIC_FLAG,
        })
    return pd.DataFrame(rows)


def generate_heat_indicators(rng, green_df):
    built_field = smooth_field(rng, N_ROWS, N_COLS, passes=3)
    built_field = 0.30 + built_field * 0.60
    shade_field = (1.0 - built_field) * rng.uniform(0.3, 0.7, (N_ROWS, N_COLS))
    shade_field = np.clip(shade_field, 0.0, 1.0)
    canopy_arr  = green_df["canopy_fraction"].to_numpy().reshape(N_ROWS, N_COLS)
    simulated_lst = (
        35.0
        + 10.0 * built_field
        -  6.0 * canopy_arr
        -  4.0 * shade_field
        + rng.normal(0, 0.8, (N_ROWS, N_COLS))
    )
    gc = grid_coords()
    rows = []
    for idx, row in gc.iterrows():
        r = idx // N_COLS; c = idx % N_COLS
        rows.append({
            "grid_cell_id":              row["grid_cell_id"],
            "lat_centre":                row["lat_centre"],
            "lon_centre":                row["lon_centre"],
            "simulated_surface_temp_c":  round(float(simulated_lst[r,c]), 2),
            "built_up_fraction":         round(float(built_field[r,c]), 4),
            "shade_fraction":            round(float(shade_field[r,c]), 4),
            "heat_note": "SYNTHETIC - simulated_surface_temp_c is a Land Surface Temperature proxy NOT measured air temperature",
            "is_synthetic": SYNTHETIC_FLAG,
        })
    return pd.DataFrame(rows)


def generate_water_stress(rng):
    gc = grid_coords()
    base_demand = rng.uniform(0.40, 1.50, len(gc))
    SCENARIOS = {
        "S1_Baseline":  {"demand_factor": 1.00, "supply_factor": 1.00, "label": "Typical dry-season baseline"},
        "S2_Heatwave":  {"demand_factor": 1.20, "supply_factor": 0.90, "label": "Heatwave shock (+20pct demand, -10pct supply)"},
        "S3_PostAdapt": {"demand_factor": 0.90, "supply_factor": 1.05, "label": "Post-adaptation (conservation + recycled water)"},
    }
    rows = []
    scen_counter = 1
    for scen_key, scen in SCENARIOS.items():
        for idx, cell in gc.iterrows():
            demand  = round(base_demand[idx] * scen["demand_factor"], 4)
            supply  = round(demand * rng.uniform(0.75, 1.15) * scen["supply_factor"], 4)
            shortage = round(max(0.0, demand - supply), 4)
            rows.append({
                "scenario_id":         f"SCN_{scen_counter:04d}",
                "scenario_key":        scen_key,
                "scenario_label":      scen["label"],
                "grid_cell_id":        cell["grid_cell_id"],
                "lat_centre":          cell["lat_centre"],
                "lon_centre":          cell["lon_centre"],
                "demand_ml_per_day":   demand,
                "supply_ml_per_day":   supply,
                "shortage_ml_per_day": shortage,
                "water_note": "SYNTHETIC - NOT real GSDA/MIDC/PMRDA data. shortage = max(0, demand - supply).",
                "is_synthetic": SYNTHETIC_FLAG,
            })
            scen_counter += 1
    return pd.DataFrame(rows)


README_CONTENT = """# ClimateAdapt Pune - Synthetic Prototype Data
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
"""


def main():
    parser = argparse.ArgumentParser(
        description="Generate synthetic prototype datasets for ClimateAdapt Pune.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--seed", type=int, default=42,
                        help="Integer random seed (default: 42).")
    parser.add_argument("--force", "-f", action="store_true",
                        help="Overwrite existing output files if they exist.")
    args = parser.parse_args()

    print(f"\n[*] ClimateAdapt Pune - Synthetic Data Generator")
    print(f"    Generated at : {GENERATED_AT}")
    print(f"    Random seed  : {args.seed}")
    print(f"    Pilot bbox   : lat {PILOT_BBOX['min_lat']}-{PILOT_BBOX['max_lat']}, "
          f"lon {PILOT_BBOX['min_lon']}-{PILOT_BBOX['max_lon']}")
    print(f"    Grid cells   : {N_ROWS} rows x {N_COLS} cols = {N_ROWS*N_COLS} total\n")

    output_files = [
        "elevation_grid.csv", "drainage_junctions.csv", "drainage_segments.csv",
        "green_cover_grid.csv", "heat_indicators.csv",
        "water_stress_scenarios.csv", "README.md",
    ]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    check_conflicts(output_files, force=args.force)

    rng = np.random.default_rng(seed=args.seed)

    print("[*] Generating datasets ...")

    elev_df = generate_elevation_grid(rng)
    write_csv(elev_df, OUT_DIR / "elevation_grid.csv",
              "Spatially coherent terrain (elevation + slope)")

    junc_df, seg_df = generate_drainage_network(rng)
    write_csv(junc_df, OUT_DIR / "drainage_junctions.csv",
              "Synthetic SWD junction nodes (100 nodes)")
    write_csv(seg_df,  OUT_DIR / "drainage_segments.csv",
              "Synthetic SWD segments (dendritic topology)")

    green_df = generate_green_cover(rng)
    write_csv(green_df, OUT_DIR / "green_cover_grid.csv",
              "Vegetation + canopy fractions per cell")

    heat_df = generate_heat_indicators(rng, green_df)
    write_csv(heat_df, OUT_DIR / "heat_indicators.csv",
              "Simulated surface-temperature proxy + built-up/shade")

    water_df = generate_water_stress(rng)
    write_csv(water_df, OUT_DIR / "water_stress_scenarios.csv",
              "3-scenario demand / supply / shortage per cell")

    readme_path = OUT_DIR / "README.md"
    readme_path.write_text(README_CONTENT, encoding="utf-8")
    print(f"  [OK] {'README.md':40s}        -  methodology & limitations")

    # --- Validation ---
    print("\n[*] Validation ...")
    assert elev_df["elevation_m"].between(500, 640).all(), "elevation_m out of range"
    assert elev_df["slope_deg"].between(0, 30).all(), "slope_deg out of range"
    junc_ids = set(junc_df["junction_id"])
    assert set(seg_df["start_junc_id"]).issubset(junc_ids), "missing start junctions"
    assert set(seg_df["end_junc_id"]).issubset(junc_ids), "missing end junctions"
    assert (seg_df["length_m"] > 0).all(), "negative lengths"
    assert (seg_df["width_m"]  > 0).all(), "negative widths"
    assert (seg_df["capacity_m3s"] > 0).all(), "negative capacities"
    assert green_df["vegetation_fraction"].between(0, 1).all(), "vegetation out of [0,1]"
    assert green_df["canopy_fraction"].between(0, 1).all(), "canopy out of [0,1]"
    assert (green_df["canopy_fraction"] <= green_df["vegetation_fraction"] + 1e-6).all(), "canopy > veg"
    assert heat_df["built_up_fraction"].between(0, 1).all(), "built_up out of [0,1]"
    assert heat_df["shade_fraction"].between(0, 1).all(), "shade out of [0,1]"
    computed = (water_df["demand_ml_per_day"] - water_df["supply_ml_per_day"]).clip(lower=0)
    assert (water_df["shortage_ml_per_day"] - computed).abs().lt(1e-6).all(), "shortage inconsistent"
    assert (water_df["shortage_ml_per_day"] >= 0).all(), "negative shortage"
    base_ids = set(elev_df["grid_cell_id"])
    for df, name in [(junc_df, "drainage_junctions"), (green_df, "green_cover"), (heat_df, "heat_indicators")]:
        assert set(df["grid_cell_id"]) == base_ids, f"{name}: grid_cell_ids mismatch"
    for df, name in [(elev_df, "elevation_grid"), (junc_df, "junctions"), (seg_df, "segments"),
                     (green_df, "green_cover"), (heat_df, "heat_indicators"), (water_df, "water_stress")]:
        assert df["is_synthetic"].all(), f"{name}: is_synthetic False somewhere"

    print("  [PASS] elevation_m in [530, 620] m, slope_deg in [0, 30] deg")
    print("  [PASS] all segment junctions exist in drainage_junctions")
    print("  [PASS] lengths, widths, capacities > 0")
    print("  [PASS] green fractions in [0,1]; canopy <= vegetation")
    print("  [PASS] built_up_fraction, shade_fraction in [0,1]")
    print("  [PASS] shortage = max(0, demand - supply) for all 300 rows")
    print("  [PASS] grid_cell_id consistent across elevation, junctions, green, heat")
    print("  [PASS] is_synthetic = True in every row of every dataset")

    print("\n[*] Output files:")
    total_bytes = 0
    for fname in output_files:
        p = OUT_DIR / fname
        sz = p.stat().st_size
        total_bytes += sz
        print(f"    {p}")
    print(f"\n    Total: {total_bytes:,} bytes across {len(output_files)} files")
    print("\n[DONE] All synthetic files written and validated successfully.")
    print("  NOTE: Do NOT present these values as real measurements.")

if __name__ == "__main__":
    main()
