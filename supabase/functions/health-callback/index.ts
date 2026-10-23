// liftlog: OAuth redirect target for Google Health. Called by the browser after the user approves access.
// Must be deployed WITHOUT JWT verification (the browser redirect carries no Authorization header);
// it is protected by a one-time `state` value created for a signed-in user.
import { createClient } from 'npm:@supabase/supabase-js@2'

const env = (k: string) => Deno.env.get(k) ?? ''
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const app = env('APP_URL').replace(/\/$/, '')
  if (!app) return new Response('APP_URL secret is not set', { status: 500 })
  const back = (qs: string) => Response.redirect(`${app}/?${qs}`, 302)

  const denied = url.searchParams.get('error')
  if (denied) return back(`health=error&reason=${encodeURIComponent(denied)}`)

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return back('health=error&reason=missing_code')

  const { data: st } = await admin.from('health_oauth_states').select('user_id, created_at').eq('state', state).maybeSingle()
  await admin.from('health_oauth_states').delete().eq('state', state) // single use
  if (!st || Date.now() - Date.parse(st.created_at) > 10 * 60_000) return back('health=error&reason=state_expired')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), code,
      redirect_uri: `${env('SUPABASE_URL')}/functions/v1/health-callback`, grant_type: 'authorization_code',
    }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.refresh_token) return back(`health=error&reason=${encodeURIComponent(j.error ?? 'no_refresh_token')}`)

  const { error: saveError } = await admin.from('health_connections').upsert({
    user_id: st.user_id,
    refresh_token: j.refresh_token,
    scopes: j.scope ?? null,
    connected_at: new Date().toISOString(),
    refresh_expires_at: j.refresh_token_expires_in ? new Date(Date.now() + Number(j.refresh_token_expires_in) * 1000).toISOString() : null,
  })
  if (saveError) return back('health=error&reason=connection_save_failed')
  return back('health=connected')
})
