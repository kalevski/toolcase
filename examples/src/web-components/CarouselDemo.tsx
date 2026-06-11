import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CarouselDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Carousel"
                        description="Slideshow component backed by Bootstrap's Carousel plugin. Supports indicators, prev/next controls, fade transitions, and autoplay via the ride attribute. Each direct child becomes a slide."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Basic — no controls or indicators">
                            {/* @ts-ignore */}
                            <tc-carousel style={{ maxWidth: '600px' }}>
                                <div style={{ height: '200px', background: '#0d6efd', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Slide 1</div>
                                <div style={{ height: '200px', background: '#6610f2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Slide 2</div>
                                <div style={{ height: '200px', background: '#6f42c1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Slide 3</div>
                            {/* @ts-ignore */}
                            </tc-carousel>
                        </SectionCard>

                        <SectionCard title="controls — prev/next navigation buttons">
                            {/* @ts-ignore */}
                            <tc-carousel controls style={{ maxWidth: '600px' }}>
                                <div style={{ height: '200px', background: '#198754', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Slide 1</div>
                                <div style={{ height: '200px', background: '#0dcaf0', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Slide 2</div>
                                <div style={{ height: '200px', background: '#ffc107', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Slide 3</div>
                            {/* @ts-ignore */}
                            </tc-carousel>
                        </SectionCard>

                        <SectionCard title="indicators — dot navigation">
                            {/* @ts-ignore */}
                            <tc-carousel controls indicators style={{ maxWidth: '600px' }}>
                                <div style={{ height: '200px', background: '#dc3545', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Slide 1</div>
                                <div style={{ height: '200px', background: '#fd7e14', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Slide 2</div>
                                <div style={{ height: '200px', background: '#20c997', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Slide 3</div>
                            {/* @ts-ignore */}
                            </tc-carousel>
                        </SectionCard>

                        <SectionCard title="fade — crossfade transition instead of slide">
                            {/* @ts-ignore */}
                            <tc-carousel controls indicators fade style={{ maxWidth: '600px' }}>
                                <div style={{ height: '200px', background: '#6c757d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Slide 1 (fade)</div>
                                <div style={{ height: '200px', background: '#343a40', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Slide 2 (fade)</div>
                                <div style={{ height: '200px', background: '#212529', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Slide 3 (fade)</div>
                            {/* @ts-ignore */}
                            </tc-carousel>
                        </SectionCard>

                        <SectionCard title="ride=carousel — autoplay on load (interval=2000ms)">
                            {/* @ts-ignore */}
                            <tc-carousel controls indicators ride="carousel" interval="2000" style={{ maxWidth: '600px' }}>
                                <div style={{ height: '200px', background: '#0d6efd', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Auto 1</div>
                                <div style={{ height: '200px', background: '#6610f2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Auto 2</div>
                                <div style={{ height: '200px', background: '#d63384', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>Auto 3</div>
                            {/* @ts-ignore */}
                            </tc-carousel>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default CarouselDemo
