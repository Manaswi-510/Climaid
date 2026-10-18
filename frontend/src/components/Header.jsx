import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, ArrowLeft, ArrowRight } from 'lucide-react';

export default function Header({ variant = 'landing' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 160);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (variant === 'workspace' || variant === 'app') {
    return (
      <header
        className="app-header"
        style={{
          background: '#06121E',
          borderBottom: '1px solid rgba(0, 102, 158, 0.22)',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: '20px',
          zIndex: 600,
          position: 'sticky',
          top: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
            onClick={() => navigate('/')}
            title="Return to Climaid home"
          >
            <img
              src="/images/climaid_logo.png"
              alt="CLIMAID"
              style={{ height: 34, objectFit: 'contain' }}
            />
          </button>

          <div style={{ width: 1, height: 22, background: 'rgba(255, 255, 255, 0.16)', margin: '0 16px' }} />

          <button
            onClick={() => navigate('/location')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#FFFFFF',
              fontFamily: 'var(--font)',
              padding: 0,
            }}
            title="Change active location"
          >
            <MapPin size={15} style={{ color: '#22C55E' }} />
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
              Pune, Maharashtra, India
            </span>
          </button>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/location')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 9999,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#CBD5E1',
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
          >
            <span>Change location</span>
          </button>

          <button
            onClick={() => navigate('/map')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 9999,
              background: location.pathname === '/map' ? '#16A34A' : '#22C55E',
              border: 'none',
              color: '#FFFFFF',
              padding: '6px 16px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            <span>Map explorer</span>
          </button>
        </nav>
      </header>
    );
  }

  // Default: Landing page navigation (Dark Mode Luxe, Get Started appears on scroll)
  return (
    <header
      className="nav"
      style={{
        background: scrolled ? '#04070D' : 'rgba(4, 7, 13, 0.4)',
        borderBottom: scrolled ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid transparent',
        transition: 'background-color 300ms ease, border-color 300ms ease',
      }}
    >
      <div className="nav-inner">
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
          onClick={() => navigate('/')}
          title="Climaid Home"
        >
          <img
            src="/images/climaid_logo.png"
            alt="CLIMAID"
            style={{ height: 34, objectFit: 'contain' }}
          />
        </button>

        <nav className="nav-links">
          <a href="#hazards" className="nav-link">Risks</a>
          <a href="#methodology" className="nav-link">Methodology</a>
          <a href="#evidence" className="nav-link">Data Integrity</a>
        </nav>

        <div className="nav-actions" style={{ minWidth: '120px', display: 'flex', justifyContent: 'flex-end' }}>
          {/* "Get Started" only comes after scrolling down */}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/location')}
            id="nav-get-started"
            style={{
              opacity: scrolled ? 1 : 0,
              pointerEvents: scrolled ? 'auto' : 'none',
              transform: scrolled ? 'translateY(0)' : 'translateY(-8px)',
              transition: 'opacity 280ms ease, transform 280ms ease',
              borderRadius: '9999px',
              padding: '0.45rem 1.15rem',
              fontWeight: 600,
            }}
          >
            Get started
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
