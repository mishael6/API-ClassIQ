import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App crash:', error?.message, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 24,
          fontFamily: "'DM Sans', sans-serif", background: '#f5f7fa', color: '#111827',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>😅</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', maxWidth: 420, lineHeight: 1.6, marginBottom: 24 }}>
            {this.state.error?.message || 'The app hit an unexpected error.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: '#0066ff', color: '#fff', border: 'none', borderRadius: 10,
              padding: '12px 24px', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}
          >
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
