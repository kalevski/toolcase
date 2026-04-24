import React from 'react'
import { FileDropzone } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const FileDropzoneDemo: React.FC = () => {
	const handleFiles = (files: File[]) => {
		alert(`Received ${files.length} file(s): ${Array.from(files).map((f) => f.name).join(', ')}`)
	}

	return (
		<DemoPage
			eyebrow="Media & Files"
			title="FileDropzone"
			lede="A drag-and-drop file upload zone with supported format badges."
		>
			<DemoSection title="Image Uploads">
				<FileDropzone
					onFiles={handleFiles}
					supported={[
						{ type: 'PNG', mimetype: 'image/png', extension: '.png' },
						{ type: 'JPEG', mimetype: 'image/jpeg', extension: '.jpg' },
						{ type: 'WebP', mimetype: 'image/webp', extension: '.webp' },
					]}
				/>
			</DemoSection>

			<DemoSection title="Data Files">
				<FileDropzone
					onFiles={handleFiles}
					supported={[
						{ type: 'JSON', mimetype: 'application/json', extension: '.json' },
						{ type: 'CSV', mimetype: 'text/csv', extension: '.csv' },
						{ type: 'XML', mimetype: 'application/xml', extension: '.xml' },
					]}
				/>
			</DemoSection>

			<DemoSection title="No Format Restrictions">
				<FileDropzone onFiles={handleFiles} />
			</DemoSection>
		</DemoPage>
	)
}

export default FileDropzoneDemo
