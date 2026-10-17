import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { prepareClientStorage } from './services/clientStorage'
import './styles/sky-theme.css'

prepareClientStorage(localStorage);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
