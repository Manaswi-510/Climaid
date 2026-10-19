/**
 * ResultsPage.jsx — Page 5: Recommended adaptation plan
 * Reads plan + scenario from sessionStorage (set by ActionPlanningPage).
 * Shows summary stats, intervention cards, scenario comparison, and report download.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import Header from '../components/Header';
import {
  CheckCircle2, AlertTriangle, Info, Download, ArrowLeft,
  ChevronRight, MapPin, Clock, Users, Wrench, TrendingDown,
  Sparkles, RefreshCw,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────
function formatINR(val) {
  if (val === null || val === undefined) return '—';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
  return `₹${Number(val).toLocaleString('en-IN')}`;
}

function SuitabilityBadge({ status }) {
  const config = {
    SUITABLE_CONFIRMED: { label: 'Site confirmed', cls: 'suitability-confirmed' },
    FLAGGED_FOR_SITE_VERIFICATION: { label: 'Verification required', cls: 'suitability-flagged' },
    UNSUITABLE_CONFIRMED: { label: 'Site unsuitable', cls: 'suitability-unsuitable' },
  };
  const c = config[status] ?? { label: status, cls: '' };
  return <span className={`suitability-badge ${c.cls}`}>{c.label}</span>;
}

function ScoreBar({ value, max = 100, color }) {
  return (
    <div style={{ background: 'var(--surface-3)', borderRadius: 2, height: 5, overflow: 'hidden', marginTop: 4 }}>
      <div style={{
        width: `${Math.min(100, (value / max) * 100)}%`,
        height: '100%',
        background: color ?? 'var(--accent)',
        borderRadius: 2,
      }} />
    </div>
  );
}

function ScenarioCard({ scenario, label, delta }) {
  if (!scenario) return null;
  const comp = scenario.composite_vulnerability;
  const color = comp >= 70 ? 'var(--heat-color)' : comp >= 50 ? '#D97706' : 'var(--accent)';
  return (
    <div className="scenario-card">
      <div className="scenario-name">{label}</div>
      <div className="scenario-composite" style={{ color }}>
        {comp !== undefined ? comp.toFixed(1) : '—'}
      </div>
      <div className="scenario-label">Composite vulnerability index</div>
      {delta !== undefined && delta !== 0 && (
        <div style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--text-sm)', color: delta < 0 ? 'var(--green-color)' : 'var(--heat-color)', fontWeight: 600 }}>
          {delta > 0 ? '+' : ''}{delta.toFixed(1)} vs baseline
        </div>
      )}
      {scenario.notes && (
        <div style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', lineHeight: 1.55 }}>
          {scenario.notes}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────
export default function ResultsPage() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [payload, setPayload] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [geminiAnalysis, setGeminiAnalysis] = useState(null);
  const [loadingGemini, setLoadingGemini] = useState(false);

  const fetchGemini = async (wardNum, planData, budget, workforce, horizon, force = false) => {
    if (!wardNum) return;
    setLoadingGemini(true);
    try {
      const res = await api.wardAnalysis(wardNum, planData, budget, workforce, horizon, force);
      setGeminiAnalysis(res);
    } catch (err) {
      console.error('Gemini analysis fetch failed:', err);
    } finally {
      setLoadingGemini(false);
    }
  };

  useEffect(() => {
    try {
      const p = sessionStorage.getItem('climaid_plan');
      const s = sessionStorage.getItem('climaid_scenario');
      const q = sessionStorage.getItem('climaid_payload');
      const parsedPayload = q ? JSON.parse(q) : {};
      if (q) setPayload(parsedPayload);
      if (s) setScenario(JSON.parse(s));
      if (p) {
        const parsedPlan = JSON.parse(p);
        setPlan(parsedPlan);
        const wMatch = parsedPlan.target_ward ? parsedPlan.target_ward.match(/Ward\s*#?(\d+)/) : null;
        const wNum = wMatch ? parseInt(wMatch[1], 10) : (parsedPayload.selected_ward_num ?? 19);
        const b = parsedPlan.budget_constraints?.total_budget_inr ?? parsedPayload.budget_inr;
        const w = parsedPayload.max_workforce_person_months ?? parsedPlan.performance_metrics?.workforce_capacity_person_months;
        const h = parsedPayload.max_horizon_months ?? parsedPlan.performance_metrics?.estimated_implementation_horizon_months;
        fetchGemini(wNum, parsedPlan, b, w, h);
      }
    } catch (e) {
      console.error('Could not parse stored plan:', e);
    }
  }, []);

  // Redirect if no plan data
  if (!plan) {
    return (
      <div style={{ background: 'var(--ground)', minHeight: '100svh', paddingTop: 60 }}>
        <Header variant="app" />
        <div style={{ textAlign: 'center', paddingTop: 'var(--sp-24)' }}>
          <AlertTriangle size={32} style={{ color: 'var(--ink-muted)', margin: '0 auto var(--sp-4)' }} />
          <p style={{ fontSize: 'var(--text-lg)', color: 'var(--ink-3)' }}>No plan found.</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 'var(--sp-6)' }}
            onClick={() => navigate('/plan')}
          >
            Go back to planning
          </button>
        </div>
      </div>
    );
  }

  const bc = plan.budget_constraints ?? {};
  const pm = plan.performance_metrics ?? {};
  const portfolio = plan.portfolio ?? [];
  const rejected = plan.rejected_candidates ?? [];
  const limitations = plan.assumptions_and_limitations ?? [];

  const baseline = scenario?.baseline_scenario;
  const postAdapt = scenario?.post_adaptation_scenario;
  const heatwave = scenario?.heatwave_scenario;
  const flashRain = scenario?.flash_rainfall_scenario;
  const baseComp = baseline?.composite_vulnerability ?? 0;
  const postComp = postAdapt?.composite_vulnerability ?? 0;

  // ── Report download ──
  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const wMatch = plan.target_ward ? plan.target_ward.match(/Ward\s*#?(\d+)/) : null;
      const targetWard = wMatch ? parseInt(wMatch[1], 10) : (payload?.selected_ward_num ?? 19);
      const res = await api.reportDownload(targetWard, plan);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Climaid_Adaptation_Report_Ward${targetWard}.pdf`;
      a.click();
    } catch {
      // Generate a basic text report as fallback
      const lines = [
        'CLIMAID — ADAPTATION PLAN REPORT',
        '='.repeat(50),
        '',
        `Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
        `Location: ${plan.pilot_area ?? 'Pune, Maharashtra, India'}`,
        `Target ward: ${plan.target_ward ?? '—'}`,
        '',
        'BUDGET',
        '-'.repeat(30),
        `Total budget: ${formatINR(bc.total_budget_inr)}`,
        `Allocated: ${formatINR(bc.allocated_spend_inr)}`,
        `Remaining: ${formatINR(bc.remaining_budget_inr)}`,
        bc.unallocated_budget_explanation
          ? `Note: ${bc.unallocated_budget_explanation}`
          : '',
        '',
        'RECOMMENDED INTERVENTIONS',
        '-'.repeat(30),
        ...portfolio.map((item, i) =>
          `${i + 1}. ${item.title}\n   Units: ${item.allocated_units} ${item.unit} | Cost: ${formatINR(item.total_cost_inr)} | Lead time: ${item.lead_time_months} months\n   Suitability: ${item.site_suitability_status}\n   ${item.rationale ?? ''}`
        ),
        '',
        'DATA LIMITATIONS',
        '-'.repeat(30),
        ...limitations,
        '',
        'DISCLAIMER',
        '-'.repeat(30),
        'This plan is a screening-level prioritization output based on spatial proxy indicators and engineering cost heuristics. It is not a validated engineering design, a procurement-ready specification, or a guarantee of physical climate outcomes. All interventions require site surveys and formal tendering before implementation.',
      ].filter(l => l !== undefined).join('\n');

      const blob = new Blob([lines], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Climaid_Adaptation_Plan.txt';
      a.click();
      setDownloadError('PDF not available — text report downloaded instead.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'rgba(6, 18, 30, 0.55)', color: '#FFFFFF', overflowY: 'auto', position: 'relative', zIndex: 1 }}>
      <Header variant="app" />

      {/* ── Results header with Pune landscape backdrop ── */}
      <div style={{ padding: '20px 24px 0', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
          <div
            style={{
              position: 'relative',
              borderRadius: 16,
              overflow: 'hidden',
              padding: '24px 28px',
              border: '1px solid rgba(0, 102, 158, 0.3)',
              backgroundImage: 'url(/images/pune_landscape.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center 40%',
              marginBottom: 20,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, rgba(6, 18, 30, 0.95) 0%, rgba(6, 18, 30, 0.85) 55%, rgba(6, 18, 30, 0.5) 100%)',
                zIndex: 1,
              }}
            />

            <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <button
                  onClick={() => navigate('/plan')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: '0.8rem', color: '#94A3B8', marginBottom: 8, padding: 0 }}
                >
                  <ArrowLeft size={14} /> Adjust constraints
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <img src="/images/climaid_logo.png" alt="Climaid" style={{ height: 26, objectFit: 'contain' }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#22C55E' }}>
                    • RECOMMENDED ADAPTATION PLAN
                  </span>
                </div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0 0 6px', color: '#FFFFFF' }}>
                  Optimal Municipal Action Plan
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={15} style={{ color: '#22C55E' }} />
                  <span style={{ fontSize: '0.85rem', color: '#CBD5E1' }}>
                    {plan.target_ward ?? 'Pune, Maharashtra, India (76 Wards)'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  id="download-report-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 20px',
                    borderRadius: 9999,
                    background: '#22C55E',
                    border: 'none',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: downloading ? 'not-allowed' : 'pointer',
                    transition: 'all 160ms ease',
                  }}
                  onMouseEnter={e => { if (!downloading) e.currentTarget.style.background = '#16A34A'; }}
                  onMouseLeave={e => { if (!downloading) e.currentTarget.style.background = '#22C55E'; }}
                >
                  <Download size={16} />
                  <span>{downloading ? 'Preparing…' : 'Download report'}</span>
                </button>
              </div>
            </div>
          </div>

          {downloadError && (
            <div style={{ marginBottom: 16, fontSize: '0.82rem', color: '#F87171', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)' }}>
              {downloadError}
            </div>
          )}

          {/* Summary stats */}
          <div className="results-summary-grid">
            {[
              { label: 'Total budget', value: formatINR(bc.total_budget_inr), sub: '' },
              { label: 'Allocated', value: formatINR(bc.allocated_spend_inr), sub: bc.remaining_budget_inr > 0 ? `${formatINR(bc.remaining_budget_inr)} unallocated` : 'Fully allocated' },
              { label: 'Interventions', value: portfolio.length, sub: `${rejected.length} candidates excluded` },
              { label: 'Implementation horizon', value: pm.estimated_implementation_horizon_months ? `${pm.estimated_implementation_horizon_months} mo` : '—', sub: 'Max lead time in portfolio' },
            ].map(stat => (
              <div className="results-stat" key={stat.label}>
                <div className="results-stat-label">{stat.label}</div>
                <div className="results-stat-value">{stat.value}</div>
                {stat.sub && <div className="results-stat-sub">{stat.sub}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="results-layout" style={{ maxWidth: 1400, margin: '0 auto', width: '100%', padding: '0 24px 36px' }}>

        {/* ── Left: interventions + scenarios ── */}
        <div>

          {/* Solver status */}
          {pm.solver_status && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
              padding: 'var(--sp-4)', background: pm.solver_status === 'Optimal' ? 'var(--green-bg)' : 'var(--heat-bg)',
              borderRadius: 'var(--r-md)', marginBottom: 'var(--sp-6)',
            }}>
              {pm.solver_status === 'Optimal'
                ? <CheckCircle2 size={16} style={{ color: 'var(--green-color)' }} />
                : <AlertTriangle size={16} style={{ color: 'var(--heat-color)' }} />
              }
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: pm.solver_status === 'Optimal' ? 'var(--green-color)' : 'var(--heat-color)' }}>
                Optimizer: {pm.solver_status === 'Optimal' || pm.solver_status?.includes('Zero') ? 'Feasible plan found' : pm.solver_status}
              </span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>
                · {pm.solver_name ?? 'PuLP-CBC'}
              </span>
            </div>
          )}

          {/* Empty-plan message */}
          {portfolio.length === 0 && (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r-lg)',
              padding: 'var(--sp-8)', textAlign: 'center', marginBottom: 'var(--sp-6)',
            }}>
              <AlertTriangle size={28} style={{ color: 'var(--ink-muted)', margin: '0 auto var(--sp-4)' }} />
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--ink)', marginBottom: 'var(--sp-3)' }}>
                No interventions selected
              </div>
              <div style={{ fontSize: 'var(--text-base)', color: 'var(--ink-3)', maxWidth: 52, margin: '0 auto var(--sp-5)', lineHeight: 1.6 }}>
                {bc.unallocated_budget_explanation ?? 'The budget constraints could not accommodate any full intervention unit. Try increasing the budget or relaxing the horizon constraint.'}
              </div>
              <button className="btn btn-ghost" onClick={() => navigate('/plan')}>
                Adjust constraints
              </button>
            </div>
          )}

          {/* ── Intervention cards ── */}
          {portfolio.length > 0 && (
            <div>
              <h2 className="t-h2" style={{ marginBottom: 'var(--sp-6)' }}>
                Recommended interventions
              </h2>

              {portfolio.map((item, idx) => (
                <div className="intervention-card" key={item.id}>
                  <div className="intervention-card-header">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink-muted)', background: 'var(--ground)', borderRadius: 'var(--r-full)', padding: '0.15rem 0.55rem' }}>
                          {idx + 1} of {portfolio.length}
                        </span>
                        <span className="badge badge-accent">{item.category}</span>
                        <SuitabilityBadge status={item.site_suitability_status} />
                      </div>
                      <div className="intervention-card-name">{item.title}</div>
                    </div>
                    <div className="intervention-card-cost">{formatINR(item.total_cost_inr)}</div>
                  </div>

                  <div className="intervention-card-body">
                    <div className="intervention-meta">
                      <span className="intervention-meta-label">Units</span>
                      <span className="intervention-meta-value">{item.allocated_units} {item.unit}</span>
                    </div>
                    <div className="intervention-meta">
                      <span className="intervention-meta-label">Lead time</span>
                      <span className="intervention-meta-value">{item.lead_time_months} months</span>
                    </div>
                    <div className="intervention-meta">
                      <span className="intervention-meta-label">Workforce</span>
                      <span className="intervention-meta-value">{item.workforce_person_months} person-months</span>
                    </div>
                    <div className="intervention-meta">
                      <span className="intervention-meta-label">Responsible department</span>
                      <span className="intervention-meta-value" style={{ fontSize: 'var(--text-xs)' }}>{item.responsible_department}</span>
                    </div>
                    <div className="intervention-meta">
                      <span className="intervention-meta-label">Addresses</span>
                      <span className="intervention-meta-value" style={{ fontSize: 'var(--text-xs)' }}>
                        {(item.affected_indicators ?? []).join(', ') || item.target_vulnerability}
                      </span>
                    </div>
                    <div className="intervention-meta">
                      <span className="intervention-meta-label">Data quality</span>
                      <span className="intervention-meta-value" style={{ fontSize: 'var(--text-xs)' }}>{item.data_quality_status}</span>
                    </div>
                  </div>

                  {/* Quantified effects */}
                  {item.quantified_effects && Object.keys(item.quantified_effects).length > 0 && (
                    <div style={{ marginBottom: 'var(--sp-4)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink-muted)', marginBottom: 'var(--sp-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Modelled indicator changes
                      </div>
                      {Object.entries(item.quantified_effects).map(([ind, eff]) => (
                        <div key={ind} style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-3)', marginBottom: 4 }}>
                          <strong style={{ color: 'var(--ink)' }}>{ind.replace(/_/g, ' ')}</strong>: {eff.delta_per_unit < 0 ? '' : '+'}{eff.delta_per_unit} per unit ({eff.confidence})
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Directional effects */}
                  {item.directional_effects?.length > 0 && (
                    <div style={{ marginBottom: 'var(--sp-4)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink-muted)', marginBottom: 'var(--sp-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Directional benefits (unquantified)
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
                        {item.directional_effects.map(d => (
                          <span key={d} className="badge">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rationale */}
                  {item.rationale && (
                    <div className="intervention-rationale">
                      {item.rationale}
                    </div>
                  )}

                  {/* Site verification note */}
                  {item.site_suitability_status === 'FLAGGED_FOR_SITE_VERIFICATION' && item.prerequisite_verification_note && (
                    <div style={{
                      display: 'flex', gap: 'var(--sp-2)', alignItems: 'flex-start',
                      background: '#FEF3C7', borderRadius: 'var(--r-sm)',
                      padding: 'var(--sp-3) var(--sp-4)', marginTop: 'var(--sp-3)',
                    }}>
                      <AlertTriangle size={13} style={{ color: '#92400E', flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 'var(--text-xs)', color: '#92400E', lineHeight: 1.55 }}>
                        {item.prerequisite_verification_note}
                      </span>
                    </div>
                  )}

                  {/* Cost provenance */}
                  {item.cost_provenance && (
                    <div style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                      Cost source: {item.cost_provenance}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Unallocated budget explanation ── */}
          {bc.unallocated_budget_explanation && bc.remaining_budget_inr > 0 && (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r-md)',
              padding: 'var(--sp-5)', display: 'flex', gap: 'var(--sp-3)',
              marginTop: 'var(--sp-2)', marginBottom: 'var(--sp-6)',
            }}>
              <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                  Unallocated budget: {formatINR(bc.remaining_budget_inr)}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
                  {bc.unallocated_budget_explanation}
                </div>
              </div>
            </div>
          )}

          {/* ── Scenario comparison ── */}
          {scenario && baseline && (
            <div style={{ marginTop: 'var(--sp-8)' }}>
              <h2 className="t-h2" style={{ marginBottom: 'var(--sp-3)' }}>
                Scenario comparison
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
                <AlertTriangle size={13} style={{ color: 'var(--ink-muted)' }} />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
                  Heatwave and heavy-rainfall shocks are illustrative model assumptions, not official forecasts. Post-adaptation changes reflect proxy indicator adjustments only.
                </span>
              </div>
              <div className="scenario-grid">
                <ScenarioCard scenario={baseline} label="Current baseline" />
                <ScenarioCard
                  scenario={postAdapt}
                  label="After this plan"
                  delta={postComp - baseComp}
                />
                <ScenarioCard
                  scenario={heatwave}
                  label="Illustrative heatwave (+3.5 °C)"
                  delta={heatwave?.composite_vulnerability - baseComp}
                />
                <ScenarioCard
                  scenario={flashRain}
                  label="Illustrative heavy rainfall (+75 mm)"
                  delta={flashRain?.composite_vulnerability - baseComp}
                />
              </div>

              {/* Indicator changes */}
              {scenario.indicator_changes && (
                <div style={{ marginTop: 'var(--sp-6)', background: 'var(--surface)', borderRadius: 'var(--r-md)', padding: 'var(--sp-5)' }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--ink)', marginBottom: 'var(--sp-4)' }}>
                    Indicator changes after plan
                  </div>
                  {Object.entries(scenario.indicator_changes)
                    .filter(([k]) => k !== 'composite_vulnerability_score')
                    .map(([key, rec]) => (
                      <div key={key} style={{ marginBottom: 'var(--sp-4)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>
                            {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                          <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>
                              {rec.baseline.toFixed(1)} → {rec.proposed.toFixed(1)}
                            </span>
                            {rec.delta !== 0 && (
                              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: rec.delta < 0 ? 'var(--green-color)' : 'var(--heat-color)' }}>
                                {rec.delta > 0 ? '+' : ''}{rec.delta.toFixed(1)}
                              </span>
                            )}
                            <span className="badge">{rec.status}</span>
                          </div>
                        </div>
                        <ScoreBar value={rec.proposed} color={rec.delta < 0 ? 'var(--accent)' : 'var(--heat-color)'} />
                        {rec.notes && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', marginTop: 4 }}>{rec.notes}</div>}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}

          {/* ── AI Strategic Ward Resilience Brief (Google Gemini 3.8 Flash) ── */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.95) 100%)',
            borderRadius: 16,
            border: '1px solid rgba(129, 140, 248, 0.35)',
            padding: '24px 28px',
            marginTop: 24,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Sparkles size={20} style={{ color: '#818CF8' }} />
                <div>
                  <h3 style={{ fontSize: '1.12rem', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
                    AI Strategic Ward Resilience Brief
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 2 }}>
                    Powered by Google Gemini 3.8 Flash • Municipal Adaptation Directive
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  const wMatch = plan.target_ward ? plan.target_ward.match(/Ward\s*#?(\d+)/) : null;
                  const wNum = wMatch ? parseInt(wMatch[1], 10) : (payload?.selected_ward_num ?? 19);
                  const b = plan.budget_constraints?.total_budget_inr ?? payload?.budget_inr;
                  const w = payload?.max_workforce_person_months ?? plan.performance_metrics?.workforce_capacity_person_months;
                  const h = payload?.max_horizon_months ?? plan.performance_metrics?.estimated_implementation_horizon_months;
                  fetchGemini(wNum, plan, b, w, h, true);
                }}
                disabled={loadingGemini}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(129, 140, 248, 0.4)',
                  borderRadius: 8, padding: '7px 14px', color: '#C7D2FE', fontSize: '0.82rem',
                  cursor: loadingGemini ? 'not-allowed' : 'pointer', fontWeight: 600,
                  transition: 'all 0.2s',
                }}
              >
                <RefreshCw size={13} style={{ animation: loadingGemini ? 'spin 1s linear infinite' : 'none' }} />
                {loadingGemini ? 'Analyzing Ward Data...' : 'Re-analyze with Gemini'}
              </button>
            </div>

            {loadingGemini ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#A5B4FC' }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: '0.85rem' }}>Synthesizing municipal evidence, weather forecasts, and portfolio allocations via Gemini 3.8 Flash...</p>
              </div>
            ) : geminiAnalysis?.content_markdown ? (
              <div style={{
                color: '#E2E8F0', fontSize: '0.88rem', lineHeight: 1.7,
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                {geminiAnalysis.content_markdown.split('\n\n').map((paragraph, idx) => {
                  if (paragraph.startsWith('### ')) {
                    return (
                      <h4 key={idx} style={{
                        fontSize: '0.98rem', fontWeight: 700, color: '#A5B4FC',
                        margin: '14px 0 6px', borderBottom: '1px solid rgba(165, 180, 252, 0.2)', paddingBottom: 4
                      }}>
                        {paragraph.replace('### ', '')}
                      </h4>
                    );
                  }
                  if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
                    return (
                      <ul key={idx} style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {paragraph.split('\n').map((item, i) => (
                          <li key={i} style={{ color: '#CBD5E1' }}>
                            {item.replace(/^[-*]\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1')}
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <p key={idx} style={{ margin: 0, color: '#CBD5E1' }}>
                      {paragraph.replace(/\*\*(.*?)\*\*/g, '$1')}
                    </p>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: '#94A3B8', fontStyle: 'italic' }}>
                Click "Re-analyze with Gemini" to generate a real-time AI strategic assessment for this ward.
              </div>
            )}
          </div>

          {/* ── Assumptions and limitations ── */}
          {limitations.length > 0 && (
            <div style={{
              background: 'var(--surface)', borderRadius: 'var(--r-lg)',
              padding: 'var(--sp-6)', marginTop: 'var(--sp-8)',
            }}>
              <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
                <Info size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--ink)' }}>
                  Assumptions and limitations
                </div>
              </div>
              <ul style={{ paddingLeft: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                {limitations.map((l, i) => (
                  <li key={i} style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', lineHeight: 1.6, listStyle: 'disc' }}>{l}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Rejected candidates ── */}
          {rejected.length > 0 && (
            <div style={{ marginTop: 'var(--sp-8)' }}>
              <details>
                <summary style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink-muted)', cursor: 'pointer', marginBottom: 'var(--sp-4)' }}>
                  {rejected.length} candidates excluded — expand to see reasons
                </summary>
                {rejected.map(r => (
                  <div key={r.id} style={{
                    background: 'var(--surface)', borderRadius: 'var(--r-md)',
                    padding: 'var(--sp-4)', marginBottom: 'var(--sp-2)',
                    display: 'flex', gap: 'var(--sp-4)', alignItems: 'flex-start',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)' }}>{r.reason}</div>
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                      {formatINR(r.cost_per_unit_inr)} / unit
                    </div>
                  </div>
                ))}
              </details>
            </div>
          )}
        </div>

        {/* ── Right: sticky actions + resource summary + 3D isometric stack ── */}
        <aside style={{ position: 'sticky', top: 20, alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ background: '#081827', borderRadius: 16, border: '1px solid rgba(0, 102, 158, 0.28)', padding: '20px 22px' }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#FFFFFF', marginBottom: 14 }}>
              Resource summary
            </div>
            {[
              { icon: <MapPin size={14} style={{ color: '#22C55E' }} />, label: 'Location', value: 'Pune, Maharashtra' },
              { icon: <Users size={14} style={{ color: '#38BDF8' }} />, label: 'Workforce demand', value: `${pm.workforce_demand_person_months ?? 0} person-months` },
              { icon: <Clock size={14} style={{ color: '#F59E0B' }} />, label: 'Max lead time', value: `${pm.estimated_implementation_horizon_months ?? 0} months` },
              { icon: <Wrench size={14} style={{ color: '#22C55E' }} />, label: 'Interventions', value: `${pm.total_interventions_selected ?? 0} selected` },
              { icon: <TrendingDown size={14} style={{ color: '#8B5CF6' }} />, label: 'Utility score', value: `${pm.total_benefit_points ?? 0} pts` },
            ].map(row => (
              <div key={row.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94A3B8', fontSize: '0.82rem' }}>
                  {row.icon} {row.label}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>{row.value}</div>
              </div>
            ))}
          </div>

          {/* 3D Isometric Layers Model Card */}
          <div style={{
            background: '#081827',
            borderRadius: 16,
            border: '1px solid rgba(0, 102, 158, 0.28)',
            padding: '16px 18px',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'relative', height: 110, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
              <img
                src="/images/isometric_layers.jpg"
                alt="3D Isometric Layers Model"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, #081827 0%, transparent 70%)',
              }} />
              <span style={{
                position: 'absolute', top: 6, left: 8,
                fontSize: '0.62rem', fontWeight: 800, padding: '2px 7px',
                borderRadius: 9999, background: 'rgba(6, 18, 30, 0.85)',
                color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.4)',
              }}>
                Spatial Decision Model
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.7rem' }}>
              <span style={{ color: '#F59E0B' }}>• Heat Exposure</span>
              <span style={{ color: '#0284C7' }}>• Hydrology & Flood</span>
              <span style={{ color: '#22C55E' }}>• Canopy Buffer</span>
              <span style={{ color: '#8B5CF6' }}>• Drainage & SWD</span>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              width: '100%',
              padding: '12px 18px',
              borderRadius: 9999,
              background: '#22C55E',
              border: 'none',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: downloading ? 'not-allowed' : 'pointer',
              transition: 'all 160ms ease',
            }}
            onMouseEnter={e => { if (!downloading) e.currentTarget.style.background = '#16A34A'; }}
            onMouseLeave={e => { if (!downloading) e.currentTarget.style.background = '#22C55E'; }}
          >
            <Download size={16} />
            <span>{downloading ? 'Preparing…' : 'Download report'}</span>
          </button>

          <button
            onClick={() => navigate('/plan')}
            style={{
              width: '100%',
              padding: '10px 18px',
              borderRadius: 9999,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#E2E8F0',
              fontWeight: 600,
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: 'all 160ms ease',
            }}
          >
            <ArrowLeft size={15} />
            <span>Adjust constraints</span>
          </button>

          <button
            onClick={() => navigate('/map')}
            style={{
              width: '100%',
              padding: '10px 18px',
              borderRadius: 9999,
              background: 'transparent',
              border: '1px solid rgba(0, 102, 158, 0.35)',
              color: '#38BDF8',
              fontWeight: 600,
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: 'all 160ms ease',
            }}
          >
            <span>Back to map explorer</span>
          </button>

          {/* Data provenance */}
          {scenario?.data_provenance_and_limitations && (
            <div style={{ background: '#081827', borderRadius: 12, border: '1px solid rgba(0, 102, 158, 0.25)', padding: '14px 16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Data provenance
              </div>
              {scenario.data_provenance_and_limitations.map((note, i) => (
                <div key={i} style={{ fontSize: '0.72rem', color: '#64748B', lineHeight: 1.5, marginBottom: 4 }}>
                  — {note}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
);
}
