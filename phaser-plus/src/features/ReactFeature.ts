import type { ReactNode } from 'react'
import type { Root } from 'react-dom/client'
import HTMLFeature from './HTMLFeature'
import type Scene from '../engine/Scene'

let createRootFn: ((container: Element | DocumentFragment) => Root) | null = null

async function loadCreateRoot(): Promise<(container: Element | DocumentFragment) => Root> {
    if (createRootFn !== null) return createRootFn
    try {
        const mod = await import(/* @vite-ignore */ 'react-dom/client') as { createRoot: (container: Element | DocumentFragment) => Root }
        createRootFn = mod.createRoot
        return createRootFn
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new Error(`react-dom is not installed. Add \`react\` and \`react-dom\` (>=18) to use ReactFeature. (${detail})`)
    }
}

export default class ReactFeature extends HTMLFeature {

    private _root: Root | null = null

    private _pending: ReactNode | null = null

    private _loading: boolean = false

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    /**
     * Render a React node into this feature's DOM container.
     * Creates a root on first call and reuses it for subsequent renders.
     * Safe to call before the root is ready — the latest pending element will be rendered once initialized.
     */
    render(element: ReactNode): void {
        if (this._root !== null) {
            this._root.render(element)
            return
        }
        this._pending = element
        if (this._loading) return
        this._loading = true
        loadCreateRoot()
            .then((createRoot) => {
                if (this._pending === null) {
                    this._loading = false
                    return
                }
                this._root = createRoot(this.node)
                this._root.render(this._pending)
                this._pending = null
                this._loading = false
            })
            .catch((error) => {
                this._loading = false
                this.logger.error('failed to mount react root:', error)
            })
    }

    /**
     * Async variant of `render` — resolves once the React root has been created and the element rendered.
     */
    async renderAsync(element: ReactNode): Promise<void> {
        if (this._root === null) {
            const createRoot = await loadCreateRoot()
            if (this._root === null) {
                this._root = createRoot(this.node)
            }
        }
        this._root.render(element)
        this._pending = null
    }

    /**
     * Unmount the React tree (if any) and dispose the root.
     */
    unmount(): void {
        this._pending = null
        if (this._root === null) return
        this._root.unmount()
        this._root = null
    }

    override preDestroy(): void {
        this.unmount()
        super.preDestroy()
    }

}
