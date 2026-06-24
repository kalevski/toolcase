import { esc } from './internal/esc'
const TAG_NAME = 'tc-gantt-chart'

// One task bar on the Gantt timeline. `label` is the canonical display field;
// `name` is accepted as a fallback so callers can pass react-components task
// objects unchanged. `start`/`end` are ISO date strings. `progress` (0–100)
// drives the inner fill; `color` overrides the default slate bar tint; `group`
// is an optional grouping key surfaced in the accessible name + tooltip.
export interface GanttTask {
    id: string
    label?: string
    // react-components compatibility alias for `label`
    name?: string
    start: string
    end: string
    progress?: number
    color?: string
    group?: string
}

export interface GanttTaskClickDetail {
    task: GanttTask
}

const DAY_MS = 86_400_000
// How many date markers to aim for across the span before thinning.
const TARGET_MARKERS = 8
// Minimum bar width as a percentage of the span so single-day tasks stay visible.
const MIN_BAR_PCT = 1.5

// Short "M/D" tick label from an epoch ms (mirrors the React GanttChart marker).
function fmtTick(ms: number): string {
    const d = new Date(ms)
    return `${d.getMonth() + 1}/${d.getDate()}`
}

interface ResolvedTask {
    task: GanttTask
    label: string
    leftPct: number
    widthPct: number
    progress: number | null
    color: string | null
}

export class GanttChart extends HTMLElement {
    private _initialised = false
    private _tasks: GanttTask[] = []
    // resolved geometry of the most recent render, indexed by data-idx
    private _resolved: ResolvedTask[] = []
    // optional callback fired alongside the tc-task-click event
    private _onTaskClick: ((task: GanttTask) => void) | null = null

    static get observedAttributes(): string[] {
        // NB: `title` is a natively-reflected HTMLElement property — listed here
        // so attributeChangedCallback fires, but read via getAttribute (no
        // getter/setter, see the porting recipe).
        return ['title', 'subtitle', 'start-date', 'end-date', 'loading']
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

    // ---- JS properties ----

    get tasks(): GanttTask[] {
        return this._tasks
    }
    set tasks(v: GanttTask[]) {
        this._tasks = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get onTaskClick(): ((task: GanttTask) => void) | null {
        return this._onTaskClick
    }
    set onTaskClick(fn: ((task: GanttTask) => void) | null) {
        this._onTaskClick = typeof fn === 'function' ? fn : null
    }

    // ---- attribute-backed props ----

    get subtitle(): string {
        return this.getAttribute('subtitle') ?? ''
    }
    set subtitle(v: string) {
        this.setAttribute('subtitle', v)
    }

    get startDate(): string | null {
        return this.getAttribute('start-date')
    }
    set startDate(v: string | null) {
        if (v != null) this.setAttribute('start-date', v)
        else this.removeAttribute('start-date')
    }

    get endDate(): string | null {
        return this.getAttribute('end-date')
    }
    set endDate(v: string | null) {
        if (v != null) this.setAttribute('end-date', v)
        else this.removeAttribute('end-date')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    // ---- geometry ----

    private _taskLabel(t: GanttTask): string {
        return t.label ?? t.name ?? ''
    }

    // Build the resolved bar geometry + the date markers for the current span.
    private _layout(): { resolved: ResolvedTask[]; markers: { pct: number; label: string }[] } {
        const tasks = this._tasks
        if (!tasks.length) return { resolved: [], markers: [] }

        const starts = tasks.map((t) => new Date(t.start).getTime()).filter((n) => !isNaN(n))
        const ends = tasks.map((t) => new Date(t.end).getTime()).filter((n) => !isNaN(n))

        const startAttr = this.startDate ? new Date(this.startDate).getTime() : NaN
        const endAttr = this.endDate ? new Date(this.endDate).getTime() : NaN
        const ts = !isNaN(startAttr) ? startAttr : starts.length ? Math.min(...starts) : 0
        const te = !isNaN(endAttr) ? endAttr : ends.length ? Math.max(...ends) : ts + DAY_MS
        const totalMs = te - ts || DAY_MS

        const pctFor = (ms: number): number => ((ms - ts) / totalMs) * 100

        const resolved: ResolvedTask[] = tasks.map((t) => {
            const s = new Date(t.start).getTime()
            const e = new Date(t.end).getTime()
            const sValid = isNaN(s) ? ts : s
            const eValid = isNaN(e) ? sValid : e
            const left = Math.max(0, Math.min(100, pctFor(sValid)))
            const rawWidth = pctFor(eValid) - pctFor(sValid)
            const width = Math.max(MIN_BAR_PCT, Math.min(100 - left, rawWidth))
            const progress =
                typeof t.progress === 'number' ? Math.max(0, Math.min(100, t.progress)) : null
            return {
                task: t,
                label: this._taskLabel(t),
                leftPct: left,
                widthPct: width,
                progress,
                color: typeof t.color === 'string' && t.color ? t.color : null,
            }
        })

        // Date markers at a sensible interval across the span.
        const totalDays = Math.max(1, Math.ceil(totalMs / DAY_MS))
        const stepDays = Math.max(1, Math.ceil(totalDays / TARGET_MARKERS))
        const markers: { pct: number; label: string }[] = []
        for (let d = 0; d <= totalDays; d += stepDays) {
            const ms = ts + d * DAY_MS
            markers.push({ pct: Math.min(100, ((d * DAY_MS) / totalMs) * 100), label: fmtTick(ms) })
        }

        return { resolved, markers }
    }

    // ---- render ----

    private render(): void {
        if (this.loading) {
            this._renderLoading()
            return
        }
        this.removeAttribute('aria-busy')

        const titleAttr = this.getAttribute('title')
        const subtitle = this.getAttribute('subtitle')
        this.setAttribute('role', 'group')
        this.setAttribute('aria-label', titleAttr || 'Gantt chart')

        const headerHtml =
            titleAttr || subtitle
                ? `<div class="tc-gantt-chart-header">` +
                  (titleAttr ? `<div class="tc-gantt-chart-title">${esc(titleAttr)}</div>` : '') +
                  (subtitle ? `<div class="tc-gantt-chart-subtitle">${esc(subtitle)}</div>` : '') +
                  `</div>`
                : ''

        if (!this._tasks.length) {
            this._resolved = []
            this.innerHTML = `<div class="tc-gantt-chart">${headerHtml}<div class="tc-gantt-chart-empty">No tasks</div></div>`
            return
        }

        const { resolved, markers } = this._layout()
        this._resolved = resolved

        // Content scales with the number of days so wide spans overflow the
        // scroll container horizontally; a floor keeps short spans readable.
        const contentMin = Math.max(560, markers.length * 90)

        const ticksHtml = markers
            .map(
                (m) =>
                    `<span class="tc-gantt-chart-tick" style="left:${m.pct.toFixed(2)}%">${esc(m.label)}</span>`,
            )
            .join('')

        const gridlinesHtml = markers
            .map(
                (m) =>
                    `<span class="tc-gantt-chart-gridline" style="left:${m.pct.toFixed(2)}%"></span>`,
            )
            .join('')

        const rowsHtml = resolved
            .map((r, i) => {
                const colorStyle = r.color ? `--bs-gantt-chart-bar-color:${esc(r.color)};` : ''
                const fillPct = r.progress != null ? r.progress : 100
                const progressLabel = r.progress != null ? `, ${r.progress}% complete` : ''
                const groupLabel = r.task.group ? ` (${r.task.group})` : ''
                const ariaName = esc(
                    `${r.label}${groupLabel}: ${r.task.start} to ${r.task.end}${progressLabel}`,
                )
                return (
                    `<div class="tc-gantt-chart-row">` +
                    `<div class="tc-gantt-chart-label" title="${esc(r.label)}">${esc(r.label)}</div>` +
                    `<div class="tc-gantt-chart-track">` +
                    `<div class="tc-gantt-chart-bar" data-idx="${i}" role="button" tabindex="0"` +
                    ` aria-label="${ariaName}" style="left:${r.leftPct.toFixed(2)}%;width:${r.widthPct.toFixed(2)}%;${colorStyle}">` +
                    `<div class="tc-gantt-chart-progress" style="width:${fillPct}%"></div>` +
                    `</div>` +
                    `</div>` +
                    `</div>`
                )
            })
            .join('')

        const tooltipHtml = `<div class="tc-gantt-chart-tooltip" role="status" aria-live="polite" hidden></div>`

        this.innerHTML =
            `<div class="tc-gantt-chart">` +
            headerHtml +
            `<div class="tc-gantt-chart-scroll" tabindex="0" role="region" aria-label="${esc((titleAttr || 'Gantt chart') + ' timeline, scrollable')}">` +
            `<div class="tc-gantt-chart-grid" style="min-width:${contentMin}px">` +
            `<div class="tc-gantt-chart-axis"><div class="tc-gantt-chart-axis-spacer"></div><div class="tc-gantt-chart-axis-track">${ticksHtml}</div></div>` +
            `<div class="tc-gantt-chart-body"><div class="tc-gantt-chart-gridlines">${gridlinesHtml}</div>${rowsHtml}</div>` +
            `</div>` +
            `</div>` +
            tooltipHtml +
            `</div>`

        const grid = this.querySelector<HTMLElement>('.tc-gantt-chart-grid')
        if (grid) {
            grid.addEventListener('pointermove', this._onPointerMove)
            grid.addEventListener('pointerleave', this._onPointerLeave)
            grid.addEventListener('click', this._onBarActivate)
            grid.addEventListener('keydown', this._onBarKeydown)
        }
    }

    private _renderLoading(): void {
        this.setAttribute('role', 'status')
        this.setAttribute('aria-busy', 'true')
        const titleAttr = this.getAttribute('title')
        const headHtml = titleAttr
            ? `<div class="tc-gantt-chart-header"><div class="tc-gantt-chart-skeleton tc-gantt-chart-skeleton--title" aria-hidden="true"></div></div>`
            : ''
        const rows = Array.from(
            { length: 5 },
            () =>
                `<div class="tc-gantt-chart-skeleton-row" aria-hidden="true">` +
                `<div class="tc-gantt-chart-skeleton tc-gantt-chart-skeleton--label"></div>` +
                `<div class="tc-gantt-chart-skeleton tc-gantt-chart-skeleton--bar"></div>` +
                `</div>`,
        ).join('')
        this.innerHTML =
            `<div class="tc-gantt-chart">` +
            headHtml +
            `<div class="tc-gantt-chart-skeleton-body">${rows}</div>` +
            `<span class="visually-hidden">Loading…</span>` +
            `</div>`
    }

    // ---- bar lookup ----

    private _barIndexFromEvent(e: Event): number {
        const target = e.target as Element | null
        const bar = target?.closest<HTMLElement>('.tc-gantt-chart-bar')
        if (!bar) return -1
        const idx = parseInt(bar.getAttribute('data-idx') ?? '', 10)
        if (isNaN(idx) || idx < 0 || idx >= this._resolved.length) return -1
        return idx
    }

    // ---- hover ----

    private _onPointerMove = (e: PointerEvent): void => {
        const idx = this._barIndexFromEvent(e)
        if (idx < 0) {
            this._onPointerLeave()
            return
        }
        this._showTooltip(idx)
    }

    private _onPointerLeave = (): void => {
        const tip = this.querySelector<HTMLElement>('.tc-gantt-chart-tooltip')
        if (tip) tip.hidden = true
    }

    private _showTooltip(idx: number): void {
        const tip = this.querySelector<HTMLElement>('.tc-gantt-chart-tooltip')
        const root = this.querySelector<HTMLElement>('.tc-gantt-chart')
        const bar = this.querySelector<HTMLElement>(`.tc-gantt-chart-bar[data-idx="${idx}"]`)
        const r = this._resolved[idx]
        if (!tip || !root || !bar || !r) return

        const progressText = r.progress != null ? ` · ${r.progress}%` : ''
        // mirror the visible content for assistive tech
        tip.setAttribute('aria-label', `${r.label}: ${r.task.start} – ${r.task.end}${progressText}`)
        if (r.color) tip.style.setProperty('--bs-gantt-chart-bar-color', r.color)
        else tip.style.removeProperty('--bs-gantt-chart-bar-color')
        tip.innerHTML =
            `<span class="tc-gantt-chart-tooltip-name">${esc(r.label)}</span>` +
            `<span class="tc-gantt-chart-tooltip-meta">${esc(r.task.start)} – ${esc(r.task.end)}${progressText}</span>`

        // position relative to the chart root (which is position: relative); the
        // bar may be scrolled, so derive its centre from live bounding boxes.
        const rootRect = root.getBoundingClientRect()
        const barRect = bar.getBoundingClientRect()
        tip.style.left = `${barRect.left + barRect.width / 2 - rootRect.left}px`
        tip.style.top = `${barRect.top - rootRect.top}px`
        tip.hidden = false
    }

    // ---- click / keyboard ----

    private _onBarActivate = (e: Event): void => {
        const idx = this._barIndexFromEvent(e)
        if (idx < 0) return
        const task = this._resolved[idx].task
        this.dispatchEvent(
            new CustomEvent('tc-task-click', {
                bubbles: true,
                composed: true,
                detail: { task } as GanttTaskClickDetail,
            }),
        )
        if (typeof this._onTaskClick === 'function') this._onTaskClick(task)
    }

    private _onBarKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return
        const bar = (e.target as Element | null)?.closest('.tc-gantt-chart-bar')
        if (!bar) return
        e.preventDefault()
        this._onBarActivate(e)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GanttChart
    }
}
