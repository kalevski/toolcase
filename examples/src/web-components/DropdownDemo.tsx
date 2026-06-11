import React, { useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const DropdownDemo: React.FC = () => {
    const dropdownRef = useRef<any>(null)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Dropdown"
                            description="Bootstrap Dropdown plugin wrapper. Use tc-dropdown-item children to build menus; supports split buttons, direction variants, and auto-close behaviour."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — toggle button with menu items">
                                {/* @ts-ignore */}
                                <tc-dropdown label="Actions" variant="primary">
                                    {/* @ts-ignore */}
                                    <tc-dropdown-item href="#">View profile</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    <tc-dropdown-item href="#">Edit settings</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    <tc-dropdown-item divider></tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    <tc-dropdown-item href="#">Sign out</tc-dropdown-item>
                                {/* @ts-ignore */}
                                </tc-dropdown>
                            </SectionCard>

                            <SectionCard title="Variants">
                                <div className="d-flex flex-wrap gap-2">
                                    {['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'].map(v => (
                                        <React.Fragment key={v}>
                                            {/* @ts-ignore */}
                                            <tc-dropdown label={v} variant={v}>
                                                {/* @ts-ignore */}
                                                <tc-dropdown-item>Option one</tc-dropdown-item>
                                                {/* @ts-ignore */}
                                                <tc-dropdown-item>Option two</tc-dropdown-item>
                                            {/* @ts-ignore */}
                                            </tc-dropdown>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </SectionCard>

                            <SectionCard title="split — action button + separate toggle">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-dropdown label="Primary" variant="primary" split>
                                        {/* @ts-ignore */}
                                        <tc-dropdown-item>Action</tc-dropdown-item>
                                        {/* @ts-ignore */}
                                        <tc-dropdown-item>Another action</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    </tc-dropdown>
                                    {/* @ts-ignore */}
                                    <tc-dropdown label="Secondary" variant="secondary" split>
                                        {/* @ts-ignore */}
                                        <tc-dropdown-item>Action</tc-dropdown-item>
                                        {/* @ts-ignore */}
                                        <tc-dropdown-item>Another action</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    </tc-dropdown>
                                </div>
                            </SectionCard>

                            <SectionCard title="direction — dropup / dropstart / dropend">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-dropdown label="Drop down" variant="secondary" direction="down">
                                        {/* @ts-ignore */}
                                        <tc-dropdown-item>Item</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    </tc-dropdown>
                                    {/* @ts-ignore */}
                                    <tc-dropdown label="Drop up" variant="secondary" direction="up">
                                        {/* @ts-ignore */}
                                        <tc-dropdown-item>Item</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    </tc-dropdown>
                                    {/* @ts-ignore */}
                                    <tc-dropdown label="Drop start" variant="secondary" direction="start">
                                        {/* @ts-ignore */}
                                        <tc-dropdown-item>Item</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    </tc-dropdown>
                                    {/* @ts-ignore */}
                                    <tc-dropdown label="Drop end" variant="secondary" direction="end">
                                        {/* @ts-ignore */}
                                        <tc-dropdown-item>Item</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    </tc-dropdown>
                                </div>
                            </SectionCard>

                            <SectionCard title="auto-close — control when the menu closes">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-dropdown label="true (default)" variant="secondary" auto-close="true">
                                        {/* @ts-ignore */}
                                        <tc-dropdown-item>Closes on any click</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    </tc-dropdown>
                                    {/* @ts-ignore */}
                                    <tc-dropdown label="inside" variant="secondary" auto-close="inside">
                                        {/* @ts-ignore */}
                                        <tc-dropdown-item>Closes only on inside click</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    </tc-dropdown>
                                    {/* @ts-ignore */}
                                    <tc-dropdown label="outside" variant="secondary" auto-close="outside">
                                        {/* @ts-ignore */}
                                        <tc-dropdown-item>Closes only on outside click</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    </tc-dropdown>
                                    {/* @ts-ignore */}
                                    <tc-dropdown label="false" variant="secondary" auto-close="false">
                                        {/* @ts-ignore */}
                                        <tc-dropdown-item>Never auto-closes</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    </tc-dropdown>
                                </div>
                            </SectionCard>

                            <SectionCard title="active and disabled items">
                                {/* @ts-ignore */}
                                <tc-dropdown label="User menu" variant="primary">
                                    {/* @ts-ignore */}
                                    <tc-dropdown-item active>Current page</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    <tc-dropdown-item>Settings</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    <tc-dropdown-item divider></tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    <tc-dropdown-item disabled>Unavailable</tc-dropdown-item>
                                {/* @ts-ignore */}
                                </tc-dropdown>
                            </SectionCard>

                            <SectionCard title="Programmatic control — show / hide / toggle">
                                <div className="d-flex gap-2 mb-3">
                                    <button className="btn btn-outline-primary" onClick={() => dropdownRef.current?.show()}>Show</button>
                                    <button className="btn btn-outline-secondary" onClick={() => dropdownRef.current?.hide()}>Hide</button>
                                    <button className="btn btn-outline-secondary" onClick={() => dropdownRef.current?.toggle()}>Toggle</button>
                                </div>
                                {/* @ts-ignore */}
                                <tc-dropdown ref={dropdownRef} label="Controlled" variant="primary">
                                    {/* @ts-ignore */}
                                    <tc-dropdown-item>Alpha</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    <tc-dropdown-item>Beta</tc-dropdown-item>
                                    {/* @ts-ignore */}
                                    <tc-dropdown-item>Gamma</tc-dropdown-item>
                                {/* @ts-ignore */}
                                </tc-dropdown>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DropdownDemo
