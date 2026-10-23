import type { Reference } from './types'
import { youtubeId } from './views/Video'

export type PreviewResult = { ok: true; ref: Reference } | { ok: false; error: string }

const today = () => new Date().toISOString().slice(0, 10)

function isHttps(url: string): boolean {
  try { return new URL(url).protocol === 'https:' } catch { return false }
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch { return null }
}

/**
 * Turns a pasted link into a reference with title, author and (when the platform allows) a preview.
 * YouTube and TikTok are looked up through their public oEmbed endpoints; anything else is kept as a plain link.
 */
export async function previewLink(raw: string): Promise<PreviewResult> {
  const url = raw.trim()
  if (!isHttps(url)) return { ok: false, error: 'Paste a full https:// link.' }
  const host = new URL(url).hostname.replace(/^www\./, '')

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
    const id = youtubeId(url)
    if (!id) return { ok: false, error: 'That does not look like a YouTube video link.' }
    const canonical = `https://www.youtube.com/watch?v=${id}`
    const j = await getJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`)
    if (!j) return { ok: false, error: 'YouTube says this video is unavailable or private.' }
    return { ok: true, ref: { type: 'video', platform: 'youtube', url: canonical, title: String(j.title ?? 'YouTube video'), author: String(j.author_name ?? 'YouTube'), checked: today() } }
  }

  if (host.endsWith('tiktok.com')) {
    const j = await getJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
    if (!j) return { ok: false, error: 'Could not load this TikTok. Check that the video is public.' }
    const html = String(j.html ?? '')
    const videoId = html.match(/player\/v1\/(\d+)/)?.[1] ?? (typeof j.embed_product_id === 'string' ? j.embed_product_id : undefined)
    // TikTok no longer returns a title, author or thumbnail from oEmbed: take the handle from the link and let the user rename it.
    const handle = url.match(/tiktok\.com\/(@[\w.]+)/)?.[1]
    const author = typeof j.author_name === 'string' ? j.author_name : handle ?? 'TikTok'
    return {
      ok: true,
      ref: {
        type: 'video', platform: 'tiktok', url,
        title: typeof j.title === 'string' && j.title ? j.title.slice(0, 140) : `TikTok video by ${author}`,
        author, checked: today(),
        thumbnail: typeof j.thumbnail_url === 'string' ? j.thumbnail_url : undefined,
        embedUrl: videoId ? `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&music_info=0&description=0` : undefined,
      },
    }
  }

  const platform = host.endsWith('instagram.com') ? 'instagram' : 'web'
  return { ok: true, ref: { type: platform === 'web' ? 'article' : 'video', platform, url, title: host, author: host, checked: today() } }
}
