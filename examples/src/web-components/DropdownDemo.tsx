import React, { useRef } from 'react'
import type { DropdownVariant } from '@toolcase/web-components'

const DropdownDemo: React.FC = () => {
    const dropdownRef = useRef<any>(null)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Dropdown"
                            description="Bootstrap Dropdown plugin wrapper. Use tc-dropdown-item children to build menus; supports split buttons, direction variants, and auto-close behaviour."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — toggle button with menu items">
                                <tc-dropdown label="Actions" variant="primary">
                                    <tc-dropdown-item href="#">View profile</tc-dropdown-item>
                                    <tc-dropdown-item href="#">Edit settings</tc-dropdown-item>
                                    <tc-dropdown-item divider></tc-dropdown-item>
                                    <tc-dropdown-item href="#">Sign out</tc-dropdown-item>
                                </tc-dropdown>
                            </tc-section-card>

                            <tc-section-card title="Variants">
                                <div className="d-flex flex-wrap gap-2">
                                    {(
                                        [
                                            'primary',
                                            'secondary',
                                            'success',
                                            'danger',
                                            'warning',
                                            'info',
                                            'light',
                                            'dark',
                                        ] as DropdownVariant[]
                                    ).map((v) => (
                                        <tc-dropdown key={v} label={v} variant={v}>
                                            <tc-dropdown-item>Option one</tc-dropdown-item>
                                            <tc-dropdown-item>Option two</tc-dropdown-item>
                                        </tc-dropdown>
                                    ))}
                                </div>
                            </tc-section-card>

                            <tc-section-card title="split — action button + separate toggle">
                                <div className="d-flex flex-wrap gap-2">
                                    <tc-dropdown label="Primary" variant="primary" split>
                                        <tc-dropdown-item>Action</tc-dropdown-item>
                                        <tc-dropdown-item>Another action</tc-dropdown-item>
                                    </tc-dropdown>
                                    <tc-dropdown label="Secondary" variant="secondary" split>
                                        <tc-dropdown-item>Action</tc-dropdown-item>
                                        <tc-dropdown-item>Another action</tc-dropdown-item>
                                    </tc-dropdown>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="direction — dropup / dropstart / dropend">
                                <div className="d-flex flex-wrap gap-2">
                                    <tc-dropdown
                                        label="Drop down"
                                        variant="secondary"
                                        direction="down"
                                    >
                                        <tc-dropdown-item>Item</tc-dropdown-item>
                                    </tc-dropdown>
                                    <tc-dropdown label="Drop up" variant="secondary" direction="up">
                                        <tc-dropdown-item>Item</tc-dropdown-item>
                                    </tc-dropdown>
                                    <tc-dropdown
                                        label="Drop start"
                                        variant="secondary"
                                        direction="start"
                                    >
                                        <tc-dropdown-item>Item</tc-dropdown-item>
                                    </tc-dropdown>
                                    <tc-dropdown
                                        label="Drop end"
                                        variant="secondary"
                                        direction="end"
                                    >
                                        <tc-dropdown-item>Item</tc-dropdown-item>
                                    </tc-dropdown>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="auto-close — control when the menu closes">
                                <div className="d-flex flex-wrap gap-2">
                                    <tc-dropdown
                                        label="true (default)"
                                        variant="secondary"
                                        auto-close="true"
                                    >
                                        <tc-dropdown-item>Closes on any click</tc-dropdown-item>
                                    </tc-dropdown>
                                    <tc-dropdown
                                        label="inside"
                                        variant="secondary"
                                        auto-close="inside"
                                    >
                                        <tc-dropdown-item>
                                            Closes only on inside click
                                        </tc-dropdown-item>
                                    </tc-dropdown>
                                    <tc-dropdown
                                        label="outside"
                                        variant="secondary"
                                        auto-close="outside"
                                    >
                                        <tc-dropdown-item>
                                            Closes only on outside click
                                        </tc-dropdown-item>
                                    </tc-dropdown>
                                    <tc-dropdown
                                        label="false"
                                        variant="secondary"
                                        auto-close="false"
                                    >
                                        <tc-dropdown-item>Never auto-closes</tc-dropdown-item>
                                    </tc-dropdown>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="active and disabled items">
                                <tc-dropdown label="User menu" variant="primary">
                                    <tc-dropdown-item active>Current page</tc-dropdown-item>
                                    <tc-dropdown-item>Settings</tc-dropdown-item>
                                    <tc-dropdown-item divider></tc-dropdown-item>
                                    <tc-dropdown-item disabled>Unavailable</tc-dropdown-item>
                                </tc-dropdown>
                            </tc-section-card>

                            <tc-section-card title="Programmatic control — show / hide / toggle">
                                <div className="d-flex gap-2 mb-3">
                                    <button
                                        className="btn btn-outline-primary"
                                        onClick={() => dropdownRef.current?.show()}
                                    >
                                        Show
                                    </button>
                                    <button
                                        className="btn btn-outline-secondary"
                                        onClick={() => dropdownRef.current?.hide()}
                                    >
                                        Hide
                                    </button>
                                    <button
                                        className="btn btn-outline-secondary"
                                        onClick={() => dropdownRef.current?.toggle()}
                                    >
                                        Toggle
                                    </button>
                                </div>
                                <tc-dropdown ref={dropdownRef} label="Controlled" variant="primary">
                                    <tc-dropdown-item>Alpha</tc-dropdown-item>
                                    <tc-dropdown-item>Beta</tc-dropdown-item>
                                    <tc-dropdown-item>Gamma</tc-dropdown-item>
                                </tc-dropdown>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DropdownDemo
