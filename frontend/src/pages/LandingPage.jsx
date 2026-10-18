/**
 * LandingPage.jsx — Dark Mode Luxe
 * SpaceEdu / High-Contrast Minimalist Aesthetic
 * 3D Earth serves as the fixed background across the entire landing page,
 * dynamically translating, scaling, and rotating as the user scrolls.
 * Top-right "Get Started" appears in the Header after scrolling down.
 * Zero text glow, zero glassmorphism, solid dark surfaces and high-contrast typography.
 */
import React, { useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { ArrowRight, ChevronDown, ShieldCheck, Thermometer, Droplets, CloudRain, Trees } from 'lucide-react';

const EarthGlobe = lazy(() => import('../components/EarthGlobe'));

// ─── Climate Risk Indicators ────────────────────────────────────
const HAZARDS = [
  {
    icon: Thermometer,
    tag: 'Thermal Vulnerability',
    title: 'Urban Heat Stress',
    desc: 'Land Surface Temperature anomalies and high built density expose unshaded wards to prolonged thermal distress.',
    color: '#F87171',
    metric: '42.8°C Max LST',
  },
  {
    icon: CloudRain,
    tag: 'Hydraulic Deficit',
    title: 'Flash Flood Runoff',
    desc: 'Impervious concrete surfaces and undersized stormwater drainage chambers accelerate street-level waterlogging.',
    color: '#38BDF8',
    metric: '18 Nalla Corridors',
  },
  {
    icon: Droplets,
    tag: 'Resource Security',
    title: 'Water Stress',
    desc: 'Uneven municipal distribution networks and falling local groundwater tables create seasonal deficit clusters.',
    color: '#0284C7',
    metric: 'Ward Deficit Index',
  },
  {
    icon: Trees,
    tag: 'Ecological Resilience',
    title: 'Canopy Deficit',
    desc: 'Dense commercial corridors with under 10% vegetative tree canopy amplify the microclimate heat island effect.',
    color: '#4ADE80',
    metric: '<12% Ward Average',
  },
];

// ─── Methodology Steps ──────────────────────────────────────────
const METHOD_STEPS = [
  {
    step: '01',
    title: 'Spatial Vulnerability Screening',
    desc: 'Ingests electoral ward boundaries, satellite environmental proxies, and municipal infrastructure data across all 76 wards.',
  },
  {
    step: '02',
    title: 'Infrastructure Overlay & Proximity',
    desc: 'Maps natural nalla drainage corridors, stormwater chambers, and critical civic assets with GIS precision.',
  },
  {
    step: '03',
    title: 'Constrained Adaptation Optimization',
    desc: 'Executes PuLP mixed-integer linear programming against strict municipal budgets, lead times, and equity weights.',
  },
  {
    step: '04',
    title: 'Actionable Intervention Roadmap',
    desc: 'Delivers a transparent, verifiable action plan complete with lead departments, unit costs, and site verification needs.',
  },
];

// ─── Scroll-reveal hook ────────────────────────────────────────
function useReveal(ref) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    const el = ref.current;
    if (el) {
      const targets = el.querySelectorAll('.reveal');
      targets.forEach((t) => observer.observe(t));
    }
    return () => observer.disconnect();
  }, [ref]);
}

export default function LandingPage() {
  const navigate = useNavigate();
  const risksRef = useRef(null);
  const methodRef = useRef(null);
  const dataRef = useRef(null);
  const ctaRef = useRef(null);

  useReveal(risksRef);
  useReveal(methodRef);
  useReveal(dataRef);
  useReveal(ctaRef);

  const scrollToRisks = () => {
    const el = document.getElementById('hazards');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--ground)', color: '#FFFFFF', overflowX: 'hidden' }}>
      {/* ── Fixed 3D Earth Canvas in Background ── */}
      <Suspense fallback={null}>
        <EarthGlobe />
      </Suspense>

      {/* ── Header Navigation (Get Started appears after scrolling) ── */}
      <Header variant="landing" />

      <main style={{ position: 'relative', zIndex: 2 }}>
        {/* ── 1. HERO SECTION ───────────────────────────────────── */}
        <section className="hero-section" aria-label="Introduction">
          <div className="hero-left animate-fade-up">
            <div className="hero-eyebrow">
              Earth Climate Intelligence
            </div>

            <h1 className="hero-title-main">
              CLIMAID
            </h1>

            <div className="hero-hairline" />

            <p className="hero-desc">
              Earth-scale climate vulnerability analysis and constraint-bounded municipal adaptation planning. Explore urban heat stress, flash flood runoff, and water security across 76 electoral wards.
            </p>

            <div className="hero-actions">
              <button
                className="btn btn-primary btn-lg"
                onClick={scrollToRisks}
                id="hero-explore-btn"
                style={{
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontSize: '0.85rem',
                  padding: '0.75rem 2rem',
                }}
              >
                Explore Risks
              </button>

              <button
                className="hero-play-btn"
                onClick={scrollToRisks}
                title="Scroll down"
                aria-label="Scroll down to climate risks"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          {/* Right half left clear so 3D Earth shines through */}
          <div className="hero-right-space" aria-hidden="true" />
        </section>

        {/* ── 2. CLIMATE RISKS SECTION ──────────────────────────── */}
        <section
          id="hazards"
          className="hazards-section"
          ref={risksRef}
          aria-label="Climate Risks"
        >
          <div className="container">
            <div style={{ maxWidth: '640px' }}>
              <div className="hero-eyebrow">Vulnerability Dimensions</div>
              <h2 className="t-h1 reveal" style={{ fontFamily: 'var(--font-serif)', letterSpacing: '0.02em' }}>
                Assessing Urban Vulnerabilities
              </h2>
              <p className="t-body reveal anim-delay-1" style={{ marginTop: 'var(--sp-4)', color: '#94A3B8' }}>
                Climaid integrates satellite environmental indices with local infrastructure geometry to reveal localized hazard exposure across Pune.
              </p>
            </div>

            <div className="hazard-grid">
              {HAZARDS.map((h, i) => {
                const IconComponent = h.icon;
                return (
                  <div
                    key={h.title}
                    className="hazard-luxe-card reveal"
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '8px',
                          background: '#0D1624',
                          border: `1px solid rgba(255, 255, 255, 0.1)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: h.color,
                        }}
                      >
                        <IconComponent size={20} />
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {h.metric}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: h.color, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {h.tag}
                    </div>

                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF', marginBottom: 'var(--sp-3)', letterSpacing: '-0.01em' }}>
                      {h.title}
                    </h3>

                    <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#94A3B8' }}>
                      {h.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── 3. METHODOLOGY SECTION ────────────────────────────── */}
        <section
          id="methodology"
          className="features-section"
          ref={methodRef}
          aria-label="Planning Methodology"
        >
          <div className="container">
            <div style={{ maxWidth: '640px' }}>
              <div className="hero-eyebrow">Decision Science</div>
              <h2 className="t-h1 reveal" style={{ fontFamily: 'var(--font-serif)', letterSpacing: '0.02em' }}>
                From geospatial data and context data, contextual data to clear action
              </h2>
              <p className="t-body reveal anim-delay-1" style={{ marginTop: 'var(--sp-4)', color: '#94A3B8' }}>
                Municipal adaptation cannot rely on guesswork. Climaid pairs transparent data with a mathematical optimization engine to formulate practical roadmaps.
              </p>
            </div>

            <div className="features-grid">
              {METHOD_STEPS.map((s, i) => (
                <div
                  key={s.step}
                  className="feature-item reveal"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="feature-number">{s.step}</div>
                  <h3 className="feature-heading">{s.title}</h3>
                  <p className="feature-body">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 4. DATA INTEGRITY & EVIDENCE ───────────────────────── */}
        <section
          id="evidence"
          className="evidence-section"
          ref={dataRef}
          aria-label="Data Evidence"
        >
          <div className="container" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 'var(--sp-12)', alignItems: 'center' }}>
            <div>
              <div className="hero-eyebrow">Integrity Guarantee</div>
              <h2 className="t-h2" style={{ fontFamily: 'var(--font-serif)', marginBottom: 'var(--sp-4)', color: '#FFFFFF' }}>
                Data Transparency by Design
              </h2>
              <p className="t-body" style={{ color: '#94A3B8' }}>
                Every vulnerability score, boundary, and infrastructure overlay clearly states its provenance. We separate ground-truth municipal surveys from model-based proxies so planners can make defensible decisions.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {[
                { title: 'Official Municipal Data', note: 'PMC OpenCity GIS ward geometries, drainage networks, stormwater chambers' },
                { title: 'Forecast & Sensor Feeds', note: 'Open-Meteo atmospheric forecasts and Landsat thermal screening' },
                { title: 'Deterministic Optimization', note: 'Open-source PuLP/CBC linear solver — fully auditable, no black box' },
                { title: 'Transparent Limitations', note: 'Identifies unverified field conditions before capital expenditure' },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--sp-4)',
                    padding: 'var(--sp-4) var(--sp-5)',
                    background: '#070D17',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                  }}
                >
                  <ShieldCheck size={18} style={{ color: '#38BDF8', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#FFFFFF', marginBottom: 2 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                      {item.note}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. FINAL CTA (SpaceEdu Grand Finale Over Earth Horizon) ─ */}
        <section
          id="cta"
          className="cta-section"
          ref={ctaRef}
          aria-label="Get Started Call to Action"
        >
          <div className="container reveal text-center">
            <div className="cta-eyebrow">
              CLIMATE ADAPTATION PLATFORM
            </div>

            <h2 className="cta-headline">
              CLIMAID
            </h2>

            <div style={{ width: 48, height: 2, background: 'var(--accent)', marginInline: 'auto', marginBottom: 'var(--sp-6)' }} />

            <p className="cta-body">
              Initiate your adaptation analysis. Evaluate localized heat and drainage vulnerabilities, and generate a budget-optimized municipal action plan.
            </p>

            <div style={{ display: 'inline-block' }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => navigate('/location')}
                id="cta-get-started"
                style={{
                  fontSize: '0.92rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '0.9rem 2.8rem',
                  fontWeight: 700,
                  borderRadius: '9999px',
                }}
              >
                Get Started
                <ArrowRight size={16} />
              </button>
            </div>

            {/* Flanking Planetary / Climate Pillars */}
            <div className="cta-flank-indicators">
              <div className="cta-flank-item">
                <span className="cta-flank-dot" />
                <span>Urban Heat</span>
              </div>
              <div className="cta-flank-item">
                <span className="cta-flank-dot" />
                <span>Flash Flood</span>
              </div>
            </div>

            <p style={{ marginTop: 'var(--sp-8)', fontSize: '0.8rem', color: '#64748B', letterSpacing: '0.04em' }}>
              Open Research Platform · No Authentication Required
            </p>
          </div>
        </section>
      </main>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer style={{ background: '#03060B', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingBlock: 'var(--sp-10)', position: 'relative', zIndex: 2 }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.08em', color: '#FFFFFF' }}>
              CLIM<span style={{ color: '#38BDF8' }}>AID</span>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#64748B', maxWidth: '60ch', margin: 0 }}>
              Climaid is an open adaptation decision platform calibrated for Pune Municipal Corporation, Maharashtra.
            </p>

            <span style={{ fontSize: '0.75rem', color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Phase 2C Active
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
