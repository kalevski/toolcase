import logging from './logging'
import Realtime from './Realtime'
import AuthMiddleware from './AuthMiddleware'
import Room from './Room'
import Actor from './Actor'

import WSTransport from './transports/WSTransport'

import WSClient from './clients/WSClient'

/** @namespace */
const Transports = {
    WSTransport
}

const Clients = {
    WSClient
}

/**
 * @callback TopicListener
 * @param {Actor} actor
 * @param {Uint8Array} payload
 * @returns {void}
 */

export {
    Transports,
    Clients,
    logging,
    Realtime,
    AuthMiddleware,
    Room
}