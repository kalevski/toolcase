import { Level as LogLevel } from '@toolcase/logging'

import Engine from './engine/Engine'
import Scene from './engine/Scene'
import GameObject from './engine/GameObject'
import GameObjectComponent from './engine/GameObjectComponent'
import * as Events from './engine/Events'

import Feature from './features/Feature'
import FeatureRegistry from './features/FeatureRegistry'
import ServiceRegistry from './features/ServiceRegistry'
import type { Disposable } from './features/ServiceRegistry'
import Layer from './features/Layer'
import ObjectLayer from './features/ObjectLayer'
import HTMLFeature from './features/HTMLFeature'
import ReactFeature from './features/ReactFeature'
import SplitScreen from './features/SplitScreen'

import GameObjectPool from './pool/GameObjectPool'

import Matrix2 from './math/Matrix2'
import { SpatialHash, Quadtree, Vec2, Easing, Random, AABB, Transform } from './structs'

import Event from './flow/Event'
import TimeEvent from './flow/TimeEvent'
import CollisionEvent from './flow/CollisionEvent'
import Job from './flow/Job'
import FlowEngine from './flow/FlowEngine'
import StateMachine from './flow/StateMachine'
import BehaviorTreeProcessor, {
    BTNode,
    Action as BTAction,
    Condition as BTCondition,
    Sequence,
    Selector,
    Parallel,
    Inverter,
    Repeater,
    AlwaysSucceed,
    AlwaysFail
} from './flow/BehaviorTree'
import ReplayRecorder from './flow/ReplayRecorder'
import Timer from './flow/Timer'
import ParallelRunner from './flow/Parallel'
import throttle from './flow/throttle'
import debounce from './flow/debounce'
import TweenProcessor from './flow/TweenProcessor'
import Timeline from './flow/Timeline'
import Tween from './flow/Tween'
import { EASE, resolveEase } from './flow/easing'

const Flow = {
    Event,
    TimeEvent,
    CollisionEvent,
    Job,
    FlowEngine,
    StateMachine,
    BehaviorTreeProcessor,
    ReplayRecorder,
    Timer,
    Tween,
    Timeline,
    TweenProcessor,
    EASE,
    resolveEase,
    Parallel: ParallelRunner,
    throttle,
    debounce,
    BT: {
        Node: BTNode,
        Action: BTAction,
        Condition: BTCondition,
        Sequence,
        Selector,
        Parallel,
        Inverter,
        Repeater,
        AlwaysSucceed,
        AlwaysFail
    }
}

const Structs = {
    Matrix2,
    SpatialHash,
    Quadtree,
    Vec2,
    AABB,
    Transform,
    Easing,
    Random,
}

export type { Disposable }
export type { SpatialPoint, SpatialRect, EasingFn, Rect } from './structs'
export {
    Events,
    Flow,
    Structs,

    Engine,
    Scene,
    GameObject,
    GameObjectComponent,
    Feature,
    FeatureRegistry,
    ServiceRegistry,
    GameObjectPool,
    Layer,
    ObjectLayer,
    HTMLFeature,
    ReactFeature,
    SplitScreen,

    LogLevel
}

export * from './debugger'
export * from './perspective2d'
export * from './effects'
export * from './ai'
export * from './tilemap'
export * from './cinema'
export * from './input'
export * from './flow'
export * from './audio'
export * from './persistence'
export * from './assets'
export * from './particles'
export * from './net'
