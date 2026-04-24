import React from 'react'
import {
	LinkedProvidersCard,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const LinkedProvidersCardDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Dashboard & Admin</RichPageHeaderChip>}
				title="LinkedProvidersCard"
				description={
			<>
				Lists third-party identity providers (Google, GitHub, Discord, etc.) linked to the
				current user. Composes <code>SectionCard</code>. Provider brand colors come from a
				built-in map that callers can override or extend.
			</>
		}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Connected accounts">
			<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(1, minmax(0, 1fr))'}}>
				<LinkedProvidersCard
					providers={[
						{ id: '1', provider: 'google', identifier: 'jordan@atlas.example.com' },
						{ id: '2', provider: 'github', identifier: '@jordanliu' },
						{ id: '3', provider: 'discord', identifier: 'jordanliu#4281' },
					]}
				/>
			</div>
		</SectionCard>

		<SectionCard title="No providers linked">
			<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(1, minmax(0, 1fr))'}}>
				<LinkedProvidersCard providers={[]} />
			</div>
		</SectionCard>

		<SectionCard title="Override colors & icons">
			<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(1, minmax(0, 1fr))'}}>
				<LinkedProvidersCard
					title="Linked accounts"
					providers={[
						{ id: '1', provider: 'okta', identifier: 'jordan@atlas.okta.com' },
						{ id: '2', provider: 'github', identifier: '@jordanliu' },
					]}
					brandColors={{ okta: '#007dc1' }}
					iconForProvider={(key) => (key === 'okta' ? 'shield-lock' : 'box-arrow-up-right')}
				/>
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default LinkedProvidersCardDemo
