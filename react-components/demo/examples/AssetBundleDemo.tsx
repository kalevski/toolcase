import React from 'react'
import { AssetBundle, Card, CodeSnippet } from '../../src'

const bundleActions = [
	{ key: 'edit', icon: 'pencil', label: 'Edit Bundle' },
	{ key: 'duplicate', icon: 'copy', label: 'Duplicate' },
	{ key: 'build', icon: 'play-fill', label: 'Build Now' },
	{ key: 'export', icon: 'download', label: 'Export Config' },
	{ key: 'delete', icon: 'trash', label: 'Delete' },
]

const AssetBundleDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">AssetBundle</h1>
				<p className="text-muted mb-0">
					A modern card representing a single asset bundle configuration for a game build —
					showing target engine, categories, tag filters, file counts, action menus, and advanced packing options.
				</p>
			</div>
		</div>

		{/* ── Unity example ── */}
		<div className="row mb-5">
			<div className="col-12 col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Unity — Full Configuration</h2>
					<AssetBundle
						name="UI Sprites"
						target="unity"
						category="Interface"
						includedTags={['hud', 'buttons', 'icons']}
						excludedTags={['debug', 'placeholder']}
						defaultBuildTag="v2.1-release"
						counts={{ textures: 124, fonts: 8, configs: 3 }}
						menuItems={bundleActions}
						onMenuItemClick={(key) => alert(`Action: ${key}`)}
						advanced={{
							scale: 75,
							rotationEnabled: true,
							algorithm: 'maxrects',
						}}
                        latestBuildRef='213123'
                        buildTag='v2.1-release'
					/>
				</Card>
			</div>

			<div className="col-12 col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Unity — Minimal</h2>
					<AssetBundle
						name="Environment Tiles"
						target="unity"
						includedTags={['ground', 'walls']}
						defaultBuildTag="main"
						counts={{ textures: 256, maps: 12 }}
						advanced={{ scale: 100, algorithm: 'basic' }}
					/>
				</Card>
			</div>
		</div>

		{/* ── Godot example ── */}
		<div className="row mb-5">
			<div className="col-12 col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Godot — Character Pack</h2>
					<AssetBundle
						name="Character Sprites"
						target="godot"
						category="Characters"
						includedTags={['hero', 'npc', 'enemy']}
						excludedTags={['wip']}
						defaultBuildTag="sprint-14"
						counts={{ textures: 89, animations: 34, sounds: 12 }}
						menuItems={bundleActions}
						onMenuItemClick={(key) => alert(`Action: ${key}`)}
						advanced={{
							scale: 50,
							rotationEnabled: false,
							algorithm: 'guillotine',
						}}
					/>
				</Card>
			</div>

			<div className="col-12 col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Godot — All Categories</h2>
					<AssetBundle
						name="Full Atlas"
						target="godot"
						includedTags={['final']}
						defaultBuildTag="nightly"
						advanced={{
							scale: 100,
							rotationEnabled: true,
							algorithm: 'skyline',
						}}
					/>
				</Card>
			</div>
		</div>

		{/* ── Unreal example ── */}
		<div className="row mb-5">
			<div className="col-12 col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Unreal — Weapons</h2>
					<AssetBundle
						name="Weapon Textures"
						target="unreal"
						category="Weapons"
						includedTags={['rifle', 'pistol', 'melee']}
						excludedTags={['concept']}
						defaultBuildTag="release-5.3"
						counts={{ textures: 48, models: 16, materials: 22, shaders: 5 }}
						menuItems={bundleActions}
						onMenuItemClick={(key) => alert(`Action: ${key}`)}
						advanced={{
							scale: 90,
							rotationEnabled: false,
							algorithm: 'octree',
						}}
					/>
				</Card>
			</div>

			<div className="col-12 col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Custom Engine</h2>
					<AssetBundle
						name="Particle Effects"
						target="custom"
						category="VFX"
						includedTags={['fire', 'smoke', 'sparks']}
						defaultBuildTag="latest"
						counts={{ textures: 67, scripts: 4, configs: 2, data: 11 }}
						advanced={{
							scale: 60,
							rotationEnabled: true,
							algorithm: 'shelf',
						}}
					/>
				</Card>
			</div>
		</div>

		{/* ── Counts & Actions focused ── */}
		<div className="row mb-5">
			<div className="col-12 col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Rich File Counts</h2>
					<AssetBundle
						name="Full Game Assets"
						target="unity"
						category="Everything"
						defaultBuildTag="release"
						counts={{
							textures: 512,
							sounds: 78,
							fonts: 12,
							configs: 45,
							dialogues: 230,
							animations: 96,
							models: 34,
							scripts: 18,
						}}
						menuItems={[
							{ key: 'build', icon: 'play-fill', label: 'Build Now' },
							{ key: 'export', icon: 'download', label: 'Export Config' },
						]}
						onMenuItemClick={(key) => alert(`Action: ${key}`)}
						advanced={{ scale: 100, rotationEnabled: true, algorithm: 'maxrects' }}
					/>
				</Card>
			</div>

			<div className="col-12 col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Defaults Only</h2>
					<AssetBundle
						name="Quick Bundle"
						target="unity"
						defaultBuildTag="dev"
					/>
				</Card>
			</div>
		</div>

		{/* ── Usage ── */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { AssetBundle } from '@webgame-cloud/react-components'

const actions = [
  { key: 'edit', icon: 'pencil', label: 'Edit Bundle' },
  { key: 'duplicate', icon: 'copy', label: 'Duplicate' },
  { key: 'build', icon: 'play-fill', label: 'Build Now' },
  { key: 'delete', icon: 'trash', label: 'Delete' },
]

<AssetBundle
  name="UI Sprites"
  target="unity"
  category="Interface"
  includedTags={['hud', 'buttons', 'icons']}
  excludedTags={['debug', 'placeholder']}
  defaultBuildTag="v2.1-release"
  counts={{ textures: 124, fonts: 8, configs: 3 }}
  menuItems={actions}
  onMenuItemClick={(key) => console.log(key)}
  advanced={{
    scale: 75,
    rotationEnabled: true,
    algorithm: 'maxrects',
  }}
/>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default AssetBundleDemo
