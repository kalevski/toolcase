import { BottomSheet } from './BottomSheet'
import { esc } from './internal/esc'
import { setAttr, syncOwnedNodes } from './internal/tc-element'

const TAG_NAME = 'tc-qr-scan-sheet'

/** Where the scanner is in its own lifecycle. Every one of these is a state the
 *  reader can be left in, which is why they are all named. */
export type QrScanState =
    /** Not open, or opened and not yet asked for the camera. */
    | 'idle'
    /** The permission prompt is up. */
    | 'requesting'
    /** The camera is live and frames are being read. */
    | 'scanning'
    /** The reader said no, or the browser had already remembered a no. */
    | 'denied'
    /** There is no camera, or this browser cannot decode. */
    | 'unsupported'
    /** Something else failed — a device in use, a track that ended. */
    | 'error'

/** The `BarcodeDetector` surface this element uses. Typed here because it is not
 *  in the DOM lib: it is a Chromium/Android API and TypeScript does not ship it. */
interface BarcodeDetectorLike {
    detect(source: CanvasImageSource): Promise<Array<{ rawValue: string; format?: string }>>
}
interface BarcodeDetectorConstructor {
    new (options?: { formats?: string[] }): BarcodeDetectorLike
    getSupportedFormats?: () => Promise<string[]>
}

/**
 * tc-qr-scan-sheet — a camera QR scan in a sheet, with every permission state
 * drawn rather than assumed.
 *
 * From polovni.mk's `QrScanSheet` (161 lines). The scanning is the easy half; the
 * reason it is 161 lines is that a camera can be refused, absent, already in use,
 * or unavailable because the page is not on a secure origin — and a scanner that
 * shows a black rectangle for any of those is a scanner nobody trusts twice.
 *
 * DECODING IS THE PLATFORM'S. `BarcodeDetector` ships in Chromium and on Android;
 * where it does not exist the element reports `unsupported` and shows the manual
 * fallback rather than pulling a decoder into a library whose bundle size is
 * already a recorded gap. Consumers who need Safari coverage listen for
 * `tc-frame` and decode the frame themselves — the element hands over the video
 * element and keeps the sheet, the permission handling and the states.
 *
 * THE CAMERA IS RELEASED ON EVERY EXIT PATH. Scrim, Escape, drag, `hide()` and an
 * unmount all stop the track: a page that leaves a camera running is a page with
 * a recording light on, and on a phone that is the single most alarming thing a
 * web app can do.
 */
export class QrScanSheet extends BottomSheet {
    private _stream: MediaStream | null = null
    private _detector: BarcodeDetectorLike | null = null
    private _frame = 0
    private _lastValue = ''

    /** Invoked on a successful read. The `tc-scan` event is the primary API. */
    onScan: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return [...BottomSheet.observedAttributes, 'state', 'hint', 'manual-label', 'facing']
    }

    connectedCallback(): void {
        super.connectedCallback()
        this.addEventListener('click', this._onBodyClick)
        this.addEventListener('tc-sheet-close', this._onSheetClose)
        this._renderBody()
        if (this.open) void this.start()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onBodyClick)
        this.removeEventListener('tc-sheet-close', this._onSheetClose)
        this.stop()
        super.disconnectedCallback()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        super.attributeChangedCallback(name, prev, next)
        if (prev === next || !this.isConnected) return
        if (name === 'open') {
            if (next === null) this.stop()
            else void this.start()
            return
        }
        if (name === 'state' || name === 'hint' || name === 'manual-label') this._renderBody()
    }

    /** Read-only in practice — the element owns it. Writable so a consumer can
     *  force the fallback (a kiosk with no camera it already knows about). */
    get state(): QrScanState {
        return (this.getAttribute('state') as QrScanState) || 'idle'
    }
    set state(v: QrScanState) {
        setAttr(this, 'state', v)
    }

    /** One line under the viewfinder — what to point the camera at. */
    get hint(): string | null {
        return this.getAttribute('hint')
    }
    set hint(v: string | null) {
        if (v != null) this.setAttribute('hint', v)
        else this.removeAttribute('hint')
    }

    /** The fallback action's label. Absent hides the fallback entirely. */
    get manualLabel(): string | null {
        return this.getAttribute('manual-label')
    }
    set manualLabel(v: string | null) {
        if (v != null) this.setAttribute('manual-label', v)
        else this.removeAttribute('manual-label')
    }

    /** `environment` (default) is the back camera — the one pointed at a code. */
    get facing(): string {
        return this.getAttribute('facing') ?? 'environment'
    }
    set facing(v: string) {
        setAttr(this, 'facing', v)
    }

    /** The live video element, for a consumer decoding frames themselves. */
    get video(): HTMLVideoElement | null {
        return this.querySelector<HTMLVideoElement>('.tc-qr-scan-sheet__video')
    }

    /** Ask for the camera and begin reading. Idempotent. */
    async start(): Promise<void> {
        if (this._stream) return
        const media = navigator.mediaDevices
        if (!media?.getUserMedia) {
            // No `mediaDevices` at all is the insecure-origin case as often as it is
            // an old browser, and both mean the same thing to the reader.
            this.state = 'unsupported'
            return
        }
        this.state = 'requesting'
        try {
            this._stream = await media.getUserMedia({
                video: { facingMode: this.facing },
                audio: false,
            })
        } catch (error) {
            const name = (error as { name?: string })?.name
            this.state = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error'
            return
        }
        // The sheet may have closed while the permission prompt was up.
        if (!this.open || !this.isConnected) {
            this._release()
            return
        }
        const video = this.video
        if (!video) {
            this._release()
            this.state = 'error'
            return
        }
        video.srcObject = this._stream
        video.setAttribute('playsinline', '')
        video.muted = true
        try {
            await video.play()
        } catch {
            // An autoplay refusal is not fatal — the frames still arrive once the
            // reader interacts, and the viewfinder is already on screen.
        }
        this.state = 'scanning'
        this._startDetection()
    }

    /** Stop reading and release the camera. Safe to call at any time. */
    stop(): void {
        if (this._frame) cancelAnimationFrame(this._frame)
        this._frame = 0
        this._release()
        const video = this.video
        if (video) video.srcObject = null
        if (this.state === 'scanning' || this.state === 'requesting') this.state = 'idle'
    }

    private _release(): void {
        this._stream?.getTracks().forEach((track) => track.stop())
        this._stream = null
    }

    private _startDetection(): void {
        const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
            .BarcodeDetector
        if (!Detector) {
            // The camera stays on: the viewfinder is still useful to a consumer
            // decoding `tc-frame` themselves, and to a reader lining the code up.
            this.dispatchEvent(new CustomEvent('tc-unsupported', { bubbles: true, composed: true }))
            return
        }
        if (!this._detector) this._detector = new Detector({ formats: ['qr_code'] })
        const tick = async (): Promise<void> => {
            if (!this._stream || !this.isConnected) return
            const video = this.video
            if (video && video.readyState >= 2) {
                try {
                    const found = await this._detector?.detect(video)
                    const value = found?.[0]?.rawValue
                    // Guarded on the VALUE, not on a flag: a code stays in frame for
                    // many frames, and firing per frame turns one scan into forty.
                    if (value && value !== this._lastValue) {
                        this._lastValue = value
                        this.dispatchEvent(
                            new CustomEvent('tc-scan', {
                                bubbles: true,
                                composed: true,
                                detail: { value },
                            }),
                        )
                        if (typeof this.onScan === 'function') this.onScan(value)
                    }
                } catch {
                    // A detect() that throws on one frame is not a failed scan.
                }
            }
            this.dispatchEvent(new CustomEvent('tc-frame', { bubbles: true, composed: true }))
            this._frame = requestAnimationFrame(() => void tick())
        }
        this._frame = requestAnimationFrame(() => void tick())
    }

    private _renderBody(): void {
        const hint = this.hint
        const manual = this.manualLabel
        // `tc-bottom-sheet`'s CSS treats EVERY unslotted direct child of the host as
        // its own body region (`tc-bottom-sheet > :not([slot])`, one match assumed).
        // Stage, hint and fallback used to be three such children, so each one
        // independently picked up the body's flex/scroll/padding rules — tripling
        // the body padding around the viewfinder and stacking a spurious top
        // padding onto the hint and the fallback on top of their own margins. They
        // are nested inside a single owned `__body` wrapper instead, which is the
        // one node the sheet's CSS is meant to see; `syncOwnedNodes` is reused on
        // that wrapper (rather than on `this`) so each piece still diffs
        // independently and a hint/manual-label change never touches — and so
        // never tears down — the live `<video>` element.
        let body = this.querySelector<HTMLElement>(':scope > .tc-qr-scan-sheet__body')
        if (!body) {
            body = document.createElement('div')
            body.className = 'tc-qr-scan-sheet__body'
            this.insertBefore(body, this.firstChild)
        }
        syncOwnedNodes(body, [
            {
                cls: 'tc-qr-scan-sheet__stage',
                tag: 'div',
                html:
                    `<video class="tc-qr-scan-sheet__video" playsinline muted></video>` +
                    `<span class="tc-qr-scan-sheet__reticle" aria-hidden="true"></span>`,
            },
            {
                cls: 'tc-qr-scan-sheet__hint',
                tag: 'p',
                html: hint ? esc(hint) : null,
            },
            {
                cls: 'tc-qr-scan-sheet__fallback',
                tag: 'div',
                html: manual
                    ? `<button type="button" class="tc-qr-scan-sheet__manual">${esc(manual)}</button>`
                    : null,
            },
        ])
    }

    private _onBodyClick = (event: MouseEvent): void => {
        const target = event.target as Element | null
        if (!target?.closest('.tc-qr-scan-sheet__manual')) return
        this.dispatchEvent(new CustomEvent('tc-manual', { bubbles: true, composed: true }))
    }

    private _onSheetClose = (): void => {
        this.stop()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: QrScanSheet
    }
}
