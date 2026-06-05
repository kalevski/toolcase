import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ImageCropProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onCrop' | 'onError'> {
	src: string
	/** Fixed aspect ratio (width/height). Undefined = free-form */
	aspectRatio?: number
	/** Render circular crop mask */
	circular?: boolean
	/** Called with the cropped image as a Blob */
	onCrop: (blob: Blob) => void
	/** Called when the source image fails to load or the canvas cannot export */
	onError?: (error: Error) => void
	className?: string
}

interface CropState {
	x: number
	y: number
	scale: number
}

// ── Component ──────────────────────────────────────────────────────────────────

export const ImageCrop: React.FC<ImageCropProps> = ({
	src,
	aspectRatio,
	circular = false,
	onCrop,
	onError,
	className = '',
	...rest
}) => {
	const canvasRef      = useRef<HTMLCanvasElement>(null)
	const containerRef   = useRef<HTMLDivElement>(null)
	const imageRef       = useRef<HTMLImageElement | null>(null)
	const [loaded, setLoaded] = useState(false)
	const [loadError, setLoadError] = useState(false)
	const [state, setState]   = useState<CropState>({ x: 0, y: 0, scale: 1 })

	const dragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 })

	const onErrorRef = useRef(onError)
	onErrorRef.current = onError

	// Load image
	useEffect(() => {
		setLoaded(false)
		setLoadError(false)
		let cancelled = false
		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.onload = () => {
			if (cancelled) return
			imageRef.current = img
			setLoaded(true)
		}
		// A CORS-blocked or missing image used to fail silently (blank canvas
		// forever) — surface it instead.
		img.onerror = () => {
			if (cancelled) return
			setLoadError(true)
			onErrorRef.current?.(new Error(`ImageCrop: failed to load image "${src}"`))
		}
		img.src = src
		return () => { cancelled = true }
	}, [src])

	// Draw canvas
	useEffect(() => {
		if (!loaded || !canvasRef.current || !imageRef.current) return
		const canvas = canvasRef.current
		const ctx    = canvas.getContext('2d')
		if (!ctx) return

		const img    = imageRef.current
		const W      = canvas.width
		const H      = canvas.height
		const scale  = state.scale
		const dx     = state.x
		const dy     = state.y

		const drawW  = img.naturalWidth  * scale
		const drawH  = img.naturalHeight * scale
		const offX   = (W - drawW) / 2 + dx
		const offY   = (H - drawH) / 2 + dy

		ctx.clearRect(0, 0, W, H)

		// Checkerboard background
		ctx.fillStyle = '#e2e8f0'
		ctx.fillRect(0, 0, W, H)

		// Clip to circle if requested
		if (circular) {
			ctx.save()
			ctx.beginPath()
			ctx.arc(W / 2, H / 2, Math.min(W, H) / 2 - 2, 0, Math.PI * 2)
			ctx.clip()
		}

		ctx.drawImage(img, offX, offY, drawW, drawH)

		if (circular) ctx.restore()

		// Overlay border
		ctx.strokeStyle = '#3b82f6'
		ctx.lineWidth   = 2
		if (circular) {
			ctx.beginPath()
			ctx.arc(W / 2, H / 2, Math.min(W, H) / 2 - 2, 0, Math.PI * 2)
			ctx.stroke()
		} else {
			ctx.strokeRect(1, 1, W - 2, H - 2)
		}
	}, [loaded, state, circular])

	// Pointer events for panning
	const handlePointerDown = (e: React.PointerEvent) => {
		// setPointerCapture throws if the pointer is already gone (fast tap) —
		// the drag still works without capture, so don't let it crash.
		try {
			(e.target as HTMLElement).setPointerCapture(e.pointerId)
		} catch { /* ignore */ }
		dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, origX: state.x, origY: state.y }
	}
	const handlePointerMove = (e: React.PointerEvent) => {
		if (!dragRef.current.active) return
		const dx = e.clientX - dragRef.current.startX
		const dy = e.clientY - dragRef.current.startY
		setState((s) => ({ ...s, x: dragRef.current.origX + dx, y: dragRef.current.origY + dy }))
	}
	const handlePointerUp = () => { dragRef.current.active = false }

	// Wheel to zoom
	const handleWheel = (e: React.WheelEvent) => {
		e.preventDefault()
		setState((s) => ({ ...s, scale: Math.max(0.1, Math.min(5, s.scale - e.deltaY * 0.001)) }))
	}

	// Crop action
	const handleCrop = useCallback(() => {
		if (!canvasRef.current) return
		canvasRef.current.toBlob((blob) => {
			if (blob) {
				onCrop(blob)
			} else {
				// null blob = tainted canvas (image served without CORS headers)
				onErrorRef.current?.(new Error('ImageCrop: canvas export failed (tainted canvas?)'))
			}
		}, 'image/png')
	}, [onCrop])

	// Reset
	const handleReset = () => setState({ x: 0, y: 0, scale: 1 })

	// Canvas dimensions (respect aspect ratio)
	const W = 320
	const H = aspectRatio ? Math.round(W / aspectRatio) : 320

	const rootClass = [
		'component component-image-crop',
		circular ? 'component-image-crop--circular' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={rootClass} ref={containerRef} {...rest}>
			<canvas
				ref={canvasRef}
				className="component-image-crop__canvas"
				width={W}
				height={H}
				aria-label="Image crop area. Drag to reposition, scroll to zoom."
				role="img"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
				onWheel={handleWheel}
			/>

			{loadError && (
				<div className="component-image-crop__error" role="alert">
					Failed to load image.
				</div>
			)}

			<div className="component-image-crop__controls">
				<div className="component-image-crop__zoom">
					<button
						type="button"
						className="component-image-crop__zoom-btn"
						aria-label="Zoom out"
						onClick={() => setState((s) => ({ ...s, scale: Math.max(0.1, s.scale - 0.1) }))}
					>
						<Icon name="dash" />
					</button>
					<span className="component-image-crop__zoom-value">{Math.round(state.scale * 100)}%</span>
					<button
						type="button"
						className="component-image-crop__zoom-btn"
						aria-label="Zoom in"
						onClick={() => setState((s) => ({ ...s, scale: Math.min(5, s.scale + 0.1) }))}
					>
						<Icon name="plus" />
					</button>
				</div>

				<div className="component-image-crop__actions">
					<Button variant="secondary" size="small" onClick={handleReset}>
						Reset
					</Button>
					<Button variant="primary" size="small" onClick={handleCrop}>
						Crop
					</Button>
				</div>
			</div>
		</div>
	)
}
