import React, { useState } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const FilterTriggerDemo: React.FC = () => {
    const [count, setCount] = useState(0)
    const [opened, setOpened] = useState(0)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="FilterTrigger"
                            description="The one control that opens a filter sheet, with an active-count marker. Six pages in polovni.mk had drawn it byte for byte."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Browse
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="Plain, and marked">
                                <div className="d-flex gap-2 flex-wrap align-items-center">
                                    <tc-filter-trigger
                                        count={count}
                                        label="More filters"
                                        ontc-open={() => setOpened((n) => n + 1)}
                                    />
                                    <tc-button
                                        variant="secondary"
                                        outline
                                        size="sm"
                                        onClick={() => setCount((c) => c + 1)}
                                    >
                                        Set a filter
                                    </tc-button>
                                    <tc-button
                                        variant="secondary"
                                        outline
                                        size="sm"
                                        onClick={() => setCount(0)}
                                    >
                                        Clear
                                    </tc-button>
                                    <span className="text-body-secondary">opened {opened}×</span>
                                </div>
                                <p style={note} className="mt-3">
                                    <strong>The count is the point.</strong> A filter button that
                                    does not say how many filters are set is a button that makes the
                                    reader open the sheet to find out — which is the one thing the
                                    trigger exists to save them.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Your own label">
                                <tc-filter-trigger count={2}>Sort &amp; filter</tc-filter-trigger>
                                <p style={note} className="mt-3">
                                    The host <em>is</em> the button, so a label you pass stays a
                                    direct child — which matters, because a trigger's label is
                                    routinely <code>{'{label}{count > 0 && `(${count})`}'}</code>:
                                    two children, and the second disappearing is exactly the
                                    individual removal that makes react-dom throw{' '}
                                    <code>NotFoundError</code> against a re-parenting element.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FilterTriggerDemo
