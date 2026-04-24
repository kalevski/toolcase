import {
	Build,
	Group,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const menuItems = [
	{ key: 'download', icon: 'download', label: 'Download' },
	{ key: 'rebuild', icon: 'arrow-clockwise', label: 'Rebuild' },
	{ key: 'delete', icon: 'trash', label: 'Delete' },
]

const BuildDemo = () => {
	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Editors</RichPageHeaderChip>}
				title="Build"
				description="Displays build metadata with status indicators, file size, duration, and context menu actions."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Production">
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
			</SectionCard>

			<SectionCard title="Staging">
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
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default BuildDemo
