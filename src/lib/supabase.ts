import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://ilrpvkxagutjmbmesqkd.supabase.co'
const publishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? 'sb_publishable_hWweUFDUNhYBxWB-m_46qQ_4_lygpx5'

export const supabase = url && publishableKey ? createClient(url, publishableKey) : undefined
export const cloudConfigured = Boolean(supabase)
