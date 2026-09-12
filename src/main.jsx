import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
// Import "a effetto collaterale": inizializza i18next prima che qualunque
// componente possa chiamare useTranslation(). Va importato prima di <App />.
import './i18n'
import App from './App.jsx'

// BrowserRouter abilita la navigazione "a pagine" (basata sull'URL del browser)
// per tutta l'app: avvolge <App /> così ogni componente al suo interno
// può usare le funzionalità di react-router (Routes, Link, useParams, ecc.).
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
