import React from 'react'

const VARIANTS = ['primary', 'secondary', 'success', 'danger', 'warning', 'info'] as const
const STATUSES = ['online', 'offline', 'busy', 'away'] as const

const AvatarDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Avatar"
                        description="Circular user avatar displaying an image, initials derived from a name, or a placeholder glyph. Supports size, variant tint, and an optional status indicator."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Image avatar">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-avatar
                                    src="https://i.pravatar.cc/150?img=1"
                                    name="Alice Johnson"
                                    size="small"
                                ></tc-avatar>
                                {/* @ts-ignore */}
                                <tc-avatar
                                    src="https://i.pravatar.cc/150?img=2"
                                    name="Bob Smith"
                                ></tc-avatar>
                                {/* @ts-ignore */}
                                <tc-avatar
                                    src="https://i.pravatar.cc/150?img=3"
                                    name="Carol Davis"
                                    size="large"
                                ></tc-avatar>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Initials (from name, no src)">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-avatar name="Alice Johnson" size="small"></tc-avatar>
                                {/* @ts-ignore */}
                                <tc-avatar name="Bob Smith"></tc-avatar>
                                {/* @ts-ignore */}
                                <tc-avatar name="Carol" size="large"></tc-avatar>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Placeholder (no src, no name)">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-avatar size="small"></tc-avatar>
                                {/* @ts-ignore */}
                                <tc-avatar></tc-avatar>
                                {/* @ts-ignore */}
                                <tc-avatar size="large"></tc-avatar>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Sizes">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-avatar name="Small" size="small" variant="primary"></tc-avatar>
                                {/* @ts-ignore */}
                                <tc-avatar name="Default" variant="primary"></tc-avatar>
                                {/* @ts-ignore */}
                                <tc-avatar name="Large" size="large" variant="primary"></tc-avatar>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Variants (initials tint)">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {VARIANTS.map((v) => (
                                    <React.Fragment key={v}>
                                        {/* @ts-ignore */}
                                        <tc-avatar
                                            name={v.charAt(0).toUpperCase() + v.slice(1) + ' User'}
                                            variant={v}
                                        ></tc-avatar>
                                    </React.Fragment>
                                ))}
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Status dots">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {STATUSES.map((s) => (
                                    <React.Fragment key={s}>
                                        {/* @ts-ignore */}
                                        <tc-avatar
                                            name={s.charAt(0).toUpperCase() + s.slice(1)}
                                            status={s}
                                        ></tc-avatar>
                                    </React.Fragment>
                                ))}
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Status dots with image">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <tc-avatar
                                    src="https://i.pravatar.cc/150?img=4"
                                    name="Dan"
                                    status="online"
                                ></tc-avatar>
                                {/* @ts-ignore */}
                                <tc-avatar
                                    src="https://i.pravatar.cc/150?img=5"
                                    name="Eve"
                                    status="busy"
                                ></tc-avatar>
                                {/* @ts-ignore */}
                                <tc-avatar
                                    src="https://i.pravatar.cc/150?img=6"
                                    name="Frank"
                                    status="away"
                                ></tc-avatar>
                                {/* @ts-ignore */}
                                <tc-avatar
                                    src="https://i.pravatar.cc/150?img=7"
                                    name="Grace"
                                    status="offline"
                                ></tc-avatar>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Broken src — fallback to initials / placeholder">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* Broken image + name → falls back to initials */}
                                {/* @ts-ignore */}
                                <tc-avatar
                                    src="https://broken.invalid/avatar.jpg"
                                    name="Jane Doe"
                                    variant="info"
                                ></tc-avatar>
                                {/* Broken image, no name → falls back to placeholder glyph */}
                                {/* @ts-ignore */}
                                <tc-avatar
                                    src="https://broken.invalid/avatar.jpg"
                                    variant="secondary"
                                ></tc-avatar>
                                {/* Broken image + status → fallback preserves the status dot */}
                                {/* @ts-ignore */}
                                <tc-avatar
                                    src="https://broken.invalid/avatar.jpg"
                                    name="John"
                                    status="online"
                                    variant="success"
                                ></tc-avatar>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default AvatarDemo
