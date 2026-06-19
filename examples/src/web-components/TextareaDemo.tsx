import React from 'react'

const TextareaDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Textarea"
                        description="Bootstrap form-control multiline wrapper with label, rows, sizes, validation states, and help text."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Label &amp; Placeholder">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 500 }}>
                                {/* @ts-ignore */}
                                <tc-textarea
                                    label="Bio"
                                    placeholder="Tell us about yourself…"
                                    rows="4"
                                />
                                {/* @ts-ignore */}
                                <tc-textarea placeholder="No label" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Rows">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 500 }}>
                                {/* @ts-ignore */}
                                <tc-textarea label="2 rows" rows="2" placeholder="Two rows" />
                                {/* @ts-ignore */}
                                <tc-textarea
                                    label="4 rows (default is 3)"
                                    rows="4"
                                    placeholder="Four rows"
                                />
                                {/* @ts-ignore */}
                                <tc-textarea label="6 rows" rows="6" placeholder="Six rows" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Sizes">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 500 }}>
                                {/* @ts-ignore */}
                                <tc-textarea label="Large" size="lg" placeholder="Large textarea" />
                                {/* @ts-ignore */}
                                <tc-textarea label="Default" placeholder="Default textarea" />
                                {/* @ts-ignore */}
                                <tc-textarea label="Small" size="sm" placeholder="Small textarea" />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Validation States">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 500 }}>
                                {/* @ts-ignore */}
                                <tc-textarea
                                    label="Valid input"
                                    state="valid"
                                    value="This looks great!"
                                />
                                {/* @ts-ignore */}
                                <tc-textarea
                                    label="Invalid input"
                                    state="invalid"
                                    value="Too short."
                                />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Help Text">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 500 }}>
                                {/* @ts-ignore */}
                                <tc-textarea
                                    label="Comments"
                                    help="Maximum 500 characters."
                                    placeholder="Leave a comment…"
                                />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Disabled &amp; Readonly">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 500 }}>
                                {/* @ts-ignore */}
                                <tc-textarea label="Disabled" disabled value="Cannot edit this." />
                                {/* @ts-ignore */}
                                <tc-textarea label="Readonly" readonly value="Read-only content." />
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default TextareaDemo
