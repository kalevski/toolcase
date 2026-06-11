import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ScrollspyDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Scrollspy"
                        description="Bootstrap ScrollSpy plugin wrapper. Highlights nav links as the user scrolls through a scrollable content region. Use the target attribute to point at the nav, offset to adjust the trigger threshold, and smooth-scroll to enable animated anchoring."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Basic — nav pills linked to scrollable region">
                            <nav id="scrollspy-nav-basic" className="navbar bg-body-secondary px-3 mb-3">
                                <ul className="nav nav-pills">
                                    <li className="nav-item">
                                        <a className="nav-link" href="#scrollspy-s1">Section 1</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#scrollspy-s2">Section 2</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#scrollspy-s3">Section 3</a>
                                    </li>
                                </ul>
                            </nav>
                            {/* @ts-ignore */}
                            <tc-scrollspy target="#scrollspy-nav-basic" style={{ height: '200px', overflowY: 'scroll', display: 'block' }}>
                                <div id="scrollspy-s1" style={{ padding: '0.5rem 0 1rem' }}>
                                    <h5>Section 1</h5>
                                    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
                                </div>
                                <div id="scrollspy-s2" style={{ padding: '0.5rem 0 1rem' }}>
                                    <h5>Section 2</h5>
                                    <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
                                </div>
                                <div id="scrollspy-s3" style={{ padding: '0.5rem 0 1rem' }}>
                                    <h5>Section 3</h5>
                                    <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
                                </div>
                            {/* @ts-ignore */}
                            </tc-scrollspy>
                        </SectionCard>

                        <SectionCard title="offset — activate 80px before the section reaches the top">
                            <nav id="scrollspy-nav-offset" className="navbar bg-body-secondary px-3 mb-3">
                                <ul className="nav nav-pills">
                                    <li className="nav-item">
                                        <a className="nav-link" href="#scrollspy-o1">Alpha</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#scrollspy-o2">Beta</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#scrollspy-o3">Gamma</a>
                                    </li>
                                </ul>
                            </nav>
                            {/* @ts-ignore */}
                            <tc-scrollspy target="#scrollspy-nav-offset" offset="80" style={{ height: '200px', overflowY: 'scroll', display: 'block' }}>
                                <div id="scrollspy-o1" style={{ padding: '0.5rem 0 1rem' }}>
                                    <h5>Alpha</h5>
                                    <p>With <code>offset="80"</code> the link activates 80 px before the section scrolls to the top of the container.</p>
                                    <p>Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Donec velit neque, auctor sit amet aliquam vel, ullamcorper sit amet ligula.</p>
                                </div>
                                <div id="scrollspy-o2" style={{ padding: '0.5rem 0 1rem' }}>
                                    <h5>Beta</h5>
                                    <p>Curabitur aliquet quam id dui posuere blandit. Cras ultricies ligula sed magna dictum porta. Vivamus magna justo, lacinia eget consectetur sed, convallis at tellus.</p>
                                </div>
                                <div id="scrollspy-o3" style={{ padding: '0.5rem 0 1rem' }}>
                                    <h5>Gamma</h5>
                                    <p>Proin eget tortor risus. Curabitur non nulla sit amet nisl tempus convallis quis ac lectus. Donec rutrum congue leo eget malesuada.</p>
                                </div>
                            {/* @ts-ignore */}
                            </tc-scrollspy>
                        </SectionCard>

                        <SectionCard title="smooth-scroll — animated anchor navigation">
                            <nav id="scrollspy-nav-smooth" className="navbar bg-body-secondary px-3 mb-3">
                                <ul className="nav nav-pills">
                                    <li className="nav-item">
                                        <a className="nav-link" href="#scrollspy-sm1">Intro</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#scrollspy-sm2">Details</a>
                                    </li>
                                    <li className="nav-item">
                                        <a className="nav-link" href="#scrollspy-sm3">Summary</a>
                                    </li>
                                </ul>
                            </nav>
                            {/* @ts-ignore */}
                            <tc-scrollspy target="#scrollspy-nav-smooth" smooth-scroll style={{ height: '200px', overflowY: 'scroll', display: 'block' }}>
                                <div id="scrollspy-sm1" style={{ padding: '0.5rem 0 1rem' }}>
                                    <h5>Intro</h5>
                                    <p>Click a nav link above — with <code>smooth-scroll</code> set, Bootstrap animates the scroll instead of jumping instantly.</p>
                                    <p>Quisque velit nisi, pretium ut lacinia in, elementum id enim. Vivamus magna justo, lacinia eget consectetur sed, convallis at tellus.</p>
                                </div>
                                <div id="scrollspy-sm2" style={{ padding: '0.5rem 0 1rem' }}>
                                    <h5>Details</h5>
                                    <p>Mauris blandit aliquet elit, eget tincidunt nibh pulvinar a. Curabitur aliquet quam id dui posuere blandit. Donec sollicitudin molestie malesuada.</p>
                                </div>
                                <div id="scrollspy-sm3" style={{ padding: '0.5rem 0 1rem' }}>
                                    <h5>Summary</h5>
                                    <p>Nulla quis lorem ut libero malesuada feugiat. Curabitur arcu erat, accumsan id imperdiet et, porttitor at sem. Sed porttitor lectus nibh.</p>
                                </div>
                            {/* @ts-ignore */}
                            </tc-scrollspy>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ScrollspyDemo
