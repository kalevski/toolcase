import React, { useEffect, useRef } from 'react'

const CurrencyDisplayDemo: React.FC = () => {
    const displayRef = useRef<any>(null)

    // JS-property props (amount as a real number, font-size as a number) need a
    // ref — React can't set them as attributes. Demonstrates the reflected
    // numeric `amount` and `fontSize` properties plus `label`/`currencyIcon`.
    useEffect(() => {
        const el = displayRef.current
        if (!el) return
        el.label = 'Wallet balance'
        el.currencyIcon = '◆'
        el.amount = 1284500
        el.fontSize = 32
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="CurrencyDisplay"
                            description="A larger currency readout pairing an optional uppercase label and currency icon with a prominent amount. The amount is rendered in JetBrains Mono with tabular figures; the icon picks up the ink accent and can be re-tinted via the color attribute, and the amount scales with the font-size attribute."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic">
                                <div className="d-flex flex-wrap gap-5 align-items-end">
                                    {/* @ts-ignore */}
                                    <tc-currency-display
                                        label="Balance"
                                        currency-icon="$"
                                        amount="2499"
                                    ></tc-currency-display>
                                    {/* @ts-ignore */}
                                    <tc-currency-display
                                        label="Earnings"
                                        currency-icon="€"
                                        amount="180500"
                                    ></tc-currency-display>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Symbol icons &amp; large amounts">
                                <div className="d-flex flex-wrap gap-5 align-items-end">
                                    {/* @ts-ignore */}
                                    <tc-currency-display
                                        label="Gems"
                                        currency-icon="◆"
                                        amount="1250000"
                                    ></tc-currency-display>
                                    {/* @ts-ignore */}
                                    <tc-currency-display
                                        label="Experience"
                                        currency-icon="XP"
                                        amount="34000"
                                    ></tc-currency-display>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom icon color">
                                <div className="d-flex flex-wrap gap-5 align-items-end">
                                    {/* @ts-ignore */}
                                    <tc-currency-display
                                        label="Credits"
                                        currency-icon="◆"
                                        amount="500"
                                        color="var(--tc-accent)"
                                    ></tc-currency-display>
                                    {/* @ts-ignore */}
                                    <tc-currency-display
                                        label="Health"
                                        currency-icon="●"
                                        amount="42"
                                        color="var(--tc-success)"
                                    ></tc-currency-display>
                                    {/* @ts-ignore */}
                                    <tc-currency-display
                                        label="Tokens"
                                        currency-icon="◆"
                                        amount="128"
                                        color="#a855f7"
                                    ></tc-currency-display>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom font size">
                                <div className="d-flex flex-wrap gap-5 align-items-end">
                                    {/* @ts-ignore */}
                                    <tc-currency-display
                                        label="Compact"
                                        currency-icon="$"
                                        amount="980"
                                        font-size="18"
                                    ></tc-currency-display>
                                    {/* @ts-ignore */}
                                    <tc-currency-display
                                        label="Headline"
                                        currency-icon="$"
                                        amount="980"
                                        font-size="40"
                                    ></tc-currency-display>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Label-less &amp; icon-less (amount only)">
                                <div className="d-flex flex-wrap gap-5 align-items-end">
                                    {/* @ts-ignore */}
                                    <tc-currency-display
                                        currency-icon="$"
                                        amount="64"
                                    ></tc-currency-display>
                                    {/* @ts-ignore */}
                                    <tc-currency-display amount="1024"></tc-currency-display>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Set via JS properties (ref)">
                                <div className="d-flex flex-wrap gap-5 align-items-end">
                                    {/* @ts-ignore */}
                                    <tc-currency-display ref={displayRef}></tc-currency-display>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CurrencyDisplayDemo
