import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/nqs-theme-system.css'
import './styles/nqs-nira-hero.css'
import './styles/nqs-easier-services.css'
import './styles/nqs-hero-beauty.css'
import './styles/nqs-home-stats.css'
import './styles/nqs-home-about-preview.css'
import './styles/nqs-how-apply.css'
import './styles/nqs-mobile-app-strip.css'
import './styles/nqs-contact.css'
import './styles/nqs-about.css'
import './styles/nqs-admin-dashboard.css'
import './styles/nqs-brand-color.css'
import './styles/nqs-citizen-appointment-flow.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
