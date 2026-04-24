import React from 'react'
import { AssetBundle } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const bundleActions = [
	{ key: 'edit', icon: 'pencil', label: 'Edit Bundle' },
	{ key: 'duplicate', icon: 'copy', label: 'Duplicate' },
	{ key: 'build', icon: 'play-fill', label: 'Build Now' },
	{ key: 'export', icon: 'download', label: 'Export Config' },
	{ key: 'delete', icon: 'trash', label: 'Delete' },
]

const AssetBundleDemo: React.FC = () => (
	<DemoPage
		eyebrow="Editors"
		title="AssetBundle"
		lede="A modern card representing a single asset bundle configuration for a game build — showing target engine, categories, tag filters, file counts, action menus, and advanced packing options."
	>
		<DemoSection title="Unity — Full Configuration">
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
		</DemoSection>

		<DemoSection title="Unity — Minimal">
			<AssetBundle
				name="Environment Tiles"
				target="unity"
				includedTags={['ground', 'walls']}
				defaultBuildTag="main"
				counts={{ textures: 256, maps: 12 }}
				advanced={{ scale: 100, algorithm: 'basic' }}
			/>
		</DemoSection>

		<DemoSection title="Godot — Character Pack">
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
		</DemoSection>

		<DemoSection title="Godot — All Categories">
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
		</DemoSection>

		<DemoSection title="Unreal — Weapons">
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
		</DemoSection>

		<DemoSection title="Custom Engine">
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
		</DemoSection>

		<DemoSection title="Rich File Counts">
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
		</DemoSection>

		<DemoSection title="Defaults Only">
			<AssetBundle
				name="Quick Bundle"
				target="unity"
				defaultBuildTag="dev"
			/>
		</DemoSection>
	</DemoPage>
)

export default AssetBundleDemo
