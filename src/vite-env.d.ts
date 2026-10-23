/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** set to "true" to show the optional Google Health (Fitbit) integration */
  readonly VITE_ENABLE_GOOGLE_HEALTH?: string
  /** "true" shows the integration with invented data (screenshots / trying the UI); never set in production */
  readonly VITE_HEALTH_DEMO?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
