import React from 'react'

const SectionCardDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="SectionCard"
                            description="Card wrapper with a header containing an optional icon chip, title, and named action slot. Supports a danger variant for destructive sections."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — no icon">
                                <div style={{ maxWidth: 640 }}>
                                    {/* @ts-ignore */}
                                    <tc-section-card title="General Settings">
                                        <p
                                            style={{
                                                margin: 0,
                                                color: 'var(--tc-text-muted)',
                                                fontSize: '0.875rem',
                                            }}
                                        >
                                            Configure your general account preferences here.
                                        </p>
                                    </tc-section-card>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Default — with icon">
                                <div style={{ maxWidth: 640 }}>
                                    {/* @ts-ignore */}
                                    <tc-section-card title="API Keys" icon="Key">
                                        <p
                                            style={{
                                                margin: 0,
                                                color: 'var(--tc-text-muted)',
                                                fontSize: '0.875rem',
                                            }}
                                        >
                                            Manage your API keys and access tokens.
                                        </p>
                                    </tc-section-card>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Default — with action slot">
                                <div style={{ maxWidth: 640 }}>
                                    {/* @ts-ignore */}
                                    <tc-section-card title="Webhooks" icon="Webhook">
                                        {/* @ts-ignore */}
                                        <tc-button slot="action" variant="primary" size="sm">
                                            Add Webhook
                                        </tc-button>
                                        <p
                                            style={{
                                                margin: 0,
                                                color: 'var(--tc-text-muted)',
                                                fontSize: '0.875rem',
                                            }}
                                        >
                                            Configure webhook endpoints for event notifications.
                                        </p>
                                    </tc-section-card>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Danger variant — with icon and action">
                                <div style={{ maxWidth: 640 }}>
                                    {/* @ts-ignore */}
                                    <tc-section-card
                                        title="Delete Account"
                                        icon="Trash2"
                                        variant="danger"
                                    >
                                        {/* @ts-ignore */}
                                        <tc-button slot="action" variant="danger" size="sm">
                                            Delete
                                        </tc-button>
                                        <p
                                            style={{
                                                margin: 0,
                                                color: 'var(--tc-text-muted)',
                                                fontSize: '0.875rem',
                                            }}
                                        >
                                            Permanently delete your account and all associated data.
                                            This action cannot be undone.
                                        </p>
                                    </tc-section-card>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SectionCardDemo
