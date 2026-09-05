import { triggerEvent } from './transition'
import { queryOne, rootMargin } from './safe-dom'

// Drop-in replacement for Bootstrap's ScrollSpy plugin (5.3 IntersectionObserver
// flavour). The spied element is the scroll container; `target` selects the nav
// whose .nav-link / .list-group-item anchors point (href="#id") at sections
// inside the container. The matching link gets .active as sections scroll into
// view, and activate.bs.scrollspy fires on the spied element with relatedTarget.
// smoothScroll makes anchor clicks scroll the container smoothly.

export interface ScrollSpyOptions {
    target: string
    smoothScroll?: boolean
    rootMargin?: string
}

export class ScrollSpy {
    private _element: HTMLElement
    private _targetNav: HTMLElement | null
    private _smoothScroll: boolean
    private _observer: IntersectionObserver | null = null
    private _linksById = new Map<string, HTMLElement>()
    private _activeLink: HTMLElement | null = null
    private _visible = new Set<Element>()

    constructor(element: HTMLElement, options: ScrollSpyOptions) {
        this._element = element
        // `target` is a selector the consumer wrote: a typo has to mean "matches
        // nothing", not a SyntaxError thrown out of the element's connect.
        this._targetNav = queryOne<HTMLElement>(document, options.target)
        this._smoothScroll = options.smoothScroll ?? false

        const sections = this._collectSections()
        if (sections.length > 0) {
            this._observer = new IntersectionObserver(this._onIntersect, {
                root: this._element,
                rootMargin: rootMargin(options.rootMargin, '0px 0px -25%'),
                threshold: [0.1, 0.5, 1],
            })
            for (const section of sections) this._observer.observe(section)
        }

        if (this._smoothScroll && this._targetNav) {
            this._targetNav.addEventListener('click', this._onNavClick)
        }
    }

    refresh(): void {
        // Surface parity with Bootstrap; observation set is rebuilt on dispose+recreate.
    }

    dispose(): void {
        this._activeLink?.classList.remove('active')
        this._activeLink = null
        this._linksById.clear()
        this._observer?.disconnect()
        this._observer = null
        this._targetNav?.removeEventListener('click', this._onNavClick)
        this._visible.clear()
    }

    private _collectSections(): HTMLElement[] {
        if (!this._targetNav) return []
        const sections: HTMLElement[] = []
        const links = this._targetNav.querySelectorAll<HTMLElement>('[href^="#"]')
        for (const link of Array.from(links)) {
            const href = link.getAttribute('href')
            if (!href || href.length < 2) continue
            const section = this._element.querySelector<HTMLElement>(
                `#${CSS.escape(href.slice(1))}`,
            )
            if (section) {
                this._linksById.set(href.slice(1), link)
                sections.push(section)
            }
        }
        return sections
    }

    private _onIntersect = (entries: IntersectionObserverEntry[]): void => {
        for (const entry of entries) {
            if (entry.isIntersecting) this._visible.add(entry.target)
            else this._visible.delete(entry.target)
        }
        // Activate the top-most visible section.
        let topMost: Element | null = null
        let topMostY = Infinity
        for (const section of this._visible) {
            const y = section.getBoundingClientRect().top
            if (y < topMostY) {
                topMostY = y
                topMost = section
            }
        }
        if (topMost?.id) this._activate(topMost.id)
    }

    private _activate(sectionId: string): void {
        const link = this._linksById.get(sectionId)
        if (!link || link === this._activeLink) return

        if (this._activeLink) this._activeLink.classList.remove('active')
        link.classList.add('active')
        this._activeLink = link
        triggerEvent(this._element, 'activate.bs.scrollspy', { relatedTarget: link })
    }

    private _onNavClick = (event: Event): void => {
        const target = event.target as Element
        const link = target.closest<HTMLElement>('[href^="#"]')
        if (!link || !this._targetNav?.contains(link)) return
        const href = link.getAttribute('href')
        if (!href || href.length < 2) return
        // href fragments are not guaranteed to be valid CSS selectors —
        // querySelector throws a DOMException on e.g. `#1numeric` or `#a:b`.
        const section = this._element.querySelector<HTMLElement>(`#${CSS.escape(href.slice(1))}`)
        if (!section) return
        event.preventDefault()
        // offsetTop is relative to *each element's own* offsetParent, not a
        // shared origin, so `section.offsetTop - this._element.offsetTop` only
        // cancels out when both share an offsetParent — it doesn't when the
        // container itself is nested inside other positioned ancestors (the
        // common case), landing the scroll far from the section. getBoundingClientRect
        // gives both elements the same (viewport) origin, so the delta between
        // them is the container-relative offset regardless of the offsetParent chain.
        const delta = section.getBoundingClientRect().top - this._element.getBoundingClientRect().top
        this._element.scrollTo({
            top: this._element.scrollTop + delta,
            behavior: 'smooth',
        })
    }
}
