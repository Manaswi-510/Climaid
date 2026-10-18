/**
 * api.js — Climaid API service layer
 * All backend communication lives here. Components never call fetch() directly.
 */

export const API_BASE = 'http://127.0.0.1:8000';

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

  /** Google Gemini AI Ward Resilience Analysis */
  wardAnalysis: (wardNum, budget, forceRefresh = false) => {
    const qs = new URLSearchParams();
    if (budget) qs.append('budget_inr', budget);
    if (forceRefresh) qs.append('force_refresh', 'true');
    const queryStr = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/api/ai/ward-analysis/${wardNum}${queryStr}`);
  },

  /** Download report with optional ward number */
  reportDownloadUrl: (wardNum) => {
    const qs = wardNum ? `?ward_num=${wardNum}` : '';
    return `${API_BASE}/api/reports/latest/download${qs}`;
  },
};
