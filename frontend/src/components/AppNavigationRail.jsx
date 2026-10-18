import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sprout, Map, BarChart3, FileText, Leaf } from 'lucide-react';

export default function AppNavigationRail() {
  const navigate = useNavigate();
  const location = useLocation();

  const NAV_ITEMS = [
    { id: 'plan', label: 'Plan', path: '/plan', icon: Sprout },
    { id: 'map', label: 'Map', path: '/map', icon: Map },
    { id: 'analysis', label: 'Analysis', path: '/results', icon: BarChart3 },
    { id: 'reports', label: 'Reports', path: '/results', icon: FileText },
  ];

  const isItemActive = (item) => {
    if (item.id === 'plan') return location.pathname === '/plan';
    if (item.id === 'map') return location.pathname === '/map';
    if (item.id === 'analysis') return location.pathname === '/results';
    if (item.id === 'reports') return location.pathname === '/results' && location.hash === '#reports';
    return false;
  };

  return (
    <aside
      className="app-nav-rail"
      style={{
        width: 76,
        background: '#06121E',
        borderRight: '1px solid rgba(0, 102, 158, 0.22)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 8px 20px',
        flexShrink: 0,
        zIndex: 650,
      }}
      aria-label="Application Navigation"
    >
      {/* Top Brand Mark / Leaf */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Return to Landing Page"
        >
          <img
            src="/images/climaid_logo.png"
            alt="Climaid Logo"
            style={{ width: 44, height: 44, objectFit: 'contain' }}
          />
        </button>
      </div>

      {/* Vertical Navigation Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', alignItems: 'center' }}>
        {NAV_ITEMS.map((item) => {
          const active = isItemActive(item);
          const IconComponent = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              style={{
                width: 60,
                height: 54,
                borderRadius: 12,
                border: active ? '1.5px solid #22C55E' : '1px solid transparent',
                background: active ? 'rgba(34, 197, 94, 0.18)' : 'transparent',
                color: active ? '#22C55E' : '#94A3B8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                transition: 'all 160ms ease',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = '#FFFFFF';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#94A3B8';
                }
              }}
              title={item.label}
            >
              <IconComponent size={20} style={{ color: active ? '#22C55E' : 'inherit' }} />
              <span style={{ fontSize: '0.68rem', fontWeight: active ? 700 : 500, letterSpacing: '0.02em' }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Footer Caption */}
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          textAlign: 'center',
          paddingInline: 4,
        }}
      >
        <Leaf size={16} style={{ color: '#22C55E', opacity: 0.9 }} />
        <span
          style={{
            fontSize: '0.55rem',
            color: '#64748B',
            lineHeight: 1.25,
            letterSpacing: '0.02em',
            maxWidth: 60,
          }}
        >
          Climate Resilience for Pune
        </span>
      </div>
    </aside>
  );
}
