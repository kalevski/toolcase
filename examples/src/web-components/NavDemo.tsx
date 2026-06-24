import React from 'react'

const NavDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Nav"
                        description="Bootstrap nav strip wrapper. Use variant to choose tabs, pills, or underline. Items wire Bootstrap's Tab plugin automatically when the parent variant is tabs or pills, enabling switchable content panes."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="variant=tabs — tabbed panes with Bootstrap Tab plugin">
                            {/* @ts-ignore */}
                            <tc-nav variant="tabs">
                                {/* @ts-ignore */}
                                <tc-nav-item href="#tc-nav-tab1" active>
                                    Home
                                </tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#tc-nav-tab2">Profile</tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#tc-nav-tab3">Contact</tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#tc-nav-tab4" disabled>
                                    Disabled
                                </tc-nav-item>
                                {/* @ts-ignore */}
                            </tc-nav>
                            <div className="tab-content mt-3">
                                <div className="tab-pane show active" id="tc-nav-tab1">
                                    <p>
                                        Home tab content. This pane is shown first because the item
                                        has the <code>active</code> attribute.
                                    </p>
                                </div>
                                <div className="tab-pane" id="tc-nav-tab2">
                                    <p>
                                        Profile tab content. Click the Profile tab above to show
                                        this pane.
                                    </p>
                                </div>
                                <div className="tab-pane" id="tc-nav-tab3">
                                    <p>
                                        Contact tab content. Click the Contact tab above to show
                                        this pane.
                                    </p>
                                </div>
                                <div className="tab-pane" id="tc-nav-tab4">
                                    <p>Disabled tab — this pane is unreachable via the nav.</p>
                                </div>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="variant=pills — pill navigation with switchable panes">
                            {/* @ts-ignore */}
                            <tc-nav variant="pills">
                                {/* @ts-ignore */}
                                <tc-nav-item href="#tc-nav-pill1" active>
                                    Overview
                                </tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#tc-nav-pill2">Settings</tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#tc-nav-pill3">Activity</tc-nav-item>
                                {/* @ts-ignore */}
                            </tc-nav>
                            <div className="tab-content mt-3">
                                <div className="tab-pane show active" id="tc-nav-pill1">
                                    <p>
                                        Overview content. Pills use the same Bootstrap Tab plugin as
                                        tabs.
                                    </p>
                                </div>
                                <div className="tab-pane" id="tc-nav-pill2">
                                    <p>
                                        Settings content. Click the Settings pill to navigate here.
                                    </p>
                                </div>
                                <div className="tab-pane" id="tc-nav-pill3">
                                    <p>
                                        Activity content. Click the Activity pill to navigate here.
                                    </p>
                                </div>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="variant=underline — underline style (no tab plugin)">
                            {/* @ts-ignore */}
                            <tc-nav variant="underline">
                                {/* @ts-ignore */}
                                <tc-nav-item href="#" active>
                                    Active
                                </tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#">Link</tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#">Another</tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#" disabled>
                                    Disabled
                                </tc-nav-item>
                                {/* @ts-ignore */}
                            </tc-nav>
                        </tc-section-card>

                        <tc-section-card title="fill — items fill available width equally">
                            {/* @ts-ignore */}
                            <tc-nav variant="pills" fill>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#" active>
                                    Active
                                </tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#">Much longer label</tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#">Short</tc-nav-item>
                                {/* @ts-ignore */}
                            </tc-nav>
                        </tc-section-card>

                        <tc-section-card title="justified — items have equal widths">
                            {/* @ts-ignore */}
                            <tc-nav variant="tabs" justified>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#" active>
                                    Active
                                </tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#">Link</tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#">Another</tc-nav-item>
                                {/* @ts-ignore */}
                            </tc-nav>
                        </tc-section-card>

                        <tc-section-card title="vertical — stacked column layout">
                            {/* @ts-ignore */}
                            <tc-nav variant="pills" vertical style={{ width: '200px' }}>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#" active>
                                    Dashboard
                                </tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#">Profile</tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#">Settings</tc-nav-item>
                                {/* @ts-ignore */}
                                <tc-nav-item href="#" disabled>
                                    Billing
                                </tc-nav-item>
                                {/* @ts-ignore */}
                            </tc-nav>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default NavDemo
