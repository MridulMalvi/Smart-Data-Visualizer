import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Catches any render-time JS exceptions in the subtree and shows a
 * friendly inline recovery UI instead of a blank white screen.
 * Used as a localised wrapper (e.g. around ChartCanvas) so the rest
 * of the dashboard remains usable when only one panel crashes.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="clay-card chart-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            padding: 32,
            textAlign: 'center',
            minHeight: 240,
          }}
        >
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'rgba(255,107,107,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={26} style={{ color: 'var(--accent-coral)' }} />
          </div>

          <div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>
              Chart render error
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', maxWidth: 320 }}>
              An unexpected error occurred while rendering this chart.
            </p>
          </div>

          {this.state.error && (
            <pre style={{
              maxWidth: 420, overflow: 'auto',
              padding: '8px 12px', borderRadius: 10,
              background: 'rgba(255,107,107,0.08)',
              border: '1px solid rgba(255,107,107,0.2)',
              fontSize: '0.72rem', color: 'var(--accent-coral)',
              textAlign: 'left', whiteSpace: 'pre-wrap',
            }}>
              {this.state.error.message}
            </pre>
          )}

          <button
            className="btn btn-secondary"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ fontSize: '0.83rem' }}
          >
            <RefreshCw size={13} />
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
