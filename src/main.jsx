import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import RankingPublicoPage from './components/RankingPublicoPage.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import LoginGate from './components/LoginGate.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{
          padding: 24,
          margin: 24,
          background: '#fff5f5',
          color: '#7a1f1f',
          border: '1px solid #f5b5b5',
          borderRadius: 12,
          fontSize: 13,
          whiteSpace: 'pre-wrap'
        }}>
          {String(this.state.error?.stack ?? this.state.error)}
        </pre>
      )
    }
    return this.props.children
  }
}

function Root() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  const isCyber = path === '/cyber' || path.startsWith('/cyber/')

  if (isCyber) {
    return (
      <ErrorBoundary>
        <RankingPublicoPage />
      </ErrorBoundary>
    )
  }
  return (
    <AuthProvider>
      <LoginGate>
        <App />
      </LoginGate>
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
