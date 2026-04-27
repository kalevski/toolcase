import React from 'react'
import { TerminalWindow, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const TerminalWindowDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Hero & Above-the-fold</RichPageHeaderChip>}
					title="TerminalWindow"
					description="Faux terminal with macOS chrome, prompts, and optional typing animation."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Static">
						<TerminalWindow
							title="~/projects/my-app"
							lines={[
								{ kind: 'comment', text: '# Install the package' },
								{ kind: 'input', text: 'npm install @your/package' },
								{ kind: 'output', text: 'added 12 packages in 2.4s' },
								{ kind: 'input', text: 'node app.js' },
								{ kind: 'output', text: '✔ server listening on http://localhost:3000' },
							]}
						/>
					</SectionCard>
					<SectionCard title="Animated typing">
						<TerminalWindow
							animateTyping
							lines={[
								{ kind: 'input', text: 'curl https://api.example.com' },
								{ kind: 'output', text: '{ "status": "ok" }' },
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default TerminalWindowDemo
