import React, { useState } from 'react'

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
	fallback?: React.ReactNode
	aspectRatio?: string
	objectFit?: 'cover' | 'contain' | 'fill' | 'none'
}

export const Image: React.FC<ImageProps> = ({
	fallback,
	aspectRatio,
	objectFit = 'cover',
	className = '',
	alt = '',
	onError,
	onLoad,
	...props
}) => {
	const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')

	const rootClass = [
		'component component-image',
		`component-image--${status}`,
		className,
	].filter(Boolean).join(' ')

	const wrapperStyle: React.CSSProperties = {
		aspectRatio,
	}

	const imgStyle: React.CSSProperties = {
		objectFit,
	}

	return (
		<div className={rootClass} style={wrapperStyle}>
			{status === 'loading' && (
				<div className="component-image__loading">
					<span className="component-image__shimmer" />
				</div>
			)}
			{status === 'error' && fallback ? (
				<div className="component-image__fallback">{fallback}</div>
			) : (
				<img
					{...props}
					alt={alt}
					style={imgStyle}
					className="component-image__img"
					onLoad={(e) => {
						setStatus('loaded')
						onLoad?.(e)
					}}
					onError={(e) => {
						setStatus('error')
						onError?.(e)
					}}
				/>
			)}
		</div>
	)
}
