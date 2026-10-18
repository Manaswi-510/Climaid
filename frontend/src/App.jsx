import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import TerrainBackground from './components/TerrainBackground';

// Pages
const LandingPage       = lazy(() => import('./pages/LandingPage'));
const LocationPage      = lazy(() => import('./pages/LocationPage'));
const MapWorkspacePage  = lazy(() => import('./pages/MapWorkspacePage'));
const ActionPlanningPage = lazy(() => import('./pages/ActionPlanningPage'));
const ResultsPage       = lazy(() => import('./pages/ResultsPage'));

function PageLoader() {
  return (
    <div style={{
      minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }} />
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>Loading…</p>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  return (
    <ErrorBoundary>
      {!isLandingPage && <TerrainBackground />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"         element={<LandingPage />} />
          <Route path="/location" element={<LocationPage />} />
          <Route path="/map"      element={<MapWorkspacePage />} />
          <Route path="/plan"     element={<ActionPlanningPage />} />
          <Route path="/results"  element={<ResultsPage />} />
          {/* Catch-all → landing */}
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
