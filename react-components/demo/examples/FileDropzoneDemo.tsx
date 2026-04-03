import React from 'react'
import { FileDropzone, Card, CodeSnippet } from '../../src'

const FileDropzoneDemo: React.FC = () => {
	const handleFiles = (files: File[]) => {
		alert(`Received ${files.length} file(s): ${Array.from(files).map((f) => f.name).join(', ')}`)
	}

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">FileDropzone</h1>
					<p className="text-muted mb-0">A drag-and-drop file upload zone with supported format badges.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Image Uploads</h2>
						<FileDropzone
							onFiles={handleFiles}
							supported={[
								{ type: 'PNG', mimetype: 'image/png', extension: '.png' },
								{ type: 'JPEG', mimetype: 'image/jpeg', extension: '.jpg' },
								{ type: 'WebP', mimetype: 'image/webp', extension: '.webp' },
							]}
						/>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Data Files</h2>
						<FileDropzone
							onFiles={handleFiles}
							supported={[
								{ type: 'JSON', mimetype: 'application/json', extension: '.json' },
								{ type: 'CSV', mimetype: 'text/csv', extension: '.csv' },
								{ type: 'XML', mimetype: 'application/xml', extension: '.xml' },
							]}
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">No Format Restrictions</h2>
						<FileDropzone onFiles={handleFiles} />
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
							code={`import { FileDropzone } from '@webgame-cloud/react-components'

<FileDropzone
  accept=".png,.jpg,.gif"
  maxSize={5 * 1024 * 1024}
  onFilesSelected={handleFiles}
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default FileDropzoneDemo
