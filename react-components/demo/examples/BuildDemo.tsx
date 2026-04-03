import { Build, Group, Card, CodeSnippet } from '../../src'

const menuItems = [
	{ key: 'download', icon: 'download', label: 'Download' },
	{ key: 'rebuild', icon: 'arrow-clockwise', label: 'Rebuild' },
	{ key: 'delete', icon: 'trash', label: 'Delete' },
]

const BuildDemo = () => {
	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Build</h1>
					<p className="text-muted mb-0">Displays build metadata with status indicators, file size, duration, and context menu actions.</p>
				</div>
			</div>

			<div className="row mb-5">
			<div className="col-lg-8">
			<Card>
			<Group label="Production" badge="3 builds" actionIcon="play" onActionClick={() => {}}>
				<Build
					name="release-v2.4.0"
					date="23/02/2024 14:35"
					status="pass"
					size={4_500_000}
					duration={32_400}
					badge="latest"
					badgeVariant="success"
					menuItems={menuItems}
					onMenuItemClick={(key) => console.log('action', key)}
				/>
				<Build
					name="release-v2.3.9"
					date="22/02/2024 10:15"
					status="pass"
					size={4_200_000}
					duration={29_800}
					menuItems={menuItems}
					onMenuItemClick={(key) => console.log('action', key)}
				/>
				<Build
					name="release-v2.3.8-hotfix"
					date="21/02/2024 16:45"
					status="fail"
					size={4_100_000}
					duration={45_200}
					badge="reverted"
					badgeVariant="danger"
					menuItems={menuItems}
					onMenuItemClick={(key) => console.log('action', key)}
				/>
			</Group>

			<Group label="Staging" badge="2 builds">
				<Build
					name="staging-abc1234"
					date="24/02/2024 09:20"
					size={5_100_000}
					duration={18_600}
					menuItems={menuItems}
					onMenuItemClick={(key) => console.log('action', key)}
                    status="queued"
				/>
				<Build
					name="staging-def5678"
					date="24/02/2024 09:20"
					size={3_800_000}
					duration={62_000}
					menuItems={menuItems}
					onMenuItemClick={(key) => console.log('action', key)}
                    status="running"
				/>
			</Group>
			</Card>
			</div>
			</div>

		{/* Usage */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { Build } from '@webgame-cloud/react-components'

<Build
  name="release-v2.4.0"
  date="23/02/2024 14:35"
  status="pass"
  size={4500000}
  duration={32400}
  badge="latest"
  badgeVariant="success"
  menuItems={[{ key: 'download', icon: 'download', label: 'Download' }]}
  onMenuItemClick={(key) => console.log(key)}
/>`}
					/>
				</Card>
			</div>
		</div>
		</div>
	)
}

export default BuildDemo
