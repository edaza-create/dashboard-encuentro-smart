import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey)

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
export const supabase = supabaseConfigured ? createClient(url, anonKey) : null
