import { patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { chevronRightIcon } from './icons'

const TAG_NAME = 'tc-tree-view'

export interface TreeNode {
    key: string
    label: string
    icon?: string
    disabled?: boolean
    children?: TreeNode[]
    /** Async loader: resolves to this node's children, fetched on first expand. */
    loadChildren?: () => Promise<TreeNode[]>
}

// kebab-case lucide name → PascalCase lookup in lucide-static, wrapped in icon().

function uniq(arr: string[]): string[] {
    return Array.from(new Set(arr))
}

// Flat metadata for one visible (rendered) row, in pre-order DOM sequence —
// powers roving-tabindex keyboard navigation without re-walking the tree.
interface RowMeta {
    key: string
    parentKey: string | null
    level: number
    hasChildren: boolean
    expanded: boolean
    disabled: boolean
}

export class TreeView extends HTMLElement {
    private _initialised = false
    private _nodes: TreeNode[] = []
    private _selected: string[] = []
    private _expanded: string[] = []
    // Children fetched by an async loadChildren(), keyed by node key.
    private _loaded = new Map<string, TreeNode[]>()
    // Node keys whose loadChildren() promise is in flight (spinner shown).
    private _loading = new Set<string>()
    private _rows: RowMeta[] = []
    private _activeKey: string | null = null
    // When true, the next render() re-focuses the active row after the
    // innerHTML rewrite (set by keyboard/mouse handlers, never by setters).
    private _pendingFocus = false

    // Optional callbacks fired alongside the matching CustomEvent.
    onSelect: ((keys: string[]) => void) | null = null
    onExpandChange: ((keys: string[]) => void) | null = null

    static get observedAttributes(): string[] {
        return ['checkbox-mode']
    }

    connectedCallback(): void {
        // Re-adding the same listener reference is a no-op, so this is safe to
        // run unconditionally and survives a disconnect/reconnect cycle.
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    // ── Properties ───────────────────────────────────────────────────────────────

    get nodes(): TreeNode[] {
        return this._nodes
    }
    set nodes(v: TreeNode[]) {
        this._nodes = Array.isArray(v) ? v : []
        // New source data invalidates any async-loaded subtrees.
        this._loaded.clear()
        this._loading.clear()
        if (this._initialised) this.render()
    }

    get selected(): string[] {
        return this._selected
    }
    set selected(v: string[]) {
        this._selected = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    get expanded(): string[] {
        return this._expanded
    }
    set expanded(v: string[]) {
        this._expanded = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    get checkboxMode(): boolean {
        return this.hasAttribute('checkbox-mode')
    }
    set checkboxMode(v: boolean) {
        if (v) this.setAttribute('checkbox-mode', '')
        else this.removeAttribute('checkbox-mode')
    }

    // ── Tree helpers ───────────────────────────────────────────────────────────────

    private _getChildren(node: TreeNode): TreeNode[] {
        return node.children ?? this._loaded.get(node.key) ?? []
    }

    private _hasChildren(node: TreeNode): boolean {
        return (
            (Array.isArray(node.children) && node.children.length > 0) ||
            !!node.loadChildren ||
            this._loaded.has(node.key)
        )
    }

    private _findNode(key: string, list: TreeNode[] = this._nodes): TreeNode | null {
        for (const n of list) {
            if (n.key === key) return n
            const kids = this._getChildren(n)
            if (kids.length) {
                const found = this._findNode(key, kids)
                if (found) return found
            }
        }
        return null
    }

    // Self + all currently-known, non-disabled descendant keys (subtree toggle set).
    private _collectSelectable(node: TreeNode): string[] {
        const out: string[] = []
        const walk = (n: TreeNode): void => {
            if (!n.disabled) out.push(n.key)
            for (const c of this._getChildren(n)) walk(c)
        }
        walk(node)
        return out
    }

    // Checkbox visual state. Parents aggregate over their selectable descendants
    // so the checkbox reflects/half-reflects child membership; leaves track self.
    private _checkboxState(node: TreeNode): { checked: boolean; indeterminate: boolean } {
        if (this._hasChildren(node)) {
            const descend = this._getChildren(node).flatMap((c) => this._collectSelectable(c))
            if (descend.length === 0) {
                return {
                    checked: !node.disabled && this._selected.includes(node.key),
                    indeterminate: false,
                }
            }
            const selectedSet = new Set(this._selected)
            let sel = 0
            for (const k of descend) if (selectedSet.has(k)) sel++
            return {
                checked: sel === descend.length,
                indeterminate: sel > 0 && sel < descend.length,
            }
        }
        return { checked: this._selected.includes(node.key), indeterminate: false }
    }

    private _enabledKeys(): string[] {
        return this._rows.flatMap((r) => (r.disabled ? [] : [r.key]))
    }

    // ── Mutations ────────────────────────────────────────────────────────────────

    private _toggleExpand(key: string): void {
        const node = this._findNode(key)
        if (!node || !this._hasChildren(node)) return

        if (this._expanded.includes(key)) {
            this._commitExpanded(this._expanded.filter((k) => k !== key))
            return
        }
        // First expand of an async branch: fetch children, then expand.
        if (node.loadChildren && !this._loaded.has(key) && !this._loading.has(key)) {
            this._loadAndExpand(key, node)
            return
        }
        this._commitExpanded([...this._expanded, key])
    }

    private _loadAndExpand(key: string, node: TreeNode): void {
        this._loading.add(key)
        // Render now so the spinner appears on the node while loading.
        this.render()
        Promise.resolve(node.loadChildren!())
            .then((kids) => {
                this._loaded.set(key, Array.isArray(kids) ? kids : [])
                this._loading.delete(key)
                this._commitExpanded([...this._expanded, key])
            })
            .catch(() => {
                this._loading.delete(key)
                this.render()
            })
    }

    private _select(key: string): void {
        if (this.checkboxMode) {
            this._toggleMembership(key)
            return
        }
        const node = this._findNode(key)
        if (!node || node.disabled) return
        this._commitSelected([key])
    }

    private _toggleMembership(key: string): void {
        const node = this._findNode(key)
        if (!node || node.disabled) return
        const own = this._collectSelectable(node)
        if (!own.length) return
        const { checked } = this._checkboxState(node)
        const ownSet = new Set(own)
        const next = checked
            ? this._selected.filter((k) => !ownSet.has(k))
            : uniq([...this._selected, ...own])
        this._commitSelected(next)
    }

    private _commitExpanded(next: string[]): void {
        this._expanded = next
        this.render()
        this.dispatchEvent(
            new CustomEvent('tc-expand-change', {
                bubbles: true,
                composed: true,
                detail: { keys: next },
            }),
        )
        if (typeof this.onExpandChange === 'function') this.onExpandChange(next)
    }

    private _commitSelected(next: string[]): void {
        this._selected = next
        this.render()
        this.dispatchEvent(
            new CustomEvent('tc-select', {
                bubbles: true,
                composed: true,
                detail: { keys: next },
            }),
        )
        if (typeof this.onSelect === 'function') this.onSelect(next)
    }

    // ── Event handlers ───────────────────────────────────────────────────────────

    private _onClick = (e: MouseEvent): void => {
        const target = e.target as Element | null
        if (!target) return

        // Disclosure toggle → expand/collapse only.
        const toggle = target.closest('.tc-tree-view-toggle')
        if (
            toggle &&
            this.contains(toggle) &&
            !toggle.classList.contains('tc-tree-view-toggle--leaf')
        ) {
            const row = toggle.closest<HTMLElement>('.tc-tree-view-row')
            const key = row?.dataset.key
            if (key != null) {
                e.preventDefault()
                this._activeKey = key
                this._pendingFocus = true
                this._toggleExpand(key)
            }
            return
        }

        // Checkbox → toggle membership (state is driven by render, not the native toggle).
        // Matched against the wrapping hit-area span (not the bare input) so the
        // click-catching region can be widened under pointer:coarse without
        // resizing the visible glyph — see .tc-tree-view-checkbox-hit in the SCSS.
        const checkbox = target.closest('.tc-tree-view-checkbox-hit')
        if (checkbox && this.contains(checkbox)) {
            const row = checkbox.closest<HTMLElement>('.tc-tree-view-row')
            const key = row?.dataset.key
            if (key != null) {
                e.preventDefault()
                const node = this._findNode(key)
                if (node && !node.disabled) {
                    this._activeKey = key
                    this._pendingFocus = true
                    this._toggleMembership(key)
                }
            }
            return
        }

        // Row/label → parents expand, leaves select.
        const row = target.closest<HTMLElement>('.tc-tree-view-row')
        if (row && this.contains(row) && row.dataset.key != null) {
            const key = row.dataset.key
            const node = this._findNode(key)
            if (!node || node.disabled) return
            this._activeKey = key
            this._pendingFocus = true
            if (this._hasChildren(node)) this._toggleExpand(key)
            else this._select(key)
        }
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        const target = e.target as HTMLElement | null
        const row = target?.closest<HTMLElement>('.tc-tree-view-row')
        if (!row || !this.contains(row) || row.dataset.key == null) return
        const key = row.dataset.key
        const meta = this._rows.find((r) => r.key === key)
        if (!meta) return

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                this._focusRelative(key, 1)
                break
            case 'ArrowUp':
                e.preventDefault()
                this._focusRelative(key, -1)
                break
            case 'Home':
                e.preventDefault()
                this._focusEdge('first')
                break
            case 'End':
                e.preventDefault()
                this._focusEdge('last')
                break
            case 'ArrowRight':
                e.preventDefault()
                if (meta.hasChildren) {
                    if (!meta.expanded) {
                        this._activeKey = key
                        this._pendingFocus = true
                        this._toggleExpand(key)
                    } else {
                        this._focusFirstChild(key)
                    }
                }
                break
            case 'ArrowLeft':
                e.preventDefault()
                if (meta.hasChildren && meta.expanded) {
                    this._activeKey = key
                    this._pendingFocus = true
                    this._toggleExpand(key)
                } else if (meta.parentKey != null) {
                    this._focusKey(meta.parentKey)
                }
                break
            case 'Enter':
            case ' ':
                e.preventDefault()
                if (!meta.disabled) {
                    this._activeKey = key
                    this._pendingFocus = true
                    this._select(key)
                }
                break
        }
    }

    // ── Focus / roving tabindex ─────────────────────────────────────────────────────

    private _rowEl(key: string): HTMLElement | null {
        const rows = this.querySelectorAll<HTMLElement>('.tc-tree-view-row')
        for (const r of Array.from(rows)) if (r.dataset.key === key) return r
        return null
    }

    // Move roving tabindex + browser focus to a row without a re-render.
    private _focusKey(key: string): void {
        const rows = this.querySelectorAll<HTMLElement>('.tc-tree-view-row')
        let target: HTMLElement | null = null
        rows.forEach((r) => {
            if (r.dataset.key === key) {
                r.setAttribute('tabindex', '0')
                target = r
            } else {
                r.setAttribute('tabindex', '-1')
            }
        })
        if (target) {
            this._activeKey = key
            ;(target as HTMLElement).focus()
        }
    }

    private _focusRelative(fromKey: string, dir: number): void {
        const enabled = this._enabledKeys()
        const idx = enabled.indexOf(fromKey)
        if (idx === -1) {
            if (enabled.length) this._focusKey(enabled[0])
            return
        }
        const next = idx + dir
        if (next < 0 || next >= enabled.length) return
        this._focusKey(enabled[next])
    }

    private _focusEdge(which: 'first' | 'last'): void {
        const enabled = this._enabledKeys()
        if (!enabled.length) return
        this._focusKey(which === 'first' ? enabled[0] : enabled[enabled.length - 1])
    }

    private _focusFirstChild(parentKey: string): void {
        const child = this._rows.find((r) => r.parentKey === parentKey && !r.disabled)
        if (child) this._focusKey(child.key)
    }

    private _applyRovingTabindex(): void {
        const enabled = this._enabledKeys()
        if (!enabled.length) {
            this._activeKey = null
            return
        }
        if (!this._activeKey || !enabled.includes(this._activeKey)) {
            this._activeKey = enabled[0]
        }
        this._rowEl(this._activeKey)?.setAttribute('tabindex', '0')
    }

    private _applyIndeterminate(): void {
        this.querySelectorAll<HTMLInputElement>(
            '.tc-tree-view-checkbox[data-indeterminate="true"]',
        ).forEach((cb) => {
            cb.indeterminate = true
        })
    }

    // ── Render ──────────────────────────────────────────────────────────────────────

    private _renderNodes(nodes: TreeNode[], level: number, parentKey: string | null): string {
        return this._renderNodesWith(
            nodes,
            level,
            parentKey,
            new Set(this._expanded),
            new Set(this._selected),
        )
    }

    private _renderNodesWith(
        nodes: TreeNode[],
        level: number,
        parentKey: string | null,
        expandedSet: Set<string>,
        selectedSet: Set<string>,
    ): string {
        return nodes
            .map((node) => {
                const key = node.key
                const hasChildren = this._hasChildren(node)
                const isExpanded = expandedSet.has(key)
                const isSelected = selectedSet.has(key)
                const isLoading = this._loading.has(key)
                const disabled = !!node.disabled

                this._rows.push({
                    key,
                    parentKey,
                    level,
                    hasChildren,
                    expanded: isExpanded,
                    disabled,
                })

                // Disclosure toggle (chevron rotates on expand) or an invisible leaf spacer.
                let toggleHtml: string
                if (hasChildren) {
                    const glyph = isLoading
                        ? '<span class="spinner-border spinner-border-sm tc-tree-view-spinner" role="status" aria-hidden="true"></span>'
                        : chevronRightIcon
                    const expandedCls = isExpanded ? ' tc-tree-view-toggle--expanded' : ''
                    toggleHtml = `<span class="tc-tree-view-toggle${expandedCls}" aria-hidden="true">${glyph}</span>`
                } else {
                    toggleHtml =
                        '<span class="tc-tree-view-toggle tc-tree-view-toggle--leaf" aria-hidden="true"></span>'
                }

                let checkboxHtml = ''
                if (this.checkboxMode) {
                    const { checked, indeterminate } = this._checkboxState(node)
                    // Wrapped in a hit-area span: the visible box stays a small
                    // 0.95rem glyph, but the span widens to a 44px tap target
                    // under pointer:coarse (parent rows have no other click path
                    // to this control — clicking elsewhere on the row expands
                    // instead of selecting, unlike leaf rows).
                    checkboxHtml =
                        `<span class="tc-tree-view-checkbox-hit">` +
                        `<input type="checkbox" class="form-check-input tc-tree-view-checkbox"` +
                        ` ${checked ? 'checked' : ''}${disabled ? ' disabled' : ''}` +
                        `${indeterminate ? ' data-indeterminate="true"' : ''}` +
                        ` tabindex="-1" aria-label="${esc(node.label ?? '')}" />` +
                        `</span>`
                }

                // Pass the class so the .tc-tree-view-icon sizing rule applies —
                // icon() strips the SVG's width/height, so without it the glyph
                // renders at its default size (huge).
                const iconHtml = node.icon ? lucideByName(node.icon, 'tc-tree-view-icon') : ''
                const labelHtml = `<span class="tc-tree-view-label">${esc(node.label ?? '')}</span>`

                const rowClasses = ['tc-tree-view-row']
                if (isSelected) rowClasses.push('tc-tree-view-row--selected')

                const ariaExpanded = hasChildren ? ` aria-expanded="${isExpanded}"` : ''
                const ariaDisabled = disabled ? ' aria-disabled="true"' : ''

                const row =
                    `<div class="${rowClasses.join(' ')}" role="treeitem" data-key="${esc(key)}"` +
                    ` aria-level="${level + 1}" aria-selected="${isSelected}"${ariaExpanded}${ariaDisabled}` +
                    ` tabindex="-1" style="--tc-tree-level: ${level}">` +
                    `${toggleHtml}${checkboxHtml}${iconHtml}${labelHtml}` +
                    `</div>`

                // The guide hairline on a child group aligns with THIS row's chevron column.
                const childrenHtml =
                    hasChildren && isExpanded
                        ? `<ul class="tc-tree-view-group" role="group" style="--tc-tree-guide: ${level}">${this._renderNodesWith(this._getChildren(node), level + 1, key, expandedSet, selectedSet)}</ul>`
                        : ''

                return `<li class="tc-tree-view-node" role="none">${row}${childrenHtml}</li>`
            })
            .join('')
    }

    private render(): void {
        this._rows = []
        const rootClass = this.checkboxMode ? 'tc-tree-view tc-tree-view--checkbox' : 'tc-tree-view'
        const multiselect = this.checkboxMode ? ' aria-multiselectable="true"' : ''
        const body = this._renderNodes(this._nodes, 0, null)
        patchHtml(
            this,
            `<div class="${rootClass}">` +
                `<ul class="tc-tree-view-group tc-tree-view-root" role="tree"${multiselect}>${body}</ul>` +
                `</div>`,
        )

        this._applyRovingTabindex()
        this._applyIndeterminate()

        if (this._pendingFocus && this._activeKey) {
            this._rowEl(this._activeKey)?.focus()
        }
        this._pendingFocus = false
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TreeView
    }
}
