import React, { useState } from 'react'
import { TreeView, TreeNode } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const treeData: TreeNode[] = [
	{
		key: 'src',
		label: 'src',
		icon: 'folder',
		children: [
			{
				key: 'components',
				label: 'components',
				icon: 'folder',
				children: [
					{ key: 'button', label: 'Button.tsx', icon: 'file-code' },
					{ key: 'input',  label: 'Input.tsx',  icon: 'file-code' },
				],
			},
			{
				key: 'hooks',
				label: 'hooks',
				icon: 'folder',
				children: [
					{ key: 'useauth', label: 'useAuth.ts', icon: 'file-code' },
				],
			},
			{ key: 'app',   label: 'App.tsx',   icon: 'file-code' },
			{ key: 'index', label: 'index.tsx',  icon: 'file-code' },
		],
	},
	{
		key: 'public',
		label: 'public',
		icon: 'folder',
		children: [
			{ key: 'favicon', label: 'favicon.ico', icon: 'file-image' },
		],
	},
	{ key: 'package', label: 'package.json', icon: 'file-earmark-code' },
]

export const TreeViewDemo: React.FC = () => {
	const [selected,  setSelected]  = useState<string[]>([])
	const [expanded,  setExpanded]  = useState<string[]>(['src'])
	const [checked,   setChecked]   = useState<string[]>([])
	const [exp2,      setExp2]      = useState<string[]>([])

	return (
		<DemoPage
			eyebrow="Data Display"
			title="TreeView"
			lede="Hierarchical collapsible tree with keyboard navigation and optional checkboxes."
		>
			<DemoSection title="File Tree">
				<TreeView
					nodes={treeData}
					selected={selected}
					onSelect={setSelected}
					expanded={expanded}
					onExpandChange={setExpanded}
				/>
				<p style={{ color: '#64748b', marginTop: 8, marginBottom: 0, fontSize: '0.85rem' }}>
					Selected: {selected.join(', ') || '—'}
				</p>
			</DemoSection>

			<DemoSection title="Checkbox Mode">
				<TreeView
					nodes={treeData}
					selected={checked}
					onSelect={setChecked}
					expanded={exp2}
					onExpandChange={setExp2}
					checkboxMode
				/>
			</DemoSection>
		</DemoPage>
	)
}
