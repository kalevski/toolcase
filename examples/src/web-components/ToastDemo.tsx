import React, { useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ToastDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const successRef = useRef<any>(null)
    const dangerRef = useRef<any>(null)
    const noAutohideRef = useRef<any>(null)
    const noTitleRef = useRef<any>(null)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Toast"
                            description="Bootstrap Toast plugin wrapper. Use the title attribute for the header, variant for theme colour, and children for the body. Autohides after delay (default 5 s) unless autohide=&quot;false&quot;."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — basic toast with title">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => basicRef.current?.show()}
                                >
                                    Show toast
                                </button>
                                <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1100 }}>
                                    {/* @ts-ignore */}
                                    <tc-toast ref={basicRef} title="Notification">
                                        Your changes have been saved.
                                    {/* @ts-ignore */}
                                    </tc-toast>
                                </div>
                            </SectionCard>

                            <SectionCard title="variant=&quot;success&quot; — green themed toast">
                                <button
                                    className="btn btn-success"
                                    onClick={() => successRef.current?.show()}
                                >
                                    Show success toast
                                </button>
                                <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1100 }}>
                                    {/* @ts-ignore */}
                                    <tc-toast ref={successRef} title="Success" variant="success">
                                        Operation completed successfully.
                                    {/* @ts-ignore */}
                                    </tc-toast>
                                </div>
                            </SectionCard>

                            <SectionCard title="variant=&quot;danger&quot; — error toast">
                                <button
                                    className="btn btn-danger"
                                    onClick={() => dangerRef.current?.show()}
                                >
                                    Show error toast
                                </button>
                                <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1100 }}>
                                    {/* @ts-ignore */}
                                    <tc-toast ref={dangerRef} title="Error" variant="danger">
                                        Something went wrong. Please try again.
                                    {/* @ts-ignore */}
                                    </tc-toast>
                                </div>
                            </SectionCard>

                            <SectionCard title="autohide=&quot;false&quot; — persists until closed">
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => noAutohideRef.current?.show()}
                                >
                                    Show persistent toast
                                </button>
                                <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1100 }}>
                                    {/* @ts-ignore */}
                                    <tc-toast ref={noAutohideRef} title="Persistent" autohide="false">
                                        This toast stays open until you close it manually.
                                    {/* @ts-ignore */}
                                    </tc-toast>
                                </div>
                            </SectionCard>

                            <SectionCard title="No title — body-only toast">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => noTitleRef.current?.show()}
                                >
                                    Show body-only toast
                                </button>
                                <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1100 }}>
                                    {/* @ts-ignore */}
                                    <tc-toast ref={noTitleRef} variant="info">
                                        No header — just a simple message.
                                    {/* @ts-ignore */}
                                    </tc-toast>
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ToastDemo
