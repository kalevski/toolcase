import React from 'react'
import {
	AssetRow,
	AssetRowList,
	BundleBar,
	CdnMap,
	ConfigPreview,
	FeatureCard,
	Pipeline,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	TeamList
} from '@toolcase/react-components'

const FeatureCardDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Layout & Surfaces</RichPageHeaderChip>}
				title="FeatureCard"
				description={
			<>
				Chrome for a marketing feature tile. Takes an icon, eyebrow, title, description, and a
				free-form <code>visual</code> slot — compose with one of the included primitives
				(<code>AssetRow</code>, <code>BundleBar</code>, <code>Pipeline</code>,{' '}
				<code>ConfigPreview</code>, <code>TeamList</code>, <code>CdnMap</code>) or supply your own.
			</>
		}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Feature grid — all seven tiles">
			<div className="component-feature-card-grid">
				<FeatureCard
					size="wide"
					icon={<i className="bi bi-folder2-open" />}
					eyebrow="Asset management"
					title="Upload, tag, and organize every file"
					description="Sprites, audio, JSON, configs. Organize with custom categories and tags, filter with complex queries, batch-edit before committing."
					visual={
						<AssetRowList>
							<AssetRow
								icon={<i className="bi bi-image" />}
								name="player_idle.png"
								tags={['sprite', 'hero']}
								size="24 KB"
							/>
							<AssetRow
								icon={<i className="bi bi-music-note-beamed" />}
								name="bgm_level_02.ogg"
								tags={['audio']}
								size="412 KB"
							/>
							<AssetRow
								icon={<i className="bi bi-filetype-json" />}
								name="enemies.json"
								tags={['data', 'balance']}
								size="3.1 KB"
							/>
						</AssetRowList>
					}
				/>

				<FeatureCard
					icon={<i className="bi bi-box-seam" />}
					eyebrow="Smart asset bundles"
					title="Build optimized packs in clicks"
					description="Filter by tag and category. Configure scale ratios, compression, and rotation — trigger a build and let the pipeline handle it."
					visual={
						<BundleBar
							chips={[
								{ label: 'sprite', active: true, icon: <i className="bi bi-check2" /> },
								{ label: 'hero', active: true, icon: <i className="bi bi-check2" /> },
								{ label: 'audio' },
								{ label: 'ui' },
							]}
							segments={12}
							filledSegments={6}
							name="mobile_lo.pack"
							meta="1.4 MB · webp · @1x"
						/>
					}
				/>

				<FeatureCard
					size="full"
					inline
					icon={<i className="bi bi-lightning-charge" />}
					eyebrow="Build pipeline"
					title="From asset to player in minutes"
					description="Automated processing optimizes your assets and pushes them live across a global CDN. Monitor every build, track deployments, rollback with confidence."
					visual={
						<Pipeline
							steps={[
								{ num: '01', title: 'Upload', sub: 'assets + tags', icon: <i className="bi bi-cloud-upload" /> },
								{ num: '02', title: 'Filter', sub: 'by category', icon: <i className="bi bi-funnel" /> },
								{
									num: '03',
									title: 'Build',
									sub: 'compress + scale',
									icon: <i className="bi bi-gear-wide-connected" />,
									state: 'live',
								},
								{ num: '04', title: 'Deploy', sub: 'edge CDN', icon: <i className="bi bi-globe2" /> },
								{ num: '05', title: 'Rollback', sub: 'one click', icon: <i className="bi bi-arrow-counterclockwise" /> },
							]}
						/>
					}
				/>

				<FeatureCard
					icon={<i className="bi bi-sliders" />}
					eyebrow="Live game configs"
					title="Tweak gameplay without redeploying"
					description="Define JSON schemas, create configs tied to those schemas, push changes live. Adjust balance, economy, or event settings while players stay online."
					visual={
						<ConfigPreview
							entries={[
								{ key: 'player_hp', value: 120 },
								{ key: 'xp_multiplier', value: 1.5, live: true },
								{ key: 'boss_event', value: true },
							]}
						/>
					}
				/>

				<FeatureCard
					icon={<i className="bi bi-braces" />}
					eyebrow="Schema-driven editor"
					title="Type-safe configs with visual editing"
					description="Build structured schemas with booleans, numbers, strings, objects, and arrays. The editor auto-generates forms and detects when configs need syncing."
					visual={
						<AssetRowList>
							<AssetRow
								icon={<i className="bi bi-toggle-on" style={{ color: '#10b981' }} />}
								name="boss_event"
								tags={['boolean']}
							/>
							<AssetRow icon={<i className="bi bi-123" />} name="xp_multiplier" tags={['number']} />
							<AssetRow icon={<i className="bi bi-list-nested" />} name="loot_table" tags={['array']} />
						</AssetRowList>
					}
				/>

				<FeatureCard
					icon={<i className="bi bi-people" />}
					eyebrow="Team collaboration"
					title="Invite your whole studio"
					description="Add members by email with role-based access — Admin, Developer, Artist, Translator, or Guest. Track invites, toggle status, transfer ownership."
					visual={
						<TeamList
							members={[
								{ initials: 'RK', email: 'rei@orbitalgames.io', role: 'Admin', gradient: ['#805ad5', '#3182ce'] },
								{ initials: 'JS', email: 'jun@orbitalgames.io', role: 'Developer', gradient: ['#10b981', '#06b6d4'] },
								{ initials: 'MT', email: 'mae@orbitalgames.io', role: 'Artist', gradient: ['#f59e0b', '#ef4444'] },
							]}
						/>
					}
				/>

				<FeatureCard
					size="wide"
					icon={<i className="bi bi-globe-americas" />}
					eyebrow="Global CDN delivery"
					title="Fast loads from any region"
					description="Every build is served from a global edge network so players load textures, audio, and data files fast — no matter where they are. 99.99% uptime backed by multi-region infrastructure."
					visual={
						<CdnMap
							height={160}
							nodes={[
								{ top: '38%', left: '18%' },
								{ top: '28%', left: '42%', variant: 'accent' },
								{ top: '52%', left: '58%' },
								{ top: '36%', left: '76%', variant: 'accent' },
								{ top: '68%', left: '30%' },
								{ top: '60%', left: '88%', variant: 'accent' },
							]}
						/>
					}
				/>
			</div>
		</SectionCard>

		<SectionCard title="Size variants">
			<div className="component-feature-card-grid">
				<FeatureCard
					icon={<i className="bi bi-grid-1x2" />}
					eyebrow="span 4"
					title="Default tile"
					description="Fits three across on wide screens."
				/>
				<FeatureCard
					size="wide"
					icon={<i className="bi bi-grid-3x2-gap" />}
					eyebrow="span 6"
					title="Wide tile"
					description="Fits two across and is the right choice for extra-dense visuals."
				/>
				<FeatureCard
					size="full"
					icon={<i className="bi bi-layout-wtf" />}
					eyebrow="span 12"
					title="Full-width tile"
					description="Stretches the full row — use for hero-style features, pipelines, or long descriptions."
				/>
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default FeatureCardDemo
