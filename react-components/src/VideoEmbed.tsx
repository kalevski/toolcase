import React from 'react'

export interface VideoEmbedProps extends React.HTMLAttributes<HTMLDivElement> {
	src: string
	poster?: string
	aspectRatio?: number
	autoplay?: boolean
	loop?: boolean
	muted?: boolean
	controls?: boolean
	title?: string
}

const isEmbed = (src: string): boolean =>
	/youtube\.com|youtu\.be|vimeo\.com|loom\.com/.test(src)

export const VideoEmbed: React.FC<VideoEmbedProps> = ({
	src,
	poster,
	aspectRatio = 16 / 9,
	autoplay = false,
	loop = false,
	muted = false,
	controls = true,
	title,
	className = '',
	...rest
}) => {
	const rootClass = `component component-video-embed ${className}`.trim()
	const style = { '--ve-aspect': `${aspectRatio}` } as React.CSSProperties

	return (
		<div className={rootClass} style={style} {...rest}>
			{isEmbed(src) ? (
				<iframe
					src={src}
					title={title ?? 'Video'}
					className="component-video-embed__frame"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowFullScreen
					loading="lazy"
				/>
			) : (
				<video
					src={src}
					poster={poster}
					autoPlay={autoplay}
					loop={loop}
					muted={muted}
					controls={controls}
					playsInline
					className="component-video-embed__video"
					title={title}
				/>
			)}
		</div>
	)
}

export default VideoEmbed
