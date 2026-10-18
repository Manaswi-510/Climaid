"""
models.py
SQLAlchemy ORM models for ClimateAdapt Pune database.
Defines both domain entities and actual PostGIS spatial layer tables.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, JSON, Boolean
from geoalchemy2 import Geometry
from .database import Base

# ==========================================
# PostGIS Spatial Layer Models (Phase 2A)
# ==========================================

class ElectoralWard(Base):
    """
    Pune Electoral Wards (76 administrative/electoral units)
    Mapped to actual table 'pune_electoral_wards' with PostGIS geometry.
    """
    __tablename__ = "pune_electoral_wards"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    ward_num = Column(Integer, index=True, nullable=False)
    ward_title = Column(String(200), nullable=True)
    area_zone = Column(String(100), nullable=True)
    heat_proxy = Column(Float, nullable=True)
    flood_proxy = Column(Float, nullable=True)
    water_stress_proxy = Column(Float, nullable=True)
    green_deficit_proxy = Column(Float, nullable=True)
    composite_score = Column(Float, nullable=True)
    ai_archetype = Column(String(255), nullable=True)
    pca_x = Column(Float, nullable=True)
    pca_y = Column(Float, nullable=True)
    geom_geojson = Column(JSON, nullable=True)
    geom = Column(Geometry(geometry_type="GEOMETRY", srid=4326), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Nalla(Base):
    """
    Natural drainage streams and nallas in Pune urban area.
    Mapped to actual table 'pune_nallas' (283 features).
    """
    __tablename__ = "pune_nallas"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=True)
    geom_geojson = Column(JSON, nullable=True)
    geom = Column(Geometry(geometry_type="GEOMETRY", srid=4326), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class SWDChamber(Base):
    """
    Stormwater utility chambers and inlet points.
    Mapped to actual table 'pune_swd_chambers' (1,532 points).
    """
    __tablename__ = "pune_swd_chambers"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=True)
    geom_geojson = Column(JSON, nullable=True)
    geom = Column(Geometry(geometry_type="GEOMETRY", srid=4326), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

# ==========================================
# Domain / Specification Models
# ==========================================

class StudyArea(Base):
    __tablename__ = "study_areas"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    bbox_min_lat = Column(Float, nullable=False)
    bbox_max_lat = Column(Float, nullable=False)
    bbox_min_lon = Column(Float, nullable=False)
    bbox_max_lon = Column(Float, nullable=False)
    center_lat = Column(Float, nullable=False)
    center_lon = Column(Float, nullable=False)
    crs = Column(String(50), default="EPSG:4326")
    timezone = Column(String(50), default="Asia/Kolkata")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class DataAsset(Base):
    __tablename__ = "data_assets"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    source = Column(String(255), nullable=False)
    license = Column(String(100), default="Open Data")
    status = Column(String(50), default="VALID")
    size_bytes = Column(Integer, default=0)
    feature_count = Column(Integer, default=0)
    retrieved_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    notes = Column(Text, nullable=True)

class WeatherRecord(Base):
    __tablename__ = "weather_records"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    recorded_at = Column(DateTime, nullable=False)
    data_type = Column(String(50), default="forecast") # 'forecast' vs 'observation'
    temperature_c = Column(Float, nullable=True)
    relative_humidity_pct = Column(Float, nullable=True)
    precipitation_mm = Column(Float, nullable=True)
    wind_speed_kmh = Column(Float, nullable=True)
    cloud_cover_pct = Column(Float, nullable=True)
    et0_mm = Column(Float, nullable=True)
    raw_json = Column(JSON, nullable=True)

class IndicatorResult(Base):
    __tablename__ = "indicator_results"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    ward_num = Column(Integer, index=True, nullable=False)
    ward_title = Column(String(150), nullable=False)
    area_zone = Column(String(100), nullable=True)
    heat_exposure_proxy = Column(Float, nullable=False)
    flood_screening_proxy = Column(Float, nullable=False)
    water_stress_proxy = Column(Float, nullable=False)
    green_deficit_proxy = Column(Float, nullable=False)
    composite_vulnerability_score = Column(Float, nullable=False)
    confidence = Column(String(100), default="Medium (Model & Proxies)")
    formula_version = Column(String(50), default="1.0.0-pune-screening")
    evidence_json = Column(JSON, nullable=True)
    limitations_json = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Intervention(Base):
    __tablename__ = "interventions"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    category = Column(String(100), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    unit_cost_inr = Column(Float, nullable=False)
    unit = Column(String(50), default="unit")
    max_units = Column(Integer, default=10)
    lead_time_months = Column(Integer, default=1)
    risk_reduction_score = Column(Float, default=80.0)
    co_benefits_score = Column(Float, default=80.0)
    equity_weight = Column(Float, default=80.0)
    responsible_dept = Column(String(150), nullable=False)
    target_vulnerability = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)

class ActionPlanRun(Base):
    __tablename__ = "action_plan_runs"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    plan_name = Column(String(150), nullable=False)
    total_budget_inr = Column(Float, nullable=False)
    allocated_spend_inr = Column(Float, nullable=False)
    total_benefit_points = Column(Float, nullable=False)
    equity_weight_factor = Column(Float, default=1.0)
    portfolio_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
