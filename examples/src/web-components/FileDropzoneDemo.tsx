import React, { useState } from 'react'
import { useTc, useTcEvents } from '@toolcase/web-components/react'

const SUPPORTED_FORMATS = [
    { label: 'PNG', mime: 'image/png', extension: '.png' },
    { label: 'JPG', mime: 'image/jpeg', extension: '.jpg' },
    { label: 'PDF', mime: 'application/pdf', extension: '.pdf' },
    { label: 'CSV', mime: 'text/csv', extension: '.csv' },
]

const FileDropzoneDemo: React.FC = () => {
    const [droppedFiles, setDroppedFiles] = useState<string[]>([])

    const withFormatsRef = useTc<HTMLElement>(
        { supported: SUPPORTED_FORMATS },
        {
            'tc-files': (e: Event) => {
                const { files } = (e as CustomEvent<{ files: File[] }>).detail
                const names = files.map(
                    (f: File) => `${f.name} (${(f.size / 1024).toFixed(1)} KB)`,
                )
                setDroppedFiles(names)
                console.log('tc-files:', files)
            },
        },
    )
    const plainRef = useTcEvents<HTMLElement>({
        'tc-files': (e: Event) => {
            const { files } = (e as CustomEvent<{ files: File[] }>).detail
            console.log('tc-files (plain):', files)
        },
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="FileDropzone"
                            description="Drag-and-drop upload zone with optional supported-format chips. Fires tc-files with the selected File array on both drop and native file-picker selection."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="With supported formats">
                                {/* @ts-ignore */}
                                <tc-file-dropzone ref={withFormatsRef} />
                                {droppedFiles.length > 0 && (
                                    <div className="form-text mt-2">
                                        Files received: {droppedFiles.join(', ')}
                                    </div>
                                )}
                            </tc-section-card>

                            <tc-section-card title="No format restriction">
                                {/* @ts-ignore */}
                                <tc-file-dropzone ref={plainRef} />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FileDropzoneDemo
