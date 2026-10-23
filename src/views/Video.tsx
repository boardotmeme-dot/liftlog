import { useState } from 'preact/hooks'
import type { CatalogExercise, Reference } from '../types'

const PLATFORM_LABEL = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', web: 'Web' } as const

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null
    if (u.hostname.endsWith('youtube.com')) return u.searchParams.get('v') ?? u.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/)?.[1] ?? null
  } catch { /* not a URL */ }
  return null
}

export const thumbUrl = (id: string): string => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

/** Preview image of a reference, if the platform gives us one. */
export function refThumb(r: Reference): string | null {
  if (r.platform === 'youtube') { const id = youtubeId(r.url); return id ? thumbUrl(id) : null }
  return r.thumbnail ?? null
}

/** Thumbnail of the first reference of an exercise that has a preview image. */
export function firstThumb(ex: Pick<CatalogExercise, 'references'> | undefined): string | null {
  for (const r of ex?.references ?? []) {
    const t = refThumb(r)
    if (t) return t
  }
  return null
}

/** Shows a preview; a tap swaps in the platform player. The original link is always offered. */
export function VideoCard(props: { r: Reference; onRemove?: () => void }) {
  const { r } = props
  const [play, setPlay] = useState(false)
  const id = r.platform === 'youtube' ? youtubeId(r.url) : null
  const thumb = refThumb(r)
  const embed = id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1` : r.embedUrl ?? null

  return (
    <div class="video">
      {thumb || embed ? (
        <div class={'vframe' + (r.platform === 'tiktok' ? ' tall' : '')}>
          {play && embed ? (
            <iframe src={embed} title={r.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          ) : (
            <button class="vthumb" onClick={() => (embed ? setPlay(true) : window.open(r.url, '_blank', 'noopener'))} aria-label={`Play: ${r.title}`}>
              {thumb && <img src={thumb} loading="lazy" referrerPolicy="no-referrer" alt="" />}
              <span class="play" aria-hidden="true">▶</span>
            </button>
          )}
        </div>
      ) : null}
      <div class="vrow">
        <a class="vmeta" href={r.url} target="_blank" rel="noopener noreferrer">
          <span class="plat">{PLATFORM_LABEL[r.platform]}</span>
          <span class="rt">{r.title}<small>{r.author} · open original ↗</small></span>
        </a>
        {props.onRemove && <button class="icon del" aria-label="Remove link" onClick={props.onRemove}>✕</button>}
      </div>
    </div>
  )
}
