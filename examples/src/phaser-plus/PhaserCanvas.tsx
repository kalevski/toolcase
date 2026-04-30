import { useEffect, useRef } from 'react'
import { AUTO, Game, Scale, Types, WEBGL, type Core } from 'phaser'
import { installEffects, Scene } from '@toolcase/phaser-plus'

interface PhaserCanvasProps {
    sceneClass: new () => Scene
    width?: number
    height?: number
}

export const PhaserCanvas = ({ sceneClass, width = 1280, height = 720 }: PhaserCanvasProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const gameRef = useRef<Game | null>(null)

    useEffect(() => {
        const parent = containerRef.current
        if (!parent) return

        const config: Types.Core.GameConfig = {
            type: WEBGL,
            parent,
            scale: {
                mode: Scale.NONE,
            },
            physics: {
                default: 'matter',
                matter: {
                    debug: true
                }
            },
            dom: {
                createContainer: true
            },
            antialias: true,
            width,
            height
        }

        const game = new Game(config)
        gameRef.current = game
        installEffects(game)
        game.scene.add('default', new sceneClass())
        game.scene.start('default')

        return () => {
            game.destroy(true)
            gameRef.current = null
        }
    }, [sceneClass, width, height])

    return <div ref={containerRef} className="phaser-canvas" />
}
