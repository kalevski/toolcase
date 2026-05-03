import { JSX, ReactNode } from 'react'
import { Home } from './pages/Home'
import { Apps } from './pages/Apps'
import { BasePage } from './pages/BasePage'
import { LoggingPage } from './pages/LoggingPage'
import { SerializerPage } from './pages/SerializerPage'
import { ReactComponentsPage } from './pages/ReactComponentsPage'
import { GameComponentsPage } from './pages/GameComponentsPage'
import { PhaserPlusPage } from './pages/PhaserPlusPage'
import { baseExamples } from './base/index'
import { loggingExamples } from './logging/index'
import { serializerExamples } from './serializer/index'
import { examples as reactComponentExamples } from './react-components/index'
import { gameComponentExamples } from './game-components/index'
import { phaserExamples } from './phaser-plus/index'

export type DemoEntry = {
    key: string
    title: string
    element: JSX.Element
    extraHeader?: ReactNode
}

export type PackageRoute = {
    key: string
    basePath: string
    indexLabel: string
    page: JSX.Element
    examples: DemoEntry[]
    canvasClassName?: string
}

const formatLabel = (key: string) =>
    key.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export const packageRoutes: PackageRoute[] = [
    {
        key: 'base',
        basePath: '/base',
        indexLabel: 'All Base Examples',
        page: <BasePage />,
        examples: baseExamples.map((e) => ({
            key: e.key,
            title: e.label,
            element: e.element,
        })),
    },
    {
        key: 'logging',
        basePath: '/logging',
        indexLabel: 'All Logging Examples',
        page: <LoggingPage />,
        examples: loggingExamples.map((e) => ({
            key: e.key,
            title: e.label,
            element: e.element,
        })),
    },
    {
        key: 'serializer',
        basePath: '/serializer',
        indexLabel: 'All Serializer Examples',
        page: <SerializerPage />,
        examples: serializerExamples.map((e) => ({
            key: e.key,
            title: e.label,
            element: e.element,
        })),
    },
    {
        key: 'react-components',
        basePath: '/react-components',
        indexLabel: 'All Components',
        page: <ReactComponentsPage />,
        examples: reactComponentExamples.map((e) => ({
            key: e.key,
            title: formatLabel(e.key),
            element: e.element,
        })),
    },
    {
        key: 'game-components',
        basePath: '/game-components',
        indexLabel: 'All Game Components',
        page: <GameComponentsPage />,
        examples: gameComponentExamples.map((e) => ({
            key: e.key,
            title: formatLabel(e.key),
            element: e.element,
        })),
    },
    {
        key: 'phaser-plus',
        basePath: '/phaser-plus',
        indexLabel: 'All Phaser+ Demos',
        page: <PhaserPlusPage />,
        canvasClassName: 'phaser-canvas-wrapper',
        examples: phaserExamples.map((e) => ({
            key: e.key,
            title: e.title,
            element: e.element,
            extraHeader: <code>{e.sceneFile}</code>,
        })),
    },
]

export const topPages = {
    home: <Home />,
    apps: <Apps />,
}
