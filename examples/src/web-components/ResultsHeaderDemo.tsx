import React from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const ResultsHeaderDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="ResultsHeader"
                        description="Title, count line, and whatever the surface puts beside them. Five browse pages had copied one page's stylesheet for it."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Browse
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-3 mt-4">
                        <tc-section-card title="With a trailing control">
                            <tc-results-header
                                heading="Cars for sale"
                                lead="1 284 results"
                                heading-level={2}
                            >
                                <tc-filter-trigger count={1} label="Filters" />
                            </tc-results-header>
                            <p style={note} className="mt-3">
                                <strong>The heading level is a decision, not a default.</strong> A
                                results header can be the page's own <code>h1</code> or a section's{' '}
                                <code>h2</code>, and an element that hardcodes one produces an
                                outline skip on half its call sites.
                            </p>
                        </tc-section-card>

                        <tc-section-card title="Stacked — the phone shape">
                            <tc-results-header
                                align="stack"
                                heading="Saved searches"
                                lead="3 of your 5 slots used"
                                heading-level={2}
                            >
                                <tc-button variant="secondary" outline size="sm" block>
                                    New search
                                </tc-button>
                            </tc-results-header>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ResultsHeaderDemo
