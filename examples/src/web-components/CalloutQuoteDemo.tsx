import React from 'react'

const CalloutQuoteDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="CalloutQuote"
                        description="Blockquote with a decorative quote-mark icon, attribution, and an optional source link."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Quote via attribute">
                            {/* @ts-ignore */}
                            <tc-callout-quote quote="The best way to predict the future is to invent it."></tc-callout-quote>
                        </tc-section-card>

                        <tc-section-card title="Quote via default slot">
                            {/* @ts-ignore */}
                            <tc-callout-quote>
                                Simplicity is the ultimate sophistication.
                            </tc-callout-quote>
                        </tc-section-card>

                        <tc-section-card title="With attribution">
                            {/* @ts-ignore */}
                            <tc-callout-quote
                                quote="Any sufficiently advanced technology is indistinguishable from magic."
                                attribution="Arthur C. Clarke"
                            ></tc-callout-quote>
                        </tc-section-card>

                        <tc-section-card title="With attribution and linked source">
                            {/* @ts-ignore */}
                            <tc-callout-quote
                                quote="Programs must be written for people to read, and only incidentally for machines to execute."
                                attribution="Harold Abelson"
                                source="Structure and Interpretation of Computer Programs"
                                source-href="https://mitpress.mit.edu/sites/default/files/sicp/index.html"
                            ></tc-callout-quote>
                        </tc-section-card>

                        <tc-section-card title="With attribution and plain source (no link)">
                            {/* @ts-ignore */}
                            <tc-callout-quote
                                quote="An idea that is not dangerous is unworthy of being called an idea at all."
                                attribution="Oscar Wilde"
                                source="The Critic as Artist"
                            ></tc-callout-quote>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default CalloutQuoteDemo
