import React from 'react'

const wrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '1rem' }
const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
}
const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const LockChipDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="LockChip"
                        description="The padlock badge that marks a paywalled row. Written identically in polovni.mk, webgame.cloud and mindmap — all three as a badge with a 🔒 in the text."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Entitlements
                        </tc-badge>
                    </tc-rich-page-header>

                    <div style={wrap} className="mt-4">
                        <tc-section-card title="Tones">
                            <div style={row}>
                                <tc-lock-chip role-name="Pro" />
                                <tc-lock-chip role-name="Team" tone="neutral" />
                                <tc-lock-chip role-name="Trader+" tone="accent" />
                            </div>
                            <p style={note} className="mt-3">
                                The emoji is why this is an element rather than a documented recipe.
                                🔒 is a glyph the platform picks, so the padlock is blue-grey on one
                                machine and gold on another, it is announced as „locked padlock" in
                                the middle of a role name, and it does not take the chip's colour.
                                An inline lucide glyph does all three correctly and costs the same
                                call site.
                            </p>
                        </tc-section-card>

                        <tc-section-card title="Nothing to name, nothing drawn">
                            <div style={row}>
                                <span>Before:</span>
                                <tc-lock-chip />
                                <span>after — the chip is hidden, not empty.</span>
                            </div>
                            <p style={note} className="mt-3">
                                All three apps returned null without a role name, because a lock
                                with no tier to name is a padlock that answers no question. Leaving
                                it in the tree and flipping one attribute is what makes it safe to
                                render unconditionally.
                            </p>
                        </tc-section-card>

                        <tc-section-card title="In a row, which is where it lives">
                            <tc-list-group>
                                <tc-list-group-item>Basic export</tc-list-group-item>
                                <tc-list-group-item>
                                    Bulk export <tc-lock-chip role-name="Pro" />
                                </tc-list-group-item>
                                <tc-list-group-item>
                                    Scheduled export <tc-lock-chip role-name="Team" />
                                </tc-list-group-item>
                            </tc-list-group>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default LockChipDemo
