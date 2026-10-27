import './styles/base.css'
import './styles/layout.css'
import './styles/stream.css'
import './styles/popup.css'
import './styles/dialogs.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
