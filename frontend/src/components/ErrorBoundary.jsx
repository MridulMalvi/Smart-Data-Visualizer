import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Catches any render-time JS exceptions in the subtree and shows a
 * friendly recovery UI instead of a blank white screen.
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
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            background: 'var(--bg-base)',
            padding: 40,
            textAlign: 'center',
          }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: 'rgba(255,107,107,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={32} style={{ color: 'var(--accent-coral)' }} />
          </div>

          <div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 420 }}>
              An unexpected error occurred while rendering the chart. The error has been
              logged to the console. Try uploading your data again.
            </p>
          </div>

          {this.state.error && (
            <pre style={{
              maxWidth: 540, overflow: 'auto',
              padding: '12px 16px', borderRadius: 12,
              background: 'rgba(255,107,107,0.08)',
              border: '1px solid rgba(255,107,107,0.2)',
              fontSize: '0.75rem', color: 'var(--accent-coral)',
              textAlign: 'left',
            }}>
              {this.state.error.message}
            </pre>
          )}

          <button
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            style={{ marginTop: 8 }}
          >
            <RefreshCw size={15} />
            Reload App
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
