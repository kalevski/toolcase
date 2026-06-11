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
                        description="Bootstrap responsive navbar wrapper. Use brand for the brand text, expand for the collapse breakpoint, variant for light/dark theming, and bg for background colour. Place nav links directly as children — they are projected into the collapsible region."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default — brand + links, collapses at lg">
                            {/* @ts-ignore */}
                            <tc-navbar brand="MyApp" expand="lg" bg="body-tertiary">
                                <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                                    <li className="nav-item">
                                        <a className="nav-link active" href="#">Home</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#">Features</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#">Pricing</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link disabled" aria-disabled="true">Disabled</a>
                                    </li>
                                </ul>
                            {/* @ts-ignore */}
                            </tc-navbar>
                        </SectionCard>

                        <SectionCard title="expand=md — collapses below md breakpoint">
                            {/* @ts-ignore */}
                            <tc-navbar brand="SiteMD" expand="md" bg="primary" variant="dark">
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

                        <SectionCard title="variant=dark — dark-themed navbar">
                            {/* @ts-ignore */}
                            <tc-navbar brand="DarkSite" expand="lg" bg="dark" variant="dark">
                                <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                                    <li className="nav-item">
                                        <a className="nav-link active" href="#">Home</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#">About</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#">Contact</a>
                                    </li>
                                </ul>
                                <div className="d-flex">
                                    <button className="btn btn-outline-light">Sign in</button>
                                </div>
                            {/* @ts-ignore */}
                            </tc-navbar>
                        </SectionCard>

                        <SectionCard title="sticky=top — sticks to top of scroll container">
                            <div style={{ height: '160px', overflowY: 'auto', border: '1px solid var(--bs-border-color)' }}>
                                {/* @ts-ignore */}
                                <tc-navbar brand="Sticky" expand="lg" bg="success" variant="dark" sticky="top">
                                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                                        <li className="nav-item">
                                            <a className="nav-link active" href="#">Page</a>
                                        </li>
                                        <li className="nav-item">
                                            <a className="nav-link" href="#">Another</a>
                                        </li>
                                    </ul>
                                {/* @ts-ignore */}
                                </tc-navbar>
                                <div className="p-3">
                                    <p>Scroll this region to see the navbar stay at the top.</p>
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
