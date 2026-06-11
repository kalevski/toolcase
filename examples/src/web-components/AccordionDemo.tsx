import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const AccordionDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Accordion"
                        description="Collapsible panel group backed by Bootstrap's Collapse plugin. Wrap tc-accordion-item elements inside tc-accordion. Use flush for borderless style and always-open to allow multiple panels open simultaneously."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default accordion — one item open at a time">
                            {/* @ts-ignore */}
                            <tc-accordion>
                                {/* @ts-ignore */}
                                <tc-accordion-item header="First item" open>
                                    <p className="mb-0">This is the first item's content. It starts expanded because of the <code>open</code> attribute.</p>
                                {/* @ts-ignore */}
                                </tc-accordion-item>
                                {/* @ts-ignore */}
                                <tc-accordion-item header="Second item">
                                    <p className="mb-0">This is the second item's content. Opening this will close the first one.</p>
                                {/* @ts-ignore */}
                                </tc-accordion-item>
                                {/* @ts-ignore */}
                                <tc-accordion-item header="Third item">
                                    <p className="mb-0">This is the third item's content.</p>
                                {/* @ts-ignore */}
                                </tc-accordion-item>
                            {/* @ts-ignore */}
                            </tc-accordion>
                        </SectionCard>

                        <SectionCard title="flush — borderless accordion aligned to parent edges">
                            {/* @ts-ignore */}
                            <tc-accordion flush>
                                {/* @ts-ignore */}
                                <tc-accordion-item header="Flush item one" open>
                                    <p className="mb-0">Flush accordions remove outer borders and rounded corners.</p>
                                {/* @ts-ignore */}
                                </tc-accordion-item>
                                {/* @ts-ignore */}
                                <tc-accordion-item header="Flush item two">
                                    <p className="mb-0">Each item still collapses individually.</p>
                                {/* @ts-ignore */}
                                </tc-accordion-item>
                            {/* @ts-ignore */}
                            </tc-accordion>
                        </SectionCard>

                        <SectionCard title="always-open — multiple items can stay open simultaneously">
                            {/* @ts-ignore */}
                            <tc-accordion always-open>
                                {/* @ts-ignore */}
                                <tc-accordion-item header="Always-open item one" open>
                                    <p className="mb-0">This panel can stay open while others are also opened.</p>
                                {/* @ts-ignore */}
                                </tc-accordion-item>
                                {/* @ts-ignore */}
                                <tc-accordion-item header="Always-open item two" open>
                                    <p className="mb-0">Both items start expanded and opening/closing one doesn't affect the other.</p>
                                {/* @ts-ignore */}
                                </tc-accordion-item>
                                {/* @ts-ignore */}
                                <tc-accordion-item header="Always-open item three">
                                    <p className="mb-0">This one starts collapsed.</p>
                                {/* @ts-ignore */}
                                </tc-accordion-item>
                            {/* @ts-ignore */}
                            </tc-accordion>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default AccordionDemo
