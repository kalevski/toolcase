import React from 'react'
import {
	Brand,
	CoolNav,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const CoolNavDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Navigation</RichPageHeaderChip>}
				title="CoolNav"
				description="A responsive navigation bar with brand, nav items, login action, and theme support."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Light Theme">
			<CoolNav
				brand={<Brand primaryText="webgame" secondaryText=".cloud" color="#6366f1" />}
				items={[
					{ key: 'features', label: 'Features', href: '#' },
					{ key: 'pricing', label: 'Pricing', href: '#' },
					{ key: 'docs', label: 'Docs', href: '#' },
				]}
				loginLabel="Sign In"
				loginVariant="primary"
				onLoginClick={() => alert('Login clicked')}
				sticky={false}
				theme="light"
			/>
		</SectionCard>

		<SectionCard title="Dark Theme">
			<div style={{ background: '#1e293b', padding: '1rem', borderRadius: '0' }}>
				<CoolNav
					brand={<Brand primaryText="pixel" secondaryText="forge" color="#f59e0b" />}
					items={[
						{ key: 'games', label: 'Games', href: '#' },
						{ key: 'assets', label: 'Assets', href: '#' },
						{ key: 'community', label: 'Community', href: '#' },
						{ key: 'blog', label: 'Blog', href: '#' },
					]}
					loginLabel="Get Started"
					loginVariant="warning"
					onLoginClick={() => alert('Get Started clicked')}
					sticky={false}
					theme="dark"
				/>
			</div>
		</SectionCard>

		<SectionCard title="Minimal (No Login)">
			<CoolNav
				brand={<Brand primaryText="docs" secondaryText=".dev" />}
				items={[
					{ key: 'guide', label: 'Guide', href: '#' },
					{ key: 'api', label: 'API', href: '#' },
					{ key: 'examples', label: 'Examples', href: '#' },
				]}
				sticky={false}
			/>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default CoolNavDemo
