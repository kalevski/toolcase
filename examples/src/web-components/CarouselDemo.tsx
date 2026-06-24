import React from 'react'

const CarouselDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Carousel"
                        description="Slideshow component backed by Bootstrap's Carousel plugin. Supports indicators, prev/next controls, fade transitions, and autoplay via the ride attribute. Each direct child becomes a slide."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Basic — no controls or indicators">
                            {/* @ts-ignore */}
                            <tc-carousel style={{ maxWidth: '600px' }}>
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#0d6efd',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Slide 1
                                </div>
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#6610f2',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Slide 2
                                </div>
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#6f42c1',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Slide 3
                                </div>
                                {/* @ts-ignore */}
                            </tc-carousel>
                        </tc-section-card>

                        <tc-section-card title="controls — prev/next navigation buttons">
                            {/* @ts-ignore */}
                            <tc-carousel controls style={{ maxWidth: '600px' }}>
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#198754',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Slide 1
                                </div>
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#0dcaf0',
                                        color: '#000',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Slide 2
                                </div>
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#ffc107',
                                        color: '#000',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Slide 3
                                </div>
                                {/* @ts-ignore */}
                            </tc-carousel>
                        </tc-section-card>

                        <tc-section-card title="indicators — dot navigation">
                            {/* @ts-ignore */}
                            <tc-carousel controls indicators style={{ maxWidth: '600px' }}>
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#dc3545',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Slide 1
                                </div>
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#fd7e14',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Slide 2
                                </div>
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#20c997',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Slide 3
                                </div>
                                {/* @ts-ignore */}
                            </tc-carousel>
                        </tc-section-card>

                        <tc-section-card title="fade — crossfade transition instead of slide">
                            {/* @ts-ignore */}
                            <tc-carousel controls indicators fade style={{ maxWidth: '600px' }}>
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#6c757d',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Slide 1 (fade)
                                </div>
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#343a40',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Slide 2 (fade)
                                </div>
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#212529',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Slide 3 (fade)
                                </div>
                                {/* @ts-ignore */}
                            </tc-carousel>
                        </tc-section-card>

                        <tc-section-card title="ride=carousel — autoplay on load (interval=2000ms)">
                            {/* @ts-ignore */}
                            <tc-carousel
                                controls
                                indicators
                                ride="carousel"
                                interval="2000"
                                style={{ maxWidth: '600px' }}
                            >
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#0d6efd',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Auto 1
                                </div>
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#6610f2',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Auto 2
                                </div>
                                <div
                                    style={{
                                        height: '200px',
                                        background: '#d63384',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                    }}
                                >
                                    Auto 3
                                </div>
                                {/* @ts-ignore */}
                            </tc-carousel>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default CarouselDemo
