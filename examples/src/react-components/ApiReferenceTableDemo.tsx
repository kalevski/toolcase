import React from 'react'
import { ApiReferenceTable, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ApiReferenceTableDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Features & API</RichPageHeaderChip>}
					title="ApiReferenceTable"
					description="Compact API surface listing function signatures and descriptions."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Grouped">
						<ApiReferenceTable
							groups={[
								{
									title: 'Server',
									items: [
										{ name: 'createServer', signature: '(opts?: ServerOptions) => Server', returns: 'Server', description: 'Create an HTTP server instance.', since: '2.0' },
										{ name: 'listen', signature: '(port: number) => Promise<void>', description: 'Start listening for connections.', since: '2.0' },
									],
								},
								{
									title: 'Client',
									items: [
										{ name: 'connect', signature: '(url: string) => Promise<Client>', returns: 'Client', description: 'Connect to a remote server.', since: '2.1' },
										{ name: 'request', signature: '(opts: RequestOptions) => Promise<Response>', deprecated: true, description: 'Send a single request — use `fetch()` instead.' },
									],
								},
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default ApiReferenceTableDemo
