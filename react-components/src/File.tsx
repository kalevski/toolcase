import EditableText from './EditableText'
import FileTags, { FileTag } from './FileTags'
import { ActionItems, ActionItem } from './ActionItems'
import { Icon } from './Icon'
import toolcase from '@toolcase/base'

export interface FileFolder {
	id: string | null
	name: string
	createdAt?: number
}

export interface FileProps {
	key?: string
	readonly?: boolean
	format?: string
	extension?: string
	name?: string
	items?: number
	size?: number
	tagIds?: string[]
	tags?: FileTag[]
	menuItems?: ActionItem[]
	onNameChange?: (name: string) => void
	onTagsChange?: (tagIds: string[]) => void
	onMenuItemClick?: (key: string) => void
}

export const File: React.FC<FileProps> = ({
	readonly = false,
	format = 'unknown',
	extension = '_',
	name = '[FILE_NAME]',
	items = 0,
	size = 2000000,
	tagIds = [],
	tags = [],
	menuItems = [],
	onNameChange,
	onTagsChange,
	onMenuItemClick,
}) => {
	return (
		<div className="component component-file">
			<div className={`component-file__type file-bg__${format}`}>
				<span>{extension}</span>
			</div>
			<div className="component-file__label">
				<EditableText
					disabled={readonly}
					defaultValue={name}
					onChange={(e) => onNameChange?.((e.target as HTMLInputElement).value)}
				/>
				<div className="component-file__label__lists">
					<FileTags
						readonly={readonly}
						tags={tags}
						selectedIds={tagIds}
						onChange={onTagsChange}
					/>
				</div>
			</div>
			<div className="component-file__items">
				{items !== 0 ? (
					<a href="#">
						<span>{items}</span>
						<span className="icon icon--medium">
							<Icon name="file-binary" />
						</span>
					</a>
				) : null}
			</div>
			<div className="component-file__size">{toolcase.formatByteSize(size)}</div>
			{!readonly && menuItems.length > 0 && (
				<ActionItems items={menuItems} onActionClick={onMenuItemClick} />
			)}
		</div>
	)
}
