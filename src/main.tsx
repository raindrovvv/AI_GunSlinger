import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { loadGameFonts } from './fonts.ts'
import { preloadGunshot } from './audio/sfx.ts'
import { LocaleProvider } from './i18n/LocaleContext.tsx'
import './index.css'

loadGameFonts()
  .finally(() => {
    preloadGunshot()
  })
  .finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </StrictMode>,
  )
})
