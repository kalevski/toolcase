import React from 'react'
import { LinkedProvidersCard, CodeSnippet } from '@toolcase/react-components'
import { DemoPage, DemoSection, DemoGrid } from './_demo'

const LinkedProvidersCardDemo: React.FC = () => (
	<DemoPage
		eyebrow="Dashboard & Admin"
		title="LinkedProvidersCard"
		lede={
			<>
				Lists third-party identity providers (Google, GitHub, Discord, etc.) linked to the
				current user. Composes <code>SectionCard</code>. Provider brand colors come from a
				built-in map that callers can override or extend.
			</>
		}
	>
		<DemoSection
			eyebrow="Default"
			title="Connected accounts"
			caption="A read-only list. Connect / disconnect affordances live in a separate wrapper."
		>
			<DemoGrid columns={1} minItemWidth={360}>
				<LinkedProvidersCard
					providers={[
						{ id: '1', provider: 'google', identifier: 'jordan@atlas.example.com' },
						{ id: '2', provider: 'github', identifier: '@jordanliu' },
						{ id: '3', provider: 'discord', identifier: 'jordanliu#4281' },
					]}
				/>
			</DemoGrid>
		</DemoSection>

		<DemoSection
			eyebrow="Empty"
			title="No providers linked"
			caption="When the list is empty, the card renders a centered empty state with the supplied label."
		>
			<DemoGrid columns={1} minItemWidth={360}>
				<LinkedProvidersCard providers={[]} />
			</DemoGrid>
		</DemoSection>

		<DemoSection
			eyebrow="Custom brand"
			title="Override colors & icons"
			caption="Pass a `brandColors` map (merged over the defaults) and an `iconForProvider` function for non-default icon names."
		>
			<DemoGrid columns={1} minItemWidth={360}>
				<LinkedProvidersCard
					title="Linked accounts"
					providers={[
						{ id: '1', provider: 'okta', identifier: 'jordan@atlas.okta.com' },
						{ id: '2', provider: 'github', identifier: '@jordanliu' },
					]}
					brandColors={{ okta: '#007dc1' }}
					iconForProvider={(key) => (key === 'okta' ? 'shield-lock' : 'box-arrow-up-right')}
				/>
			</DemoGrid>
		</DemoSection>

		<DemoSection eyebrow="API" title="Usage">
			<CodeSnippet
				language="typescript"
				code={`import { LinkedProvidersCard } from '@toolcase/react-components'

<LinkedProvidersCard
  providers={[
    { id: '1', provider: 'google', identifier: 'jordan@atlas.example.com' },
    { id: '2', provider: 'github', identifier: '@jordanliu' },
  ]}
/>

// Extend the defaults
<LinkedProvidersCard
  providers={providers}
  brandColors={{ okta: '#007dc1' }}
  iconForProvider={(key) => (key === 'okta' ? 'shield-lock' : undefined)}
/>`}
			/>
		</DemoSection>
	</DemoPage>
)

export default LinkedProvidersCardDemo
