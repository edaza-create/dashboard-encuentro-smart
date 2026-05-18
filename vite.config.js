import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Expone SUPABASE_* del .env al cliente (además de VITE_*).
  envPrefix: ['VITE_', 'SUPABASE_'],
  server: {
    // Puerto fijo: el endpoint CORS de ored tiene 5173/5174/5175 en allowlist.
    // Si el puerto esta ocupado, Vite falla en vez de saltar a otro (evita
    // sorpresas de CORS en dev).
    port: 5173,
    strictPort: true,
  },
})
