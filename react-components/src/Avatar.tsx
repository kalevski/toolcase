import React from 'react'

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
	src?: string
	alt?: string
	name?: string
	size?: 'small' | 'default' | 'large'
	status?: 'online' | 'offline' | 'busy' | 'away'
	variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
}

const getInitials = (name: string): string => {
	const parts = name.trim().split(/\s+/)
	if (parts.length === 0) return '?'
	if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const Avatar: React.FC<AvatarProps> = ({
	src,
	alt,
	name,
	size = 'default',
	status,
	variant = 'primary',
	...props
}) => {
	const [imageError, setImageError] = React.useState(false)
	const [imageLoaded, setImageLoaded] = React.useState(false)

	React.useEffect(() => {
		setImageError(false)
		setImageLoaded(false)
	}, [src])

	const handleImageError = () => {
		setImageError(true)
	}

	const handleImageLoad = () => {
		setImageLoaded(true)
	}

	const showImage = src && !imageError
	const showInitials = !showImage && name
	const showPlaceholder = !showImage && !name

	let avatarClass = `${props.className || ''} component component-avatar avatar avatar-${size}`
	if (!showImage) {
		avatarClass += ` avatar-initials bg-${variant}`
	}

	const initials = name ? getInitials(name) : '?'

	return (
		<div {...props} className={avatarClass.trim()}>
			{showImage && (
				<img
					src={src}
					alt={alt || name || 'Avatar'}
					onError={handleImageError}
					onLoad={handleImageLoad}
					className={`avatar-img ${imageLoaded ? 'loaded' : ''}`}
				/>
			)}
			{showInitials && <span className="avatar-initials-text">{initials}</span>}
			{showPlaceholder && <span className="avatar-placeholder">?</span>}
			{status && <span className={`avatar-status avatar-status-${status}`} />}
		</div>
	)
}
