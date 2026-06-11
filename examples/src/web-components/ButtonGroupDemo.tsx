import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ButtonGroupDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Button Group"
                        description="Bootstrap button group wrapper supporting horizontal and vertical layouts with optional size variants."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Basic Group">
                            {/* @ts-ignore */}
                            <tc-button-group aria-label="Basic actions">
                                {/* @ts-ignore */}
                                <tc-button variant="primary">Left</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="primary">Middle</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="primary">Right</tc-button>
                                {/* @ts-ignore */}
                            </tc-button-group>
                        </SectionCard>

                        <SectionCard title="Sizes">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-button-group size="lg" aria-label="Large group">
                                    {/* @ts-ignore */}
                                    <tc-button variant="secondary">Left</tc-button>
                                    {/* @ts-ignore */}
                                    <tc-button variant="secondary">Middle</tc-button>
                                    {/* @ts-ignore */}
                                    <tc-button variant="secondary">Right</tc-button>
                                    {/* @ts-ignore */}
                                </tc-button-group>
                                {/* @ts-ignore */}
                                <tc-button-group aria-label="Default group">
                                    {/* @ts-ignore */}
                                    <tc-button variant="secondary">Left</tc-button>
                                    {/* @ts-ignore */}
                                    <tc-button variant="secondary">Middle</tc-button>
                                    {/* @ts-ignore */}
                                    <tc-button variant="secondary">Right</tc-button>
                                    {/* @ts-ignore */}
                                </tc-button-group>
                                {/* @ts-ignore */}
                                <tc-button-group size="sm" aria-label="Small group">
                                    {/* @ts-ignore */}
                                    <tc-button variant="secondary">Left</tc-button>
                                    {/* @ts-ignore */}
                                    <tc-button variant="secondary">Middle</tc-button>
                                    {/* @ts-ignore */}
                                    <tc-button variant="secondary">Right</tc-button>
                                    {/* @ts-ignore */}
                                </tc-button-group>
                            </div>
                        </SectionCard>

                        <SectionCard title="Vertical">
                            {/* @ts-ignore */}
                            <tc-button-group vertical aria-label="Vertical actions">
                                {/* @ts-ignore */}
                                <tc-button variant="primary">Top</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="primary">Middle</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="primary">Bottom</tc-button>
                                {/* @ts-ignore */}
                            </tc-button-group>
                        </SectionCard>

                        <SectionCard title="Outline Buttons">
                            {/* @ts-ignore */}
                            <tc-button-group aria-label="Outline group">
                                {/* @ts-ignore */}
                                <tc-button variant="danger" outline>Delete</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="warning" outline>Archive</tc-button>
                                {/* @ts-ignore */}
                                <tc-button variant="success" outline>Save</tc-button>
                                {/* @ts-ignore */}
                            </tc-button-group>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ButtonGroupDemo
