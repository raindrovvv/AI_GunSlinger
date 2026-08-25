import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { loadGameFonts } from './fonts.ts'
import { preloadGunshot } from './audio/sfx.ts'
import './index.css'

loadGameFonts()
  .finally(() => {
    preloadGunshot()
  })
  .finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
