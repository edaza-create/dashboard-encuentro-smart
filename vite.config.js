import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Expone SUPABASE_* del .env al cliente (además de VITE_*).
  envPrefix: ['VITE_', 'SUPABASE_'],
})
