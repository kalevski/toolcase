import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

// tc-scrollspy toggles .active on the href-carrying anchor inside the target.
// For tc-list-group-item that anchor is an internal node, so this hook listens
// for the tc-activate event and mirrors the state onto the item's `active`
// attribute, which drives the list-group-item active styling.
function useListGroupSync(): [React.RefObject<any>, React.RefObject<any>] {
    const spyRef = useRef<any>(null)
    const listRef = useRef<any>(null)

    useEffect(() => {
        const spy = spyRef.current
        const list = listRef.current
        if (!spy || !list) return
        const handler = (event: Event) => {
            const link = (event as CustomEvent).detail?.relatedTarget as HTMLElement | null
            const href = link?.getAttribute('href')
            if (!href) return
            list.querySelectorAll('tc-list-group-item').forEach((item: any) => {
                if (item.getAttribute('href') === href) item.setAttribute('active', '')
                else item.removeAttribute('active')
            })
        }
        spy.addEventListener('tc-activate', handler)
        return () => spy.removeEventListener('tc-activate', handler)
    }, [])

    return [spyRef, listRef]
}

const ScrollspyDemo: React.FC = () => {
    const [spyRef, listRef] = useListGroupSync()

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Scrollspy"
                            description="Scroll-position tracker. Point the target attribute at a tc-nav or tc-list-group and the active link follows the section scrolled into view. Use offset to shift the trigger threshold, smooth-scroll for animated in-pane anchor clicks, and the tc-activate event to react to section changes."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="tc-nav target — vertical underline nav follows scroll">
                                <div className="row g-3">
                                    <div className="col-12 col-md-3">
                                        {/* @ts-ignore */}
                                        <tc-nav id="scrollspy-nav-target" variant="underline" vertical>
                                            {/* @ts-ignore */}
                                            <tc-nav-item href="#scrollspy-n1">Overview</tc-nav-item>
                                            {/* @ts-ignore */}
                                            <tc-nav-item href="#scrollspy-n2">Install</tc-nav-item>
                                            {/* @ts-ignore */}
                                            <tc-nav-item href="#scrollspy-n3">Theming</tc-nav-item>
                                            {/* @ts-ignore */}
                                            <tc-nav-item href="#scrollspy-n4">API</tc-nav-item>
                                        {/* @ts-ignore */}
                                        </tc-nav>
                                    </div>
                                    <div className="col-12 col-md-9">
                                        {/* @ts-ignore */}
                                        <tc-scrollspy target="#scrollspy-nav-target" smooth-scroll style={{ height: '220px' }}>
                                            <div id="scrollspy-n1" style={{ padding: '0.5rem 0 1rem' }}>
                                                <h5 className="d-flex align-items-center gap-2">
                                                    Overview
                                                    {/* @ts-ignore */}
                                                    <tc-badge variant="secondary" text="docs" />
                                                </h5>
                                                <p>Scroll this pane — the underline nav on the left highlights the section currently in view. Each nav item links to a section id inside the pane (<code>href="#scrollspy-n1"</code> and so on), and the spy resolves them automatically.</p>
                                            </div>
                                            <div id="scrollspy-n2" style={{ padding: '0.5rem 0 1rem' }}>
                                                <h5>Install</h5>
                                                <p>The scroll container is the <code>tc-scrollspy</code> element itself; it only needs a fixed height. The <code>target</code> attribute is a CSS selector pointing at the nav whose links should be spied.</p>
                                            </div>
                                            <div id="scrollspy-n3" style={{ padding: '0.5rem 0 1rem' }}>
                                                <h5 className="d-flex align-items-center gap-2">
                                                    Theming
                                                    {/* @ts-ignore */}
                                                    <tc-badge variant="info" text="css vars" />
                                                </h5>
                                                <p>The active link picks up the regular <code>tc-nav</code> active styling, so any nav variant works — underline shown here keeps the plain anchors the spy expects.</p>
                                            </div>
                                            <div id="scrollspy-n4" style={{ padding: '0.5rem 0 1rem' }}>
                                                <h5>API</h5>
                                                <p>With <code>smooth-scroll</code> set, clicking a nav link animates the pane to the section instead of jumping the whole page. The host also fires <code>tc-activate</code> whenever the active link changes.</p>
                                            </div>
                                        {/* @ts-ignore */}
                                        </tc-scrollspy>
                                    </div>
                                </div>
                            </SectionCard>

                            <SectionCard title="tc-list-group target — active item follows scroll via tc-activate">
                                <div className="row g-3">
                                    <div className="col-12 col-md-4">
                                        {/* @ts-ignore */}
                                        <tc-list-group id="scrollspy-list-target" ref={listRef}>
                                            {/* @ts-ignore */}
                                            <tc-list-group-item href="#scrollspy-l1" active>Getting started</tc-list-group-item>
                                            {/* @ts-ignore */}
                                            <tc-list-group-item href="#scrollspy-l2">Configuration</tc-list-group-item>
                                            {/* @ts-ignore */}
                                            <tc-list-group-item href="#scrollspy-l3">Release notes</tc-list-group-item>
                                        {/* @ts-ignore */}
                                        </tc-list-group>
                                    </div>
                                    <div className="col-12 col-md-8">
                                        {/* @ts-ignore */}
                                        <tc-scrollspy ref={spyRef} target="#scrollspy-list-target" smooth-scroll style={{ height: '220px' }}>
                                            <div id="scrollspy-l1" style={{ padding: '0.5rem 0 1rem' }}>
                                                <h5>Getting started</h5>
                                                <p>A <code>tc-list-group</code> works as a spy target too: give each <code>tc-list-group-item</code> an <code>href</code> pointing at a section id inside the pane.</p>
                                                <p>This demo listens for the <code>tc-activate</code> event on the scrollspy host and mirrors the activated link onto the matching item's <code>active</code> attribute.</p>
                                            </div>
                                            <div id="scrollspy-l2" style={{ padding: '0.5rem 0 1rem' }}>
                                                <h5>Configuration</h5>
                                                <p>The event detail carries <code>relatedTarget</code> — the anchor that just became active — so the handler only needs to compare hrefs to find the matching item.</p>
                                            </div>
                                            <div id="scrollspy-l3" style={{ padding: '0.5rem 0 1rem' }}>
                                                <h5>Release notes</h5>
                                                {/* @ts-ignore */}
                                                <tc-card title="Sections can hold any markup" subtitle="Cards, badges, forms…">
                                                    <p className="mb-0">The spy observes the section wrappers by id, so the content inside them is unconstrained — this card scrolls along like any other block.</p>
                                                {/* @ts-ignore */}
                                                </tc-card>
                                            </div>
                                        {/* @ts-ignore */}
                                        </tc-scrollspy>
                                    </div>
                                </div>
                            </SectionCard>

                            <SectionCard title="offset — activate 80px before the section reaches the top">
                                {/* @ts-ignore */}
                                <tc-nav id="scrollspy-offset-target" variant="underline" style={{ marginBottom: '0.75rem' }}>
                                    {/* @ts-ignore */}
                                    <tc-nav-item href="#scrollspy-o1">Alpha</tc-nav-item>
                                    {/* @ts-ignore */}
                                    <tc-nav-item href="#scrollspy-o2">Beta</tc-nav-item>
                                    {/* @ts-ignore */}
                                    <tc-nav-item href="#scrollspy-o3">Gamma</tc-nav-item>
                                {/* @ts-ignore */}
                                </tc-nav>
                                {/* @ts-ignore */}
                                <tc-scrollspy target="#scrollspy-offset-target" offset="80" smooth-scroll style={{ height: '200px' }}>
                                    <div id="scrollspy-o1" style={{ padding: '0.5rem 0 1rem' }}>
                                        <h5>Alpha</h5>
                                        <p>With <code>offset="80"</code> the link activates 80 px before the section scrolls to the top of the container.</p>
                                        <p>Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Donec velit neque, auctor sit amet aliquam vel, ullamcorper sit amet ligula.</p>
                                    </div>
                                    <div id="scrollspy-o2" style={{ padding: '0.5rem 0 1rem' }}>
                                        <h5>Beta</h5>
                                        <p>Curabitur aliquet quam id dui posuere blandit. Cras ultricies ligula sed magna dictum porta. Vivamus magna justo, lacinia eget consectetur sed, convallis at tellus.</p>
                                    </div>
                                    <div id="scrollspy-o3" style={{ padding: '0.5rem 0 1rem' }}>
                                        <h5>Gamma</h5>
                                        <p>Proin eget tortor risus. Curabitur non nulla sit amet nisl tempus convallis quis ac lectus. Donec rutrum congue leo eget malesuada.</p>
                                    </div>
                                {/* @ts-ignore */}
                                </tc-scrollspy>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ScrollspyDemo
