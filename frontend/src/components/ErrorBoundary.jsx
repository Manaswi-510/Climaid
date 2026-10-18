import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100svh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'var(--ground, #F3F0E8)',
          color: 'var(--ink, #18271A)',
          textAlign: 'center',
          fontFamily: 'var(--font, sans-serif)',
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 600 }}>
            Something went wrong while rendering this view.
          </h2>
          <p style={{ maxWidth: '480px', color: 'var(--ink-muted, #7A9080)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.6rem 1.2rem',
                borderRadius: '6px',
                border: 'none',
                background: '#1D6A4E',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                padding: '0.6rem 1.2rem',
                borderRadius: '6px',
                border: '1px solid #ccc',
                background: '#fff',
                color: '#333',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
