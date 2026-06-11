import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CardDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Card"
                        description="Flexible content container built on Bootstrap's card classes. Supports title, subtitle, image (top or bottom), theme variants, and optional header/footer slots."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Basic — title, subtitle and body text">
                            <div className="row g-3">
                                <div className="col-md-4">
                                    {/* @ts-ignore */}
                                    <tc-card title="Card title" subtitle="Card subtitle">
                                        <p className="card-text">Some quick example text to build on the card title and make up the bulk of the card's content.</p>
                                        <a href="#" className="btn btn-primary btn-sm">Go somewhere</a>
                                    {/* @ts-ignore */}
                                    </tc-card>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Image top — img-position=top (default)">
                            <div className="row g-3">
                                <div className="col-md-4">
                                    {/* @ts-ignore */}
                                    <tc-card title="Card with image" img="https://placehold.co/400x200" img-position="top">
                                        <p className="card-text">A card with an image at the top. The image uses <code>.card-img-top</code> and rounds the upper corners.</p>
                                    {/* @ts-ignore */}
                                    </tc-card>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Image bottom — img-position=bottom">
                            <div className="row g-3">
                                <div className="col-md-4">
                                    {/* @ts-ignore */}
                                    <tc-card title="Card with bottom image" img="https://placehold.co/400x200" img-position="bottom">
                                        <p className="card-text">A card with an image at the bottom. The image uses <code>.card-img-bottom</code> and rounds the lower corners.</p>
                                    {/* @ts-ignore */}
                                    </tc-card>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Header and footer slots — slot=&quot;header&quot; / slot=&quot;footer&quot;">
                            <div className="row g-3">
                                <div className="col-md-4">
                                    {/* @ts-ignore */}
                                    <tc-card title="Featured">
                                        <span slot="header">Featured</span>
                                        <p className="card-text">With supporting text below as a natural lead-in to additional content.</p>
                                        <a href="#" className="btn btn-primary btn-sm">Go somewhere</a>
                                        <span slot="footer"><small className="text-body-secondary">Last updated 3 mins ago</small></span>
                                    {/* @ts-ignore */}
                                    </tc-card>
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Variants — text-bg-{variant}">
                            <div className="row g-3">
                                {(['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'] as const).map(v => (
                                    <div key={v} className="col-md-3">
                                        {/* @ts-ignore */}
                                        <tc-card title={v.charAt(0).toUpperCase() + v.slice(1)} variant={v}>
                                            <p className="card-text">A <strong>{v}</strong> card using the <code>variant</code> attribute.</p>
                                        {/* @ts-ignore */}
                                        </tc-card>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default CardDemo
