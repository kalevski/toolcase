import React, { useState } from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	TreeNode,
	TreeView
} from '@toolcase/react-components'

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
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
				title="TreeView"
				description="Hierarchical collapsible tree with keyboard navigation and optional checkboxes."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="File Tree">
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
			</SectionCard>

			<SectionCard title="Checkbox Mode">
				<TreeView
					nodes={treeData}
					selected={checked}
					onSelect={setChecked}
					expanded={exp2}
					onExpandChange={setExp2}
					checkboxMode
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}
