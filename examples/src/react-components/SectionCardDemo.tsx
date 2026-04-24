import React from 'react'
import {
	Button,
	FormInput,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const SectionCardDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Layout & Surfaces</RichPageHeaderChip>}
				title="SectionCard"
				description={
			<>
				An opinionated titled card for settings and detail pages. The header row holds an icon
				tile, a title, and an optional <code>action</code> slot (usually a button). The body is a
				free-form children region. A <code>danger</code> variant tints the chrome red for
				destructive zones.
			</>
		}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Titled card with icon">
			<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'}}>
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
			</div>
		</SectionCard>

		<SectionCard title="Header-right control">
			<SectionCard
				title="API keys"
				icon="key"
				action={<Button size="small">New key</Button>}
			>
				<p style={{ margin: 0, color: '#475569' }}>
					Active keys appear here. Rotating a key invalidates the previous value immediately.
				</p>
			</SectionCard>
		</SectionCard>

		<SectionCard title="Forms inside">
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
		</SectionCard>

		<SectionCard title="Destructive zone">
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
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default SectionCardDemo
