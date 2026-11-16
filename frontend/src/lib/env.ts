export const environment = Object.freeze({
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL ?? '').trim(),
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
})

