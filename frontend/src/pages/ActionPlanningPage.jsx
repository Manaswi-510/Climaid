/**
 * ActionPlanningPage.jsx — Adaptation Planner
 * Botanical Alpine Theme matching the reference UI mockup.
 * Integrates:
 * - AppNavigationRail on the left
 * - Header with Climaid logo
 * - Pune landscape panoramic banner
 * - Two-column planning form + live summary + 3D isometric climate layer card
 * - Submits constraints to /api/action-plans and navigates to results
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import Header from '../components/Header';
import AppNavigationRail from '../components/AppNavigationRail';
import {
  MapPin, AlertTriangle, CheckCircle2, Loader2, Info,
  ChevronRight, Flame, Droplets, Waves, TreePine,
  Coins, Users, Calendar, Crosshair, Layers, Network,
  ShieldCheck, FileText, ArrowRight, Sliders, Check
} from 'lucide-react';

const HORIZON_OPTIONS = [
  { value: 1, label: '1 month' },
  { value: 3, label: '3 months' },
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
  { value: null, label: 'No limit' },
];

function formatINR(val) {
  if (!val && val !== 0) return '—';
  return '₹ ' + Number(val).toLocaleString('en-IN');
}

export default function ActionPlanningPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Form state — matching backend ActionPlanRequest schema
  const [budgetInr, setBudgetInr] = useState(5000000);
  const [budgetRaw, setBudgetRaw] = useState('50,00,000');
  const [equityFactor, setEquityFactor] = useState(1.0);
  const [maxHorizon, setMaxHorizon] = useState(null);
  const [maxWorkforce, setMaxWorkforce] = useState('');

  const getTargetWardParam = () => {
    const fromUrl = searchParams.get('ward');
    if (fromUrl) return fromUrl;
    try {
      return sessionStorage.getItem('climaid_selected_ward') || null;
    } catch {
      return null;
    }
  };

  const initialWardParam = getTargetWardParam();
  const [selectedWard, setSelectedWard] = useState(initialWardParam ? Number(initialWardParam) : null);
  const [wardOptions, setWardOptions] = useState([]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Load ward list for selection and preserve passed context
  useEffect(() => {
    const wardParam = getTargetWardParam();
    if (wardParam) {
      setSelectedWard(Number(wardParam));
    }

    api.indicators()
      .then(data => {
        if (data?.wards) {
          setWardOptions(data.wards);
          const currentParam = getTargetWardParam();
          if (currentParam) {
            const num = Number(currentParam);
            const found = data.wards.find(w => Number(w.ward_num) === num);
            if (found) {
              setSelectedWard(num);
            }
          }
        }
      })
      .catch(() => {});
  }, [searchParams]);

  const selectedWardObj = useMemo(() => {
    if (selectedWard == null) return null;
    return wardOptions.find(w => Number(w.ward_num) === Number(selectedWard)) || null;
  }, [selectedWard, wardOptions]);

  // Budget input handler — parse Indian number formatting
  const handleBudgetChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const num = Number(raw);
    setBudgetRaw(raw ? num.toLocaleString('en-IN') : '');
    setBudgetInr(num);
  };

  // Validate form
  const validate = () => {
    const errs = {};
    if (!budgetInr || budgetInr <= 0) errs.budget = 'Enter a positive budget amount.';
    if (budgetInr > 1e9) errs.budget = 'Budget cannot exceed ₹100 crore in this prototype.';
    if (maxWorkforce && (isNaN(Number(maxWorkforce)) || Number(maxWorkforce) <= 0)) {
      errs.workforce = 'Enter a positive number of person-months, or leave blank for no limit.';
    }
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitError(null);
    setSubmitting(true);

    const payload = {
      budget_inr: budgetInr,
      equity_weight_factor: equityFactor,
      ...(selectedWard !== null && selectedWard !== '' && { selected_ward_num: Number(selectedWard) }),
      ...(maxHorizon !== null && { max_horizon_months: maxHorizon }),
      ...(maxWorkforce && { max_workforce_person_months: Number(maxWorkforce) }),
    };

    try {
      const [plan, scenario] = await Promise.all([
        api.actionPlan(payload),
        api.scenarioCompare(payload).catch(() => null),
      ]);

      if (!plan || !plan.budget_constraints) {
        setSubmitError('The server returned an unexpected response. Please try again.');
        return;
      }

      // Pass results via sessionStorage to avoid URL length limits
      sessionStorage.setItem('climaid_plan', JSON.stringify(plan));
      sessionStorage.setItem('climaid_scenario', JSON.stringify(scenario));
      sessionStorage.setItem('climaid_payload', JSON.stringify(payload));
      navigate('/results');
    } catch (err) {
      setSubmitError('Could not reach the planning service. Ensure the backend is running on port 8000.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'rgba(6, 18, 28, 0.45)', color: '#FFFFFF', position: 'relative', zIndex: 1 }}>
      {/* ── Left Navigation Rail ── */}
      <AppNavigationRail />

      {/* ── Main Workspace Body ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header variant="app" />

        <main style={{ flex: 1, padding: '16px 24px 36px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
          {/* ── 1. Top Panoramic Pune Landscape Banner ── */}
          <div
            style={{
              position: 'relative',
              borderRadius: 16,
              overflow: 'hidden',
              minHeight: 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '24px 32px',
              marginBottom: 24,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundImage: 'url(/images/pune_landscape.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center 35%',
            }}
          >
            {/* Dark gradient veil over photo */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, rgba(6, 18, 30, 0.94) 0%, rgba(6, 18, 30, 0.82) 48%, rgba(6, 18, 30, 0.45) 100%)',
                zIndex: 1,
              }}
            />

            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <img src="/images/climaid_logo.png" alt="Climaid" style={{ height: 26, objectFit: 'contain' }} />
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#22C55E',
                  }}
                >
                  • ADAPTATION PLANNER
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <MapPin size={26} style={{ color: '#22C55E', flexShrink: 0 }} />
                <h1
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.9rem',
                    fontWeight: 700,
                    margin: 0,
                    color: '#FFFFFF',
                    letterSpacing: '0.02em',
                  }}
                >
                  Pune, Maharashtra, India
                </h1>
              </div>

              <div style={{ fontSize: '0.82rem', color: '#94A3B8' }}>
                76 electoral wards &nbsp;•&nbsp; Active prototype region &nbsp;•&nbsp; PMC OpenCity & GIS data
              </div>
            </div>

            <div style={{ position: 'relative', zIndex: 2, textAlign: 'right' }}>
              <div style={{ fontSize: '0.88rem', color: '#E2E8F0', fontWeight: 500, fontStyle: 'italic' }}>
                Smarter planning.
              </div>
              <div style={{ fontSize: '0.88rem', color: '#22C55E', fontWeight: 600 }}>
                Stronger communities.
              </div>
            </div>
          </div>

          {submitError && (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#FCA5A5',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 20,
              }}
            >
              <AlertTriangle size={16} />
              <span>{submitError}</span>
            </div>
          )}

          {/* ── 2. Two-Column Dashboard Grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.75fr)', gap: 24 }}>
            {/* ══ LEFT COLUMN: Planning Form ══ */}
            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Card 1: Planning constraints */}
              <div
                style={{
                  background: '#081827',
                  border: '1px solid rgba(0, 102, 158, 0.28)',
                  borderRadius: 16,
                  padding: '24px 26px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <Sliders size={20} style={{ color: '#22C55E' }} />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
                    Planning constraints
                  </h2>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '0 0 20px 30px' }}>
                  Set your budget and priorities for the intervention plan.
                </p>

                {/* Total budget */}
                <div style={{ marginBottom: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Coins size={16} style={{ color: '#22C55E' }} />
                    <label htmlFor="budget-input" style={{ fontSize: '0.86rem', fontWeight: 600, color: '#FFFFFF' }}>
                      Total budget <span style={{ color: '#94A3B8', fontWeight: 400 }}>(Indian Rupees)</span>
                    </label>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#22C55E',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                      }}
                    >
                      ₹
                    </div>
                    <input
                      id="budget-input"
                      type="text"
                      inputMode="numeric"
                      value={budgetRaw}
                      onChange={handleBudgetChange}
                      placeholder="e.g. 50,00,000"
                      style={{
                        width: '100%',
                        background: '#0B1C2D',
                        border: validationErrors.budget ? '1.5px solid #EF4444' : '1px solid rgba(0, 102, 158, 0.35)',
                        borderRadius: 8,
                        padding: '11px 16px 11px 32px',
                        color: '#FFFFFF',
                        fontSize: '0.96rem',
                        fontWeight: 700,
                        outline: 'none',
                        fontFamily: 'var(--font)',
                      }}
                    />
                  </div>
                  {validationErrors.budget && (
                    <div style={{ color: '#EF4444', fontSize: '0.78rem', marginTop: 4 }}>{validationErrors.budget}</div>
                  )}
                  <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: '6px 0 0', lineHeight: 1.45 }}>
                    The optimizer will allocate up to this amount across selected interventions and will not spend beyond it. Unused funds are explained in the results.
                  </p>
                </div>

                {/* Equity priority factor */}
                <div style={{ marginBottom: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={16} style={{ color: '#22C55E' }} />
                      <label htmlFor="equity-slider" style={{ fontSize: '0.86rem', fontWeight: 600, color: '#FFFFFF' }}>
                        Equity priority factor
                      </label>
                      <Info size={13} style={{ color: '#64748B' }} title="Weights lower-income & higher-vulnerability wards" />
                    </div>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#22C55E' }}>
                      {equityFactor.toFixed(1)}x
                    </span>
                  </div>

                  <input
                    id="equity-slider"
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={equityFactor}
                    onChange={(e) => setEquityFactor(Number(e.target.value))}
                    style={{
                      width: '100%',
                      accentColor: '#22C55E',
                      cursor: 'pointer',
                      height: 5,
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748B', marginTop: 4 }}>
                    <span>0.5x</span>
                    <span>1.0x</span>
                    <span>2.0x</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: '6px 0 0', lineHeight: 1.45 }}>
                    Higher values increase the selection weight for interventions that benefit lower-income and more vulnerable populations. The optimizer utility score reflects this weighting, not a physical outcome.
                  </p>
                </div>

                {/* Maximum implementation horizon */}
                <div style={{ marginBottom: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Calendar size={16} style={{ color: '#22C55E' }} />
                    <label style={{ fontSize: '0.86rem', fontWeight: 600, color: '#FFFFFF' }}>
                      Maximum implementation horizon
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {HORIZON_OPTIONS.map((opt) => {
                      const active = maxHorizon === opt.value;
                      return (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => setMaxHorizon(opt.value)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 9999,
                            border: active ? '1.5px solid #22C55E' : '1px solid rgba(255, 255, 255, 0.12)',
                            background: active ? '#22C55E' : '#0B1C2D',
                            color: active ? '#FFFFFF' : '#CBD5E1',
                            fontWeight: active ? 700 : 500,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 140ms ease',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: '8px 0 0', lineHeight: 1.45 }}>
                    Interventions whose lead time exceeds this horizon are excluded. Lead times are estimates — not contractual commitments.
                  </p>
                </div>

                {/* Maximum workforce capacity */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Users size={16} style={{ color: '#22C55E' }} />
                    <label htmlFor="workforce-input" style={{ fontSize: '0.86rem', fontWeight: 600, color: '#FFFFFF' }}>
                      Maximum workforce capacity <span style={{ color: '#94A3B8', fontWeight: 400 }}>(person-months, optional)</span>
                    </label>
                  </div>
                  <input
                    id="workforce-input"
                    type="number"
                    min={1}
                    value={maxWorkforce}
                    onChange={(e) => setMaxWorkforce(e.target.value)}
                    placeholder="Leave blank for no limit"
                    style={{
                      width: '100%',
                      background: '#0B1C2D',
                      border: validationErrors.workforce ? '1.5px solid #EF4444' : '1px solid rgba(0, 102, 158, 0.35)',
                      borderRadius: 8,
                      padding: '11px 16px',
                      color: '#FFFFFF',
                      fontSize: '0.92rem',
                      outline: 'none',
                      fontFamily: 'var(--font)',
                    }}
                  />
                  {validationErrors.workforce && (
                    <div style={{ color: '#EF4444', fontSize: '0.78rem', marginTop: 4 }}>{validationErrors.workforce}</div>
                  )}
                  <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: '6px 0 0', lineHeight: 1.45 }}>
                    One person-month = one person working full-time for one month. Do not confuse with calendar months.
                  </p>
                </div>
              </div>

              {/* Card 2: Target area (optional) */}
              <div
                style={{
                  background: '#081827',
                  border: '1px solid rgba(0, 102, 158, 0.28)',
                  borderRadius: 16,
                  padding: '24px 26px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <Crosshair size={20} style={{ color: '#22C55E' }} />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
                    Target area <span style={{ color: '#94A3B8', fontWeight: 400, fontSize: '0.95rem' }}>(optional)</span>
                  </h2>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: '0 0 16px 30px' }}>
                  Focus on a specific ward
                </p>

                <select
                  id="ward-select"
                  value={selectedWard != null ? String(selectedWard) : ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setSelectedWard(val);
                    try {
                      if (val) sessionStorage.setItem('climaid_selected_ward', String(val));
                      else sessionStorage.removeItem('climaid_selected_ward');
                    } catch {}
                  }}
                  style={{
                    width: '100%',
                    background: '#0B1C2D',
                    border: '1px solid rgba(0, 102, 158, 0.35)',
                    borderRadius: 8,
                    padding: '11px 16px',
                    color: '#FFFFFF',
                    fontSize: '0.9rem',
                    outline: 'none',
                    fontFamily: 'var(--font)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Highest-vulnerability ward (automatic)</option>
                  {wardOptions.map((w) => (
                    <option key={w.ward_num} value={String(w.ward_num)}>
                      Ward {w.ward_num}: {w.ward_title}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '0.75rem', color: '#94A3B8', margin: '8px 0 0', lineHeight: 1.45 }}>
                  If no ward is selected, the optimizer targets the highest-vulnerability ward in the dataset.
                </p>
              </div>

              {/* Card 3: How the plan is generated */}
              <div
                style={{
                  background: '#081827',
                  border: '1px solid rgba(0, 102, 158, 0.28)',
                  borderRadius: 16,
                  padding: '24px 26px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                  <Crosshair size={18} style={{ color: '#22C55E' }} />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
                    How the plan is generated
                  </h3>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: 12,
                    alignItems: 'start',
                  }}
                >
                  {[
                    { step: '1. Data ingestion', desc: 'Ward boundaries, climate and socio-economic data', icon: Layers },
                    { step: '2. Optimization', desc: 'Multi-objective model balances cost, risk and equity', icon: Network },
                    { step: '3. Feasibility check', desc: 'Site, workforce and budget constraints', icon: ShieldCheck },
                    { step: '4. Action plan', desc: 'Priority interventions with expected impact', icon: FileText },
                  ].map((s, idx) => {
                    const StepIcon = s.icon;
                    return (
                      <div key={s.step} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background: 'rgba(34, 197, 94, 0.12)',
                            border: '1px solid rgba(34, 197, 94, 0.28)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#22C55E',
                          }}
                        >
                          <StepIcon size={18} />
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF' }}>{s.step}</div>
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.4 }}>{s.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Big CTA Button */}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '14px 28px',
                  borderRadius: 9999,
                  background: submitting ? '#64748B' : '#22C55E',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.98rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'all 160ms ease',
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Running PuLP Linear Program Solver…</span>
                  </>
                ) : (
                  <>
                    <span>Generate adaptation plan</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            {/* ══ RIGHT COLUMN: Live Summary & 3D Isometric Climate Card ══ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Card 1: Plan summary */}
              <div
                style={{
                  background: '#081827',
                  border: '1px solid rgba(0, 102, 158, 0.28)',
                  borderRadius: 16,
                  padding: '22px 24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                  <FileText size={18} style={{ color: '#22C55E' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
                    Plan summary
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: 10 }}>
                    <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>Total budget</span>
                    <strong style={{ fontSize: '0.95rem', color: '#FFFFFF' }}>{formatINR(budgetInr)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: 10 }}>
                    <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>Equity factor</span>
                    <strong style={{ fontSize: '0.92rem', color: '#FFFFFF' }}>{equityFactor.toFixed(1)}x</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: 10 }}>
                    <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>Horizon</span>
                    <strong style={{ fontSize: '0.92rem', color: '#FFFFFF' }}>
                      {maxHorizon ? `${maxHorizon} months` : 'No limit'}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: 10 }}>
                    <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>Workforce cap</span>
                    <strong style={{ fontSize: '0.92rem', color: '#FFFFFF' }}>
                      {maxWorkforce ? `${maxWorkforce} p-mo` : 'No limit'}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', color: '#94A3B8' }}>Target ward</span>
                    <strong style={{ fontSize: '0.85rem', color: '#22C55E', textAlign: 'right', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedWardObj ? `Ward ${selectedWardObj.ward_num}: ${selectedWardObj.ward_title}` : 'Highest vulnerability'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Card 2: What you'll get */}
              <div
                style={{
                  background: '#081827',
                  border: '1px solid rgba(0, 102, 158, 0.28)',
                  borderRadius: 16,
                  padding: '22px 24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <CheckCircle2 size={18} style={{ color: '#22C55E' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
                    What you'll get
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    'Recommended interventions with costs',
                    'Site suitability status',
                    'Workforce and lead-time estimates',
                    'Unallocated budget explanation',
                    'Baseline vs. proposed scenario',
                    'Download-ready summary report',
                  ].map((text) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: '#22C55E',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Check size={12} style={{ color: '#06121C', strokeWidth: 3 }} />
                      </div>
                      <span style={{ fontSize: '0.82rem', color: '#CBD5E1' }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 3: 3D Isometric Climate Layers Graphic */}
              <div
                style={{
                  background: '#081827',
                  border: '1px solid rgba(0, 102, 158, 0.28)',
                  borderRadius: 16,
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div style={{ width: '100%', position: 'relative' }}>
                  {/* Layer indicators flanking the 3D graphic */}
                  <img
                    src="/images/isometric_layers.jpg"
                    alt="Climate Layers Illustration"
                    style={{
                      width: '100%',
                      maxHeight: 310,
                      objectFit: 'contain',
                      borderRadius: 12,
                      display: 'block',
                      margin: '0 auto 12px',
                    }}
                  />

                  {/* Visual layer tags matching the 4 isometric layers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: '#F59E0B' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
                      <span>Heat & Temp</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: '#0284C7' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0284C7' }} />
                      <span>River & Flood</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: '#22C55E' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
                      <span>Canopy Cover</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: '#8B5CF6' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6' }} />
                      <span>SWD Drainage</span>
                    </div>
                  </div>
                </div>

                <div style={{ width: '100%', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 10, textAlign: 'center' }}>
                  <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontStyle: 'italic' }}>
                    Multi-layer spatial intelligence. One actionable roadmap.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
