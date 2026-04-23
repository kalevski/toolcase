import React, { useState } from 'react'
import {
	Alert,
	Avatar,
	Badge,
	Button,
	Card,
	CodeLabelCell,
	CodeSnippet,
	EntityCell,
	EntityProfileCard,
	FormInput,
	MetricGrid,
	ProgressBar,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Skeleton,
	Spinner,
	StatCard,
	StatusDot,
	Table,
	TableColumn,
} from '@toolcase/react-components'
import { DemoPage, DemoSection, DemoGrid } from './_demo'

interface Project {
	id: string
	name: string
	slug: string
	color: 'violet' | 'cyan' | 'emerald' | 'amber' | 'pink' | 'blue' | 'slate' | 'rose'
	initial: string
	members: number
}

const projects: Project[] = [
	{ id: '1', name: 'Grid Reaches', slug: 'grid-reaches', color: 'pink', initial: 'GR', members: 24 },
	{ id: '2', name: 'Night City', slug: 'night-city', color: 'cyan', initial: 'NC', members: 12 },
	{ id: '3', name: 'Neon Drift', slug: 'neon-drift', color: 'violet', initial: 'ND', members: 7 },
]

const NeonThemeDemo: React.FC = () => {
	const [themeEnabled, setThemeEnabled] = useState(true)
	const [scanlines, setScanlines] = useState(false)
	const [inputValue, setInputValue] = useState('')

	const wrapperClass = themeEnabled
		? `theme theme--neon${scanlines ? ' theme--neon--scanlines' : ''}`
		: ''

	return (
		<DemoPage
			eyebrow="Themes"
			title="Neon Drift theme"
			lede={
				<>
					Wrap any subtree with <code>{'<div class="theme theme--neon">...</div>'}</code> and
					every component inside adopts the neon look — dark navy/purple surfaces, magenta +
					cyan accents, glowing focus, uppercase mono eyebrows. The default (unwrapped) look
					is the light toolcase baseline. Toggle the wrapper below to see the same components
					flip between themes.
				</>
			}
		>
			{/* Demo-only overrides: the shared demo chrome hardcodes white
			    surfaces, so inside the neon wrapper we tint demo-section and
			    its headers to match the dark palette. */}
			<style>{`
				.theme--neon .demo-section {
					background: rgba(12, 8, 32, 0.55);
					border-color: rgba(120, 80, 200, 0.22);
					color: #f3e9ff;
					backdrop-filter: blur(6px);
					-webkit-backdrop-filter: blur(6px);
				}
				.theme--neon .demo-section__head {
					border-bottom-color: rgba(120, 80, 200, 0.22);
				}
				.theme--neon .demo-section__eyebrow {
					color: #00e5ff;
					font-family: 'Ubuntu Mono', 'JetBrains Mono', monospace;
					letter-spacing: 0.22em;
				}
				.theme--neon .demo-section__title {
					color: #f3e9ff;
					font-family: 'Orbitron', 'Ubuntu Mono', monospace;
					letter-spacing: 0.04em;
					text-transform: uppercase;
				}
				.theme--neon .demo-section__caption {
					color: #9a8fc2;
				}
			`}</style>
			<DemoSection
				eyebrow="Controls"
				title="Toggle the theme wrapper"
				caption="The wrapper is just a class on an outer <div>. Nothing about the components themselves changes — they read their colors from CSS custom properties that the theme scope overrides."
			>
				<div
					style={{
						display: 'flex',
						gap: 16,
						alignItems: 'center',
						flexWrap: 'wrap',
						padding: 14,
						background: '#f8fafc',
						border: '1px solid #e2e8f0',
					}}
				>
					<label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
						<input
							type="checkbox"
							checked={themeEnabled}
							onChange={(e) => setThemeEnabled(e.target.checked)}
						/>
						Apply <code>theme--neon</code>
					</label>
					<label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
						<input
							type="checkbox"
							checked={scanlines}
							onChange={(e) => setScanlines(e.target.checked)}
							disabled={!themeEnabled}
						/>
						Scanline overlay (<code>theme--neon--scanlines</code>)
					</label>
				</div>
			</DemoSection>

			<div className={wrapperClass} style={{ padding: themeEnabled ? '24px' : 0 }}>
				<DemoSection
					eyebrow="Hero"
					title="RichPageHeader"
					caption="Color palette (violet / cyan / pink / rose) and the chip row all retint for the dark scope."
				>
					<RichPageHeader
						icon={{ name: 'lightning-charge', color: 'pink' }}
						chips={
							<>
								<RichPageHeaderChip icon="check-circle">Online</RichPageHeaderChip>
								<RichPageHeaderChip icon="geo-alt">Grid Sector 7</RichPageHeaderChip>
							</>
						}
						title="Neon Drift · launch control"
						sub="Build 2045.07 · 8 cores · GPU-accelerated"
						description="Cross-platform synthwave racer. Day-one on console & PC. Cross-save, cross-play, cross-dimensional."
						actions={
							<>
								<Button variant="secondary" outline>
									Logs
								</Button>
								<Button variant="primary">Deploy</Button>
							</>
						}
					/>
				</DemoSection>

				<DemoSection
					eyebrow="KPIs"
					title="StatCard & MetricGrid"
					caption="Delta chips adopt theme-appropriate semantic colors; the large number picks up the display font when it's loaded."
				>
					<DemoGrid columns={3} minItemWidth={220}>
						<StatCard
							icon="graph-up-arrow"
							label="Wishlist"
							value="128k"
							delta="+12.4%"
							deltaKind="up"
							helper="week over week"
						/>
						<StatCard
							icon="speedometer"
							label="Frame time"
							value="8.2"
							unit="ms"
							delta="-0.4ms"
							deltaKind="down"
							helper="99th percentile"
						/>
						<StatCard
							icon="activity"
							label="Concurrent"
							value="4,210"
							delta="±0"
							deltaKind="neutral"
							helper="flat"
						/>
					</DemoGrid>
					<div style={{ height: 16 }} />
					<MetricGrid
						columns={4}
						items={[
							{ icon: 'hdd', label: 'Bundle', value: '2.1', unit: 'GB' },
							{ icon: 'cloud-upload', label: 'CDN', value: '42', hint: 'edge PoPs' },
							{ icon: 'people', label: 'Squads', value: '12', unit: 'of 16' },
							{ icon: 'cpu', label: 'CPU', value: '62', unit: '%' },
						]}
					/>
				</DemoSection>

				<DemoSection
					eyebrow="Surfaces"
					title="SectionCard & Card"
					caption="Cards become translucent panels with neon borders and backdrop blur. The `danger` variant shifts to rose on dark."
				>
					<DemoGrid columns={2} minItemWidth={320}>
						<SectionCard
							title="Identity"
							icon="person-circle"
							action={<Button size="small">Manage</Button>}
						>
							<p style={{ margin: 0 }}>
								Primary profile. Display name and handle are visible across squads.
							</p>
						</SectionCard>
						<SectionCard
							title="Purge save data"
							icon="exclamation-triangle"
							variant="danger"
							action={
								<Button variant="danger" outline size="small">
									Purge
								</Button>
							}
						>
							<p style={{ margin: 0 }}>
								Wipes local saves, cloud checkpoints, and replay captures. No recovery.
							</p>
						</SectionCard>
					</DemoGrid>
				</DemoSection>

				<DemoSection
					eyebrow="Buttons"
					title="Variants under neon"
					caption="Primary gets the magenta-gradient neon fill; outline variants pick up glowing borders on hover."
				>
					<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
						<Button variant="primary">Primary</Button>
						<Button variant="secondary">Secondary</Button>
						<Button variant="info">Info</Button>
						<Button variant="success">Success</Button>
						<Button variant="warning">Warning</Button>
						<Button variant="danger">Danger</Button>
					</div>
					<div style={{ height: 10 }} />
					<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
						<Button variant="primary" outline>
							Primary
						</Button>
						<Button variant="secondary" outline>
							Secondary
						</Button>
						<Button variant="info" outline>
							Info
						</Button>
						<Button variant="success" outline>
							Success
						</Button>
						<Button variant="warning" outline>
							Warning
						</Button>
						<Button variant="danger" outline>
							Danger
						</Button>
					</div>
				</DemoSection>

				<DemoSection
					eyebrow="Feedback"
					title="Alerts, badges, status"
					caption="Alerts, badges, and status dots adopt neon semantic colors while keeping the same structure."
				>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
						<Alert variant="primary" title="Deploy started" icon="rocket-takeoff">
							Build 2045.07 is rolling out to edge.
						</Alert>
						<Alert variant="info" title="Patch available" icon="info-circle">
							A hotfix for the HUD clipping issue is ready.
						</Alert>
						<Alert variant="warning" title="Quota warning" icon="exclamation-triangle">
							Your compute quota is at 82%.
						</Alert>
						<Alert variant="danger" title="Validation failed" icon="x-circle">
							2 of 5 shader bundles did not compile.
						</Alert>
					</div>

					<div style={{ height: 12 }} />

					<div
						style={{
							display: 'flex',
							gap: 10,
							flexWrap: 'wrap',
							alignItems: 'center',
						}}
					>
						<Badge variant="primary">PRIMARY</Badge>
						<Badge variant="secondary">SECONDARY</Badge>
						<Badge variant="info">INFO</Badge>
						<Badge variant="success">SUCCESS</Badge>
						<Badge variant="warning">WARNING</Badge>
						<Badge variant="danger">DANGER</Badge>

						<span style={{ marginLeft: 12, display: 'flex', gap: 14, alignItems: 'center' }}>
							<StatusDot status="online" /> online
							<StatusDot status="busy" /> busy
							<StatusDot status="away" /> away
							<StatusDot status="offline" /> offline
						</span>
					</div>
				</DemoSection>

				<DemoSection
					eyebrow="Forms"
					title="FormInput & controls"
					caption="Inputs become dark panels; focus gets a cyan glow; labels flip to mono uppercase."
				>
					<DemoGrid columns={2} minItemWidth={260}>
						<FormInput
							type="text"
							label="Pilot callsign"
							placeholder="e.g. Kestrel"
							value={inputValue}
							onChange={(v) => setInputValue(String(v))}
							helper="Visible in leaderboards."
						/>
						<FormInput
							type="email"
							label="Crew email"
							placeholder="crew@drift.example"
							value=""
							onChange={() => {}}
						/>
					</DemoGrid>
				</DemoSection>

				<DemoSection
					eyebrow="Data"
					title="Table & cells"
					caption="Tables pick up the dark striped/hover treatment; EntityCell tiles retint for neon."
				>
					<Table
						columns={
							[
								{
									key: 'name',
									header: 'Squad',
									render: (row: Project) => (
										<EntityCell
											name={row.name}
											subLabel={row.slug}
											initial={row.initial}
											color={row.color}
										/>
									),
								},
								{
									key: 'region',
									header: 'Region',
									render: () => <CodeLabelCell code="JP" name="Japan · Tokyo" />,
								},
								{
									key: 'members',
									header: 'Pilots',
									render: (row: Project) => row.members,
									align: 'right',
								},
							] as TableColumn<Project>[]
						}
						data={projects}
						rowKey={(r) => r.id}
					/>
				</DemoSection>

				<DemoSection
					eyebrow="Profile"
					title="EntityProfileCard"
					caption="Hero row + meta grid with monospace for IDs — the `mono` modifier keys into cyan."
				>
					<EntityProfileCard
						lead={<Avatar name="Kestrel Liu" size="large" variant="primary" />}
						title="Kestrel Liu"
						subtitle="kestrel@drift.example"
						chips={
							<>
								<Badge variant="success" pill>
									ONLINE
								</Badge>
								<Badge variant="primary" pill>
									CAPTAIN
								</Badge>
							</>
						}
						meta={[
							{ icon: 'calendar-event', label: 'Joined', value: '2045-02-11' },
							{ icon: 'clock-history', label: 'Last seen', value: '3 minutes ago' },
							{ icon: 'people', label: 'Squads', value: '3' },
							{ icon: 'hash', label: 'Pilot ID', value: 'pilot_9a82c0f3e641', mono: true },
						]}
					/>
				</DemoSection>

				<DemoSection
					eyebrow="Loading"
					title="Progress, spinner, skeleton"
					caption="Progress bars gain an inner glow; spinners switch to magenta; skeletons shimmer in the neon palette."
				>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
						<ProgressBar value={72} variant="primary" label="Bundle upload" />
						<ProgressBar value={40} variant="info" label="Shader compile" />
						<ProgressBar value={94} variant="success" label="Edge propagation" />
					</div>
					<div style={{ height: 12 }} />
					<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
						<Spinner />
						<span>Rolling to edge…</span>
					</div>
					<div style={{ height: 12 }} />
					<Card>
						<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
							<Skeleton width="60%" />
							<Skeleton width="40%" />
							<Skeleton height={80} />
						</div>
					</Card>
				</DemoSection>

				<DemoSection eyebrow="API" title="Usage">
					<CodeSnippet
						language="typescript"
						code={`// Wrap any subtree with the theme class.
// Components inside adopt the neon look via CSS custom property overrides.
// No component API changes — same props, different palette.

<div className="theme theme--neon">
  <RichPageHeader
    icon={{ name: 'lightning-charge', color: 'pink' }}
    title="Neon Drift · launch control"
    actions={<Button variant="primary">Deploy</Button>}
  />
  <StatCard label="Wishlist" value="128k" delta="+12.4%" deltaKind="up" />
</div>

// Optional: add the scanline overlay modifier
<div className="theme theme--neon theme--neon--scanlines">
  ...
</div>

// The default, unwrapped tree keeps the light toolcase baseline:
<Card header="Settings">Standard light card.</Card>`}
					/>
				</DemoSection>
			</div>
		</DemoPage>
	)
}

export default NeonThemeDemo
