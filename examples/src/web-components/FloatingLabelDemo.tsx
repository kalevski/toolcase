import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const FloatingLabelDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Floating Label"
                        description="Bootstrap form-floating wrapper that animates the label above a control when focused or filled."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Text inputs">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-floating-label label="Email address" for="fl-email">
                                    <input type="email" class="form-control" id="fl-email" />
                                    {/* @ts-ignore */}
                                </tc-floating-label>
                                {/* @ts-ignore */}
                                <tc-floating-label label="Password" for="fl-pwd">
                                    <input type="password" class="form-control" id="fl-pwd" />
                                    {/* @ts-ignore */}
                                </tc-floating-label>
                            </div>
                        </SectionCard>

                        <SectionCard title="Textarea">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-floating-label label="Comments" for="fl-comment">
                                    <textarea class="form-control" id="fl-comment" style={{ height: '100px' }} />
                                    {/* @ts-ignore */}
                                </tc-floating-label>
                            </div>
                        </SectionCard>

                        <SectionCard title="Select">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-floating-label label="Country" for="fl-country">
                                    <select class="form-select" id="fl-country">
                                        <option value="">Choose a country…</option>
                                        <option value="us">United States</option>
                                        <option value="gb">United Kingdom</option>
                                        <option value="de">Germany</option>
                                    </select>
                                    {/* @ts-ignore */}
                                </tc-floating-label>
                            </div>
                        </SectionCard>

                        <SectionCard title="Disabled">
                            <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
                                {/* @ts-ignore */}
                                <tc-floating-label label="Disabled input" for="fl-dis">
                                    <input type="text" class="form-control" id="fl-dis" value="Cannot edit" disabled />
                                    {/* @ts-ignore */}
                                </tc-floating-label>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default FloatingLabelDemo
