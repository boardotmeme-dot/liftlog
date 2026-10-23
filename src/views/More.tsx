import { useRef, useState } from 'preact/hooks'
import { cloudEnabled, sendReset, setNewPassword, signIn, signOut, signUp, syncNow, useCloud } from '../cloud'
import { normalizeState } from '../logic'
import { eraseEverything, exportJson, patchSettings, replaceAll, useStore } from '../store'
import { Select, Stepper, TextField, confirmDialog, dateShort, timeShort } from '../ui'

export function MoreView() {
  return (
    <div>
      {cloudEnabled ? <Account /> : <LocalOnly />}
      <Settings />
      <Backup />
      <h2 class="sec">About</h2>
      <div class="card">
        <div class="sub">liftlog is open source (MIT). Exercise references link to videos made by their authors.</div>
      </div>
    </div>
  )
}

function LocalOnly() {
  return (
    <>
      <h2 class="sec">Account</h2>
      <div class="card"><div class="sub">Cloud sync is not configured for this copy of the app. Your data lives only in this browser. Use the backup below, or self-host with Supabase (see the README).</div></div>
    </>
  )
}

function Account() {
  const c = useCloud()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')

  if (c.recovery && c.user) {
    return (
      <>
        <h2 class="sec">Set a new password</h2>
        <div class="card">
          <TextField label="Password" type="password" autocomplete="new-password" value={pass} live onCommit={setPass} />
          <button class="btn full" disabled={c.busy || pass.length < 6} onClick={() => setNewPassword(pass)}>Save password</button>
          {c.message && <div class={'sub ' + (c.error ? 'err' : 'ok')}>{c.message}</div>}
        </div>
      </>
    )
  }

  return (
    <>
      <h2 class="sec">Account</h2>
      <div class="card">
        {!c.ready ? <div class="sub">Loading…</div> : c.user ? (
          <>
            <h4>{c.user.email}</h4>
            <div class="sub">{c.lastSync ? `Synced ${dateShort(c.lastSync)} ${timeShort(c.lastSync)}` : 'Not synced yet'}</div>
            <div class="row">
              <button class="btn" disabled={c.busy} onClick={() => syncNow()}>{c.busy ? '…' : 'Sync now'}</button>
              <button class="btn ghost" onClick={signOut}>Sign out</button>
            </div>
            <div class="sub">Changes upload automatically a few seconds after you make them. Data is merged between devices; if you sign in with a different account, this device’s data is added to it.</div>
          </>
        ) : (
          <>
            <div class="sub">Sign in to keep your history on a server and use several devices.</div>
            <TextField label="Email" type="email" autocomplete="email" value={email} live onCommit={setEmail} />
            {mode !== 'reset' && <TextField label="Password" type="password" autocomplete={mode === 'up' ? 'new-password' : 'current-password'} value={pass} live onCommit={setPass} />}
            <div class="row">
              {mode === 'in' && <button class="btn" disabled={c.busy} onClick={() => signIn(email, pass)}>{c.busy ? '…' : 'Sign in'}</button>}
              {mode === 'up' && <button class="btn" disabled={c.busy} onClick={() => signUp(email, pass)}>{c.busy ? '…' : 'Create account'}</button>}
              {mode === 'reset' && <button class="btn" disabled={c.busy} onClick={() => sendReset(email)}>{c.busy ? '…' : 'Send reset link'}</button>}
            </div>
            <div class="row links">
              {mode !== 'in' && <button class="link" onClick={() => setMode('in')}>Sign in</button>}
              {mode !== 'up' && <button class="link" onClick={() => setMode('up')}>Create account</button>}
              {mode !== 'reset' && <button class="link" onClick={() => setMode('reset')}>Forgot password</button>}
            </div>
          </>
        )}
        {c.message && <div class={'sub ' + (c.error ? 'err' : 'ok')}>{c.message}</div>}
      </div>
    </>
  )
}

function Settings() {
  const s = useStore((x) => x.settings)
  return (
    <>
      <h2 class="sec">Rest timer</h2>
      <div class="card">
        <Stepper label="Rest" value={s.restSec} step={15} min={15} max={900} unit="s" onChange={(v) => patchSettings({ restSec: Math.round(v ?? 120) })} />
        <Select label="Smart rest" value={s.smartRest ? '1' : '0'} options={[['1', 'Shorter for isolation'], ['0', 'Same for all']]} onChange={(v) => patchSettings({ smartRest: v === '1' })} />
        {s.smartRest && <Stepper label="Isolation" value={s.restIsolationSec} step={15} min={15} max={600} unit="s" onChange={(v) => patchSettings({ restIsolationSec: Math.round(v ?? 60) })} />}
        <Select label="Vibration" value={s.vibrate ? '1' : '0'} options={[['1', 'On'], ['0', 'Off']]} onChange={(v) => patchSettings({ vibrate: v === '1' })} />
        <Select label="Beep" value={s.sound ? '1' : '0'} options={[['1', 'On'], ['0', 'Off']]} onChange={(v) => patchSettings({ sound: v === '1' })} />
        <div class="sub">The timer starts when you tick a set. Compound lifts get the longer rest.</div>
      </div>
      <h2 class="sec">Goal</h2>
      <div class="card">
        <Stepper label="Per week" value={s.weeklyGoal} step={1} min={1} max={7} unit="workouts" onChange={(v) => patchSettings({ weeklyGoal: Math.round(v ?? 3) })} />
        <div class="sub">Shown above your workout, with a streak of weeks you hit it.</div>
      </div>
      <h2 class="sec">Units</h2>
      <div class="card">
        <Select label="Weight" value={s.units} options={[['kg', 'Kilograms (kg)'], ['lb', 'Pounds (lb)']]} onChange={(v) => patchSettings({ units: v })} />
        <div class="sub">Your data is stored in kilograms, so you can switch at any time without losing anything.</div>
      </div>
      <h2 class="sec">Barbell and plates</h2>
      <div class="card">
        <Stepper label="Bar" value={s.units === 'kg' ? s.barKg : s.barLb} step={s.units === 'kg' ? 2.5 : 5} unit={s.units} onChange={(v) => patchSettings(s.units === 'kg' ? { barKg: v ?? 0 } : { barLb: v ?? 0 })} />
        <TextField label="Plates" value={(s.units === 'kg' ? s.plates : s.platesLb).join(', ')} onCommit={(v) => {
          const list = v.split(/[,\s]+/).map((x) => Number(x.replace(',', '.'))).filter((x) => x > 0)
          if (list.length) patchSettings(s.units === 'kg' ? { plates: [...new Set(list)].sort((a, b) => b - a) } : { platesLb: [...new Set(list)].sort((a, b) => b - a) })
        }} />
        <div class="sub">Comma separated, one value per plate size ({s.units}). Tap a barbell weight in a workout to see what to load on each side.</div>
      </div>
    </>
  )
}

function Backup() {
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `liftlog-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
  const onFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const f = input.files?.[0]
    input.value = ''
    if (!f) return
    let parsed: unknown = null
    try { parsed = JSON.parse(await f.text()) } catch { /* handled below */ }
    const next = normalizeState(parsed)
    if (!next) return setMsg('That file is not a liftlog backup.')
    if (await confirmDialog(`Replace current data with the backup (${next.plan.length} days, ${next.logs.length} workouts)?`, 'Replace')) {
      replaceAll({ ...next, planUpdatedAt: Date.now() })
      setMsg('Backup restored.')
    }
  }
  return (
    <>
      <h2 class="sec">Backup</h2>
      <div class="card">
        <div class="sub">Everything is stored in this browser first. Clearing site data or changing phone removes it unless you sign in or keep a backup.</div>
        <div class="row">
          <button class="btn" onClick={download}>Save backup</button>
          <button class="btn ghost" onClick={() => file.current?.click()}>Restore</button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={onFile} />
        {msg && <div class="sub ok">{msg}</div>}
      </div>
      <h2 class="sec">Reset</h2>
      <div class="card">
        <button class="link danger" onClick={async () => {
          if (await confirmDialog('Erase your plan, custom exercises and all history on this device (and in your account if you are signed in)?', 'Erase everything')) eraseEverything()
        }}>Erase everything</button>
      </div>
    </>
  )
}
