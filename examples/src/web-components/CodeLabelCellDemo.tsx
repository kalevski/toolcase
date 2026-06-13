import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CodeLabelCellDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CodeLabelCell"
                            description="Machine-facing code chip alongside a human-readable display name. Purely presentational — designed to drop into table or list cells."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Standalone pairs">
                                <div className="d-flex flex-column gap-3">
                                    {/* @ts-ignore */}
                                    <tc-code-label-cell code="USR_001" name="Alice Johnson"></tc-code-label-cell>
                                    {/* @ts-ignore */}
                                    <tc-code-label-cell code="PRD_42" name="Premium Widget"></tc-code-label-cell>
                                    {/* @ts-ignore */}
                                    <tc-code-label-cell code="ORD-2024-09871" name="Purchase Order #9871"></tc-code-label-cell>
                                </div>
                            </SectionCard>

                            <SectionCard title="Inside a table cell">
                                <table className="table table-sm table-bordered mb-0">
                                    <thead>
                                        <tr>
                                            <th>Identifier</th>
                                            <th>Status</th>
                                            <th>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>
                                                {/* @ts-ignore */}
                                                <tc-code-label-cell code="INV-0001" name="Monthly subscription"></tc-code-label-cell>
                                            </td>
                                            <td>Paid</td>
                                            <td>$49.00</td>
                                        </tr>
                                        <tr>
                                            <td>
                                                {/* @ts-ignore */}
                                                <tc-code-label-cell code="INV-0002" name="One-time setup fee"></tc-code-label-cell>
                                            </td>
                                            <td>Pending</td>
                                            <td>$199.00</td>
                                        </tr>
                                        <tr>
                                            <td>
                                                {/* @ts-ignore */}
                                                <tc-code-label-cell code="INV-0003" name="Add-on storage pack"></tc-code-label-cell>
                                            </td>
                                            <td>Overdue</td>
                                            <td>$9.00</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </SectionCard>

                            <SectionCard title="Special characters (escaped)">
                                <div className="d-flex flex-column gap-3">
                                    {/* @ts-ignore */}
                                    <tc-code-label-cell code="<script>" name="XSS &amp; escape test"></tc-code-label-cell>
                                    {/* @ts-ignore */}
                                    <tc-code-label-cell code="A&B" name='Quote "example"'></tc-code-label-cell>
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CodeLabelCellDemo
