import React from 'react'
import { Tag } from './Tag'
import { Badge } from './Badge'
import { Switch } from './Switch'
import { Icon } from './Icon'
import { ActionItems, ActionItem } from './ActionItems'
import { Skeleton } from './Skeleton'
import { ProgressBar } from './ProgressBar'

export type AssetBundleEngine = 'unity' | 'godot' | 'unreal' | 'phaser' | 'pixijs' | 'custom'              // Unreal

export interface AssetBundleAdvancedOptions {
	/** Scale percentage (1–100) */
	scale?: number
	/** Whether rotation is enabled for packing */
	rotationEnabled?: boolean
	/** Packing algorithm — available set depends on target engine */
	algorithm?: string
}

export interface AssetBundleProps {
	/** Display name of the asset bundle */
	name: string
	/** Target game engine */
	target: string
	/** Override icon for the target engine (Bootstrap Icon name) */
	targetIcon?: string
	/** Selected category — when undefined all categories are included */
	category?: string
	/** Tags that are included in this bundle */
	includedTags?: string[]
	/** Tags that are excluded from this bundle */
	excludedTags?: string[]
	/** The single default build tag */
	defaultBuildTag?: string
	/** Number of included files by type — keys are dynamic (e.g. "textures", "sounds") */
	counts?: Record<string, number>
	/** Latest build reference (e.g. commit hash, build number) */
	latestBuildRef?: string
	/** Build tag associated with the latest build */
	buildTag?: string
	/** Advanced packing options */
	advanced?: AssetBundleAdvancedOptions
	/** Action menu items */
	menuItems?: ActionItem[]
	/** Callback when an action menu item is clicked */
	onMenuItemClick?: (key: string) => void
	/** Additional class name */
	className?: string

    onBuildClick?: () => void
	loading?: boolean
}

const fileTypeIcons: Record<string, string> = {
	textures: 'image',
	sounds: 'music-note-beamed',
	fonts: 'fonts',
	configs: 'file-earmark-code',
	dialogues: 'chat-left-text',
	animations: 'film',
	models: 'box',
	scripts: 'file-earmark-binary',
	shaders: 'lightning',
	materials: 'palette',
	prefabs: 'layers',
	scenes: 'grid-3x3',
	maps: 'map',
	data: 'database',
}

function fileTypeIcon(type: string): string {
	return fileTypeIcons[type.toLowerCase()] ?? 'file-earmark'
}

export const AssetBundle: React.FC<AssetBundleProps> = ({
	name,
	target,
	targetIcon,
	category,
	includedTags = [],
	excludedTags = [],
	defaultBuildTag,
	counts = {},
	latestBuildRef,
	buildTag,
	advanced = {},
	menuItems = [],
	onMenuItemClick,
	onBuildClick,
	className = '',
	loading = false,
}) => {
	const { scale = 100, rotationEnabled = false, algorithm } = advanced
	const fileEntries = Object.entries(counts)
	const totalFiles = fileEntries.reduce((sum, [, n]) => sum + n, 0)

	const rootClass = [
		'component component-asset-bundle',
		className,
	].filter(Boolean).join(' ')

	if (loading) {
		return (
			<div className={rootClass}>
				<div className="component-asset-bundle__header">
					<Skeleton variant="circle" width="2.5rem" height="2.5rem" />
					<div className="component-asset-bundle__title-group">
						<Skeleton width="50%" />
						<Skeleton width="30%" />
					</div>
				</div>
				<div className="component-asset-bundle__divider" />
				<div className="component-asset-bundle__section">
					<Skeleton count={3} />
				</div>
				<div className="component-asset-bundle__divider" />
				<div className="component-asset-bundle__section">
					<Skeleton count={2} />
				</div>
			</div>
		)
	}

	return (
		<div className={rootClass}>
			{/* ── Header ── */}
			<div className="component-asset-bundle__header">
				<div className="component-asset-bundle__engine-icon">
					<Icon name={targetIcon || 'gear'} />
				</div>
				<div className="component-asset-bundle__title-group">
					<span className="component-asset-bundle__name">{name}</span>
					<Badge variant="secondary" pill>{target}</Badge>
				</div>
				{menuItems.length > 0 && (
					<ActionItems items={menuItems} onActionClick={onMenuItemClick} />
				)}
			</div>

			{/* ── Divider ── */}
			<div className="component-asset-bundle__divider" />

			{/* ── Tags section ── */}
			<div className="component-asset-bundle__section">
				{/* Category */}
				<div className="component-asset-bundle__row">
					<span className="component-asset-bundle__row-label">
						<Icon name="grid" />
						Category
					</span>
					{category ? (
						<Badge variant="info" pill>{category}</Badge>
					) : (
						<Badge variant="primary" pill>All Categories</Badge>
					)}
				</div>

				{/* Default build tag */}
				{defaultBuildTag && (
					<div className="component-asset-bundle__row">
						<span className="component-asset-bundle__row-label">
							<Icon name="tag-fill" />
							Build Tag
						</span>
						<Tag variant="primary">{defaultBuildTag}</Tag>
					</div>
				)}

				<div className="component-asset-bundle__row">
                    <span className="component-asset-bundle__row-label">
                        <Icon name="plus-circle" />
                        Included
                    </span>
                    <div className="component-asset-bundle__tag-list">
                        {includedTags.map((t) => (
                            <Tag key={t} variant="success">{t}</Tag>
                        ))}
                    </div>
                </div>

				<div className="component-asset-bundle__row">
                    <span className="component-asset-bundle__row-label">
                        <Icon name="dash-circle" />
                        Excluded
                    </span>
                    <div className="component-asset-bundle__tag-list">
                        {excludedTags.map((t) => (
                            <Tag key={t} variant="danger">{t}</Tag>
                        ))}
                    </div>
                </div>

				<div className="component-asset-bundle__row">
                    <span className="component-asset-bundle__row-label">
                        <Icon onClick={onBuildClick} name="box-arrow-up-right" />
                        Build Ref
                    </span>
                    <span className="component-asset-bundle__build-ref">
                        <code>{latestBuildRef}</code>
                        {buildTag && <Tag variant="info">{buildTag}</Tag>}
                    </span>
                </div>
			</div>

			{/* ── File counts ── */}
			{fileEntries.length > 0 && (
				<>
					<div className="component-asset-bundle__divider" />
					<div className="component-asset-bundle__section">
						<span className="component-asset-bundle__section-title">
							<Icon name="files" />
							Files
							<Badge variant="secondary" pill>{totalFiles}</Badge>
						</span>
						<div className="component-asset-bundle__tag-list">
							{fileEntries.map(([type, count]) => (
								<Tag key={type} variant="secondary">
									<Icon name={fileTypeIcon(type)} decorative /> {type} {count}
								</Tag>
							))}
						</div>
					</div>
				</>
			)}

			{/* ── Advanced options ── */}
			<div className="component-asset-bundle__divider" />
			<div className="component-asset-bundle__section component-asset-bundle__advanced">
				<span className="component-asset-bundle__section-title">
					<Icon name="sliders" />
					Advanced
				</span>

				<div className="component-asset-bundle__options-grid">
					{/* Scale */}
					<ProgressBar label="Scale" value={scale} />

					{/* Rotation */}
					<div className="component-asset-bundle__option">
						<span className="component-asset-bundle__option-label">Rotation</span>
						<Switch checked={rotationEnabled} readOnly size="small" />
					</div>

					{/* Algorithm */}
					{algorithm && (
						<div className="component-asset-bundle__option">
							<span className="component-asset-bundle__option-label">Algorithm</span>
							<Badge variant="secondary">{algorithm}</Badge>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
