import React from 'react'
import { Avatar } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const AvatarDemo: React.FC = () => (
	<DemoPage
		eyebrow="Data Display"
		title="Avatar"
		lede="User avatars with image, initials fallback, sizing variants, and status indicators."
	>
		<DemoSection title="Avatar Sizes">
			<div className="d-flex flex-wrap align-items-center gap-3">
				<Avatar name="John Doe" size="small" />
				<Avatar name="Jane Smith" size="default" />
				<Avatar name="Bob Wilson" size="large" />
			</div>
		</DemoSection>

		<DemoSection title="Avatars with Images">
			<div className="d-flex flex-wrap align-items-center gap-3">
				<Avatar src="https://i.pravatar.cc/150?img=1" alt="User 1" name="Alice Johnson" />
				<Avatar src="https://i.pravatar.cc/150?img=2" alt="User 2" name="Bob Smith" size="large" />
				<Avatar src="https://i.pravatar.cc/150?img=3" alt="User 3" name="Charlie Brown" size="small" />
			</div>
		</DemoSection>

		<DemoSection title="Avatars with Initials (Fallback)">
			<div className="d-flex flex-wrap align-items-center gap-3">
				<Avatar name="John Doe" variant="primary" />
				<Avatar name="Jane Smith" variant="secondary" />
				<Avatar name="Bob Wilson" variant="success" />
				<Avatar name="Alice Johnson" variant="danger" />
				<Avatar name="Charlie Brown" variant="warning" />
				<Avatar name="Diana Prince" variant="info" />
			</div>
		</DemoSection>

		<DemoSection title="Avatars with Status Indicators">
			<div className="d-flex flex-wrap align-items-center gap-3 mb-4">
				<div className="text-center">
					<Avatar name="John Doe" status="online" />
					<small className="d-block mt-2 text-muted">Online</small>
				</div>
				<div className="text-center">
					<Avatar name="Jane Smith" status="offline" variant="secondary" />
					<small className="d-block mt-2 text-muted">Offline</small>
				</div>
				<div className="text-center">
					<Avatar name="Bob Wilson" status="busy" variant="danger" />
					<small className="d-block mt-2 text-muted">Busy</small>
				</div>
				<div className="text-center">
					<Avatar name="Alice Johnson" status="away" variant="warning" />
					<small className="d-block mt-2 text-muted">Away</small>
				</div>
			</div>
			<div className="d-flex flex-wrap align-items-center gap-3">
				<Avatar src="https://i.pravatar.cc/150?img=4" name="User 4" status="online" size="large" />
				<Avatar src="https://i.pravatar.cc/150?img=5" name="User 5" status="busy" size="large" />
				<Avatar src="https://i.pravatar.cc/150?img=6" name="User 6" status="away" size="large" />
			</div>
		</DemoSection>

		<DemoSection title="Avatar Placeholder States" caption="When no name or image is provided, a placeholder is shown.">
			<div className="d-flex flex-wrap align-items-center gap-3">
				<Avatar variant="primary" size="small" />
				<Avatar variant="secondary" />
				<Avatar variant="info" size="large" />
			</div>
		</DemoSection>

		<DemoSection title="Image Error Handling" caption="When image fails to load, it falls back to initials.">
			<div className="d-flex flex-wrap align-items-center gap-3">
				<Avatar src="https://invalid-url.example.com/image.jpg" name="John Doe" variant="primary" />
				<Avatar
					src="https://invalid-url.example.com/image2.jpg"
					name="Jane Smith"
					variant="success"
					size="large"
				/>
			</div>
		</DemoSection>

		<DemoSection title="Avatar in User Lists">
			<div className="list-group">
				<div className="list-group-item d-flex align-items-center gap-3">
					<Avatar name="John Doe" status="online" />
					<div>
						<div className="fw-bold">John Doe</div>
						<small className="text-muted">john.doe@example.com</small>
					</div>
				</div>
				<div className="list-group-item d-flex align-items-center gap-3">
					<Avatar name="Jane Smith" status="busy" variant="secondary" />
					<div>
						<div className="fw-bold">Jane Smith</div>
						<small className="text-muted">jane.smith@example.com</small>
					</div>
				</div>
				<div className="list-group-item d-flex align-items-center gap-3">
					<Avatar src="https://i.pravatar.cc/150?img=7" name="Bob Wilson" status="away" />
					<div>
						<div className="fw-bold">Bob Wilson</div>
						<small className="text-muted">bob.wilson@example.com</small>
					</div>
				</div>
			</div>
		</DemoSection>
	</DemoPage>
)

export default AvatarDemo
