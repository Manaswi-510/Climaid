"""
schemas.py
Pydantic data schemas for ClimateAdapt Pune REST API.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ProjectInfo(BaseModel):
    name: str = "ClimateAdapt Pune"
    version: str = "1.0.0"
    status: str = "Operational"
    pilot_area: str = "Pune Urban Core, Maharashtra, India"
    bounding_box: Dict[str, float]
    center_coordinates: Dict[str, float]
    timezone: str = "Asia/Kolkata"
    crs: str = "EPSG:4326 (Projected: UTM 43N EPSG:32643)"
    data_quality_disclaimer: str

class DataSourceAsset(BaseModel):
    filename: Optional[str] = None
    identifier: Optional[str] = None
    category: str
    source: Optional[str] = "Municipal / Global Data"
    description: Optional[str] = None
    status: str
    size_bytes: Optional[int] = 0
    feature_count: Optional[int] = None
    notes: Optional[str] = None

class DataSourcesResponse(BaseModel):
    generated_at_utc: str
    total_assets: int
    assets: List[DataSourceAsset]
    issues_and_notices: List[str]

class WardIndicator(BaseModel):
    ward_num: int
    ward_title: str
    area_zone: Optional[str] = None
    population_voters_proxy: Optional[int] = None
    indicators: Dict[str, float]
    evidence: Dict[str, Any]
    confidence: str
    limitations_and_gaps: List[str]

class IndicatorsResponse(BaseModel):
    formula_version: str
    pilot_area: str
    total_wards_analyzed: int
    top_vulnerable_wards: List[str]
    wards: List[WardIndicator]

class InterventionItem(BaseModel):
    id: str
    category: str
    title: str
    description: str
    unit_cost_inr: float
    unit: str
    max_units: int
    lead_time_months: int
    risk_reduction_score: float
    co_benefits_score: float
    equity_weight: float
    maintenance_burden: str
    responsible_department: str
    target_vulnerability: str

class ActionPlanRequest(BaseModel):
    budget_inr: float = Field(default=5000000, ge=0, le=100000000)
    equity_weight_factor: float = Field(default=1.0, ge=0.0, le=2.0)
    selected_ward_num: Optional[int] = None
    max_workforce_person_months: Optional[float] = None
    max_horizon_months: Optional[int] = None

class ActionPlanPortfolioItem(BaseModel):
    id: str
    title: str
    category: str
    allocated_units: int
    unit: str
    unit_cost_inr: float
    total_cost_inr: float
    lead_time_months: int
    utility_score: float
    responsible_department: str
    rationale: str
    workforce_person_months: Optional[float] = None
    target_vulnerability: Optional[str] = None
    data_quality_status: Optional[str] = None
    selection_justification: Optional[str] = None

class ActionPlanResponse(BaseModel):
    generated_at_utc: str
    pilot_area: str
    target_ward: str
    budget_constraints: Dict[str, Any]
    performance_metrics: Dict[str, Any]
    portfolio: List[ActionPlanPortfolioItem]
    rejected_candidates: Optional[List[Dict[str, Any]]] = None
    assumptions_and_limitations: Optional[List[str]] = None

class ScenarioComparisonResponse(BaseModel):
    generated_at_utc: str
    target_ward: Optional[str] = None
    baseline_scenario: Dict[str, Any]
    heatwave_scenario: Dict[str, Any]
    flash_rainfall_scenario: Dict[str, Any]
    post_adaptation_scenario: Dict[str, Any]

