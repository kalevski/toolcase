import React from 'react'

const IconDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Icon"
                        description="Inline lucide SVG icons with accessibility support. Inherits color from surrounding text by default; supply color, size, label, or decorative attributes to customise."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Named icons at default size">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-icon name="Star"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Heart"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Bell"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Search"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Settings"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="User"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Trash2"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Download"></tc-icon>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Different sizes">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-icon name="Star" size="12"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Star" size="16"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Star" size="24"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Star" size="32"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Star" size="48"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Star" size="1.5em"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Star" size="2rem"></tc-icon>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Colors">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-icon name="Heart" size="24" color="var(--tc-danger)"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Star" size="24" color="var(--tc-warning)"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon
                                    name="CheckCircle"
                                    size="24"
                                    color="var(--tc-success)"
                                ></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Info" size="24" color="var(--tc-info)"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon
                                    name="AlertTriangle"
                                    size="24"
                                    color="var(--tc-warning)"
                                ></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="X" size="24" color="var(--tc-danger)"></tc-icon>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Accessible (labelled) icon">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                <span>
                                    Icon with aria-label (inspect to verify role=&quot;img&quot;):
                                </span>
                                {/* @ts-ignore */}
                                <tc-icon name="Star" size="24" label="Favourite"></tc-icon>
                                {/* @ts-ignore */}
                                <tc-icon name="Bell" size="24" label="Notifications"></tc-icon>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Decorative icon (aria-hidden)">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                <span>Decorative icon hidden from screen readers:</span>
                                {/* @ts-ignore */}
                                <tc-icon name="Sparkles" size="24" decorative></tc-icon>
                                <span>Text after decorative icon</span>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Custom wrapper tag (as)">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                <span>Default span wrapper:</span>
                                {/* @ts-ignore */}
                                <tc-icon name="Circle" size="24"></tc-icon>
                                <span>div wrapper (as=&quot;div&quot;):</span>
                                {/* @ts-ignore */}
                                <tc-icon name="Square" size="24" as="div"></tc-icon>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Unknown name renders empty wrapper (no throw)">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                <span>Unknown icon name:</span>
                                {/* @ts-ignore */}
                                <tc-icon name="ThisIconDoesNotExist123" size="24"></tc-icon>
                                <span>(nothing rendered above — no error thrown)</span>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default IconDemo
