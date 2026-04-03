import React, { useEffect, useRef } from 'react'
import Dropzone from 'dropzone'

export type DropzoneFileFormat = {
	type: string
	mimetype: string
	extension: string
}

export interface FileDropzoneProps {
	className?: string
	onFiles?: (files: File[]) => void
	supported?: DropzoneFileFormat[]
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({ className = '', onFiles, supported = [] }) => {
	let dropzoneRef = useRef<HTMLDivElement>(null)

	let dropzone: Dropzone | null = null
	const accept = supported.map((format) => format.mimetype)

	useEffect(() => {
		if (dropzoneRef.current) {
			dropzone = new Dropzone(dropzoneRef.current, {
				url: '/',
				uploadMultiple: false,
				autoQueue: false,
				previewsContainer: false,
				acceptedFiles: accept.join(','),
			})

			dropzone.on('addedfiles', (files: File[]) => {
				if (onFiles) onFiles(files)
			})
		}
		return () => {
			if (dropzone) dropzone.destroy()
		}
	}, [accept, onFiles])

	return (
		<div className={`component component-file-dropzone ${className}`}>
			<div ref={dropzoneRef} className="component-file-dropzone__dropzone">
				<div className="component-file-dropzone__upload_text">
					Drop files here <b>or</b> Click to upload
				</div>
				<p>Supported formats</p>
				<div className="component-file-dropzone__supported-formats">
					{supported.map((format) => (
						<div
							key={format.type + format.extension}
							className={`component-file-dropzone__format file-bg__${format.type}`}
						>
							<span>{format.extension.toUpperCase()}</span>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

export default Dropzone
