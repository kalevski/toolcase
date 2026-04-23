import React from 'react'
import { SectionCard, Button, CodeSnippet, FormInput } from '@toolcase/react-components'
import { DemoPage, DemoSection, DemoGrid } from './_demo'

const SectionCardDemo: React.FC = () => (
	<DemoPage
		eyebrow="Layout & Surfaces"
		title="SectionCard"
		lede={
			<>
				An opinionated titled card for settings and detail pages. The header row holds an icon
				tile, a title, and an optional <code>action</code> slot (usually a button). The body is a
				free-form children region. A <code>danger</code> variant tints the chrome red for
				destructive zones.
			</>
		}
	>
		<DemoSection
			eyebrow="Default"
			title="Titled card with icon"
			caption="The workhorse — group a single concern behind an icon + title header."
		>
			<DemoGrid columns={2} minItemWidth={320}>
				<SectionCard title="Account details" icon="person-circle">
					<p style={{ margin: 0, color: '#475569' }}>
						Your profile information is visible to anyone you share a workspace with.
					</p>
				</SectionCard>
				<SectionCard title="Notifications" icon="bell">
					<p style={{ margin: 0, color: '#475569' }}>
						Choose when we email you. You can always mute individual projects.
					</p>
				</SectionCard>
			</DemoGrid>
		</DemoSection>

		<DemoSection
			eyebrow="With action"
			title="Header-right control"
			caption="Pass a Button (or any node) into the `action` slot — it sits flush to the right of the title."
		>
			<SectionCard
				title="API keys"
				icon="key"
				action={<Button size="small">New key</Button>}
			>
				<p style={{ margin: 0, color: '#475569' }}>
					Active keys appear here. Rotating a key invalidates the previous value immediately.
				</p>
			</SectionCard>
		</DemoSection>

		<DemoSection
			eyebrow="Body composition"
			title="Forms inside"
			caption="The body is a plain slot — drop form inputs, lists, or any other content directly in."
		>
			<SectionCard
				title="Workspace profile"
				icon="building"
				action={<Button variant="primary" size="small">Save</Button>}
			>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<FormInput
						type="text"
						label="Name"
						value="Atlas Industries"
						onChange={() => {}}
					/>
					<FormInput
						type="text"
						label="Public URL"
						value="atlas.example.com"
						onChange={() => {}}
					/>
				</div>
			</SectionCard>
		</DemoSection>

		<DemoSection
			eyebrow="Danger variant"
			title="Destructive zone"
			caption="Reserve the `danger` variant for irreversible actions. Pair with an outline danger button."
		>
			<SectionCard
				title="Delete workspace"
				icon="exclamation-triangle"
				variant="danger"
				action={<Button variant="danger" outline size="small">Delete</Button>}
			>
				<p style={{ margin: 0, color: '#475569' }}>
					Permanently deletes this workspace and all of its projects. This cannot be undone.
				</p>
			</SectionCard>
		</DemoSection>

		<DemoSection eyebrow="API" title="Usage">
			<CodeSnippet
				language="typescript"
				code={`import { SectionCard, Button } from '@toolcase/react-components'

<SectionCard
  title="API keys"
  icon="key"
  action={<Button size="small">New key</Button>}
>
  Active keys appear here.
</SectionCard>

<SectionCard
  title="Delete workspace"
  icon="exclamation-triangle"
  variant="danger"
  action={<Button variant="danger" outline size="small">Delete</Button>}
>
  Permanently deletes this workspace and all of its projects.
</SectionCard>`}
			/>
		</DemoSection>
	</DemoPage>
)

export default SectionCardDemo
