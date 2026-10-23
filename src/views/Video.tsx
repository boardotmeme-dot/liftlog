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

/** Thumbnail of the first YouTube reference of an exercise, if any. */
export function firstThumb(ex: Pick<CatalogExercise, 'references'> | undefined): string | null {
  for (const r of ex?.references ?? []) {
    const id = r.platform === 'youtube' ? youtubeId(r.url) : null
    if (id) return thumbUrl(id)
  }
  return null
}

/** Shows a thumbnail; a tap swaps in the privacy-friendly YouTube player. The original link is always offered. */
export function VideoCard(props: { r: Reference }) {
  const { r } = props
  const [play, setPlay] = useState(false)
  const id = r.platform === 'youtube' ? youtubeId(r.url) : null

  return (
    <div class="video">
      {id ? (
        <div class="vframe">
          {play ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
              title={r.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <button class="vthumb" onClick={() => setPlay(true)} aria-label={`Play: ${r.title}`}>
              <img src={thumbUrl(id)} loading="lazy" referrerPolicy="no-referrer" alt="" />
              <span class="play" aria-hidden="true">▶</span>
            </button>
          )}
        </div>
      ) : null}
      <a class="vmeta" href={r.url} target="_blank" rel="noopener noreferrer">
        <span class="plat">{PLATFORM_LABEL[r.platform]}</span>
        <span class="rt">{r.title}<small>{r.author} · open original ↗</small></span>
      </a>
    </div>
  )
}
