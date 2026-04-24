import React, { useState } from 'react'
import {
    File,
    RichPageHeader,
    RichPageHeaderChip,
    SectionCard,
} from '@toolcase/react-components'

const availableTags = [
    { id: 'hero', name: 'hero', color: '#3b82f6' },
    { id: 'enemy', name: 'enemy', color: '#ef4444' },
    { id: 'level-1', name: 'level-1', color: '#10b981' },
    { id: 'wip', name: 'wip', color: '#f59e0b' },
]

const FileDemo: React.FC = () => {
    const [name, setName] = useState('hero-idle.png')
    const [tagIds, setTagIds] = useState<string[]>(['hero', 'level-1'])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Media & Files</RichPageHeaderChip>}
                        title="File"
                        description="Single file row with an extension badge, inline-editable name, tags, item count, and a size readout. Use inside a Group for asset managers."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Editable">
                            <File
                                name={name}
                                extension="png"
                                format="image"
                                size={18432}
                                tagIds={tagIds}
                                tags={availableTags}
                                onNameChange={setName}
                                onTagsChange={setTagIds}
                                menuItems={[
                                    { key: 'duplicate', label: 'Duplicate', icon: 'files' },
                                    { key: 'delete', label: 'Delete', icon: 'trash' },
                                ]}
                                onMenuItemClick={(key) => console.log('menu:', key)}
                            />
                        </SectionCard>

                        <SectionCard title="Readonly with items">
                            <File
                                readonly
                                name="theme.ogg"
                                extension="ogg"
                                format="audio"
                                size={51200}
                                items={12}
                            />
                        </SectionCard>

                        <SectionCard title="Loading">
                            <File loading />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FileDemo
