"""
fetch_weather.py
Fetches Pune weather forecast using Open-Meteo API.
Adheres to ClimateAdapt Pune specification:
- Saves complete response with metadata to data/raw/weather/pune_forecast_raw.json
- Exports hourly forecast to data/raw/weather/pune_forecast_hourly.csv
- Exports daily forecast to data/raw/weather/pune_forecast_daily.csv
- Exports current conditions to data/raw/weather/pune_forecast_current.json
- Clearly tags data_type='forecast' (never conflating forecast with historical observations)
"""

import os
import sys
import json
import argparse
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd
import requests_cache
from retry_requests import retry
import openmeteo_requests

# Default coordinates for Pune Pilot Center
DEFAULT_LAT = 18.523726
DEFAULT_LON = 73.868760
DEFAULT_TIMEZONE = "Asia/Kolkata"

def fetch_and_save_weather(lat: float = DEFAULT_LAT, lon: float = DEFAULT_LON, tz: str = DEFAULT_TIMEZONE, output_dir: Path = None):
    if output_dir is None:
        # Resolve data/raw/weather relative to repo root
        repo_root = Path(__file__).resolve().parent.parent.parent
        output_dir = repo_root / "data" / "raw" / "weather"

    output_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = repo_root / ".cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    print(f"[*] Initializing Open-Meteo client (Cache dir: {cache_dir})...")
    cache_session = requests_cache.CachedSession(str(cache_dir / "openmeteo_cache"), expire_after=3600)
    retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
    openmeteo = openmeteo_requests.Client(session=retry_session)

    url = "https://api.open-meteo.com/v1/forecast"
    daily_vars = [
        "temperature_2m_max", "temperature_2m_min",
        "apparent_temperature_max", "apparent_temperature_min",
        "precipitation_sum", "precipitation_probability_max",
        "wind_speed_10m_max", "shortwave_radiation_sum",
        "et0_fao_evapotranspiration", "uv_index_max"
    ]
    hourly_vars = [
        "temperature_2m", "relative_humidity_2m", "apparent_temperature",
        "rain", "precipitation_probability", "precipitation",
        "cloud_cover", "wind_speed_10m", "wind_gusts_10m",
        "evapotranspiration", "et0_fao_evapotranspiration",
        "soil_moisture_0_to_1cm", "soil_moisture_9_to_27cm"
    ]
    current_vars = [
        "temperature_2m", "relative_humidity_2m", "apparent_temperature",
        "precipitation", "cloud_cover", "wind_speed_10m", "wind_gusts_10m"
    ]

    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": daily_vars,
        "hourly": hourly_vars,
        "current": current_vars,
        "timezone": tz,
    }

    print(f"[*] Requesting Open-Meteo Forecast for Pune (lat: {lat}, lon: {lon}, tz: {tz})...")
    retrieval_time = datetime.now(timezone.utc).isoformat()
    
    try:
        responses = openmeteo.weather_api(url, params=params)
        response = responses[0]
    except Exception as e:
        print(f"[!] Error fetching Open-Meteo forecast: {e}", file=sys.stderr)
        raise

    resolved_lat = response.Latitude()
    resolved_lon = response.Longitude()
    elevation = response.Elevation()
    resp_tz = response.Timezone().decode() if isinstance(response.Timezone(), bytes) else response.Timezone()
    resp_tz_abbr = response.TimezoneAbbreviation().decode() if isinstance(response.TimezoneAbbreviation(), bytes) else response.TimezoneAbbreviation()
    utc_offset = response.UtcOffsetSeconds()

    print(f"[+] Coordinates received: {resolved_lat:.4f}°N, {resolved_lon:.4f}°E | Elevation: {elevation} m | Timezone: {resp_tz} ({resp_tz_abbr})")

    # 1. Process Current Weather
    current = response.Current()
    current_data = {
        "retrieved_at_utc": retrieval_time,
        "data_type": "forecast_current",
        "source": "Open-Meteo Forecast API",
        "latitude": resolved_lat,
        "longitude": resolved_lon,
        "elevation_m": elevation,
        "timezone": resp_tz,
        "time_epoch": current.Time(),
        "temperature_2m_c": float(current.Variables(0).Value()),
        "relative_humidity_2m_pct": float(current.Variables(1).Value()),
        "apparent_temperature_c": float(current.Variables(2).Value()),
        "precipitation_mm": float(current.Variables(3).Value()),
        "cloud_cover_pct": float(current.Variables(4).Value()),
        "wind_speed_10m_kmh": float(current.Variables(5).Value()),
        "wind_gusts_10m_kmh": float(current.Variables(6).Value())
    }

    current_file = output_dir / "pune_forecast_current.json"
    with open(current_file, "w", encoding="utf-8") as f:
        json.dump(current_data, f, indent=2)
    print(f"[+] Saved current forecast to {current_file}")

    # 2. Process Hourly Weather
    hourly = response.Hourly()
    hourly_date_range = pd.date_range(
        start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
        end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
        freq=pd.Timedelta(seconds=hourly.Interval()),
        inclusive="left"
    ).tz_convert(resp_tz)

    hourly_dict = {
        "datetime": hourly_date_range.strftime("%Y-%m-%dT%H:%M:%S%z")
    }
    for idx, var_name in enumerate(hourly_vars):
        hourly_dict[var_name] = hourly.Variables(idx).ValuesAsNumpy().tolist()

    df_hourly = pd.DataFrame(data=hourly_dict)
    hourly_csv_file = output_dir / "pune_forecast_hourly.csv"
    df_hourly.to_csv(hourly_csv_file, index=False)
    print(f"[+] Saved hourly forecast ({len(df_hourly)} rows) to {hourly_csv_file}")

    # 3. Process Daily Weather
    daily = response.Daily()
    daily_date_range = pd.date_range(
        start=pd.to_datetime(daily.Time(), unit="s", utc=True),
        end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
        freq=pd.Timedelta(seconds=daily.Interval()),
        inclusive="left"
    ).tz_convert(resp_tz)

    daily_dict = {
        "date": daily_date_range.strftime("%Y-%m-%d")
    }
    for idx, var_name in enumerate(daily_vars):
        daily_dict[var_name] = daily.Variables(idx).ValuesAsNumpy().tolist()

    df_daily = pd.DataFrame(data=daily_dict)
    daily_csv_file = output_dir / "pune_forecast_daily.csv"
    df_daily.to_csv(daily_csv_file, index=False)
    print(f"[+] Saved daily forecast ({len(df_daily)} rows) to {daily_csv_file}")

    # 4. Save Raw Combined JSON representation with full provenance
    raw_payload = {
        "metadata": {
            "source": "Open-Meteo Weather Forecast API",
            "url": url,
            "data_type": "forecast",
            "retrieval_timestamp_utc": retrieval_time,
            "pilot_area": "Pune Pilot, Maharashtra, India",
            "requested_coordinates": {"latitude": lat, "longitude": lon},
            "resolved_coordinates": {"latitude": resolved_lat, "longitude": resolved_lon},
            "elevation_m": elevation,
            "timezone": resp_tz,
            "utc_offset_seconds": utc_offset,
            "disclaimer": "This dataset represents a short-term model forecast and not historical climate observations."
        },
        "current": current_data,
        "hourly_summary": {
            "interval_seconds": hourly.Interval(),
            "variables": hourly_vars,
            "record_count": len(df_hourly)
        },
        "daily_summary": {
            "interval_seconds": daily.Interval(),
            "variables": daily_vars,
            "record_count": len(df_daily)
        }
    }

    raw_json_file = output_dir / "pune_forecast_raw.json"
    with open(raw_json_file, "w", encoding="utf-8") as f:
        json.dump(raw_payload, f, indent=2)
    print(f"[+] Saved raw forecast payload with metadata to {raw_json_file}")
    print("[SUCCESS] Weather data ingestion completed successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch and store Pune weather forecast from Open-Meteo")
    parser.add_argument("--lat", type=float, default=DEFAULT_LAT, help="Latitude (default Pune Center: 18.523726)")
    parser.add_argument("--lon", type=float, default=DEFAULT_LON, help="Longitude (default Pune Center: 73.868760)")
    parser.add_argument("--tz", type=str, default=DEFAULT_TIMEZONE, help="Timezone (default Asia/Kolkata)")
    args = parser.parse_args()

    fetch_and_save_weather(lat=args.lat, lon=args.lon, tz=args.tz)
