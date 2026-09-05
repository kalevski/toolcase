import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-video-embed'

const DEFAULT_ASPECT = 16 / 9

export type VideoProvider = 'youtube' | 'vimeo' | 'loom' | 'native'

// Provider detection from the source URL. Anything that isn't a known embed
// host is treated as a native media file (rendered into a <video>).
function detectProvider(src: string): VideoProvider {
    if (/(?:youtube\.com|youtu\.be)/i.test(src)) return 'youtube'
    if (/vimeo\.com/i.test(src)) return 'vimeo'
    if (/loom\.com/i.test(src)) return 'loom'
    return 'native'
}

// Robustly extract a YouTube video id from the various URL forms:
// youtu.be/ID, youtube.com/watch?v=ID, /embed/ID, /shorts/ID, /v/ID.
function youtubeId(src: string): string | null {
    let m = src.match(/youtu\.be\/([\w-]{6,})/)
    if (m) return m[1]
    m = src.match(/youtube\.com\/(?:embed|shorts|v)\/([\w-]{6,})/)
    if (m) return m[1]
    m = src.match(/[?&]v=([\w-]{6,})/)
    if (m) return m[1]
    return null
}

// Vimeo ids are numeric; cover bare, channel, group, album and player forms.
function vimeoId(src: string): string | null {
    let m = src.match(/player\.vimeo\.com\/video\/(\d+)/)
    if (m) return m[1]
    m = src.match(
        /vimeo\.com\/(?:channels\/[\w-]+\/|groups\/[\w-]+\/videos\/|album\/\d+\/video\/)?(\d+)/,
    )
    if (m) return m[1]
    return null
}

// Loom share / embed ids are hex-ish slugs.
function loomId(src: string): string | null {
    const m = src.match(/loom\.com\/(?:share|embed)\/([\w-]+)/)
    return m ? m[1] : null
}

interface EmbedOptions {
    autoplay: boolean
    loop: boolean
    muted: boolean
    controls: boolean
}

// Build the provider-specific embed URL, forwarding the playback flags as the
// query params each provider understands. Autoplay implies muted everywhere
// (browser autoplay policy), so it forces the mute flag on.
function buildEmbedUrl(provider: VideoProvider, id: string, o: EmbedOptions): string {
    const p: string[] = []
    if (provider === 'youtube') {
        if (o.autoplay) {
            p.push('autoplay=1')
            p.push('mute=1')
        } else if (o.muted) p.push('mute=1')
        if (o.loop) {
            p.push('loop=1')
            p.push(`playlist=${id}`)
        }
        if (!o.controls) p.push('controls=0')
        return `https://www.youtube.com/embed/${id}${p.length ? `?${p.join('&')}` : ''}`
    }
    if (provider === 'vimeo') {
        if (o.autoplay) {
            p.push('autoplay=1')
            p.push('muted=1')
        } else if (o.muted) p.push('muted=1')
        if (o.loop) p.push('loop=1')
        if (!o.controls) p.push('controls=0')
        return `https://player.vimeo.com/video/${id}${p.length ? `?${p.join('&')}` : ''}`
    }
    // loom
    if (o.autoplay) p.push('autoplay=1')
    if (o.muted) p.push('muted=1')
    return `https://www.loom.com/embed/${id}${p.length ? `?${p.join('&')}` : ''}`
}

function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
}

export class VideoEmbed extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        // `title` is observed so changes re-render, but it is read via
        // getAttribute('title') — HTMLElement already reflects `.title` natively,
        // so defining a getter/setter would collide with the platform property.
        return ['src', 'poster', 'aspect-ratio', 'autoplay', 'loop', 'muted', 'controls', 'title']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get src(): string | null {
        return this.getAttribute('src')
    }
    set src(v: string | null) {
        if (v != null) this.setAttribute('src', v)
        else this.removeAttribute('src')
    }

    get poster(): string | null {
        return this.getAttribute('poster')
    }
    set poster(v: string | null) {
        if (v != null) this.setAttribute('poster', v)
        else this.removeAttribute('poster')
    }

    get aspectRatio(): number {
        const raw = this.getAttribute('aspect-ratio')
        const n = raw != null ? parseFloat(raw) : NaN
        return Number.isFinite(n) && n > 0 ? n : DEFAULT_ASPECT
    }
    set aspectRatio(v: number | null) {
        if (v != null) this.setAttribute('aspect-ratio', String(v))
        else this.removeAttribute('aspect-ratio')
    }

    get autoplay(): boolean {
        return this.hasAttribute('autoplay')
    }
    set autoplay(v: boolean) {
        if (v) this.setAttribute('autoplay', '')
        else this.removeAttribute('autoplay')
    }

    get loop(): boolean {
        return this.hasAttribute('loop')
    }
    set loop(v: boolean) {
        if (v) this.setAttribute('loop', '')
        else this.removeAttribute('loop')
    }

    get muted(): boolean {
        return this.hasAttribute('muted')
    }
    set muted(v: boolean) {
        if (v) this.setAttribute('muted', '')
        else this.removeAttribute('muted')
    }

    // controls defaults to true when the attribute is absent; set controls="false"
    // (or controls property = false) to hide the player chrome.
    get controls(): boolean {
        if (!this.hasAttribute('controls')) return true
        return this.getAttribute('controls') !== 'false'
    }
    set controls(v: boolean) {
        this.setAttribute('controls', v ? 'true' : 'false')
    }

    private render(): void {
        const src = this.src ?? ''
        const aspect = this.aspectRatio
        const controls = this.controls
        const loop = this.loop
        const muted = this.muted
        // Honour prefers-reduced-motion: never autoplay decorative motion under it.
        const autoplay = this.autoplay && !prefersReducedMotion()
        const title = this.getAttribute('title')

        const rootStyle = `--bs-video-embed-aspect:${aspect}`

        let media: string
        if (!src) {
            media = ''
        } else {
            const provider = detectProvider(src)
            if (provider === 'native') {
                const posterAttr = this.poster ? ` poster="${esc(this.poster)}"` : ''
                const titleAttr = title ? ` title="${esc(title)}"` : ''
                // Autoplay requires muted under browser policy.
                const wantMuted = muted || autoplay
                media =
                    `<video class="tc-video-embed-media tc-video-embed-video"` +
                    ` src="${esc(src)}"${posterAttr}` +
                    (controls ? ' controls' : '') +
                    (autoplay ? ' autoplay' : '') +
                    (loop ? ' loop' : '') +
                    (wantMuted ? ' muted' : '') +
                    ' playsinline' +
                    titleAttr +
                    '></video>'
            } else {
                const id =
                    provider === 'youtube'
                        ? youtubeId(src)
                        : provider === 'vimeo'
                          ? vimeoId(src)
                          : loomId(src)
                // If the id can't be parsed, fall back to the raw URL (it may already
                // be an embed URL the provider understands).
                const embedSrc = id
                    ? buildEmbedUrl(provider, id, { autoplay, loop, muted, controls })
                    : src
                const titleAttr = title ? esc(title) : 'Video'
                media =
                    `<iframe class="tc-video-embed-media tc-video-embed-iframe"` +
                    ` src="${esc(embedSrc)}"` +
                    ` title="${titleAttr}"` +
                    ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"' +
                    ' allowfullscreen' +
                    ' loading="lazy"' +
                    '></iframe>'
            }
        }

        patchHtml(
            this,
            `<div class="tc-video-embed" style="${rootStyle}"><div class="tc-video-embed-frame">${media}</div></div>`,
        )

        // Reflect the muted state onto the <video> property — the HTML attribute
        // alone is not always honoured for the initial muted state.
        if (src && detectProvider(src) === 'native' && (muted || autoplay)) {
            const videoEl = this.querySelector<HTMLVideoElement>('.tc-video-embed-video')
            if (videoEl) videoEl.muted = true
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VideoEmbed
    }
}
