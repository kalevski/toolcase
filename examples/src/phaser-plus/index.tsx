import { JSX } from 'react'
import { PhaserCanvas } from './PhaserCanvas'

import HelloWorld from './scenes/HelloWorld.js'
import SceneLifecycle from './scenes/SceneLifecycle.js'
import Services from './scenes/Services.js'
import CreateGameObjects from './scenes/CreateGameObjects.js'
import CreatePhysicsObjects from './scenes/CreatePhysicsObjects.js'
import AbsolutePosition from './scenes/AbsolutePosition.js'
import ObjectPooling from './scenes/ObjectPooling.js'
import SceneLayers from './scenes/SceneLayers.js'
import LayerBackground from './scenes/LayerBackground.js'
import LayerDepth from './scenes/LayerDepth.js'
import SplitScreenDemo from './scenes/SplitScreenDemo.js'
import FeatureCommunication from './scenes/FeatureCommunication.js'
import HTMLOverlay from './scenes/HTMLOverlay.js'
import Debugging from './scenes/Debugging.js'
import CustomDebugPanel from './scenes/CustomDebugPanel.js'
import PerformancePanelDemo from './scenes/PerformancePanelDemo.js'
import MemoryPanelDemo from './scenes/MemoryPanelDemo.js'
import TimelinePanelDemo from './scenes/TimelinePanelDemo.js'
import InputPanelDemo from './scenes/InputPanelDemo.js'
import AudioPanelDemo from './scenes/AudioPanelDemo.js'
import NetPanelDemo from './scenes/NetPanelDemo.js'
import ConsoleCommandsDemo from './scenes/ConsoleCommandsDemo.js'
import HotReloadDemo from './scenes/HotReloadDemo.js'
import RemoteDebuggerDemo from './scenes/RemoteDebuggerDemo.js'
import GameEvents from './scenes/GameEvents.js'
import TimeEvents from './scenes/TimeEvents.js'
import TimerControl from './scenes/TimerControl.js'
import JobQueue from './scenes/JobQueue.js'
import CollisionEvents from './scenes/CollisionEvents.js'
import ISOScene from './scenes/ISOScene.js'
import ISOMovement from './scenes/ISOMovement.js'
import WorldReset from './scenes/WorldReset.js'
import Effects from './scenes/Effects.js'
import PathFinderDemo from './scenes/PathFinderDemo.js'
import StateMachineDemo from './scenes/StateMachineDemo.js'
import BehaviorTreeDemo from './scenes/BehaviorTreeDemo.js'
import ReplayRecorderDemo from './scenes/ReplayRecorderDemo.js'
import CameraDirectorDemo from './scenes/CameraDirectorDemo.js'
import ScreenShakeDemo from './scenes/ScreenShakeDemo.js'
import ParallaxLayerDemo from './scenes/ParallaxLayerDemo.js'
import LetterboxDemo from './scenes/LetterboxDemo.js'
import InputFeatureDemo from './scenes/InputFeatureDemo.js'
import VirtualJoystickDemo from './scenes/VirtualJoystickDemo.js'
import GestureRecognizerDemo from './scenes/GestureRecognizerDemo.js'
import GamepadDemo from './scenes/GamepadDemo.js'
import InputBufferDemo from './scenes/InputBufferDemo.js'

export type PhaserCategory =
    | 'Core'
    | 'Layers'
    | 'Features'
    | 'Debugging'
    | 'Flow'
    | 'Perspective2D'
    | 'Effects'
    | 'AI'
    | 'Cinema'
    | 'Input'

export type PhaserExampleDef = {
    key: string
    title: string
    category: PhaserCategory
    description: string
    sceneFile: string
    element: JSX.Element
}

export const phaserCategories: PhaserCategory[] = [
    'Core',
    'Layers',
    'Features',
    'Debugging',
    'Flow',
    'Perspective2D',
    'Effects',
    'AI',
    'Cinema',
    'Input'
]

export const phaserExamples: PhaserExampleDef[] = [
    {
        key: 'hello-world',
        title: 'Hello World',
        category: 'Core',
        description: 'Minimal Scene with onLoad/onCreate.',
        sceneFile: 'HelloWorld.js',
        element: <PhaserCanvas sceneClass={HelloWorld} />
    },
    {
        key: 'scene-lifecycle',
        title: 'Scene Lifecycle',
        category: 'Core',
        description: 'Scene.onUpdate hook + Scene.restart(payload).',
        sceneFile: 'SceneLifecycle.js',
        element: <PhaserCanvas sceneClass={SceneLifecycle} />
    },
    {
        key: 'services',
        title: 'Service Registry',
        category: 'Core',
        description: 'Cross-scene singleton via ServiceRegistry.resolve(class).',
        sceneFile: 'Services.js',
        element: <PhaserCanvas sceneClass={Services} />
    },
    {
        key: 'create-game-objects',
        title: 'Create Game Objects',
        category: 'Core',
        description: 'GameObject lifecycle + pool obtain/release.',
        sceneFile: 'CreateGameObjects.js',
        element: <PhaserCanvas sceneClass={CreateGameObjects} />
    },
    {
        key: 'create-physics-objects',
        title: 'Create Physics Objects',
        category: 'Core',
        description: 'Matter physics body attached to GameObject.',
        sceneFile: 'CreatePhysicsObjects.js',
        element: <PhaserCanvas sceneClass={CreatePhysicsObjects} />
    },
    {
        key: 'absolute-position',
        title: 'Absolute Position',
        category: 'Core',
        description: 'GameObject.getAbsolute(out) walking parentContainer chain.',
        sceneFile: 'AbsolutePosition.js',
        element: <PhaserCanvas sceneClass={AbsolutePosition} />
    },
    {
        key: 'object-pooling',
        title: 'Object Pooling',
        category: 'Core',
        description: 'GameObjectPool with .count() and visible vs allocated tracking.',
        sceneFile: 'ObjectPooling.js',
        element: <PhaserCanvas sceneClass={ObjectPooling} />
    },

    {
        key: 'scene-layers',
        title: 'Scene Layers',
        category: 'Layers',
        description: 'Two camera-isolated Layer features.',
        sceneFile: 'SceneLayers.js',
        element: <PhaserCanvas sceneClass={SceneLayers} />
    },
    {
        key: 'layer-background',
        title: 'Layer Background + Clear',
        category: 'Layers',
        description: 'Layer.setBackgroundColor and Layer.clear.',
        sceneFile: 'LayerBackground.js',
        element: <PhaserCanvas sceneClass={LayerBackground} />
    },
    {
        key: 'layer-depth',
        title: 'Layers & Depth',
        category: 'Layers',
        description: 'Layer depth swap via Flow.Event.',
        sceneFile: 'LayerDepth.js',
        element: <PhaserCanvas sceneClass={LayerDepth} />
    },

    {
        key: 'split-screen',
        title: 'Split Screen',
        category: 'Layers',
        description: 'SplitScreen feature: WASD player A, IJKL player B; cameras split via Mask filter when players separate.',
        sceneFile: 'SplitScreenDemo.js',
        element: <PhaserCanvas sceneClass={SplitScreenDemo} />
    },

    {
        key: 'feature-communication',
        title: 'Feature Communication',
        category: 'Features',
        description: 'Pub-sub between Features via FeatureRegistry.',
        sceneFile: 'FeatureCommunication.js',
        element: <PhaserCanvas sceneClass={FeatureCommunication} />
    },
    {
        key: 'html-overlay',
        title: 'HTML Overlay',
        category: 'Features',
        description: 'HTMLFeature drives a styled <div> overlay.',
        sceneFile: 'HTMLOverlay.js',
        element: <PhaserCanvas sceneClass={HTMLOverlay} />
    },

    {
        key: 'debugging',
        title: 'Debugging',
        category: 'Debugging',
        description: 'Built-in Debugger feature with all panels.',
        sceneFile: 'Debugging.js',
        element: <PhaserCanvas sceneClass={Debugging} />
    },
    {
        key: 'custom-debug-panel',
        title: 'Custom Debug Panel',
        category: 'Debugging',
        description: 'Debugger.addPanel with custom Tweakpane folder.',
        sceneFile: 'CustomDebugPanel.js',
        element: <PhaserCanvas sceneClass={CustomDebugPanel} />
    },
    {
        key: 'performance-panel',
        title: 'Performance Panel',
        category: 'Debugging',
        description: 'FPS, frame-time histogram, draw calls, GC pause counter.',
        sceneFile: 'PerformancePanelDemo.js',
        element: <PhaserCanvas sceneClass={PerformancePanelDemo} />
    },
    {
        key: 'memory-panel',
        title: 'Memory Panel',
        category: 'Debugging',
        description: 'Texture MB, pool fill, live object counts by type.',
        sceneFile: 'MemoryPanelDemo.js',
        element: <PhaserCanvas sceneClass={MemoryPanelDemo} />
    },
    {
        key: 'timeline-panel',
        title: 'Timeline Panel',
        category: 'Debugging',
        description: 'Pause/step FlowEngine ticks; scrub through triggered events.',
        sceneFile: 'TimelinePanelDemo.js',
        element: <PhaserCanvas sceneClass={TimelinePanelDemo} />
    },
    {
        key: 'input-panel',
        title: 'Input Panel',
        category: 'Debugging',
        description: 'Live keys, pointer, gamepad, registered actions.',
        sceneFile: 'InputPanelDemo.js',
        element: <PhaserCanvas sceneClass={InputPanelDemo} />
    },
    {
        key: 'audio-panel',
        title: 'Audio Panel',
        category: 'Debugging',
        description: 'Master vol/mute + per-bus sliders; lists playing tracks.',
        sceneFile: 'AudioPanelDemo.js',
        element: <PhaserCanvas sceneClass={AudioPanelDemo} />
    },
    {
        key: 'net-panel',
        title: 'Net Panel',
        category: 'Debugging',
        description: 'RTT graph, loss%, sent/recv rate, message log.',
        sceneFile: 'NetPanelDemo.js',
        element: <PhaserCanvas sceneClass={NetPanelDemo} />
    },
    {
        key: 'console-commands',
        title: 'Console Commands',
        category: 'Debugging',
        description: 'Register dev commands runnable from a Tweakpane text input.',
        sceneFile: 'ConsoleCommandsDemo.js',
        element: <PhaserCanvas sceneClass={ConsoleCommandsDemo} />
    },
    {
        key: 'hot-reload',
        title: 'Hot Reload',
        category: 'Debugging',
        description: 'Re-run scene init via scene.goTo(key, payload).',
        sceneFile: 'HotReloadDemo.js',
        element: <PhaserCanvas sceneClass={HotReloadDemo} />
    },
    {
        key: 'remote-debugger',
        title: 'Remote Debugger',
        category: 'Debugging',
        description: 'WS bridge: forwards panel state to a desktop inspector.',
        sceneFile: 'RemoteDebuggerDemo.js',
        element: <PhaserCanvas sceneClass={RemoteDebuggerDemo} />
    },

    {
        key: 'game-events',
        title: 'Game Events',
        category: 'Flow',
        description: 'Flow.Event class with delayed trigger.',
        sceneFile: 'GameEvents.js',
        element: <PhaserCanvas sceneClass={GameEvents} />
    },
    {
        key: 'time-events',
        title: 'Time Events',
        category: 'Flow',
        description: 'Recurring Flow.TimeEvent.',
        sceneFile: 'TimeEvents.js',
        element: <PhaserCanvas sceneClass={TimeEvents} />
    },
    {
        key: 'timer-control',
        title: 'Timer Control',
        category: 'Flow',
        description: 'Flow.timer pause / resume / reset.',
        sceneFile: 'TimerControl.js',
        element: <PhaserCanvas sceneClass={TimerControl} />
    },
    {
        key: 'job-queue',
        title: 'Job Queue',
        category: 'Flow',
        description: 'Flow.Job cooperative scheduler with maxJobsPerFrame.',
        sceneFile: 'JobQueue.js',
        element: <PhaserCanvas sceneClass={JobQueue} />
    },
    {
        key: 'collision-events',
        title: 'Collision Events',
        category: 'Flow',
        description: 'Flow.CollisionEvent label-routed Matter callbacks.',
        sceneFile: 'CollisionEvents.js',
        element: <PhaserCanvas sceneClass={CollisionEvents} />
    },

    {
        key: 'iso-scene',
        title: 'Isometric Scene',
        category: 'Perspective2D',
        description: 'Scene2D + World + GameObject2D + Matrix2 ISO basis.',
        sceneFile: 'ISOScene.js',
        element: <PhaserCanvas sceneClass={ISOScene} />
    },
    {
        key: 'iso-movement',
        title: 'ISO Movement',
        category: 'Perspective2D',
        description: 'Keyboard-driven GameObject2D in ISO World.',
        sceneFile: 'ISOMovement.js',
        element: <PhaserCanvas sceneClass={ISOMovement} />
    },
    {
        key: 'world-reset',
        title: 'World Reset',
        category: 'Perspective2D',
        description: 'World.clear releasing GameObject2Ds back to pool.',
        sceneFile: 'WorldReset.js',
        element: <PhaserCanvas sceneClass={WorldReset} />
    },

    {
        key: 'effects',
        title: 'Shader Effects',
        category: 'Effects',
        description: 'Cycle the entire phaser-plus effect catalogue on a sprite.',
        sceneFile: 'Effects.js',
        element: <PhaserCanvas sceneClass={Effects} />
    },

    {
        key: 'pathfinder',
        title: 'A* PathFinder',
        category: 'AI',
        description: 'Time-sliced incremental A* over a grid NavMesh: click to walk, right-click to toggle walls.',
        sceneFile: 'PathFinderDemo.js',
        element: <PhaserCanvas sceneClass={PathFinderDemo} />
    },

    {
        key: 'state-machine',
        title: 'State Machine',
        category: 'Flow',
        description: 'StateMachine feature: idle/run/jump with signal- and guard-based transitions.',
        sceneFile: 'StateMachineDemo.js',
        element: <PhaserCanvas sceneClass={StateMachineDemo} />
    },
    {
        key: 'behavior-tree',
        title: 'Behavior Tree',
        category: 'Flow',
        description: 'Selector(chase, patrol) with Sequence + Action + Condition nodes.',
        sceneFile: 'BehaviorTreeDemo.js',
        element: <PhaserCanvas sceneClass={BehaviorTreeDemo} />
    },
    {
        key: 'replay-recorder',
        title: 'Replay Recorder',
        category: 'Flow',
        description: 'Record arrow-key inputs at fixed step then play them back deterministically.',
        sceneFile: 'ReplayRecorderDemo.js',
        element: <PhaserCanvas sceneClass={ReplayRecorderDemo} />
    },

    {
        key: 'camera-director',
        title: 'Camera Director',
        category: 'Cinema',
        description: 'Queueable shots: pan, zoom, fit-bounds, follow target, Catmull-Rom spline.',
        sceneFile: 'CameraDirectorDemo.js',
        element: <PhaserCanvas sceneClass={CameraDirectorDemo} />
    },
    {
        key: 'screen-shake',
        title: 'Screen Shake',
        category: 'Cinema',
        description: 'Trauma-based stacking shake. Click for small bumps, Shift+Click for big.',
        sceneFile: 'ScreenShakeDemo.js',
        element: <PhaserCanvas sceneClass={ScreenShakeDemo} />
    },
    {
        key: 'parallax-layer',
        title: 'Parallax Layers',
        category: 'Cinema',
        description: 'Three ParallaxLayers with different scroll factors driven by main camera.',
        sceneFile: 'ParallaxLayerDemo.js',
        element: <PhaserCanvas sceneClass={ParallaxLayerDemo} />
    },
    {
        key: 'letterbox',
        title: 'Letterbox / Pillarbox',
        category: 'Cinema',
        description: 'LetterboxFeature applies black bars when canvas aspect ≠ target aspect.',
        sceneFile: 'LetterboxDemo.js',
        element: <PhaserCanvas sceneClass={LetterboxDemo} />
    },

    {
        key: 'input-feature',
        title: 'Action Map',
        category: 'Input',
        description: 'InputFeature unifies WASD + Arrows + Space into named actions with hold timing.',
        sceneFile: 'InputFeatureDemo.js',
        element: <PhaserCanvas sceneClass={InputFeatureDemo} />
    },
    {
        key: 'virtual-joystick',
        title: 'Virtual Joystick',
        category: 'Input',
        description: 'Touch joystick + on-screen buttons feeding InputFeature virtual bindings.',
        sceneFile: 'VirtualJoystickDemo.js',
        element: <PhaserCanvas sceneClass={VirtualJoystickDemo} />
    },
    {
        key: 'gesture-recognizer',
        title: 'Gesture Recognizer',
        category: 'Input',
        description: 'Tap, double-tap, long-press, swipe, two-finger pinch on Scene pointer events.',
        sceneFile: 'GestureRecognizerDemo.js',
        element: <PhaserCanvas sceneClass={GestureRecognizerDemo} />
    },
    {
        key: 'gamepad',
        title: 'Gamepad',
        category: 'Input',
        description: 'Hot-plug, deadzone, dual-stick visualization, rumble on button press.',
        sceneFile: 'GamepadDemo.js',
        element: <PhaserCanvas sceneClass={GamepadDemo} />
    },
    {
        key: 'input-buffer',
        title: 'Input Buffer / Combos',
        category: 'Input',
        description: 'Ring buffer of recent inputs; consumeMatch detects fighting-game combos.',
        sceneFile: 'InputBufferDemo.js',
        element: <PhaserCanvas sceneClass={InputBufferDemo} />
    }
]
