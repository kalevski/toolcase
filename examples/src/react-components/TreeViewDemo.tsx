import React, { useState } from 'react'
import { TreeView, TreeNode, Card, CodeSnippet } from '@toolcase/react-components'

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

const usageCode = `import { TreeView, TreeNode } from '@toolcase/react-components'

const nodes: TreeNode[] = [
  { key: 'src', label: 'src', icon: 'folder', children: [...] }
]

const [selected, setSelected] = useState<string[]>([])
const [expanded, setExpanded] = useState<string[]>([])

<TreeView
  nodes={nodes}
  selected={selected}
  onSelect={setSelected}
  expanded={expanded}
  onExpandChange={setExpanded}
/>`

export const TreeViewDemo: React.FC = () => {
	const [selected,  setSelected]  = useState<string[]>([])
	const [expanded,  setExpanded]  = useState<string[]>(['src'])
	const [checked,   setChecked]   = useState<string[]>([])
	const [exp2,      setExp2]      = useState<string[]>([])

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">TreeView</h1>
					<p className="text-muted mb-0">Hierarchical collapsible tree with keyboard navigation and optional checkboxes.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">File Tree</h2>
						<TreeView
							nodes={treeData}
							selected={selected}
							onSelect={setSelected}
							expanded={expanded}
							onExpandChange={setExpanded}
						/>
						<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.85rem' }}>
							Selected: {selected.join(', ') || '—'}
						</p>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Checkbox Mode</h2>
						<TreeView
							nodes={treeData}
							selected={checked}
							onSelect={setChecked}
							expanded={exp2}
							onExpandChange={setExp2}
							checkboxMode
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet language="typescript" code={usageCode} />
					</Card>
				</div>
			</div>
		</div>
	)
}
