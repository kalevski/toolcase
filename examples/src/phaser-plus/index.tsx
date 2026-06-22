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
import ReplayRecorderTimelineDemo from './scenes/ReplayRecorderTimelineDemo.js'
import CameraDirectorDemo from './scenes/CameraDirectorDemo.js'
import ScreenShakeDemo from './scenes/ScreenShakeDemo.js'
import ParallaxLayerDemo from './scenes/ParallaxLayerDemo.js'
import LetterboxDemo from './scenes/LetterboxDemo.js'
import InputFeatureDemo from './scenes/InputFeatureDemo.js'
import VirtualJoystickDemo from './scenes/VirtualJoystickDemo.js'
import GestureRecognizerDemo from './scenes/GestureRecognizerDemo.js'
import GamepadDemo from './scenes/GamepadDemo.js'
import InputBufferDemo from './scenes/InputBufferDemo.js'
import SaveServiceDemo from './scenes/SaveServiceDemo.js'
import SaveStatePanelDemo from './scenes/SaveStatePanelDemo.js'
import AssetFeatureDemo from './scenes/AssetFeatureDemo.js'
import TilemapNavMeshDemo from './scenes/TilemapNavMeshDemo.js'
import ParticleFeatureDemo from './scenes/ParticleFeatureDemo.js'
import TweenTimelineDemo from './scenes/TweenTimelineDemo.js'
import EffectsGalleryDemo from './scenes/EffectsGalleryDemo.js'
import FlowLandingDemo from './scenes/FlowLandingDemo.js'
import InputLandingDemo from './scenes/InputLandingDemo.js'
import CinemaLandingDemo from './scenes/CinemaLandingDemo.js'

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
    | 'Particles'
    | 'Audio'
    | 'Net'
    | 'Persistence'
    | 'Assets'

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
    'Flow',
    'Cinema',
    'Input',
    'Audio',
    'Net',
    'Effects',
    'Particles',
    'Assets',
    'Persistence',
    'AI',
    'Perspective2D',
    'Debugging'
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
        title: 'Audio Mixer',
        category: 'Audio',
        description: 'AudioFeature: music/sfx/ui/ambience buses, 1.2s crossfade, spatial ping emitter, duck button. Bound to AudioPanel in the debugger.',
        sceneFile: 'AudioPanelDemo.js',
        element: <PhaserCanvas sceneClass={AudioPanelDemo} />
    },
    {
        key: 'net-panel',
        title: 'NetFeature Loopback',
        category: 'Net',
        description: 'NetFeature: LoopbackTransport pair (50 ms latency), entity sync with delta encoding, real RTT/throughput in NetPanel.',
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
        key: 'effects-gallery',
        title: 'Effects Gallery',
        category: 'Effects',
        description: 'Searchable grid of all 73 built-in shaders with live thumbnails, family filter, click-to-apply, and per-uniform ±tweak controls.',
        sceneFile: 'EffectsGalleryDemo.js',
        element: <PhaserCanvas sceneClass={EffectsGalleryDemo} />
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
        key: 'tilemap-navmesh',
        title: 'Tilemap NavMesh',
        category: 'AI',
        description: 'TilemapFeature.buildNavMesh auto-generates a NavMesh from walkable tiles; agent path-finds around walls.',
        sceneFile: 'TilemapNavMeshDemo.js',
        element: <PhaserCanvas sceneClass={TilemapNavMeshDemo} />
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
        key: 'replay-recorder-timeline',
        title: 'Replay + Timeline Panel',
        category: 'Flow',
        description: 'ReplayRecorder wired to TimelinePanel via bindReplay — frame log, scrub slider, Record/Stop/Replay buttons in the debugger.',
        sceneFile: 'ReplayRecorderTimelineDemo.js',
        element: <PhaserCanvas sceneClass={ReplayRecorderTimelineDemo} />
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
    },
    {
        key: 'save-service',
        title: 'Save Service',
        category: 'Persistence',
        description: 'SaveService + PersistenceFeature: 3 slots via tc-save-slot-list, LocalStorage backend, visible v1→v2 migration on load.',
        sceneFile: 'SaveServiceDemo.js',
        element: <PhaserCanvas sceneClass={SaveServiceDemo} />
    },
    {
        key: 'save-state-panel',
        title: 'Save State Panel',
        category: 'Persistence',
        description: 'SaveStatePanel: inspect slot list, view metadata, preview data content, force-load or delete any slot from the debugger.',
        sceneFile: 'SaveStatePanelDemo.js',
        element: <PhaserCanvas sceneClass={SaveStatePanelDemo} />
    },
    {
        key: 'asset-feature',
        title: 'Asset Feature',
        category: 'Assets',
        description: 'AssetFeature: declarative manifest, bundle-based lazy loading, aggregated progress, retry on failure, hot-reload swap. Cross-package: tc-loading-screen bound to ASSET_PROGRESS events.',
        sceneFile: 'AssetFeatureDemo.js',
        element: <PhaserCanvas sceneClass={AssetFeatureDemo} />
    },

    {
        key: 'particle-feature',
        title: 'VFX Gallery',
        category: 'Particles',
        description: 'ParticleFeature: define named presets, click-to-burst, cursor-following stream, and Explosion preset chained to a screen HeatEffect.',
        sceneFile: 'ParticleFeatureDemo.js',
        element: <PhaserCanvas sceneClass={ParticleFeatureDemo} />
    },
    {
        key: 'tween-timeline',
        title: 'Tween & Timeline',
        category: 'Flow',
        description: 'Flow.Tween + Flow.Timeline: sequence, parallel, stagger across five easing functions; scrub and replay via TimelinePanel.',
        sceneFile: 'TweenTimelineDemo.js',
        element: <PhaserCanvas sceneClass={TweenTimelineDemo} />
    },

    // ── Subsystem landing demos ────────────────────────────────────────────────
    {
        key: 'flow-landing',
        title: 'Flow Subsystem',
        category: 'Flow',
        description: 'Landing demo: whole Flow surface — Event, TimeEvent, Job, Tween, Timeline, and StateMachine FSM in one interactive panel.',
        sceneFile: 'FlowLandingDemo.js',
        element: <PhaserCanvas sceneClass={FlowLandingDemo} />
    },
    {
        key: 'input-landing',
        title: 'Input Subsystem',
        category: 'Input',
        description: 'Landing demo: whole Input surface — InputFeature action map, InputBuffer combo detection, GestureRecognizer (tap/swipe/pinch), GamepadFeature.',
        sceneFile: 'InputLandingDemo.js',
        element: <PhaserCanvas sceneClass={InputLandingDemo} />
    },
    {
        key: 'cinema-landing',
        title: 'Cinema Subsystem',
        category: 'Cinema',
        description: 'Landing demo: whole Cinema surface — CameraDirector shots, ScreenShake (impact/rumble/sine), CameraFlash, ParallaxLayer, LetterboxFeature, DialogCameraCue.',
        sceneFile: 'CinemaLandingDemo.js',
        element: <PhaserCanvas sceneClass={CinemaLandingDemo} />
    }
]
