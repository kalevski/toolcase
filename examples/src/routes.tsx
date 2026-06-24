import { JSX, ReactNode } from 'react'
import { Home } from './pages/Home'
import { Apps } from './pages/Apps'
import { Skills } from './pages/Skills'
import { BasePage } from './pages/BasePage'
import { LoggingPage } from './pages/LoggingPage'
import { SerializerPage } from './pages/SerializerPage'
import { WebComponentsPage } from './pages/WebComponentsPage'
import { PhaserPlusPage } from './pages/PhaserPlusPage'
import { NodePage } from './pages/NodePage'
import { baseExamples } from './base/index'
import { loggingExamples } from './logging/index'
import { serializerExamples } from './serializer/index'
import { webComponentExamples } from './web-components/index'
import { phaserExamples } from './phaser-plus/index'
import { nodeExamples } from './node/index'

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
    {
        key: 'web-components',
        basePath: '/web-components',
        indexLabel: 'All Web Components',
        page: <WebComponentsPage />,
        examples: webComponentExamples.map((e) => ({
            key: e.key,
            title: formatLabel(e.key),
            element: e.element,
        })),
    },
    {
        key: 'node',
        basePath: '/node',
        indexLabel: 'All Node Helpers',
        page: <NodePage />,
        examples: nodeExamples.map((e) => ({
            key: e.key,
            title: e.label,
            element: e.element,
        })),
    },
]

export const topPages = {
    home: <Home />,
    apps: <Apps />,
    skills: <Skills />,
}
