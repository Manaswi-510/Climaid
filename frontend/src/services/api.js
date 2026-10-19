/**
 * api.js — Climaid API service layer
 * All backend communication lives here. Components never call fetch() directly.
 */

export const API_BASE = '';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  return res.json();
}

export const api = {
  health: () => request('/health'),
  project: () => request('/api/project'),
  indicators: () => request('/api/indicators'),
  weather: () => request('/api/weather'),
  dataSources: () => request('/api/data-sources'),
  interventions: () => request('/api/interventions'),

  /** Map layer GeoJSON — supports optional bbox string "minLon,minLat,maxLon,maxLat" */
  mapLayer: (name, bbox) => {
    const qs = bbox ? `?bbox=${bbox}` : '';
    return request(`/api/map-layers/${name}${qs}`);
  },

  /** Generate action plan */
  actionPlan: (payload) =>
    request('/api/action-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  /** Scenario comparison — optionally pass plan payload and target ward number */
  scenarioCompare: (payload, wardNum) => {
    const qs = wardNum ? `?ward_num=${wardNum}` : '';
    return request(`/api/scenarios/compare${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
    });
  },

  /** Google Gemini AI Ward Resilience Analysis — POST with full plan data */
  wardAnalysis: (wardNum, planData, budget, workforce, horizon, forceRefresh = false) => {
    const qs = forceRefresh ? '?force_refresh=true' : '';
    return request(`/api/ai/ward-analysis/${wardNum}${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_data: planData,
        budget_inr: budget,
        max_workforce: workforce,
        max_horizon_months: horizon,
      }),
    });
  },

  /** Download report — POST with plan data for accurate PDF */
  reportDownload: (wardNum, planData) => {
    const qs = wardNum ? `?ward_num=${wardNum}` : '';
    return fetch(`${API_BASE}/api/reports/latest/download${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_data: planData }),
    });
  },

  /** Legacy URL-only accessor (kept for backwards compat) */
  reportDownloadUrl: (wardNum) => {
    const qs = wardNum ? `?ward_num=${wardNum}` : '';
    return `${API_BASE}/api/reports/latest/download${qs}`;
  },
};
