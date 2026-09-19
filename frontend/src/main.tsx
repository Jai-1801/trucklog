import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import App from './App.tsx'
import './index.css'
import { getHealth } from './lib/api'

// Wake the API (serverless cold start) while the splash is still up.
getHealth().catch(() => undefined)

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

// Fade the HTML splash once fonts are in (at least 600 ms so it never flashes, at most 2.5 s).
const splash = document.getElementById('splash')
if (splash) {
  const minimum = new Promise((resolve) => setTimeout(resolve, 600))
  const fonts = Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 2500))])
  Promise.all([minimum, fonts]).then(() => {
    splash.classList.add('is-done')
    setTimeout(() => splash.remove(), 400)
  })
}
