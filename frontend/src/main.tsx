import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shared/styles/globals.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router'

const ogImageUrl = new URL('/og.png', window.location.origin).toString()
document
  .querySelector('meta[property="og:image"]')
  ?.setAttribute('content', ogImageUrl)
document
  .querySelector('meta[name="twitter:image"]')
  ?.setAttribute('content', ogImageUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
