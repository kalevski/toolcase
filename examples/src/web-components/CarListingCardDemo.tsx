import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const SPECS = [
    { icon: 'gauge', label: '12,400 mi' },
    { icon: 'fuel', label: 'Petrol' },
    { icon: 'settings-2', label: 'Automatic' },
]

const CarListingCardDemo: React.FC = () => {
    const [wishlisted, setWishlisted] = useState(false)
    const [lastEvent, setLastEvent] = useState<string>('—')

    const gridRef = useTc<HTMLElement>(
        { specs: SPECS },
        {
            'tc-wishlist-toggle': (e: any) => {
                setWishlisted(e.detail.wishlisted)
                setLastEvent(`wishlisted: ${e.detail.wishlisted}`)
            },
        },
    )
    const listRef = useTc<HTMLElement>({ specs: SPECS })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Car Listing Card"
                            description="A vehicle listing card — image, category chip, wishlist toggle, title, rating, an icon spec row for mileage/fuel/transmission, current + strikethrough-old price, and an optional seller mini-row. Ported from automotive marketplace templates for the Redline theme (see the Theme demo). Switch layout to `list` for a horizontal browsing arrangement."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Grid layout (default)">
                                <p className="text-muted small mb-3">
                                    Last event: {lastEvent}. Click the heart to toggle the wishlist
                                    state (fires <code>tc-wishlist-toggle</code>).
                                </p>
                                <div style={{ maxWidth: '20rem' }}>
                                    {/* @ts-ignore */}
                                    <tc-car-listing-card
                                        ref={gridRef}
                                        image-src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&h=400&fit=crop"
                                        image-alt="Red sports coupe"
                                        category="Sports Car"
                                        title-text="2024 Vantage GT Coupe"
                                        href="#"
                                        price-text="$58,900"
                                        price-old-text="$62,400"
                                        rating="4.5"
                                        rating-count-text="(128)"
                                        seller-name="Redline Motors"
                                        seller-avatar-src="https://i.pravatar.cc/40?img=13"
                                        // @ts-ignore
                                        wishlisted={wishlisted}
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title='Layout="list"'>
                                <p className="text-muted small mb-3">
                                    A horizontal arrangement for list-view browsing pages, image
                                    left / details right (stacks below 576px).
                                </p>
                                {/* @ts-ignore */}
                                <tc-car-listing-card
                                    ref={listRef}
                                    layout="list"
                                    image-src="https://images.unsplash.com/photo-1502877338535-766e1452684a?w=600&h=400&fit=crop"
                                    image-alt="Silver sedan"
                                    category="Sedan"
                                    title-text="2023 Meridian Sedan LX"
                                    href="#"
                                    price-text="$34,200"
                                    rating="4"
                                    rating-count-text="(64)"
                                    seller-name="City Auto Group"
                                    seller-avatar-src="https://i.pravatar.cc/40?img=32"
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CarListingCardDemo
