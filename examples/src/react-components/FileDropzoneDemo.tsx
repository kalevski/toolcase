import React from 'react'
import {
	FileDropzone,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const FileDropzoneDemo: React.FC = () => {
	const handleFiles = (files: File[]) => {
		alert(`Received ${files.length} file(s): ${Array.from(files).map((f) => f.name).join(', ')}`)
	}

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Media & Files</RichPageHeaderChip>}
				title="FileDropzone"
				description="A drag-and-drop file upload zone with supported format badges."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Image Uploads">
				<FileDropzone
					onFiles={handleFiles}
					supported={[
						{ type: 'PNG', mimetype: 'image/png', extension: '.png' },
						{ type: 'JPEG', mimetype: 'image/jpeg', extension: '.jpg' },
						{ type: 'WebP', mimetype: 'image/webp', extension: '.webp' },
					]}
				/>
			</SectionCard>

			<SectionCard title="Data Files">
				<FileDropzone
					onFiles={handleFiles}
					supported={[
						{ type: 'JSON', mimetype: 'application/json', extension: '.json' },
						{ type: 'CSV', mimetype: 'text/csv', extension: '.csv' },
						{ type: 'XML', mimetype: 'application/xml', extension: '.xml' },
					]}
				/>
			</SectionCard>

			<SectionCard title="No Format Restrictions">
				<FileDropzone onFiles={handleFiles} />
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default FileDropzoneDemo
