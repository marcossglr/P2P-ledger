import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { resolveBackendPort } from './services/api.js'
import './index.css'

// Disparar resolución temprana del puerto dinámico en entorno Desktop (Tauri)
resolveBackendPort().catch((err) => {
  console.warn('[P2P Ledger] Error inicializando puerto dinámico de backend:', err);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

