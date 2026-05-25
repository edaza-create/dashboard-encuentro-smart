import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import AsistenciaFormPage from './pages/AsistenciaFormPage.jsx'

function Root() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  const isAsistencia = path === '/asistencia' || path.startsWith('/asistencia/')

  if (isAsistencia) {
    return <AsistenciaFormPage />
  }

  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
