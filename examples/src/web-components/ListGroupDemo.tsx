import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ListGroupDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="List Group"
                        description="Flexible component for displaying a series of content. Use tc-list-group-item elements inside tc-list-group. Add flush for borderless style, numbered for an ordered list, and horizontal for inline layout."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default list group — static items">
                            {/* @ts-ignore */}
                            <tc-list-group>
                                {/* @ts-ignore */}
                                <tc-list-group-item>An item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item>A second item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item>A third item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item>A fourth item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item>And a fifth one</tc-list-group-item>
                            {/* @ts-ignore */}
                            </tc-list-group>
                        </SectionCard>

                        <SectionCard title="Active and disabled items">
                            {/* @ts-ignore */}
                            <tc-list-group>
                                {/* @ts-ignore */}
                                <tc-list-group-item active>An active item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item>A second item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item disabled>A disabled item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item>A fourth item</tc-list-group-item>
                            {/* @ts-ignore */}
                            </tc-list-group>
                        </SectionCard>

                        <SectionCard title="Linked items with href">
                            {/* @ts-ignore */}
                            <tc-list-group>
                                {/* @ts-ignore */}
                                <tc-list-group-item href="#" active>An active link item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item href="#">A second link item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item href="#" disabled>A disabled link item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item href="#">A fourth link item</tc-list-group-item>
                            {/* @ts-ignore */}
                            </tc-list-group>
                        </SectionCard>

                        <SectionCard title="Button items with action">
                            {/* @ts-ignore */}
                            <tc-list-group>
                                {/* @ts-ignore */}
                                <tc-list-group-item action active>The current button</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item action>A second button item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item action disabled>A disabled button item</tc-list-group-item>
                            {/* @ts-ignore */}
                            </tc-list-group>
                        </SectionCard>

                        <SectionCard title="Contextual variants">
                            {/* @ts-ignore */}
                            <tc-list-group>
                                {/* @ts-ignore */}
                                <tc-list-group-item>Default item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item variant="primary">A primary item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item variant="secondary">A secondary item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item variant="success">A success item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item variant="danger">A danger item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item variant="warning">A warning item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item variant="info">An info item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item variant="light">A light item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item variant="dark">A dark item</tc-list-group-item>
                            {/* @ts-ignore */}
                            </tc-list-group>
                        </SectionCard>

                        <SectionCard title="flush — removes outer borders">
                            {/* @ts-ignore */}
                            <tc-list-group flush>
                                {/* @ts-ignore */}
                                <tc-list-group-item>An item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item>A second item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item>A third item</tc-list-group-item>
                            {/* @ts-ignore */}
                            </tc-list-group>
                        </SectionCard>

                        <SectionCard title="numbered — ordered list with counters">
                            {/* @ts-ignore */}
                            <tc-list-group numbered>
                                {/* @ts-ignore */}
                                <tc-list-group-item>A list item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item>A list item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item>A list item</tc-list-group-item>
                            {/* @ts-ignore */}
                            </tc-list-group>
                        </SectionCard>

                        <SectionCard title="horizontal — inline layout">
                            {/* @ts-ignore */}
                            <tc-list-group horizontal>
                                {/* @ts-ignore */}
                                <tc-list-group-item>An item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item>A second item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item>A third item</tc-list-group-item>
                            {/* @ts-ignore */}
                            </tc-list-group>
                        </SectionCard>

                        <SectionCard title="horizontal=&quot;md&quot; — horizontal at md breakpoint and above">
                            {/* @ts-ignore */}
                            <tc-list-group horizontal="md">
                                {/* @ts-ignore */}
                                <tc-list-group-item>An item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item>A second item</tc-list-group-item>
                                {/* @ts-ignore */}
                                <tc-list-group-item>A third item</tc-list-group-item>
                            {/* @ts-ignore */}
                            </tc-list-group>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ListGroupDemo
