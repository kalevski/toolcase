import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const NavbarDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Navbar"
                        description="The toolcase app chrome: a translucent glass bar on a hairline, with the typographic brand mark (square accent dot + mono wordmark) and dense links — the active item carries a 2px accent underline. Use brand for the wordmark, expand for the collapse breakpoint, variant=dark for the ink surface, and sticky/fixed for positioning. Nav links placed as children are projected into the collapsible region."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default — glass chrome, brand mark + links, collapses at lg">
                            {/* @ts-ignore */}
                            <tc-navbar brand="toolcase" expand="lg">
                                <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                                    <li className="nav-item">
                                        <a className="nav-link active" href="#">Overview</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#">Components</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#">Tokens</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link disabled" aria-disabled="true">Changelog</a>
                                    </li>
                                </ul>
                            {/* @ts-ignore */}
                            </tc-navbar>
                        </SectionCard>

                        <SectionCard title="expand=md — borderless icon toggler, sheet-style collapse below md">
                            {/* @ts-ignore */}
                            <tc-navbar brand="console" expand="md">
                                <ul className="navbar-nav me-auto mb-2 mb-md-0">
                                    <li className="nav-item">
                                        <a className="nav-link active" href="#">Dashboard</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#">Reports</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#">Settings</a>
                                    </li>
                                </ul>
                            {/* @ts-ignore */}
                            </tc-navbar>
                        </SectionCard>

                        <SectionCard title="variant=dark — ink surface, the brand dot keeps the signature cyan">
                            {/* @ts-ignore */}
                            <tc-navbar brand="ops" expand="lg" variant="dark">
                                <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                                    <li className="nav-item">
                                        <a className="nav-link active" href="#">Fleet</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#">Incidents</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#">Audit</a>
                                    </li>
                                </ul>
                                <div className="d-flex">
                                    <button className="btn btn-outline-light">Sign in</button>
                                </div>
                            {/* @ts-ignore */}
                            </tc-navbar>
                        </SectionCard>

                        <SectionCard title="sticky=top — the glass surface blurs content scrolling underneath">
                            <div style={{ height: '160px', overflowY: 'auto', border: '1px solid var(--bs-border-color)' }}>
                                {/* @ts-ignore */}
                                <tc-navbar brand="docs" expand="lg" sticky="top">
                                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                                        <li className="nav-item">
                                            <a className="nav-link active" href="#">Guide</a>
                                        </li>
                                        <li className="nav-item">
                                            <a className="nav-link" href="#">Reference</a>
                                        </li>
                                    </ul>
                                {/* @ts-ignore */}
                                </tc-navbar>
                                <div className="p-3">
                                    <p>Scroll this region — the bar stays pinned and the translucent surface picks up the content moving beneath it.</p>
                                    <p>More content below…</p>
                                    <p>Even more content…</p>
                                    <p>Keeps going…</p>
                                </div>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default NavbarDemo
