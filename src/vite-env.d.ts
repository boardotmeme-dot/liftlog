/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** set to "true" to show the optional Google Health (Fitbit) integration */
  readonly VITE_ENABLE_GOOGLE_HEALTH?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
