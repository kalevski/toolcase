import React, { useState } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const QrScanSheetDemo: React.FC = () => {
    const [open, setOpen] = useState(false)
    const [scanned, setScanned] = useState('—')

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="QrScanSheet"
                            description="A camera QR scan in a sheet, with every permission state drawn rather than assumed."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Overlays
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="Open the scanner">
                                <div className="d-flex gap-2 align-items-center flex-wrap">
                                    <tc-button variant="primary" onClick={() => setOpen(true)}>
                                        Scan a code
                                    </tc-button>
                                    <span className="text-body-secondary">last: {scanned}</span>
                                </div>

                                <tc-qr-scan-sheet
                                    open={open}
                                    heading="Scan the plate's QR"
                                    hint="Line the code up inside the frame."
                                    manual-label="Type it instead"
                                    ontc-scan={(e) => {
                                        setScanned(String(e.detail.value))
                                        setOpen(false)
                                    }}
                                    ontc-manual={() => setOpen(false)}
                                    ontc-sheet-close={() => setOpen(false)}
                                />

                                <p style={note} className="mt-3">
                                    The scanning is the easy half. The reason the originating
                                    component is 161 lines is that a camera can be refused, absent,
                                    already in use, or unavailable because the page is not on a
                                    secure origin — and a scanner that shows a black rectangle for
                                    any of those is a scanner nobody trusts twice.
                                </p>
                                <p style={note}>
                                    <strong>Decoding is the platform's.</strong>{' '}
                                    <code>BarcodeDetector</code> ships in Chromium and on Android;
                                    where it does not exist the element reports{' '}
                                    <code>unsupported</code> and shows the manual fallback rather
                                    than pulling a decoder into a library whose bundle size is
                                    already a recorded gap. Consumers who need Safari coverage
                                    listen for <code>tc-frame</code> and decode the frame
                                    themselves.
                                </p>
                                <p style={note}>
                                    <strong>The camera is released on every exit path</strong> —
                                    scrim, Escape, drag, <code>hide()</code> and an unmount. A page
                                    that leaves a camera running is a page with a recording light
                                    on, and on a phone that is the single most alarming thing a web
                                    app can do.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default QrScanSheetDemo
