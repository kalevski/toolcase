import { Level as LogLevel } from '@toolcase/logging'

import Engine from './engine/Engine'
import Scene from './engine/Scene'
import GameObject from './engine/GameObject'
import * as Events from './engine/Events'

import Feature from './features/Feature'
import FeatureRegistry from './features/FeatureRegistry'
import ServiceRegistry from './features/ServiceRegistry'
import Layer from './features/Layer'
import ObjectLayer from './features/ObjectLayer'
import HTMLFeature from './features/HTMLFeature'
import SplitScreen from './features/SplitScreen'

import GameObjectPool from './pool/GameObjectPool'

import Matrix2 from './math/Matrix2'

import Event from './flow/Event'
import TimeEvent from './flow/TimeEvent'
import CollisionEvent from './flow/CollisionEvent'
import Job from './flow/Job'
import FlowEngine from './flow/FlowEngine'

const Flow = {
    Event,
    TimeEvent,
    CollisionEvent,
    Job,
    FlowEngine
}

const Structs = {
    Matrix2
}

export {
    Events,
    Flow,
    Structs,

    Engine,
    Scene,
    GameObject,
    Feature,
    FeatureRegistry,
    ServiceRegistry,
    GameObjectPool,
    Layer,
    ObjectLayer,
    HTMLFeature,
    SplitScreen,

    LogLevel
}

export * from './debugger'
export * from './perspective2d'
export * from './effects'
export * from './ai'
