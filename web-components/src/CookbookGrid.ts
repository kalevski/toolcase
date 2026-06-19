import { esc } from './internal/esc'
const TAG_NAME = 'tc-cookbook-grid'

const COLUMNS = [2, 3] as const
export type CookbookGridColumns = 2 | 3

export interface Recipe {
    title: string
    description?: string
    code: string
    language?: string
    tags?: string[]
    href?: string
}

export class CookbookGrid extends HTMLElement {
    private _initialised = false
    private _recipes: Recipe[] = []

    static get observedAttributes(): string[] {
        return ['columns', 'title']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const hasTitleAttr = this.hasAttribute('title')
            const slotNodes = hasTitleAttr
                ? []
                : Array.from(this.querySelectorAll('[slot="title"]'))
            this.render()
            if (!hasTitleAttr) {
                const slot = this.querySelector('.tc-cookbook-grid-title-slot')
                if (slot) slotNodes.forEach((n) => slot.appendChild(n))
                this._updateHeaderVisibility()
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    get recipes(): Recipe[] {
        return this._recipes
    }
    set recipes(v: Recipe[]) {
        this._recipes = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    get columns(): CookbookGridColumns {
        const raw = parseInt(this.getAttribute('columns') ?? '2', 10) as CookbookGridColumns
        return (COLUMNS as readonly number[]).includes(raw) ? raw : 2
    }
    set columns(v: CookbookGridColumns) {
        this.setAttribute('columns', String(v))
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        if (v) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    private _rerenderWithSlots(): void {
        const hasTitleAttr = this.hasAttribute('title')
        const slot = this.querySelector('.tc-cookbook-grid-title-slot')
        const slotNodes =
            !hasTitleAttr && slot ? Array.from(slot.querySelectorAll('[slot="title"]')) : []
        this.render()
        if (!hasTitleAttr) {
            const newSlot = this.querySelector('.tc-cookbook-grid-title-slot')
            if (newSlot) slotNodes.forEach((n) => newSlot.appendChild(n))
            this._updateHeaderVisibility()
        }
    }

    private _updateHeaderVisibility(): void {
        const header = this.querySelector('.tc-cookbook-grid__header--slot') as HTMLElement | null
        if (!header) return
        const slot = header.querySelector('.tc-cookbook-grid-title-slot')
        if (slot && slot.hasChildNodes()) {
            header.style.removeProperty('display')
        } else {
            header.style.display = 'none'
        }
    }

    private _recipeHtml(recipe: Recipe): string {
        const titleHtml = `<h3 class="tc-cookbook-grid-item__title">${esc(recipe.title)}</h3>`

        const descHtml = recipe.description
            ? `<p class="tc-cookbook-grid-item__desc">${esc(recipe.description)}</p>`
            : ''

        const langHtml = recipe.language
            ? `<span class="tc-cookbook-grid-item__lang">${esc(recipe.language.toUpperCase())}</span>`
            : ''

        const codeHtml =
            `<div class="tc-cookbook-grid-item__code-wrap">` +
            `${langHtml}` +
            `<pre class="tc-cookbook-grid-item__pre"><code class="tc-cookbook-grid-item__code">${esc(recipe.code)}</code></pre>` +
            `</div>`

        const tagsHtml =
            recipe.tags && recipe.tags.length > 0
                ? `<div class="tc-cookbook-grid-item__tags">` +
                  recipe.tags
                      .map((t) => `<span class="tc-cookbook-grid-item__tag">${esc(t)}</span>`)
                      .join('') +
                  `</div>`
                : ''

        const inner =
            `<div class="tc-cookbook-grid-item-inner">` +
            `${titleHtml}${descHtml}${codeHtml}${tagsHtml}` +
            `</div>`

        if (recipe.href) {
            return (
                `<a class="tc-cookbook-grid-item tc-cookbook-grid-item--linked" ` +
                `href="${esc(recipe.href)}" aria-label="${esc(recipe.title)}">${inner}</a>`
            )
        }
        return `<article class="tc-cookbook-grid-item">${inner}</article>`
    }

    private render(): void {
        this.classList.add('tc-cookbook-grid')

        const titleAttr = this.getAttribute('title')
        const hasTitleAttr = titleAttr != null
        const cols = this.columns

        let headerHtml = ''
        if (hasTitleAttr) {
            if (titleAttr) {
                headerHtml =
                    `<div class="tc-cookbook-grid__header">` +
                    `<h2 class="tc-cookbook-grid__title">${esc(titleAttr)}</h2>` +
                    `</div>`
            }
        } else {
            headerHtml =
                `<div class="tc-cookbook-grid__header tc-cookbook-grid__header--slot" style="display:none">` +
                `<span class="tc-cookbook-grid-title-slot"></span>` +
                `</div>`
        }

        const itemsHtml = this._recipes.map((r) => this._recipeHtml(r)).join('')

        this.innerHTML =
            `${headerHtml}` +
            `<div class="tc-cookbook-grid-grid" style="--tc-cg-cols:${cols}">${itemsHtml}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CookbookGrid
    }
}
