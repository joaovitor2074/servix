import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shared/styles/globals.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router'

ativarModoLeveQuandoNecessario()

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

function ativarModoLeveQuandoNecessario() {
  const navegador = navigator as Navigator & { deviceMemory?: number }
  const poucosNucleos = navegador.hardwareConcurrency > 0
    && navegador.hardwareConcurrency <= 4
  const poucaMemoria = typeof navegador.deviceMemory === 'number'
    && navegador.deviceMemory <= 4

  if (poucosNucleos || poucaMemoria) {
    document.documentElement.dataset.performance = 'reduced'
  }
}
