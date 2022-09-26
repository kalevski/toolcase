// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function (modules, entry, mainEntry, parcelRequireName, globalName) {
  /* eslint-disable no-undef */
  var globalObject =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : {};
  /* eslint-enable no-undef */

  // Save the require from previous bundle to this closure if any
  var previousRequire =
    typeof globalObject[parcelRequireName] === 'function' &&
    globalObject[parcelRequireName];

  var cache = previousRequire.cache || {};
  // Do not use `require` to prevent Webpack from trying to bundle this call
  var nodeRequire =
    typeof module !== 'undefined' &&
    typeof module.require === 'function' &&
    module.require.bind(module);

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire =
          typeof globalObject[parcelRequireName] === 'function' &&
          globalObject[parcelRequireName];
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error("Cannot find module '" + name + "'");
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = (cache[name] = new newRequire.Module(name));

      modules[name][0].call(
        module.exports,
        localRequire,
        module,
        module.exports,
        this
      );
    }

    return cache[name].exports;

    function localRequire(x) {
      var res = localRequire.resolve(x);
      return res === false ? {} : newRequire(res);
    }

    function resolve(x) {
      var id = modules[name][1][x];
      return id != null ? id : x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [
      function (require, module) {
        module.exports = exports;
      },
      {},
    ];
  };

  Object.defineProperty(newRequire, 'root', {
    get: function () {
      return globalObject[parcelRequireName];
    },
  });

  globalObject[parcelRequireName] = newRequire;

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  if (mainEntry) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(mainEntry);

    // CommonJS
    if (typeof exports === 'object' && typeof module !== 'undefined') {
      module.exports = mainExports;

      // RequireJS
    } else if (typeof define === 'function' && define.amd) {
      define(function () {
        return mainExports;
      });

      // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }
})({"iFasa":[function(require,module,exports) {
"use strict";
var global = arguments[3];
var HMR_HOST = null;
var HMR_PORT = null;
var HMR_SECURE = false;
var HMR_ENV_HASH = "d6ea1d42532a7575";
module.bundle.HMR_BUNDLE_ID = "df29809f9c67bce7";
/* global HMR_HOST, HMR_PORT, HMR_ENV_HASH, HMR_SECURE, chrome, browser, globalThis, __parcel__import__, __parcel__importScripts__, ServiceWorkerGlobalScope */ /*::
import type {
  HMRAsset,
  HMRMessage,
} from '@parcel/reporter-dev-server/src/HMRServer.js';
interface ParcelRequire {
  (string): mixed;
  cache: {|[string]: ParcelModule|};
  hotData: mixed;
  Module: any;
  parent: ?ParcelRequire;
  isParcelRequire: true;
  modules: {|[string]: [Function, {|[string]: string|}]|};
  HMR_BUNDLE_ID: string;
  root: ParcelRequire;
}
interface ParcelModule {
  hot: {|
    data: mixed,
    accept(cb: (Function) => void): void,
    dispose(cb: (mixed) => void): void,
    // accept(deps: Array<string> | string, cb: (Function) => void): void,
    // decline(): void,
    _acceptCallbacks: Array<(Function) => void>,
    _disposeCallbacks: Array<(mixed) => void>,
  |};
}
interface ExtensionContext {
  runtime: {|
    reload(): void,
    getURL(url: string): string;
    getManifest(): {manifest_version: number, ...};
  |};
}
declare var module: {bundle: ParcelRequire, ...};
declare var HMR_HOST: string;
declare var HMR_PORT: string;
declare var HMR_ENV_HASH: string;
declare var HMR_SECURE: boolean;
declare var chrome: ExtensionContext;
declare var browser: ExtensionContext;
declare var __parcel__import__: (string) => Promise<void>;
declare var __parcel__importScripts__: (string) => Promise<void>;
declare var globalThis: typeof self;
declare var ServiceWorkerGlobalScope: Object;
*/ var OVERLAY_ID = "__parcel__error__overlay__";
var OldModule = module.bundle.Module;
function Module(moduleName) {
    OldModule.call(this, moduleName);
    this.hot = {
        data: module.bundle.hotData,
        _acceptCallbacks: [],
        _disposeCallbacks: [],
        accept: function(fn) {
            this._acceptCallbacks.push(fn || function() {});
        },
        dispose: function(fn) {
            this._disposeCallbacks.push(fn);
        }
    };
    module.bundle.hotData = undefined;
}
module.bundle.Module = Module;
var checkedAssets, acceptedAssets, assetsToAccept /*: Array<[ParcelRequire, string]> */ ;
function getHostname() {
    return HMR_HOST || (location.protocol.indexOf("http") === 0 ? location.hostname : "localhost");
}
function getPort() {
    return HMR_PORT || location.port;
} // eslint-disable-next-line no-redeclare
var parent = module.bundle.parent;
if ((!parent || !parent.isParcelRequire) && typeof WebSocket !== "undefined") {
    var hostname = getHostname();
    var port = getPort();
    var protocol = HMR_SECURE || location.protocol == "https:" && !/localhost|127.0.0.1|0.0.0.0/.test(hostname) ? "wss" : "ws";
    var ws = new WebSocket(protocol + "://" + hostname + (port ? ":" + port : "") + "/"); // Web extension context
    var extCtx = typeof chrome === "undefined" ? typeof browser === "undefined" ? null : browser : chrome; // Safari doesn't support sourceURL in error stacks.
    // eval may also be disabled via CSP, so do a quick check.
    var supportsSourceURL = false;
    try {
        (0, eval)('throw new Error("test"); //# sourceURL=test.js');
    } catch (err) {
        supportsSourceURL = err.stack.includes("test.js");
    } // $FlowFixMe
    ws.onmessage = async function(event) {
        checkedAssets = {} /*: {|[string]: boolean|} */ ;
        acceptedAssets = {} /*: {|[string]: boolean|} */ ;
        assetsToAccept = [];
        var data = JSON.parse(event.data);
        if (data.type === "update") {
            // Remove error overlay if there is one
            if (typeof document !== "undefined") removeErrorOverlay();
            let assets = data.assets.filter((asset)=>asset.envHash === HMR_ENV_HASH); // Handle HMR Update
            let handled = assets.every((asset)=>{
                return asset.type === "css" || asset.type === "js" && hmrAcceptCheck(module.bundle.root, asset.id, asset.depsByBundle);
            });
            if (handled) {
                console.clear(); // Dispatch custom event so other runtimes (e.g React Refresh) are aware.
                if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") window.dispatchEvent(new CustomEvent("parcelhmraccept"));
                await hmrApplyUpdates(assets);
                for(var i = 0; i < assetsToAccept.length; i++){
                    var id = assetsToAccept[i][1];
                    if (!acceptedAssets[id]) hmrAcceptRun(assetsToAccept[i][0], id);
                }
            } else fullReload();
        }
        if (data.type === "error") {
            // Log parcel errors to console
            for (let ansiDiagnostic of data.diagnostics.ansi){
                let stack = ansiDiagnostic.codeframe ? ansiDiagnostic.codeframe : ansiDiagnostic.stack;
                console.error("\uD83D\uDEA8 [parcel]: " + ansiDiagnostic.message + "\n" + stack + "\n\n" + ansiDiagnostic.hints.join("\n"));
            }
            if (typeof document !== "undefined") {
                // Render the fancy html overlay
                removeErrorOverlay();
                var overlay = createErrorOverlay(data.diagnostics.html); // $FlowFixMe
                document.body.appendChild(overlay);
            }
        }
    };
    ws.onerror = function(e) {
        console.error(e.message);
    };
    ws.onclose = function() {
        console.warn("[parcel] \uD83D\uDEA8 Connection to the HMR server was lost");
    };
}
function removeErrorOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        overlay.remove();
        console.log("[parcel] ✨ Error resolved");
    }
}
function createErrorOverlay(diagnostics) {
    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    let errorHTML = '<div style="background: black; opacity: 0.85; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; font-family: Menlo, Consolas, monospace; z-index: 9999;">';
    for (let diagnostic of diagnostics){
        let stack = diagnostic.frames.length ? diagnostic.frames.reduce((p, frame)=>{
            return `${p}
<a href="/__parcel_launch_editor?file=${encodeURIComponent(frame.location)}" style="text-decoration: underline; color: #888" onclick="fetch(this.href); return false">${frame.location}</a>
${frame.code}`;
        }, "") : diagnostic.stack;
        errorHTML += `
      <div>
        <div style="font-size: 18px; font-weight: bold; margin-top: 20px;">
          🚨 ${diagnostic.message}
        </div>
        <pre>${stack}</pre>
        <div>
          ${diagnostic.hints.map((hint)=>"<div>\uD83D\uDCA1 " + hint + "</div>").join("")}
        </div>
        ${diagnostic.documentation ? `<div>📝 <a style="color: violet" href="${diagnostic.documentation}" target="_blank">Learn more</a></div>` : ""}
      </div>
    `;
    }
    errorHTML += "</div>";
    overlay.innerHTML = errorHTML;
    return overlay;
}
function fullReload() {
    if ("reload" in location) location.reload();
    else if (extCtx && extCtx.runtime && extCtx.runtime.reload) extCtx.runtime.reload();
}
function getParents(bundle, id) /*: Array<[ParcelRequire, string]> */ {
    var modules = bundle.modules;
    if (!modules) return [];
    var parents = [];
    var k, d, dep;
    for(k in modules)for(d in modules[k][1]){
        dep = modules[k][1][d];
        if (dep === id || Array.isArray(dep) && dep[dep.length - 1] === id) parents.push([
            bundle,
            k
        ]);
    }
    if (bundle.parent) parents = parents.concat(getParents(bundle.parent, id));
    return parents;
}
function updateLink(link) {
    var newLink = link.cloneNode();
    newLink.onload = function() {
        if (link.parentNode !== null) // $FlowFixMe
        link.parentNode.removeChild(link);
    };
    newLink.setAttribute("href", link.getAttribute("href").split("?")[0] + "?" + Date.now()); // $FlowFixMe
    link.parentNode.insertBefore(newLink, link.nextSibling);
}
var cssTimeout = null;
function reloadCSS() {
    if (cssTimeout) return;
    cssTimeout = setTimeout(function() {
        var links = document.querySelectorAll('link[rel="stylesheet"]');
        for(var i = 0; i < links.length; i++){
            // $FlowFixMe[incompatible-type]
            var href = links[i].getAttribute("href");
            var hostname = getHostname();
            var servedFromHMRServer = hostname === "localhost" ? new RegExp("^(https?:\\/\\/(0.0.0.0|127.0.0.1)|localhost):" + getPort()).test(href) : href.indexOf(hostname + ":" + getPort());
            var absolute = /^https?:\/\//i.test(href) && href.indexOf(location.origin) !== 0 && !servedFromHMRServer;
            if (!absolute) updateLink(links[i]);
        }
        cssTimeout = null;
    }, 50);
}
function hmrDownload(asset) {
    if (asset.type === "js") {
        if (typeof document !== "undefined") {
            let script = document.createElement("script");
            script.src = asset.url + "?t=" + Date.now();
            if (asset.outputFormat === "esmodule") script.type = "module";
            return new Promise((resolve, reject)=>{
                var _document$head;
                script.onload = ()=>resolve(script);
                script.onerror = reject;
                (_document$head = document.head) === null || _document$head === void 0 || _document$head.appendChild(script);
            });
        } else if (typeof importScripts === "function") {
            // Worker scripts
            if (asset.outputFormat === "esmodule") return import(asset.url + "?t=" + Date.now());
            else return new Promise((resolve, reject)=>{
                try {
                    importScripts(asset.url + "?t=" + Date.now());
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        }
    }
}
async function hmrApplyUpdates(assets) {
    global.parcelHotUpdate = Object.create(null);
    let scriptsToRemove;
    try {
        // If sourceURL comments aren't supported in eval, we need to load
        // the update from the dev server over HTTP so that stack traces
        // are correct in errors/logs. This is much slower than eval, so
        // we only do it if needed (currently just Safari).
        // https://bugs.webkit.org/show_bug.cgi?id=137297
        // This path is also taken if a CSP disallows eval.
        if (!supportsSourceURL) {
            let promises = assets.map((asset)=>{
                var _hmrDownload;
                return (_hmrDownload = hmrDownload(asset)) === null || _hmrDownload === void 0 ? void 0 : _hmrDownload.catch((err)=>{
                    // Web extension bugfix for Chromium
                    // https://bugs.chromium.org/p/chromium/issues/detail?id=1255412#c12
                    if (extCtx && extCtx.runtime && extCtx.runtime.getManifest().manifest_version == 3) {
                        if (typeof ServiceWorkerGlobalScope != "undefined" && global instanceof ServiceWorkerGlobalScope) {
                            extCtx.runtime.reload();
                            return;
                        }
                        asset.url = extCtx.runtime.getURL("/__parcel_hmr_proxy__?url=" + encodeURIComponent(asset.url + "?t=" + Date.now()));
                        return hmrDownload(asset);
                    }
                    throw err;
                });
            });
            scriptsToRemove = await Promise.all(promises);
        }
        assets.forEach(function(asset) {
            hmrApply(module.bundle.root, asset);
        });
    } finally{
        delete global.parcelHotUpdate;
        if (scriptsToRemove) scriptsToRemove.forEach((script)=>{
            if (script) {
                var _document$head2;
                (_document$head2 = document.head) === null || _document$head2 === void 0 || _document$head2.removeChild(script);
            }
        });
    }
}
function hmrApply(bundle, asset) {
    var modules = bundle.modules;
    if (!modules) return;
    if (asset.type === "css") reloadCSS();
    else if (asset.type === "js") {
        let deps = asset.depsByBundle[bundle.HMR_BUNDLE_ID];
        if (deps) {
            if (modules[asset.id]) {
                // Remove dependencies that are removed and will become orphaned.
                // This is necessary so that if the asset is added back again, the cache is gone, and we prevent a full page reload.
                let oldDeps = modules[asset.id][1];
                for(let dep in oldDeps)if (!deps[dep] || deps[dep] !== oldDeps[dep]) {
                    let id = oldDeps[dep];
                    let parents = getParents(module.bundle.root, id);
                    if (parents.length === 1) hmrDelete(module.bundle.root, id);
                }
            }
            if (supportsSourceURL) // Global eval. We would use `new Function` here but browser
            // support for source maps is better with eval.
            (0, eval)(asset.output);
             // $FlowFixMe
            let fn = global.parcelHotUpdate[asset.id];
            modules[asset.id] = [
                fn,
                deps
            ];
        } else if (bundle.parent) hmrApply(bundle.parent, asset);
    }
}
function hmrDelete(bundle, id) {
    let modules = bundle.modules;
    if (!modules) return;
    if (modules[id]) {
        // Collect dependencies that will become orphaned when this module is deleted.
        let deps = modules[id][1];
        let orphans = [];
        for(let dep in deps){
            let parents = getParents(module.bundle.root, deps[dep]);
            if (parents.length === 1) orphans.push(deps[dep]);
        } // Delete the module. This must be done before deleting dependencies in case of circular dependencies.
        delete modules[id];
        delete bundle.cache[id]; // Now delete the orphans.
        orphans.forEach((id)=>{
            hmrDelete(module.bundle.root, id);
        });
    } else if (bundle.parent) hmrDelete(bundle.parent, id);
}
function hmrAcceptCheck(bundle, id, depsByBundle) {
    if (hmrAcceptCheckOne(bundle, id, depsByBundle)) return true;
     // Traverse parents breadth first. All possible ancestries must accept the HMR update, or we'll reload.
    let parents = getParents(module.bundle.root, id);
    let accepted = false;
    while(parents.length > 0){
        let v = parents.shift();
        let a = hmrAcceptCheckOne(v[0], v[1], null);
        if (a) // If this parent accepts, stop traversing upward, but still consider siblings.
        accepted = true;
        else {
            // Otherwise, queue the parents in the next level upward.
            let p = getParents(module.bundle.root, v[1]);
            if (p.length === 0) {
                // If there are no parents, then we've reached an entry without accepting. Reload.
                accepted = false;
                break;
            }
            parents.push(...p);
        }
    }
    return accepted;
}
function hmrAcceptCheckOne(bundle, id, depsByBundle) {
    var modules = bundle.modules;
    if (!modules) return;
    if (depsByBundle && !depsByBundle[bundle.HMR_BUNDLE_ID]) {
        // If we reached the root bundle without finding where the asset should go,
        // there's nothing to do. Mark as "accepted" so we don't reload the page.
        if (!bundle.parent) return true;
        return hmrAcceptCheck(bundle.parent, id, depsByBundle);
    }
    if (checkedAssets[id]) return true;
    checkedAssets[id] = true;
    var cached = bundle.cache[id];
    assetsToAccept.push([
        bundle,
        id
    ]);
    if (!cached || cached.hot && cached.hot._acceptCallbacks.length) return true;
}
function hmrAcceptRun(bundle, id) {
    var cached = bundle.cache[id];
    bundle.hotData = {};
    if (cached && cached.hot) cached.hot.data = bundle.hotData;
    if (cached && cached.hot && cached.hot._disposeCallbacks.length) cached.hot._disposeCallbacks.forEach(function(cb) {
        cb(bundle.hotData);
    });
    delete bundle.cache[id];
    bundle(id);
    cached = bundle.cache[id];
    if (cached && cached.hot && cached.hot._acceptCallbacks.length) cached.hot._acceptCallbacks.forEach(function(cb) {
        var assetsToAlsoAccept = cb(function() {
            return getParents(module.bundle.root, id);
        });
        if (assetsToAlsoAccept && assetsToAccept.length) // $FlowFixMe[method-unbinding]
        assetsToAccept.push.apply(assetsToAccept, assetsToAlsoAccept);
    });
    acceptedAssets[id] = true;
}

},{}],"gQInm":[function(require,module,exports) {
var _base = require("@toolcase/base");
var _realtimeJs = require("@toolcase/realtime.js");
const decoder = new window.TextDecoder("utf-8");
const serializer = new (0, _base.Serializer)();
serializer.define("test", [
    {
        key: "types",
        type: "int32",
        rule: "repeated"
    }
]);
serializer.define("my_topic", [
    {
        key: "names",
        type: "bool",
        rule: "repeated"
    },
    {
        key: "test",
        type: "test",
        rule: "required"
    }
]);
const client = new (0, _realtimeJs.WSClient)("ws://localhost:3000");
client.connect("test");
client.on("client:connect", ()=>{
    client.send("my_topic", "test");
});
client.on("client:disconnect", (payload)=>{
    console.log("reason:", decoder.decode(payload));
});
client.on("my_topic", (payload)=>{
    let data = serializer.decode("my_topic", payload);
    console.log(JSON.stringify(data));
    console.log(JSON.stringify(data).length);
});

},{"@toolcase/realtime.js":"hm5xb","@toolcase/base":"cNzzF"}],"hm5xb":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "WSClient", ()=>(0, _wsclientDefault.default));
var _wsclient = require("./WSClient");
var _wsclientDefault = parcelHelpers.interopDefault(_wsclient);

},{"./WSClient":"agnmS","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"agnmS":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var _base = require("@toolcase/base");
var _logging = require("@toolcase/logging");
var _loggingDefault = parcelHelpers.interopDefault(_logging);
var _serializer = require("./serializer");
const encoder = new window.TextEncoder();
/**
 * @typedef EventTypes
 * @type {('client:connect'|'client:disconnect')}
 */ /**
 * @callback EventListener
 * @param {Uint8Array} payload
 * @param {string} topic
 */ /**
 * @extends {Broadcast<EventTypes,EventListener,any>}
 */ class WSClient extends (0, _base.Broadcast) {
    /** @private */ logger = (0, _loggingDefault.default).getLogger("ws client");
    /**
     * @private
     * @type {string}
     */ baseURL = null;
    /**
     * @private
     * @type {WebSocket}
     */ ws = null;
    /**
     * 
     * @param {string} baseURL 
     */ constructor(baseURL){
        super();
        this.baseURL = baseURL;
    }
    get connected() {
        return this.ws !== null;
    }
    connect(ticket = null) {
        if (this.connected) return this.logger.warning("the client is already connected");
        if (typeof ticket !== "string") throw new Error(`ticketmust be a sting, ${ticket} provided`);
        let url = new window.URL(this.baseURL);
        url.searchParams.append("ticket", ticket);
        this.ws = new window.WebSocket(url.toString());
        this.ws.onopen = this.onOpen;
        this.ws.onclose = this.onClose;
        this.ws.binaryType = "arraybuffer";
    }
    disocnnect() {
        if (!this.connected) return;
        this.ws.close();
        this.ws = null;
        this.emit("client:disconnect", encoder.encode("terminated"));
    }
    /**
     * 
     * @param {string} topic 
     * @param {Uint8Array|string} payload 
     */ send(topic, payload) {
        if (!this.connected) return this.logger.warning("send fail: connection is not established yet");
        if (typeof topic !== "string") throw new Error(`topic must be a string, ${topic} provided`);
        if (payload instanceof Uint8Array) return this.ws.send((0, _serializer.encode)(topic, payload));
        if (typeof payload === "string") return this.ws.send((0, _serializer.encode)(topic, encoder.encode(payload)));
        throw new Error(`send error: invalid payload=${payload}, must be a string or Buffer`);
    }
    /** @private */ onOpen = ()=>{
        this.ws.onmessage = this.onMessage;
        this.emit("client:connect");
    };
    /**
     * @private
     * @param {MessageEvent} message 
     */ onMessage = (message)=>{
        let { topic , payload  } = (0, _serializer.decode)(new Uint8Array(message.data));
        this.emit(topic, payload);
    };
    /**
     * @private
     * @param {CloseEvent} event
     */ onClose = (event)=>{
        this.emit("client:disconnect", encoder.encode(event.reason));
        this.ws = null;
    };
    /**
     * @private
     * @param {EventTypes} eventName 
     * @param  {...any} messages 
     */ emit(eventName, ...messages) {
        if (this.events.listenerCount(eventName) === 0) return this.logger.warning(`event=${eventName} emitted, register listener to handle the event`);
        super.emit(eventName, ...messages);
    }
}
exports.default = WSClient;

},{"@toolcase/base":"cNzzF","@toolcase/logging":"cB7AC","./serializer":"htyGI","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"cNzzF":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "HTTP", ()=>HTTP);
parcelHelpers.export(exports, "VectorClock", ()=>(0, _vectorClockDefault.default));
parcelHelpers.export(exports, "EventEmitter", ()=>(0, _eventEmitterDefault.default));
parcelHelpers.export(exports, "Broadcast", ()=>(0, _broadcastDefault.default));
parcelHelpers.export(exports, "LSystem", ()=>(0, _lsystemDefault.default));
parcelHelpers.export(exports, "ObjectPool", ()=>(0, _objectPoolDefault.default));
parcelHelpers.export(exports, "PriorityQueue", ()=>(0, _priorityQueueDefault.default));
parcelHelpers.export(exports, "env", ()=>(0, _envDefault.default));
parcelHelpers.export(exports, "generateId", ()=>(0, _generateIdDefault.default));
parcelHelpers.export(exports, "toHex", ()=>(0, _toHexDefault.default));
parcelHelpers.export(exports, "formatByteSize", ()=>(0, _formatByteSizeDefault.default));
parcelHelpers.export(exports, "bufferToHex", ()=>(0, _bufferToHexDefault.default));
parcelHelpers.export(exports, "hexToBuffer", ()=>(0, _hexToBufferDefault.default));
parcelHelpers.export(exports, "Color", ()=>(0, _colorDefault.default));
parcelHelpers.export(exports, "JSONSchema", ()=>(0, _jsonschemaDefault.default));
parcelHelpers.export(exports, "getNumberInRange", ()=>(0, _getNumberInRangeDefault.default));
parcelHelpers.export(exports, "Cache", ()=>(0, _cacheDefault.default));
parcelHelpers.export(exports, "Serializer", ()=>(0, _serializerDefault.default));
var _vectorClock = require("./VectorClock");
var _vectorClockDefault = parcelHelpers.interopDefault(_vectorClock);
var _eventEmitter = require("./EventEmitter");
var _eventEmitterDefault = parcelHelpers.interopDefault(_eventEmitter);
var _broadcast = require("./Broadcast");
var _broadcastDefault = parcelHelpers.interopDefault(_broadcast);
var _lsystem = require("./LSystem");
var _lsystemDefault = parcelHelpers.interopDefault(_lsystem);
var _objectPool = require("./ObjectPool");
var _objectPoolDefault = parcelHelpers.interopDefault(_objectPool);
var _priorityQueue = require("./PriorityQueue");
var _priorityQueueDefault = parcelHelpers.interopDefault(_priorityQueue);
var _env = require("./env");
var _envDefault = parcelHelpers.interopDefault(_env);
var _generateId = require("./generateId");
var _generateIdDefault = parcelHelpers.interopDefault(_generateId);
var _toHex = require("./toHex");
var _toHexDefault = parcelHelpers.interopDefault(_toHex);
var _formatByteSize = require("./formatByteSize");
var _formatByteSizeDefault = parcelHelpers.interopDefault(_formatByteSize);
var _bufferToHex = require("./bufferToHex");
var _bufferToHexDefault = parcelHelpers.interopDefault(_bufferToHex);
var _hexToBuffer = require("./hexToBuffer");
var _hexToBufferDefault = parcelHelpers.interopDefault(_hexToBuffer);
var _color = require("./Color");
var _colorDefault = parcelHelpers.interopDefault(_color);
var _jsonschema = require("./JSONSchema");
var _jsonschemaDefault = parcelHelpers.interopDefault(_jsonschema);
var _getNumberInRange = require("./getNumberInRange");
var _getNumberInRangeDefault = parcelHelpers.interopDefault(_getNumberInRange);
var _cache = require("./Cache");
var _cacheDefault = parcelHelpers.interopDefault(_cache);
var _serializer = require("./Serializer");
var _serializerDefault = parcelHelpers.interopDefault(_serializer);
var _status = require("./http/Status");
var _statusDefault = parcelHelpers.interopDefault(_status);
var _resterror = require("./http/RESTError");
var _resterrorDefault = parcelHelpers.interopDefault(_resterror);
var _restresponse = require("./http/RESTResponse");
var _restresponseDefault = parcelHelpers.interopDefault(_restresponse);
const HTTP = {
    Status: (0, _statusDefault.default),
    RESTError: (0, _resterrorDefault.default),
    RESTResponse: (0, _restresponseDefault.default)
};

},{"./VectorClock":"8uPcc","./EventEmitter":"jvRhs","./Broadcast":"3F4Pj","./LSystem":"lyUYu","./ObjectPool":"eOeDn","./PriorityQueue":"gLLZt","./env":"3Kf2v","./generateId":"2Nl6N","./toHex":"iZj57","./formatByteSize":"9TdSF","./bufferToHex":"kfDNu","./hexToBuffer":"fJ2Pv","./Color":"fkkbr","./JSONSchema":"2eHEa","./getNumberInRange":"anUGx","./Cache":"8nP4U","./Serializer":"amWrd","./http/Status":"e7uya","./http/RESTError":"fvlz8","./http/RESTResponse":"7srda","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"8uPcc":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
class VectorClock {
    /**
     * @readonly
     * @type {string}
     */ nodeId = null;
    /**
     * @private
     * @type {Object.<string, number>}
     */ data = {};
    /**
     * 
     * @param {string} nodeId 
     * @param {Object.<string, number>} data 
     */ constructor(nodeId, data = {}){
        this.nodeId = nodeId;
        this.data = data;
    }
    /**
     * 
     * @param {Object.<string, number>} object 
     */ setClock(clock = {}) {
        this.data = clock;
    }
    /**
     * 
     * @returns {Object.<string, number>}
     */ getClock() {
        return {
            ...this.data
        };
    }
    /**
     * 
     * @param {number} version
     * @param {string} nodeId 
     */ setVersion(version, nodeId = this.nodeId) {
        this.data[nodeId] = version;
    }
    /**
     * 
     * @param {string} nodeId
     * @returns {number}
     */ getVersion(nodeId = this.nodeId) {
        return this.data[nodeId] || 0;
    }
    /**
     * 
     */ increment() {
        this.data[this.nodeId] = this.getVersion(this.nodeId) + 1;
    }
    /**
     * 
     * @param {VectorClock} vectorClock 
     */ update(vectorClock) {
        const updated = {};
        for (let nodeId of VectorClock.getNodeIds(this, vectorClock))updated[nodeId] = Math.max(this.getVersion(nodeId), vectorClock.getVersion(nodeId));
        this.data = updated;
    }
    /**
     * 
     * @param {VectorClock} vectorClock 
     * @returns {boolean} 
     */ isAfter(vectorClock) {
        return VectorClock.isAfter(this, vectorClock);
    }
    /**
     * 
     * @param {VectorClock} vectorClock
     * @returns {boolean} 
     */ isConcurrent(vectorClock) {
        return VectorClock.isConcurrent(this, vectorClock);
    }
    /**
     * 
     * @param {VectorClock} vectorClock 
     */ isBefore(vectorClock) {
        return VectorClock.isBefore(this, vectorClock);
    }
}
/**
 * 
 * @param {VectorClock} vectorClock1 
 * @param {VectorClock} vectorClock2
 * @returns {Array.<string>} 
 */ VectorClock.getNodeIds = (vectorClock1, vectorClock2)=>{
    const map = {
        ...vectorClock1.getClock(),
        ...vectorClock2.getClock()
    };
    return Object.keys(map);
};
/**
 * 
 * @param {VectorClock} vectorClock1 
 * @param {VectorClock} vectorClock2
 * @returns {boolean} 
 */ VectorClock.isAfter = (vectorClock1, vectorClock2)=>{
    let isAfter = true;
    for (let nodeId of VectorClock.getNodeIds(vectorClock1, vectorClock2))if (vectorClock1.getVersion(nodeId) < vectorClock2.getVersion(nodeId)) isAfter = false;
    return isAfter;
};
/**
 * 
 * @param {VectorClock} vectorClock1 
 * @param {VectorClock} vectorClock2 
 */ VectorClock.isConcurrent = (vectorClock1, vectorClock2)=>{
    return !(VectorClock.isAfter(vectorClock1, vectorClock2) || VectorClock.isAfter(vectorClock2, vectorClock1));
};
/**
 * 
 * @param {VectorClock} vectorClock1 
 * @param {VectorClock} vectorClock2 
 */ VectorClock.isBefore = (vectorClock1, vectorClock2)=>{
    return !VectorClock.isAfter(vectorClock1, vectorClock2) && !VectorClock.isConcurrent(vectorClock1, vectorClock2);
};
/**
 * 
 * @param {VectorClock} vectorClock1 
 * @param {VectorClock} vectorClock2
 * @returns {number} 
 */ VectorClock.compare = (vectorClock1, vectorClock2)=>{
    if (VectorClock.isAfter(vectorClock1, vectorClock2)) return 1;
    else if (VectorClock.isConcurrent(vectorClock1, vectorClock2)) return 0;
    else return -1;
};
exports.default = VectorClock;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"gkKU3":[function(require,module,exports) {
exports.interopDefault = function(a) {
    return a && a.__esModule ? a : {
        default: a
    };
};
exports.defineInteropFlag = function(a) {
    Object.defineProperty(a, "__esModule", {
        value: true
    });
};
exports.exportAll = function(source, dest) {
    Object.keys(source).forEach(function(key) {
        if (key === "default" || key === "__esModule" || dest.hasOwnProperty(key)) return;
        Object.defineProperty(dest, key, {
            enumerable: true,
            get: function() {
                return source[key];
            }
        });
    });
    return dest;
};
exports.export = function(dest, destName, get) {
    Object.defineProperty(dest, destName, {
        enumerable: true,
        get: get
    });
};

},{}],"jvRhs":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var _eventemitter3 = require("eventemitter3");
/**
 * @extends {EventEmitter3}
 */ class EventEmitter extends (0, _eventemitter3.EventEmitter) {
}
exports.default = EventEmitter;

},{"eventemitter3":"3fnfh","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"3fnfh":[function(require,module,exports) {
"use strict";
var has = Object.prototype.hasOwnProperty, prefix = "~";
/**
 * Constructor to create a storage for our `EE` objects.
 * An `Events` instance is a plain object whose properties are event names.
 *
 * @constructor
 * @private
 */ function Events() {}
//
// We try to not inherit from `Object.prototype`. In some engines creating an
// instance in this way is faster than calling `Object.create(null)` directly.
// If `Object.create(null)` is not supported we prefix the event names with a
// character to make sure that the built-in object properties are not
// overridden or used as an attack vector.
//
if (Object.create) {
    Events.prototype = Object.create(null);
    //
    // This hack is needed because the `__proto__` property is still inherited in
    // some old browsers like Android 4, iPhone 5.1, Opera 11 and Safari 5.
    //
    if (!new Events().__proto__) prefix = false;
}
/**
 * Representation of a single event listener.
 *
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} [once=false] Specify if the listener is a one-time listener.
 * @constructor
 * @private
 */ function EE(fn, context, once) {
    this.fn = fn;
    this.context = context;
    this.once = once || false;
}
/**
 * Add a listener for a given event.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} once Specify if the listener is a one-time listener.
 * @returns {EventEmitter}
 * @private
 */ function addListener(emitter, event, fn, context, once) {
    if (typeof fn !== "function") throw new TypeError("The listener must be a function");
    var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
    if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
    else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
    else emitter._events[evt] = [
        emitter._events[evt],
        listener
    ];
    return emitter;
}
/**
 * Clear event by name.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} evt The Event name.
 * @private
 */ function clearEvent(emitter, evt) {
    if (--emitter._eventsCount === 0) emitter._events = new Events();
    else delete emitter._events[evt];
}
/**
 * Minimal `EventEmitter` interface that is molded against the Node.js
 * `EventEmitter` interface.
 *
 * @constructor
 * @public
 */ function EventEmitter() {
    this._events = new Events();
    this._eventsCount = 0;
}
/**
 * Return an array listing the events for which the emitter has registered
 * listeners.
 *
 * @returns {Array}
 * @public
 */ EventEmitter.prototype.eventNames = function eventNames() {
    var names = [], events, name;
    if (this._eventsCount === 0) return names;
    for(name in events = this._events)if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
    if (Object.getOwnPropertySymbols) return names.concat(Object.getOwnPropertySymbols(events));
    return names;
};
/**
 * Return the listeners registered for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Array} The registered listeners.
 * @public
 */ EventEmitter.prototype.listeners = function listeners(event) {
    var evt = prefix ? prefix + event : event, handlers = this._events[evt];
    if (!handlers) return [];
    if (handlers.fn) return [
        handlers.fn
    ];
    for(var i = 0, l = handlers.length, ee = new Array(l); i < l; i++)ee[i] = handlers[i].fn;
    return ee;
};
/**
 * Return the number of listeners listening to a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Number} The number of listeners.
 * @public
 */ EventEmitter.prototype.listenerCount = function listenerCount(event) {
    var evt = prefix ? prefix + event : event, listeners = this._events[evt];
    if (!listeners) return 0;
    if (listeners.fn) return 1;
    return listeners.length;
};
/**
 * Calls each of the listeners registered for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Boolean} `true` if the event had listeners, else `false`.
 * @public
 */ EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
    var evt = prefix ? prefix + event : event;
    if (!this._events[evt]) return false;
    var listeners = this._events[evt], len = arguments.length, args, i;
    if (listeners.fn) {
        if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);
        switch(len){
            case 1:
                return listeners.fn.call(listeners.context), true;
            case 2:
                return listeners.fn.call(listeners.context, a1), true;
            case 3:
                return listeners.fn.call(listeners.context, a1, a2), true;
            case 4:
                return listeners.fn.call(listeners.context, a1, a2, a3), true;
            case 5:
                return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
            case 6:
                return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
        }
        for(i = 1, args = new Array(len - 1); i < len; i++)args[i - 1] = arguments[i];
        listeners.fn.apply(listeners.context, args);
    } else {
        var length = listeners.length, j;
        for(i = 0; i < length; i++){
            if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);
            switch(len){
                case 1:
                    listeners[i].fn.call(listeners[i].context);
                    break;
                case 2:
                    listeners[i].fn.call(listeners[i].context, a1);
                    break;
                case 3:
                    listeners[i].fn.call(listeners[i].context, a1, a2);
                    break;
                case 4:
                    listeners[i].fn.call(listeners[i].context, a1, a2, a3);
                    break;
                default:
                    if (!args) for(j = 1, args = new Array(len - 1); j < len; j++)args[j - 1] = arguments[j];
                    listeners[i].fn.apply(listeners[i].context, args);
            }
        }
    }
    return true;
};
/**
 * Add a listener for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 */ EventEmitter.prototype.on = function on(event, fn, context) {
    return addListener(this, event, fn, context, false);
};
/**
 * Add a one-time listener for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 */ EventEmitter.prototype.once = function once(event, fn, context) {
    return addListener(this, event, fn, context, true);
};
/**
 * Remove the listeners of a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn Only remove the listeners that match this function.
 * @param {*} context Only remove the listeners that have this context.
 * @param {Boolean} once Only remove one-time listeners.
 * @returns {EventEmitter} `this`.
 * @public
 */ EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
    var evt = prefix ? prefix + event : event;
    if (!this._events[evt]) return this;
    if (!fn) {
        clearEvent(this, evt);
        return this;
    }
    var listeners = this._events[evt];
    if (listeners.fn) {
        if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) clearEvent(this, evt);
    } else {
        for(var i = 0, events = [], length = listeners.length; i < length; i++)if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) events.push(listeners[i]);
        //
        // Reset the array, or remove it completely if we have no more listeners.
        //
        if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
        else clearEvent(this, evt);
    }
    return this;
};
/**
 * Remove all listeners, or those of the specified event.
 *
 * @param {(String|Symbol)} [event] The event name.
 * @returns {EventEmitter} `this`.
 * @public
 */ EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
    var evt;
    if (event) {
        evt = prefix ? prefix + event : event;
        if (this._events[evt]) clearEvent(this, evt);
    } else {
        this._events = new Events();
        this._eventsCount = 0;
    }
    return this;
};
//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;
//
// Expose the prefix.
//
EventEmitter.prefixed = prefix;
//
// Allow `EventEmitter` to be imported as module namespace.
//
EventEmitter.EventEmitter = EventEmitter;
module.exports = EventEmitter;

},{}],"3F4Pj":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var _eventEmitter = require("./EventEmitter");
var _eventEmitterDefault = parcelHelpers.interopDefault(_eventEmitter);
/**
 * @template EventTypes
 * @template T
 * @template Context
 */ class Broadcast {
    /**
     * @private
     * @type {EventEmitter.<EventTypes,Context>}
     */ events = new (0, _eventEmitterDefault.default)();
    /**
     * 
     * @param {EventTypes} event 
     * @param {T} eventListener 
     * @param {Context} context 
     * @returns {this}
     */ on(event, eventListener, context) {
        this.events.on(event, eventListener, context);
        return this;
    }
    /**
     * 
     * @param {EventTypes} event 
     * @param {T} eventListener 
     * @param {Context} context 
     * @returns {this}
     */ off(event, eventListener, context) {
        this.events.off(event, eventListener, context);
        return this;
    }
    /**
     * 
     * @param {EventTypes} event 
     * @param {T} eventListener 
     * @param {Context} context 
     * @returns {this}
     */ once(event, eventListener, context) {
        this.events.once(event, eventListener, context);
        return this;
    }
    /**
     * @protected
     * @param {EventTypes} event 
     * @param  {...T} messages 
     * @returns {boolean}
     */ emit(event, ...messages) {
        return this.events.emit(event, ...messages);
    }
    /**
     * @private
     */ clearListeners() {
        this.events.removeAllListeners();
    }
}
exports.default = Broadcast;

},{"./EventEmitter":"jvRhs","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"lyUYu":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * @typedef LSystemConfig
 * @property {string} axiom
 * @property {Object<string,string>} rules
 */ class LSystem {
    /**
     * @private
     * @type {LSystemConfig}
     */ config = null;
    /** @readonly */ state = "";
    /** @readonly */ iteration = 0;
    /**
     * 
     * @param {LSystemConfig} config 
     */ constructor(config){
        this.config = config;
        this.state += config.axiom;
    }
    iterate() {
        let sequence = "";
        for (let rule of this.state.split("")){
            let resolved = this.config.rules[rule];
            if (typeof resolved !== "string") {
                sequence += rule;
                continue;
            }
            sequence += resolved;
        }
        ++this.iteration;
        this.state = sequence;
        return sequence;
    }
}
exports.default = LSystem;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"eOeDn":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * @template T
 */ class ObjectPool {
    /**
     * @callback ResetFn
     * @param {T} object
     * @return {void}
     */ /**
     * @callback InstanceFn
     * @param {typeof Object} object
     * @return {T}
     */ /**
     * @private
     * @type {Array<T>}
     */ pool = [];
    /**
     * @private
     * @type {typeof Object}
     */ objectClass = null;
    /**
     * @readonly
     * @type {number}
     */ instances = 0;
    /**
     * @private
     * @type {ResetFn}
     */ resetFn = ()=>{};
    /**
     * @private
     * @type {InstanceFn}
     */ instanceFn = ()=>new this.objectClass();
    /**
     * 
     * @param {typeof Object} objectClass 
     * @param {ResetFn} resetFn 
     * @param {InstanceFn} instanceFn
     */ constructor(objectClass, resetFn = null, instanceFn = null){
        this.objectClass = objectClass;
        if (typeof resetFn === "function") this.resetFn = resetFn;
        if (typeof instanceFn === "function") this.instanceFn = instanceFn;
    }
    /**
     * 
     * @returns {T}
     */ obtain() {
        if (this.pool.length === 0) this.createInstance();
        let object = this.pool.pop();
        return object;
    }
    release = (object)=>{
        this.resetFn(object);
        this.pool.push(object);
        return this;
    };
    dispose() {
        this.pool = [];
    }
    /**
     * @private
     */ createInstance() {
        let object = this.instanceFn(this.objectClass);
        this.instances++;
        if (typeof object.release === "undefined") object.release = ()=>this.release(object);
        else throw new Error(`object ${JSON.stringify(object)} already have release function`);
        this.pool.push(object);
    }
}
exports.default = ObjectPool;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"gLLZt":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * @template T
 */ class PriorityQueue {
    /**
     * @callback PriorityFn
     * @param {T} node
     * @returns {number}
     */ /**
     * @callback UniqueFn
     * @param {T} node
     * @returns {string}
     */ /**
     * @private
     * @type {Array<T>}
     */ values = [];
    /**
     * @private
     * @type {Map<string,string>}
     */ hashMap = new Map();
    /**
     * @private
     * @type {PriorityFn}
     */ priorityFn = null;
    /**
     * @private
     * @type {UniqueFn}
     */ uniqueFn = null;
    /**
     * 
     * @param {PriorityFn} priorityFn
     * @param {UniqueFn} uniqueFn
     */ constructor(priorityFn, uniqueFn = null){
        if (typeof priorityFn !== "function") throw new Error("priorityFn is required");
        this.priorityFn = priorityFn;
        if (typeof uniqueFn !== "function") this.uniqueFn = null;
        else this.uniqueFn = uniqueFn;
    }
    get length() {
        return this.values.length;
    }
    /**
     * 
     * @param {T} value 
     * @returns {boolean}
     */ enqueue(value) {
        if (typeof value === "undefined") console.log("here ?");
        this.values.push(value);
        this.bubbleUp();
        if (this.uniqueFn !== null) this.hashMap.set(this.uniqueFn(value), 0);
        return true;
    }
    dequeue() {
        this.swap(0, this.values.length - 1);
        let node = this.values.pop() || null;
        if (this.values.length > 1) this.bubbleDown();
        if (this.uniqueFn !== null && node !== null) this.hashMap.delete(this.uniqueFn(node));
        return node;
    }
    pop() {
        let node = this.values.pop() || null;
        if (this.uniqueFn !== null && node !== null) this.hashMap.delete(this.uniqueFn(node));
        return node;
    }
    /**
     * 
     * @param {T} value 
     */ has(value) {
        if (this.uniqueFn === null) return null;
        return this.hashMap.has(this.uniqueFn(value));
    }
    /** @private */ bubbleUp() {
        let index = this.values.length - 1;
        while(index > 0){
            let parentIndex = Math.floor((index - 1) / 2);
            if (this.getPriority(parentIndex) > this.getPriority(index)) {
                this.swap(index, parentIndex);
                index = parentIndex;
            } else break;
        }
    }
    /** @private */ bubbleDown() {
        let parentIndex = 0;
        const priority = this.getPriority(parentIndex);
        while(true){
            let indexToSwap = null;
            let leftIndex = 2 * parentIndex + 1;
            let rightIndex = 2 * parentIndex + 2;
            const leftChildPriority = this.getPriority(leftIndex);
            const rightChildPriority = this.getPriority(rightIndex);
            if (leftIndex < this.values.length && leftChildPriority <= priority) indexToSwap = leftIndex;
            let conditionA = rightChildPriority < priority && indexToSwap === null;
            let conditionB = rightChildPriority < leftChildPriority && indexToSwap !== null;
            if (rightIndex < this.values.length && (conditionA || conditionB)) indexToSwap = rightIndex;
            if (indexToSwap === null) break;
            this.swap(parentIndex, indexToSwap);
            parentIndex = indexToSwap;
        // break
        }
    }
    /**
     * @private
     * @param {number} indexA 
     * @param {number} indexB 
     */ swap(indexA, indexB) {
        let temp = this.values[indexA];
        this.values[indexA] = this.values[indexB];
        this.values[indexB] = temp;
    }
    /**
     * @private
     * @param {number} index 
     * @returns {number}
     */ getPriority(index) {
        let node = this.values[index] || null;
        return node === null ? Number.MAX_SAFE_INTEGER : this.priorityFn(node);
    }
}
exports.default = PriorityQueue;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"3Kf2v":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var process = require("process");
/**
 * 
 * @param {string} key 
 * @param {string|number|boolean} defaultValue 
 * @param {('string'|'number'|'boolean')} type
 */ const env = (key, defaultValue = null, type = "string")=>{
    if (typeof process === "undefined") throw new Error("env works only with NodeJS");
    let value = process.env[key];
    if (type === "number") {
        let numberValue = parseInt(value, 10);
        return numberValue.toString() === value ? numberValue : defaultValue;
    }
    if (type === "boolean") {
        let boolValue = (value + "").toLowerCase();
        if (boolValue === "true") return true;
        else if (boolValue === "false") return false;
        else return defaultValue;
    }
    return value ? value : defaultValue;
};
exports.default = env;

},{"process":"d5jf4","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"d5jf4":[function(require,module,exports) {
// shim for using process in browser
var process = module.exports = {};
// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.
var cachedSetTimeout;
var cachedClearTimeout;
function defaultSetTimout() {
    throw new Error("setTimeout has not been defined");
}
function defaultClearTimeout() {
    throw new Error("clearTimeout has not been defined");
}
(function() {
    try {
        if (typeof setTimeout === "function") cachedSetTimeout = setTimeout;
        else cachedSetTimeout = defaultSetTimout;
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === "function") cachedClearTimeout = clearTimeout;
        else cachedClearTimeout = defaultClearTimeout;
    } catch (e1) {
        cachedClearTimeout = defaultClearTimeout;
    }
})();
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) //normal enviroments in sane situations
    return setTimeout(fun, 0);
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch (e) {
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch (e1) {
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }
}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) //normal enviroments in sane situations
    return clearTimeout(marker);
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e) {
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e1) {
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }
}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;
function cleanUpNextTick() {
    if (!draining || !currentQueue) return;
    draining = false;
    if (currentQueue.length) queue = currentQueue.concat(queue);
    else queueIndex = -1;
    if (queue.length) drainQueue();
}
function drainQueue() {
    if (draining) return;
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;
    var len = queue.length;
    while(len){
        currentQueue = queue;
        queue = [];
        while(++queueIndex < len)if (currentQueue) currentQueue[queueIndex].run();
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}
process.nextTick = function(fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) for(var i = 1; i < arguments.length; i++)args[i - 1] = arguments[i];
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) runTimeout(drainQueue);
};
// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function() {
    this.fun.apply(null, this.array);
};
process.title = "browser";
process.browser = true;
process.env = {};
process.argv = [];
process.version = ""; // empty string to avoid regexp issues
process.versions = {};
function noop() {}
process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;
process.listeners = function(name) {
    return [];
};
process.binding = function(name) {
    throw new Error("process.binding is not supported");
};
process.cwd = function() {
    return "/";
};
process.chdir = function(dir) {
    throw new Error("process.chdir is not supported");
};
process.umask = function() {
    return 0;
};

},{}],"2Nl6N":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * 
 * @param {number} length 
 * @returns {string}
 */ const MODULE_LENGTH = 5;
const MODULE_SEPARATOR = "";
const generateId = (length = 8, separator = MODULE_SEPARATOR, moduleLength = MODULE_LENGTH)=>{
    let modules = [];
    for(let i = 0; i < Math.floor(length / moduleLength); i++)modules.push(moduleLength);
    if (length % moduleLength !== 0) modules.push(length % moduleLength);
    return modules.map((length)=>{
        const multiplier = parseInt(`0x1${"0".repeat(length)}`);
        const seed = 1 + Math.random();
        return Math.floor(seed * multiplier).toString(16).substring(1);
    }).join(separator);
};
exports.default = generateId;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"iZj57":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * 
 * @param {number} value 
 * @param {number} [digits=4] 
 */ const toHex = (value, digits = 4)=>{
    return ("0".repeat(digits - 1) + value.toString(16)).slice(-digits);
};
exports.default = toHex;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"9TdSF":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * 
 * @param {number} bytes 
 * @param {number} [decimals=2] 
 * @returns {string}
 */ const formatByteSize = (bytes, decimals = 2)=>{
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = [
        "Bytes",
        "KB",
        "MB",
        "GB",
        "TB",
        "PB",
        "EB",
        "ZB",
        "YB"
    ];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};
exports.default = formatByteSize;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"kfDNu":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * 
 * @param {Uint8Array} buffer 
 * @returns {string}
 */ const bufferToHex = (buffer)=>{
    return [
        ...buffer
    ].map((byte)=>byte.toString(16).padStart(2, "0")).join("");
};
exports.default = bufferToHex;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"fJ2Pv":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * 
 * @param {string} hexNumber 
 * @returns {Uint8Array}
 */ const hexToBuffer = (hexNumber)=>{
    let array = hexNumber.match(/.{1,2}/g).map((byte)=>parseInt(byte, 16));
    return new Uint8Array(array);
};
exports.default = hexToBuffer;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"fkkbr":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * @typedef ColorType
 * @type {('white'|'red'|'pink'|'purple'|'deep_purple'|'indigo'|'blue'|'light_blue'|'cyan'|'teal'|'green'|'light_green'|'lime'|'yellow'|'amber'|'orange'|'deep_orange'|'brown'|'grey'|'blue_grey'|'black')}
 */ const Color = {
    RED: "#f44336",
    PINK: "#e91e63",
    PURPLE: "#9c27b0",
    DEEP_PURPLE: "#673ab7",
    INDIGO: "#3f51b5",
    BLUE: "#2196f3",
    LIGHT_BLUE: "#03a9f4",
    CYAN: "#00bcd4",
    TEAL: "#009688",
    GREEN: "#4caf50",
    LIGHT_GREEN: "#8bc34a",
    LIME: "#cddc39",
    YELLOW: "#ffeb3b",
    AMBER: "#ffc107",
    ORANGE: "#ff9800",
    DEEP_ORANGE: "#ff5722",
    /**
     * 
     * @param {ColorType} color 
     * @returns {string}
     */ getHex: (color)=>{
        let key = color.toUpperCase();
        return Color[key] || null;
    },
    /**
     * 
     * @param {ColorType} color 
     */ toNumber: (color)=>{
        let hex = Color.getHex(color);
        if (hex === null) return 0;
        return parseInt(hex.split("#")[1], 16);
    },
    /**
     * 
     * @returns {string}
     */ getRandomHex: ()=>{
        let keys = Object.keys(Color).filter((key)=>typeof Color[key] === "string");
        let index = Math.floor(Math.random() * keys.length);
        let color = keys[index];
        return Color[color];
    }
};
exports.default = Color;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"2eHEa":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * @typedef DataType
 * @type {('number'|'string'|'boolean'|'object'|'array'|'email')}
 */ /**
 * @typedef Schema
 * @property {DataType} type type of the property
 * @property {boolean} required is required
 * @property {Object<string,Schema>} properties validate object properties (works only with type='object')
 * @property {boolean} flexible is object flexible (works only with type='object')
 * @property {Schema} items type of the properties (works only with type='array')
 */ /**
 * @callback ValidationFn
 * @param {string} propertyName
 * @param {Schema} schema
 * @param {any} data
 * @returns {boolean|string}
 */ class JSONSchema {
    /**
     * @private
     * @type {Map<string,ValidationFn>}
     */ validators = new Map();
    /**
     * @private
     * @type {Schema}
     */ schema = null;
    /**
     * 
     * @param {Schema} schema 
     */ constructor(schema){
        this.register("string", this.validateString);
        this.register("boolean", this.validateBoolean);
        this.register("number", this.validateNumber);
        this.register("object", this.validateObject);
        this.register("array", this.validateArray);
        this.register("email", this.validateEmail);
        this.validateSchema(schema);
        this.schema = schema;
    }
    /**
     * 
     * @param {string} type 
     * @param {ValidationFn} validationFn 
     */ register(type = null, validationFn = null) {
        if (typeof type !== "string") throw new Error(`validation type must be a string, "${type}" provided`);
        if (this.validators.has(type)) throw new Error(`validation type "${type}" is already registered`);
        if (typeof validationFn !== "function") throw new Error(`validation function is not a valid function, ${validationFn} provided`);
        this.validators.set(type, validationFn);
    }
    /**
     * 
     * @param {any} data 
     */ validate(data) {
        let validator = this.validators.get(this.schema.type) || null;
        validator(null, this.schema, data);
    }
    /**
     * @private
     * @param {Schema} schema 
     */ validateSchema(schema) {
        if (typeof schema !== "object") throw new Error(`schema must be an object, "${schema}" provided`);
        if (typeof schema.type !== "string") throw new Error(`schema type must be a string, "${schema.type}" provided`);
        if (typeof schema.properties !== "object") return;
        if (!this.validators.has(schema.type)) throw new Error(`schama type does not exist, "${schema.type}" provided`);
        if (schema.type === "array" && typeof schema.items === "object") this.validateSchema(schema.items);
        for(let property in schema.properties)this.validateSchema(schema.properties[property]);
    }
    /**
     * @private
     * @type {ValidationFn}
     */ validateString = (propertyName, schema, data)=>{
        if (typeof data !== "string") throw new Error(`property "${propertyName}" must be a string, "${data}" provided`);
    };
    /**
     * @private
     * @type {ValidationFn}
     */ validateBoolean = (propertyName, schema, data)=>{
        if (typeof data !== "boolean") throw new Error(`property "${propertyName}" can be "true" or "false", "${data}" provided`);
    };
    /**
     * @private
     * @type {ValidationFn}
     */ validateNumber = (propertyName, schema, data)=>{
        if (typeof data !== "number") throw new Error(`property "${propertyName}" must be a number, "${data}" provided`);
    };
    /**
     * @private
     * @type {ValidationFn}
     */ validateObject = (propertyName, schema, data)=>{
        if (typeof data !== "object") throw new Error(`property "${propertyName}" must be an object, "${data}" provided`);
        let isStrict = schema.flexible !== true;
        let propList = new Set();
        Object.keys(schema.properties).forEach((propName)=>propList.add(propName));
        Object.keys(data).forEach((propName)=>propList.add(propName));
        for (let propName of propList){
            let propSchema = typeof schema.properties[propName] === "object" ? schema.properties[propName] : null;
            if (propSchema === null && isStrict) throw new Error(`property "${propName}" is not expected`);
            else if (propSchema === null && !isStrict) continue;
            if (typeof data[propName] === "undefined" && propSchema.required === false) continue;
            let validator = this.validators.get(propSchema.type);
            validator(propName, propSchema, data[propName]);
        }
    };
    /**
     * @private
     * @type {ValidationFn}
     */ validateArray = (propertyName, schema, data)=>{
        if (!Array.isArray(data)) throw new Error(`property "${propertyName}" must be an array, "${data}" provided`);
        if (typeof schema.items !== "object") return;
        let validator = this.validators.get(schema.items.type);
        for (let [index, item] of data.entries())validator(`${propertyName}[${index}]`, schema.items, item);
    };
    /**
     * @private
     * @type {ValidationFn}
     */ validateEmail = (propertyName, schema, data)=>{
        const mailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g;
        if (typeof data !== "string") throw new Error(`property "${propertyName}" must be a string, "${data}" provided`);
        if (!mailRegex.test(data)) throw new Error(`property "${propertyName}" must be a valid email address, "${data}" provided`);
    };
}
exports.default = JSONSchema;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"anUGx":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * 
 * @param {string|number} value 
 * @param {number} defaultValue 
 * @param {number} min 
 * @param {number} max 
 */ const getNumberInRange = (value, defaultValue = 0, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER)=>{
    let number = null;
    if (typeof value === "string") {
        value = parseInt(value, 10);
        if (Number.isNaN(value)) number = defaultValue;
    } else if (typeof value !== "number") number = defaultValue;
    else throw new Error(`not supported value type "${typeof value}"`);
    return Math.min(Math.max(number, min), max);
};
exports.default = getNumberInRange;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"8nP4U":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * @template T
 */ class Cache {
    /**
     * @typedef CachedEntry
     * @property {number} fetchedAt
     * @property {T} data
     */ /**
     * @callback FetchFn
     * @returns {T|Promise<T>}
     */ /**
     * @private
     * @type {Map<string,CachedEntry>}
     */ entiries = new Map();
    /**
     * @readonly
     * @type {number}
     */ fetchedAt = 0;
    /**
     * @private
     * @type {number}
     */ ms = 0;
    /**
     * @private
     * @type {FetchFn}
     */ fetchFn = null;
    /**
     * 
     * @param {FetchFn} fetchFn 
     * @param {number} ms 
     */ constructor(fetchFn, ms = 0){
        if (typeof fetchFn !== "function") throw new Error(`fetchFn must be a function, ${fetchFn} provided`);
        this.fetchFn = fetchFn;
        this.setMS(ms);
    }
    async get(...args) {
        let currentTime = this.getTime();
        let hash = this.getHash(args);
        let entry = this.getEntry(hash);
        if (currentTime > entry.fetchedAt + this.ms) {
            entry.data = await this.fetchFn(...args);
            entry.fetchedAt = currentTime;
        }
        return entry.data;
    }
    setMS(ms = 0) {
        if (typeof ms !== "number") throw new Error(`ms must be a number, ${ms} provided`);
        this.ms = ms;
    }
    /**
     * @private
     * @returns {number}
     */ getTime() {
        return new Date().getTime();
    }
    /**
     * @private
     * @param {any} filter 
     * @returns {string}
     */ getHash(filter) {
        let hash = JSON.stringify(filter);
        return hash;
    }
    /**
     * @private
     * @param {string} hash 
     */ getEntry(hash) {
        let entry = this.entiries.get(hash) || null;
        if (entry === null) {
            entry = {
                data: null,
                fetchedAt: 0
            };
            this.entiries.set(hash, entry);
        }
        return entry;
    }
}
exports.default = Cache;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"amWrd":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var _light = require("protobufjs/light");
var _generateId = require("./generateId");
var _generateIdDefault = parcelHelpers.interopDefault(_generateId);
/**
 * @typedef FieldType
 * @property {string} key
 * @property {('double'|'float'|'int32'|'uint32'|'sint32'|'fixed32'|'sfixed32'|'int64'|'uint64'|'sint64'|'fixed64'|'sfixed64'|'string'|'bool'|'bytes')} type
 * @property {('optional'|'required'|'repeated')} rule
 */ class Serializer {
    /** @private */ writer = new (0, _light.Writer)();
    /**
     * @private
     * @type {Root}
     */ root = null;
    /**
     * @private
     * @type {Namespace}
     */ namespace = null;
    /**
     * @param {string} [id]
     */ constructor(id = null){
        if (id === null) id = (0, _generateIdDefault.default)(16);
        this.root = new (0, _light.Root)();
        this.namespace = this.root.define(id);
    }
    /**
     * 
     * @param {string} key 
     * @param {Array<FieldType>} fields 
     */ define(key, fields = []) {
        let type = new (0, _light.Type)(key);
        for (let [index, field] of fields.entries())type.add(new (0, _light.Field)(field.key, index + 1, field.type, field.rule));
        this.namespace.add(type);
    }
    /**
     * @param {string} key
     * @param {Object<string,any>} message
     * @returns {Uint8Array} 
     */ encode(key, message) {
        this.writer.reset();
        let type = this.getType(key);
        try {
            return type.encode(message, this.writer).finish();
        } catch (error) {
            throw new Error(`encode error: ${error.message}`);
        }
    }
    /**
     * @param {string} key
     * @param {Uint8Array} buffer
     * @returns {Object<string,any>} 
     */ decode(key, buffer) {
        let type = this.getType(key);
        try {
            return type.decode(buffer);
        } catch (error) {
            throw new Error(`decode error: ${error.message}`);
        }
    }
    /**
     * @private
     * @param {string} schema
     * @returns {Type} 
     */ getType(key) {
        try {
            return this.namespace.lookupType(key);
        } catch (error) {
            throw new Error(`type key=${key} is not defined`);
        }
    }
}
exports.default = Serializer;

},{"protobufjs/light":"lxmnZ","./generateId":"2Nl6N","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"lxmnZ":[function(require,module,exports) {
// light library entry point.
"use strict";
module.exports = require("./src/index-light");

},{"./src/index-light":"dEgso"}],"dEgso":[function(require,module,exports) {
"use strict";
var protobuf = module.exports = require("./index-minimal");
protobuf.build = "light";
/**
 * A node-style callback as used by {@link load} and {@link Root#load}.
 * @typedef LoadCallback
 * @type {function}
 * @param {Error|null} error Error, if any, otherwise `null`
 * @param {Root} [root] Root, if there hasn't been an error
 * @returns {undefined}
 */ /**
 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and calls the callback.
 * @param {string|string[]} filename One or multiple files to load
 * @param {Root} root Root namespace, defaults to create a new one if omitted.
 * @param {LoadCallback} callback Callback function
 * @returns {undefined}
 * @see {@link Root#load}
 */ function load(filename, root, callback) {
    if (typeof root === "function") {
        callback = root;
        root = new protobuf.Root();
    } else if (!root) root = new protobuf.Root();
    return root.load(filename, callback);
}
/**
 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and calls the callback.
 * @name load
 * @function
 * @param {string|string[]} filename One or multiple files to load
 * @param {LoadCallback} callback Callback function
 * @returns {undefined}
 * @see {@link Root#load}
 * @variation 2
 */ // function load(filename:string, callback:LoadCallback):undefined
/**
 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and returns a promise.
 * @name load
 * @function
 * @param {string|string[]} filename One or multiple files to load
 * @param {Root} [root] Root namespace, defaults to create a new one if omitted.
 * @returns {Promise<Root>} Promise
 * @see {@link Root#load}
 * @variation 3
 */ // function load(filename:string, [root:Root]):Promise<Root>
protobuf.load = load;
/**
 * Synchronously loads one or multiple .proto or preprocessed .json files into a common root namespace (node only).
 * @param {string|string[]} filename One or multiple files to load
 * @param {Root} [root] Root namespace, defaults to create a new one if omitted.
 * @returns {Root} Root namespace
 * @throws {Error} If synchronous fetching is not supported (i.e. in browsers) or if a file's syntax is invalid
 * @see {@link Root#loadSync}
 */ function loadSync(filename, root) {
    if (!root) root = new protobuf.Root();
    return root.loadSync(filename);
}
protobuf.loadSync = loadSync;
// Serialization
protobuf.encoder = require("./encoder");
protobuf.decoder = require("./decoder");
protobuf.verifier = require("./verifier");
protobuf.converter = require("./converter");
// Reflection
protobuf.ReflectionObject = require("./object");
protobuf.Namespace = require("./namespace");
protobuf.Root = require("./root");
protobuf.Enum = require("./enum");
protobuf.Type = require("./type");
protobuf.Field = require("./field");
protobuf.OneOf = require("./oneof");
protobuf.MapField = require("./mapfield");
protobuf.Service = require("./service");
protobuf.Method = require("./method");
// Runtime
protobuf.Message = require("./message");
protobuf.wrappers = require("./wrappers");
// Utility
protobuf.types = require("./types");
protobuf.util = require("./util");
// Set up possibly cyclic reflection dependencies
protobuf.ReflectionObject._configure(protobuf.Root);
protobuf.Namespace._configure(protobuf.Type, protobuf.Service, protobuf.Enum);
protobuf.Root._configure(protobuf.Type);
protobuf.Field._configure(protobuf.Type);

},{"./index-minimal":"kFkOY","./encoder":"2Tm2M","./decoder":"em0YB","./verifier":"bOenx","./converter":"dDM7d","./object":"aySAl","./namespace":"11udM","./root":"8raSc","./enum":"ctHUl","./type":"6v8Mj","./field":"eqf59","./oneof":"jIa8c","./mapfield":"2RIZG","./service":"bWLAN","./method":"gpCFJ","./message":"46CgL","./wrappers":"gMoL0","./types":"lER3o","./util":"lXEbJ"}],"kFkOY":[function(require,module,exports) {
"use strict";
var protobuf = exports;
/**
 * Build type, one of `"full"`, `"light"` or `"minimal"`.
 * @name build
 * @type {string}
 * @const
 */ protobuf.build = "minimal";
// Serialization
protobuf.Writer = require("./writer");
protobuf.BufferWriter = require("./writer_buffer");
protobuf.Reader = require("./reader");
protobuf.BufferReader = require("./reader_buffer");
// Utility
protobuf.util = require("./util/minimal");
protobuf.rpc = require("./rpc");
protobuf.roots = require("./roots");
protobuf.configure = configure;
/* istanbul ignore next */ /**
 * Reconfigures the library according to the environment.
 * @returns {undefined}
 */ function configure() {
    protobuf.util._configure();
    protobuf.Writer._configure(protobuf.BufferWriter);
    protobuf.Reader._configure(protobuf.BufferReader);
}
// Set up buffer utility according to the environment
configure();

},{"./writer":"boWmp","./writer_buffer":"gIB4S","./reader":"bN2lE","./reader_buffer":"1b0Ms","./util/minimal":"4HDe1","./rpc":"eRwa1","./roots":"bJQDp"}],"boWmp":[function(require,module,exports) {
"use strict";
module.exports = Writer;
var util = require("./util/minimal");
var BufferWriter; // cyclic
var LongBits = util.LongBits, base64 = util.base64, utf8 = util.utf8;
/**
 * Constructs a new writer operation instance.
 * @classdesc Scheduled writer operation.
 * @constructor
 * @param {function(*, Uint8Array, number)} fn Function to call
 * @param {number} len Value byte length
 * @param {*} val Value to write
 * @ignore
 */ function Op(fn, len, val) {
    /**
     * Function to call.
     * @type {function(Uint8Array, number, *)}
     */ this.fn = fn;
    /**
     * Value byte length.
     * @type {number}
     */ this.len = len;
    /**
     * Next operation.
     * @type {Writer.Op|undefined}
     */ this.next = undefined;
    /**
     * Value to write.
     * @type {*}
     */ this.val = val; // type varies
}
/* istanbul ignore next */ function noop() {} // eslint-disable-line no-empty-function
/**
 * Constructs a new writer state instance.
 * @classdesc Copied writer state.
 * @memberof Writer
 * @constructor
 * @param {Writer} writer Writer to copy state from
 * @ignore
 */ function State(writer) {
    /**
     * Current head.
     * @type {Writer.Op}
     */ this.head = writer.head;
    /**
     * Current tail.
     * @type {Writer.Op}
     */ this.tail = writer.tail;
    /**
     * Current buffer length.
     * @type {number}
     */ this.len = writer.len;
    /**
     * Next state.
     * @type {State|null}
     */ this.next = writer.states;
}
/**
 * Constructs a new writer instance.
 * @classdesc Wire format writer using `Uint8Array` if available, otherwise `Array`.
 * @constructor
 */ function Writer() {
    /**
     * Current length.
     * @type {number}
     */ this.len = 0;
    /**
     * Operations head.
     * @type {Object}
     */ this.head = new Op(noop, 0, 0);
    /**
     * Operations tail
     * @type {Object}
     */ this.tail = this.head;
    /**
     * Linked forked states.
     * @type {Object|null}
     */ this.states = null;
// When a value is written, the writer calculates its byte length and puts it into a linked
// list of operations to perform when finish() is called. This both allows us to allocate
// buffers of the exact required size and reduces the amount of work we have to do compared
// to first calculating over objects and then encoding over objects. In our case, the encoding
// part is just a linked list walk calling operations with already prepared values.
}
var create = function create() {
    return util.Buffer ? function create_buffer_setup() {
        return (Writer.create = function create_buffer() {
            return new BufferWriter();
        })();
    } : function create_array() {
        return new Writer();
    };
};
/**
 * Creates a new writer.
 * @function
 * @returns {BufferWriter|Writer} A {@link BufferWriter} when Buffers are supported, otherwise a {@link Writer}
 */ Writer.create = create();
/**
 * Allocates a buffer of the specified size.
 * @param {number} size Buffer size
 * @returns {Uint8Array} Buffer
 */ Writer.alloc = function alloc(size) {
    return new util.Array(size);
};
// Use Uint8Array buffer pool in the browser, just like node does with buffers
/* istanbul ignore else */ if (util.Array !== Array) Writer.alloc = util.pool(Writer.alloc, util.Array.prototype.subarray);
/**
 * Pushes a new operation to the queue.
 * @param {function(Uint8Array, number, *)} fn Function to call
 * @param {number} len Value byte length
 * @param {number} val Value to write
 * @returns {Writer} `this`
 * @private
 */ Writer.prototype._push = function push(fn, len, val) {
    this.tail = this.tail.next = new Op(fn, len, val);
    this.len += len;
    return this;
};
function writeByte(val, buf, pos) {
    buf[pos] = val & 255;
}
function writeVarint32(val, buf, pos) {
    while(val > 127){
        buf[pos++] = val & 127 | 128;
        val >>>= 7;
    }
    buf[pos] = val;
}
/**
 * Constructs a new varint writer operation instance.
 * @classdesc Scheduled varint writer operation.
 * @extends Op
 * @constructor
 * @param {number} len Value byte length
 * @param {number} val Value to write
 * @ignore
 */ function VarintOp(len, val) {
    this.len = len;
    this.next = undefined;
    this.val = val;
}
VarintOp.prototype = Object.create(Op.prototype);
VarintOp.prototype.fn = writeVarint32;
/**
 * Writes an unsigned 32 bit value as a varint.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.uint32 = function write_uint32(value) {
    // here, the call to this.push has been inlined and a varint specific Op subclass is used.
    // uint32 is by far the most frequently used operation and benefits significantly from this.
    this.len += (this.tail = this.tail.next = new VarintOp((value = value >>> 0) < 128 ? 1 : value < 16384 ? 2 : value < 2097152 ? 3 : value < 268435456 ? 4 : 5, value)).len;
    return this;
};
/**
 * Writes a signed 32 bit value as a varint.
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.int32 = function write_int32(value) {
    return value < 0 ? this._push(writeVarint64, 10, LongBits.fromNumber(value)) // 10 bytes per spec
     : this.uint32(value);
};
/**
 * Writes a 32 bit value as a varint, zig-zag encoded.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.sint32 = function write_sint32(value) {
    return this.uint32((value << 1 ^ value >> 31) >>> 0);
};
function writeVarint64(val, buf, pos) {
    while(val.hi){
        buf[pos++] = val.lo & 127 | 128;
        val.lo = (val.lo >>> 7 | val.hi << 25) >>> 0;
        val.hi >>>= 7;
    }
    while(val.lo > 127){
        buf[pos++] = val.lo & 127 | 128;
        val.lo = val.lo >>> 7;
    }
    buf[pos++] = val.lo;
}
/**
 * Writes an unsigned 64 bit value as a varint.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */ Writer.prototype.uint64 = function write_uint64(value) {
    var bits = LongBits.from(value);
    return this._push(writeVarint64, bits.length(), bits);
};
/**
 * Writes a signed 64 bit value as a varint.
 * @function
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */ Writer.prototype.int64 = Writer.prototype.uint64;
/**
 * Writes a signed 64 bit value as a varint, zig-zag encoded.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */ Writer.prototype.sint64 = function write_sint64(value) {
    var bits = LongBits.from(value).zzEncode();
    return this._push(writeVarint64, bits.length(), bits);
};
/**
 * Writes a boolish value as a varint.
 * @param {boolean} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.bool = function write_bool(value) {
    return this._push(writeByte, 1, value ? 1 : 0);
};
function writeFixed32(val, buf, pos) {
    buf[pos] = val & 255;
    buf[pos + 1] = val >>> 8 & 255;
    buf[pos + 2] = val >>> 16 & 255;
    buf[pos + 3] = val >>> 24;
}
/**
 * Writes an unsigned 32 bit value as fixed 32 bits.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.fixed32 = function write_fixed32(value) {
    return this._push(writeFixed32, 4, value >>> 0);
};
/**
 * Writes a signed 32 bit value as fixed 32 bits.
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.sfixed32 = Writer.prototype.fixed32;
/**
 * Writes an unsigned 64 bit value as fixed 64 bits.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */ Writer.prototype.fixed64 = function write_fixed64(value) {
    var bits = LongBits.from(value);
    return this._push(writeFixed32, 4, bits.lo)._push(writeFixed32, 4, bits.hi);
};
/**
 * Writes a signed 64 bit value as fixed 64 bits.
 * @function
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */ Writer.prototype.sfixed64 = Writer.prototype.fixed64;
/**
 * Writes a float (32 bit).
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.float = function write_float(value) {
    return this._push(util.float.writeFloatLE, 4, value);
};
/**
 * Writes a double (64 bit float).
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.double = function write_double(value) {
    return this._push(util.float.writeDoubleLE, 8, value);
};
var writeBytes = util.Array.prototype.set ? function writeBytes_set(val, buf, pos) {
    buf.set(val, pos); // also works for plain array values
} : function writeBytes_for(val, buf, pos) {
    for(var i = 0; i < val.length; ++i)buf[pos + i] = val[i];
};
/**
 * Writes a sequence of bytes.
 * @param {Uint8Array|string} value Buffer or base64 encoded string to write
 * @returns {Writer} `this`
 */ Writer.prototype.bytes = function write_bytes(value) {
    var len = value.length >>> 0;
    if (!len) return this._push(writeByte, 1, 0);
    if (util.isString(value)) {
        var buf = Writer.alloc(len = base64.length(value));
        base64.decode(value, buf, 0);
        value = buf;
    }
    return this.uint32(len)._push(writeBytes, len, value);
};
/**
 * Writes a string.
 * @param {string} value Value to write
 * @returns {Writer} `this`
 */ Writer.prototype.string = function write_string(value) {
    var len = utf8.length(value);
    return len ? this.uint32(len)._push(utf8.write, len, value) : this._push(writeByte, 1, 0);
};
/**
 * Forks this writer's state by pushing it to a stack.
 * Calling {@link Writer#reset|reset} or {@link Writer#ldelim|ldelim} resets the writer to the previous state.
 * @returns {Writer} `this`
 */ Writer.prototype.fork = function fork() {
    this.states = new State(this);
    this.head = this.tail = new Op(noop, 0, 0);
    this.len = 0;
    return this;
};
/**
 * Resets this instance to the last state.
 * @returns {Writer} `this`
 */ Writer.prototype.reset = function reset() {
    if (this.states) {
        this.head = this.states.head;
        this.tail = this.states.tail;
        this.len = this.states.len;
        this.states = this.states.next;
    } else {
        this.head = this.tail = new Op(noop, 0, 0);
        this.len = 0;
    }
    return this;
};
/**
 * Resets to the last state and appends the fork state's current write length as a varint followed by its operations.
 * @returns {Writer} `this`
 */ Writer.prototype.ldelim = function ldelim() {
    var head = this.head, tail = this.tail, len = this.len;
    this.reset().uint32(len);
    if (len) {
        this.tail.next = head.next; // skip noop
        this.tail = tail;
        this.len += len;
    }
    return this;
};
/**
 * Finishes the write operation.
 * @returns {Uint8Array} Finished buffer
 */ Writer.prototype.finish = function finish() {
    var head = this.head.next, buf = this.constructor.alloc(this.len), pos = 0;
    while(head){
        head.fn(head.val, buf, pos);
        pos += head.len;
        head = head.next;
    }
    // this.head = this.tail = null;
    return buf;
};
Writer._configure = function(BufferWriter_) {
    BufferWriter = BufferWriter_;
    Writer.create = create();
    BufferWriter._configure();
};

},{"./util/minimal":"4HDe1"}],"4HDe1":[function(require,module,exports) {
"use strict";
var global = arguments[3];
var util = exports;
// used to return a Promise where callback is omitted
util.asPromise = require("@protobufjs/aspromise");
// converts to / from base64 encoded strings
util.base64 = require("@protobufjs/base64");
// base class of rpc.Service
util.EventEmitter = require("@protobufjs/eventemitter");
// float handling accross browsers
util.float = require("@protobufjs/float");
// requires modules optionally and hides the call from bundlers
util.inquire = require("@protobufjs/inquire");
// converts to / from utf8 encoded strings
util.utf8 = require("@protobufjs/utf8");
// provides a node-like buffer pool in the browser
util.pool = require("@protobufjs/pool");
// utility to work with the low and high bits of a 64 bit value
util.LongBits = require("./longbits");
/**
 * Whether running within node or not.
 * @memberof util
 * @type {boolean}
 */ util.isNode = Boolean(typeof global !== "undefined" && global && global.process && global.process.versions && global.process.versions.node);
/**
 * Global object reference.
 * @memberof util
 * @type {Object}
 */ util.global = util.isNode && global || typeof window !== "undefined" && window || typeof self !== "undefined" && self || this; // eslint-disable-line no-invalid-this
/**
 * An immuable empty array.
 * @memberof util
 * @type {Array.<*>}
 * @const
 */ util.emptyArray = Object.freeze ? Object.freeze([]) : /* istanbul ignore next */ []; // used on prototypes
/**
 * An immutable empty object.
 * @type {Object}
 * @const
 */ util.emptyObject = Object.freeze ? Object.freeze({}) : /* istanbul ignore next */ {}; // used on prototypes
/**
 * Tests if the specified value is an integer.
 * @function
 * @param {*} value Value to test
 * @returns {boolean} `true` if the value is an integer
 */ util.isInteger = Number.isInteger || /* istanbul ignore next */ function isInteger(value) {
    return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
};
/**
 * Tests if the specified value is a string.
 * @param {*} value Value to test
 * @returns {boolean} `true` if the value is a string
 */ util.isString = function isString(value) {
    return typeof value === "string" || value instanceof String;
};
/**
 * Tests if the specified value is a non-null object.
 * @param {*} value Value to test
 * @returns {boolean} `true` if the value is a non-null object
 */ util.isObject = function isObject(value) {
    return value && typeof value === "object";
};
/**
 * Checks if a property on a message is considered to be present.
 * This is an alias of {@link util.isSet}.
 * @function
 * @param {Object} obj Plain object or message instance
 * @param {string} prop Property name
 * @returns {boolean} `true` if considered to be present, otherwise `false`
 */ util.isset = /**
 * Checks if a property on a message is considered to be present.
 * @param {Object} obj Plain object or message instance
 * @param {string} prop Property name
 * @returns {boolean} `true` if considered to be present, otherwise `false`
 */ util.isSet = function isSet(obj, prop) {
    var value = obj[prop];
    if (value != null && obj.hasOwnProperty(prop)) return typeof value !== "object" || (Array.isArray(value) ? value.length : Object.keys(value).length) > 0;
    return false;
};
/**
 * Any compatible Buffer instance.
 * This is a minimal stand-alone definition of a Buffer instance. The actual type is that exported by node's typings.
 * @interface Buffer
 * @extends Uint8Array
 */ /**
 * Node's Buffer class if available.
 * @type {Constructor<Buffer>}
 */ util.Buffer = function() {
    try {
        var Buffer = util.inquire("buffer").Buffer;
        // refuse to use non-node buffers if not explicitly assigned (perf reasons):
        return Buffer.prototype.utf8Write ? Buffer : /* istanbul ignore next */ null;
    } catch (e) {
        /* istanbul ignore next */ return null;
    }
}();
// Internal alias of or polyfull for Buffer.from.
util._Buffer_from = null;
// Internal alias of or polyfill for Buffer.allocUnsafe.
util._Buffer_allocUnsafe = null;
/**
 * Creates a new buffer of whatever type supported by the environment.
 * @param {number|number[]} [sizeOrArray=0] Buffer size or number array
 * @returns {Uint8Array|Buffer} Buffer
 */ util.newBuffer = function newBuffer(sizeOrArray) {
    /* istanbul ignore next */ return typeof sizeOrArray === "number" ? util.Buffer ? util._Buffer_allocUnsafe(sizeOrArray) : new util.Array(sizeOrArray) : util.Buffer ? util._Buffer_from(sizeOrArray) : typeof Uint8Array === "undefined" ? sizeOrArray : new Uint8Array(sizeOrArray);
};
/**
 * Array implementation used in the browser. `Uint8Array` if supported, otherwise `Array`.
 * @type {Constructor<Uint8Array>}
 */ util.Array = typeof Uint8Array !== "undefined" ? Uint8Array /* istanbul ignore next */  : Array;
/**
 * Any compatible Long instance.
 * This is a minimal stand-alone definition of a Long instance. The actual type is that exported by long.js.
 * @interface Long
 * @property {number} low Low bits
 * @property {number} high High bits
 * @property {boolean} unsigned Whether unsigned or not
 */ /**
 * Long.js's Long class if available.
 * @type {Constructor<Long>}
 */ util.Long = /* istanbul ignore next */ util.global.dcodeIO && /* istanbul ignore next */ util.global.dcodeIO.Long || /* istanbul ignore next */ util.global.Long || util.inquire("long");
/**
 * Regular expression used to verify 2 bit (`bool`) map keys.
 * @type {RegExp}
 * @const
 */ util.key2Re = /^true|false|0|1$/;
/**
 * Regular expression used to verify 32 bit (`int32` etc.) map keys.
 * @type {RegExp}
 * @const
 */ util.key32Re = /^-?(?:0|[1-9][0-9]*)$/;
/**
 * Regular expression used to verify 64 bit (`int64` etc.) map keys.
 * @type {RegExp}
 * @const
 */ util.key64Re = /^(?:[\\x00-\\xff]{8}|-?(?:0|[1-9][0-9]*))$/;
/**
 * Converts a number or long to an 8 characters long hash string.
 * @param {Long|number} value Value to convert
 * @returns {string} Hash
 */ util.longToHash = function longToHash(value) {
    return value ? util.LongBits.from(value).toHash() : util.LongBits.zeroHash;
};
/**
 * Converts an 8 characters long hash string to a long or number.
 * @param {string} hash Hash
 * @param {boolean} [unsigned=false] Whether unsigned or not
 * @returns {Long|number} Original value
 */ util.longFromHash = function longFromHash(hash, unsigned) {
    var bits = util.LongBits.fromHash(hash);
    if (util.Long) return util.Long.fromBits(bits.lo, bits.hi, unsigned);
    return bits.toNumber(Boolean(unsigned));
};
/**
 * Merges the properties of the source object into the destination object.
 * @memberof util
 * @param {Object.<string,*>} dst Destination object
 * @param {Object.<string,*>} src Source object
 * @param {boolean} [ifNotSet=false] Merges only if the key is not already set
 * @returns {Object.<string,*>} Destination object
 */ function merge(dst, src, ifNotSet) {
    for(var keys = Object.keys(src), i = 0; i < keys.length; ++i)if (dst[keys[i]] === undefined || !ifNotSet) dst[keys[i]] = src[keys[i]];
    return dst;
}
util.merge = merge;
/**
 * Converts the first character of a string to lower case.
 * @param {string} str String to convert
 * @returns {string} Converted string
 */ util.lcFirst = function lcFirst(str) {
    return str.charAt(0).toLowerCase() + str.substring(1);
};
/**
 * Creates a custom error constructor.
 * @memberof util
 * @param {string} name Error name
 * @returns {Constructor<Error>} Custom error constructor
 */ function newError(name) {
    function CustomError(message, properties) {
        if (!(this instanceof CustomError)) return new CustomError(message, properties);
        // Error.call(this, message);
        // ^ just returns a new error instance because the ctor can be called as a function
        Object.defineProperty(this, "message", {
            get: function() {
                return message;
            }
        });
        /* istanbul ignore next */ if (Error.captureStackTrace) Error.captureStackTrace(this, CustomError);
        else Object.defineProperty(this, "stack", {
            value: new Error().stack || ""
        });
        if (properties) merge(this, properties);
    }
    CustomError.prototype = Object.create(Error.prototype, {
        constructor: {
            value: CustomError,
            writable: true,
            enumerable: false,
            configurable: true
        },
        name: {
            get () {
                return name;
            },
            set: undefined,
            enumerable: false,
            // configurable: false would accurately preserve the behavior of
            // the original, but I'm guessing that was not intentional.
            // For an actual error subclass, this property would
            // be configurable.
            configurable: true
        },
        toString: {
            value () {
                return this.name + ": " + this.message;
            },
            writable: true,
            enumerable: false,
            configurable: true
        }
    });
    return CustomError;
}
util.newError = newError;
/**
 * Constructs a new protocol error.
 * @classdesc Error subclass indicating a protocol specifc error.
 * @memberof util
 * @extends Error
 * @template T extends Message<T>
 * @constructor
 * @param {string} message Error message
 * @param {Object.<string,*>} [properties] Additional properties
 * @example
 * try {
 *     MyMessage.decode(someBuffer); // throws if required fields are missing
 * } catch (e) {
 *     if (e instanceof ProtocolError && e.instance)
 *         console.log("decoded so far: " + JSON.stringify(e.instance));
 * }
 */ util.ProtocolError = newError("ProtocolError");
/**
 * So far decoded message instance.
 * @name util.ProtocolError#instance
 * @type {Message<T>}
 */ /**
 * A OneOf getter as returned by {@link util.oneOfGetter}.
 * @typedef OneOfGetter
 * @type {function}
 * @returns {string|undefined} Set field name, if any
 */ /**
 * Builds a getter for a oneof's present field name.
 * @param {string[]} fieldNames Field names
 * @returns {OneOfGetter} Unbound getter
 */ util.oneOfGetter = function getOneOf(fieldNames) {
    var fieldMap = {};
    for(var i = 0; i < fieldNames.length; ++i)fieldMap[fieldNames[i]] = 1;
    /**
     * @returns {string|undefined} Set field name, if any
     * @this Object
     * @ignore
     */ return function() {
        for(var keys = Object.keys(this), i = keys.length - 1; i > -1; --i)if (fieldMap[keys[i]] === 1 && this[keys[i]] !== undefined && this[keys[i]] !== null) return keys[i];
    };
};
/**
 * A OneOf setter as returned by {@link util.oneOfSetter}.
 * @typedef OneOfSetter
 * @type {function}
 * @param {string|undefined} value Field name
 * @returns {undefined}
 */ /**
 * Builds a setter for a oneof's present field name.
 * @param {string[]} fieldNames Field names
 * @returns {OneOfSetter} Unbound setter
 */ util.oneOfSetter = function setOneOf(fieldNames) {
    /**
     * @param {string} name Field name
     * @returns {undefined}
     * @this Object
     * @ignore
     */ return function(name) {
        for(var i = 0; i < fieldNames.length; ++i)if (fieldNames[i] !== name) delete this[fieldNames[i]];
    };
};
/**
 * Default conversion options used for {@link Message#toJSON} implementations.
 *
 * These options are close to proto3's JSON mapping with the exception that internal types like Any are handled just like messages. More precisely:
 *
 * - Longs become strings
 * - Enums become string keys
 * - Bytes become base64 encoded strings
 * - (Sub-)Messages become plain objects
 * - Maps become plain objects with all string keys
 * - Repeated fields become arrays
 * - NaN and Infinity for float and double fields become strings
 *
 * @type {IConversionOptions}
 * @see https://developers.google.com/protocol-buffers/docs/proto3?hl=en#json
 */ util.toJSONOptions = {
    longs: String,
    enums: String,
    bytes: String,
    json: true
};
// Sets up buffer utility according to the environment (called in index-minimal)
util._configure = function() {
    var Buffer = util.Buffer;
    /* istanbul ignore if */ if (!Buffer) {
        util._Buffer_from = util._Buffer_allocUnsafe = null;
        return;
    }
    // because node 4.x buffers are incompatible & immutable
    // see: https://github.com/dcodeIO/protobuf.js/pull/665
    util._Buffer_from = Buffer.from !== Uint8Array.from && Buffer.from || /* istanbul ignore next */ function Buffer_from(value, encoding) {
        return new Buffer(value, encoding);
    };
    util._Buffer_allocUnsafe = Buffer.allocUnsafe || /* istanbul ignore next */ function Buffer_allocUnsafe(size) {
        return new Buffer(size);
    };
};

},{"@protobufjs/aspromise":"gv7US","@protobufjs/base64":"aOjmr","@protobufjs/eventemitter":"lWFnX","@protobufjs/float":"gifXM","@protobufjs/inquire":"fon4w","@protobufjs/utf8":"8DJTf","@protobufjs/pool":"fadtm","./longbits":"c4DvK"}],"gv7US":[function(require,module,exports) {
"use strict";
module.exports = asPromise;
/**
 * Callback as used by {@link util.asPromise}.
 * @typedef asPromiseCallback
 * @type {function}
 * @param {Error|null} error Error, if any
 * @param {...*} params Additional arguments
 * @returns {undefined}
 */ /**
 * Returns a promise from a node-style callback function.
 * @memberof util
 * @param {asPromiseCallback} fn Function to call
 * @param {*} ctx Function context
 * @param {...*} params Function arguments
 * @returns {Promise<*>} Promisified function
 */ function asPromise(fn, ctx /*, varargs */ ) {
    var params = new Array(arguments.length - 1), offset = 0, index = 2, pending = true;
    while(index < arguments.length)params[offset++] = arguments[index++];
    return new Promise(function executor(resolve, reject) {
        params[offset] = function callback(err /*, varargs */ ) {
            if (pending) {
                pending = false;
                if (err) reject(err);
                else {
                    var params = new Array(arguments.length - 1), offset = 0;
                    while(offset < params.length)params[offset++] = arguments[offset];
                    resolve.apply(null, params);
                }
            }
        };
        try {
            fn.apply(ctx || null, params);
        } catch (err) {
            if (pending) {
                pending = false;
                reject(err);
            }
        }
    });
}

},{}],"aOjmr":[function(require,module,exports) {
"use strict";
/**
 * A minimal base64 implementation for number arrays.
 * @memberof util
 * @namespace
 */ var base64 = exports;
/**
 * Calculates the byte length of a base64 encoded string.
 * @param {string} string Base64 encoded string
 * @returns {number} Byte length
 */ base64.length = function length(string) {
    var p = string.length;
    if (!p) return 0;
    var n = 0;
    while(--p % 4 > 1 && string.charAt(p) === "=")++n;
    return Math.ceil(string.length * 3) / 4 - n;
};
// Base64 encoding table
var b64 = new Array(64);
// Base64 decoding table
var s64 = new Array(123);
// 65..90, 97..122, 48..57, 43, 47
for(var i = 0; i < 64;)s64[b64[i] = i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i - 59 | 43] = i++;
/**
 * Encodes a buffer to a base64 encoded string.
 * @param {Uint8Array} buffer Source buffer
 * @param {number} start Source start
 * @param {number} end Source end
 * @returns {string} Base64 encoded string
 */ base64.encode = function encode(buffer, start, end) {
    var parts = null, chunk = [];
    var i = 0, j = 0, t; // temporary
    while(start < end){
        var b = buffer[start++];
        switch(j){
            case 0:
                chunk[i++] = b64[b >> 2];
                t = (b & 3) << 4;
                j = 1;
                break;
            case 1:
                chunk[i++] = b64[t | b >> 4];
                t = (b & 15) << 2;
                j = 2;
                break;
            case 2:
                chunk[i++] = b64[t | b >> 6];
                chunk[i++] = b64[b & 63];
                j = 0;
                break;
        }
        if (i > 8191) {
            (parts || (parts = [])).push(String.fromCharCode.apply(String, chunk));
            i = 0;
        }
    }
    if (j) {
        chunk[i++] = b64[t];
        chunk[i++] = 61;
        if (j === 1) chunk[i++] = 61;
    }
    if (parts) {
        if (i) parts.push(String.fromCharCode.apply(String, chunk.slice(0, i)));
        return parts.join("");
    }
    return String.fromCharCode.apply(String, chunk.slice(0, i));
};
var invalidEncoding = "invalid encoding";
/**
 * Decodes a base64 encoded string to a buffer.
 * @param {string} string Source string
 * @param {Uint8Array} buffer Destination buffer
 * @param {number} offset Destination offset
 * @returns {number} Number of bytes written
 * @throws {Error} If encoding is invalid
 */ base64.decode = function decode(string, buffer, offset) {
    var start = offset;
    var j = 0, t; // temporary
    for(var i = 0; i < string.length;){
        var c = string.charCodeAt(i++);
        if (c === 61 && j > 1) break;
        if ((c = s64[c]) === undefined) throw Error(invalidEncoding);
        switch(j){
            case 0:
                t = c;
                j = 1;
                break;
            case 1:
                buffer[offset++] = t << 2 | (c & 48) >> 4;
                t = c;
                j = 2;
                break;
            case 2:
                buffer[offset++] = (t & 15) << 4 | (c & 60) >> 2;
                t = c;
                j = 3;
                break;
            case 3:
                buffer[offset++] = (t & 3) << 6 | c;
                j = 0;
                break;
        }
    }
    if (j === 1) throw Error(invalidEncoding);
    return offset - start;
};
/**
 * Tests if the specified string appears to be base64 encoded.
 * @param {string} string String to test
 * @returns {boolean} `true` if probably base64 encoded, otherwise false
 */ base64.test = function test(string) {
    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(string);
};

},{}],"lWFnX":[function(require,module,exports) {
"use strict";
module.exports = EventEmitter;
/**
 * Constructs a new event emitter instance.
 * @classdesc A minimal event emitter.
 * @memberof util
 * @constructor
 */ function EventEmitter() {
    /**
     * Registered listeners.
     * @type {Object.<string,*>}
     * @private
     */ this._listeners = {};
}
/**
 * Registers an event listener.
 * @param {string} evt Event name
 * @param {function} fn Listener
 * @param {*} [ctx] Listener context
 * @returns {util.EventEmitter} `this`
 */ EventEmitter.prototype.on = function on(evt, fn, ctx) {
    (this._listeners[evt] || (this._listeners[evt] = [])).push({
        fn: fn,
        ctx: ctx || this
    });
    return this;
};
/**
 * Removes an event listener or any matching listeners if arguments are omitted.
 * @param {string} [evt] Event name. Removes all listeners if omitted.
 * @param {function} [fn] Listener to remove. Removes all listeners of `evt` if omitted.
 * @returns {util.EventEmitter} `this`
 */ EventEmitter.prototype.off = function off(evt, fn) {
    if (evt === undefined) this._listeners = {};
    else if (fn === undefined) this._listeners[evt] = [];
    else {
        var listeners = this._listeners[evt];
        for(var i = 0; i < listeners.length;)if (listeners[i].fn === fn) listeners.splice(i, 1);
        else ++i;
    }
    return this;
};
/**
 * Emits an event by calling its listeners with the specified arguments.
 * @param {string} evt Event name
 * @param {...*} args Arguments
 * @returns {util.EventEmitter} `this`
 */ EventEmitter.prototype.emit = function emit(evt) {
    var listeners = this._listeners[evt];
    if (listeners) {
        var args = [], i = 1;
        for(; i < arguments.length;)args.push(arguments[i++]);
        for(i = 0; i < listeners.length;)listeners[i].fn.apply(listeners[i++].ctx, args);
    }
    return this;
};

},{}],"gifXM":[function(require,module,exports) {
"use strict";
module.exports = factory(factory);
/**
 * Reads / writes floats / doubles from / to buffers.
 * @name util.float
 * @namespace
 */ /**
 * Writes a 32 bit float to a buffer using little endian byte order.
 * @name util.float.writeFloatLE
 * @function
 * @param {number} val Value to write
 * @param {Uint8Array} buf Target buffer
 * @param {number} pos Target buffer offset
 * @returns {undefined}
 */ /**
 * Writes a 32 bit float to a buffer using big endian byte order.
 * @name util.float.writeFloatBE
 * @function
 * @param {number} val Value to write
 * @param {Uint8Array} buf Target buffer
 * @param {number} pos Target buffer offset
 * @returns {undefined}
 */ /**
 * Reads a 32 bit float from a buffer using little endian byte order.
 * @name util.float.readFloatLE
 * @function
 * @param {Uint8Array} buf Source buffer
 * @param {number} pos Source buffer offset
 * @returns {number} Value read
 */ /**
 * Reads a 32 bit float from a buffer using big endian byte order.
 * @name util.float.readFloatBE
 * @function
 * @param {Uint8Array} buf Source buffer
 * @param {number} pos Source buffer offset
 * @returns {number} Value read
 */ /**
 * Writes a 64 bit double to a buffer using little endian byte order.
 * @name util.float.writeDoubleLE
 * @function
 * @param {number} val Value to write
 * @param {Uint8Array} buf Target buffer
 * @param {number} pos Target buffer offset
 * @returns {undefined}
 */ /**
 * Writes a 64 bit double to a buffer using big endian byte order.
 * @name util.float.writeDoubleBE
 * @function
 * @param {number} val Value to write
 * @param {Uint8Array} buf Target buffer
 * @param {number} pos Target buffer offset
 * @returns {undefined}
 */ /**
 * Reads a 64 bit double from a buffer using little endian byte order.
 * @name util.float.readDoubleLE
 * @function
 * @param {Uint8Array} buf Source buffer
 * @param {number} pos Source buffer offset
 * @returns {number} Value read
 */ /**
 * Reads a 64 bit double from a buffer using big endian byte order.
 * @name util.float.readDoubleBE
 * @function
 * @param {Uint8Array} buf Source buffer
 * @param {number} pos Source buffer offset
 * @returns {number} Value read
 */ // Factory function for the purpose of node-based testing in modified global environments
function factory(exports) {
    // float: typed array
    if (typeof Float32Array !== "undefined") (function() {
        var f32 = new Float32Array([
            -0
        ]), f8b = new Uint8Array(f32.buffer), le = f8b[3] === 128;
        function writeFloat_f32_cpy(val, buf, pos) {
            f32[0] = val;
            buf[pos] = f8b[0];
            buf[pos + 1] = f8b[1];
            buf[pos + 2] = f8b[2];
            buf[pos + 3] = f8b[3];
        }
        function writeFloat_f32_rev(val, buf, pos) {
            f32[0] = val;
            buf[pos] = f8b[3];
            buf[pos + 1] = f8b[2];
            buf[pos + 2] = f8b[1];
            buf[pos + 3] = f8b[0];
        }
        /* istanbul ignore next */ exports.writeFloatLE = le ? writeFloat_f32_cpy : writeFloat_f32_rev;
        /* istanbul ignore next */ exports.writeFloatBE = le ? writeFloat_f32_rev : writeFloat_f32_cpy;
        function readFloat_f32_cpy(buf, pos) {
            f8b[0] = buf[pos];
            f8b[1] = buf[pos + 1];
            f8b[2] = buf[pos + 2];
            f8b[3] = buf[pos + 3];
            return f32[0];
        }
        function readFloat_f32_rev(buf, pos) {
            f8b[3] = buf[pos];
            f8b[2] = buf[pos + 1];
            f8b[1] = buf[pos + 2];
            f8b[0] = buf[pos + 3];
            return f32[0];
        }
        /* istanbul ignore next */ exports.readFloatLE = le ? readFloat_f32_cpy : readFloat_f32_rev;
        /* istanbul ignore next */ exports.readFloatBE = le ? readFloat_f32_rev : readFloat_f32_cpy;
    // float: ieee754
    })();
    else (function() {
        function writeFloat_ieee754(writeUint, val, buf, pos) {
            var sign = val < 0 ? 1 : 0;
            if (sign) val = -val;
            if (val === 0) writeUint(1 / val > 0 ? /* positive */ 0 : /* negative 0 */ 2147483648, buf, pos);
            else if (isNaN(val)) writeUint(2143289344, buf, pos);
            else if (val > 3.4028234663852886e+38) writeUint((sign << 31 | 2139095040) >>> 0, buf, pos);
            else if (val < 1.1754943508222875e-38) writeUint((sign << 31 | Math.round(val / 1.401298464324817e-45)) >>> 0, buf, pos);
            else {
                var exponent = Math.floor(Math.log(val) / Math.LN2), mantissa = Math.round(val * Math.pow(2, -exponent) * 8388608) & 8388607;
                writeUint((sign << 31 | exponent + 127 << 23 | mantissa) >>> 0, buf, pos);
            }
        }
        exports.writeFloatLE = writeFloat_ieee754.bind(null, writeUintLE);
        exports.writeFloatBE = writeFloat_ieee754.bind(null, writeUintBE);
        function readFloat_ieee754(readUint, buf, pos) {
            var uint = readUint(buf, pos), sign = (uint >> 31) * 2 + 1, exponent = uint >>> 23 & 255, mantissa = uint & 8388607;
            return exponent === 255 ? mantissa ? NaN : sign * Infinity : exponent === 0 // denormal
             ? sign * 1.401298464324817e-45 * mantissa : sign * Math.pow(2, exponent - 150) * (mantissa + 8388608);
        }
        exports.readFloatLE = readFloat_ieee754.bind(null, readUintLE);
        exports.readFloatBE = readFloat_ieee754.bind(null, readUintBE);
    })();
    // double: typed array
    if (typeof Float64Array !== "undefined") (function() {
        var f64 = new Float64Array([
            -0
        ]), f8b = new Uint8Array(f64.buffer), le = f8b[7] === 128;
        function writeDouble_f64_cpy(val, buf, pos) {
            f64[0] = val;
            buf[pos] = f8b[0];
            buf[pos + 1] = f8b[1];
            buf[pos + 2] = f8b[2];
            buf[pos + 3] = f8b[3];
            buf[pos + 4] = f8b[4];
            buf[pos + 5] = f8b[5];
            buf[pos + 6] = f8b[6];
            buf[pos + 7] = f8b[7];
        }
        function writeDouble_f64_rev(val, buf, pos) {
            f64[0] = val;
            buf[pos] = f8b[7];
            buf[pos + 1] = f8b[6];
            buf[pos + 2] = f8b[5];
            buf[pos + 3] = f8b[4];
            buf[pos + 4] = f8b[3];
            buf[pos + 5] = f8b[2];
            buf[pos + 6] = f8b[1];
            buf[pos + 7] = f8b[0];
        }
        /* istanbul ignore next */ exports.writeDoubleLE = le ? writeDouble_f64_cpy : writeDouble_f64_rev;
        /* istanbul ignore next */ exports.writeDoubleBE = le ? writeDouble_f64_rev : writeDouble_f64_cpy;
        function readDouble_f64_cpy(buf, pos) {
            f8b[0] = buf[pos];
            f8b[1] = buf[pos + 1];
            f8b[2] = buf[pos + 2];
            f8b[3] = buf[pos + 3];
            f8b[4] = buf[pos + 4];
            f8b[5] = buf[pos + 5];
            f8b[6] = buf[pos + 6];
            f8b[7] = buf[pos + 7];
            return f64[0];
        }
        function readDouble_f64_rev(buf, pos) {
            f8b[7] = buf[pos];
            f8b[6] = buf[pos + 1];
            f8b[5] = buf[pos + 2];
            f8b[4] = buf[pos + 3];
            f8b[3] = buf[pos + 4];
            f8b[2] = buf[pos + 5];
            f8b[1] = buf[pos + 6];
            f8b[0] = buf[pos + 7];
            return f64[0];
        }
        /* istanbul ignore next */ exports.readDoubleLE = le ? readDouble_f64_cpy : readDouble_f64_rev;
        /* istanbul ignore next */ exports.readDoubleBE = le ? readDouble_f64_rev : readDouble_f64_cpy;
    // double: ieee754
    })();
    else (function() {
        function writeDouble_ieee754(writeUint, off0, off1, val, buf, pos) {
            var sign = val < 0 ? 1 : 0;
            if (sign) val = -val;
            if (val === 0) {
                writeUint(0, buf, pos + off0);
                writeUint(1 / val > 0 ? /* positive */ 0 : /* negative 0 */ 2147483648, buf, pos + off1);
            } else if (isNaN(val)) {
                writeUint(0, buf, pos + off0);
                writeUint(2146959360, buf, pos + off1);
            } else if (val > 1.7976931348623157e+308) {
                writeUint(0, buf, pos + off0);
                writeUint((sign << 31 | 2146435072) >>> 0, buf, pos + off1);
            } else {
                var mantissa;
                if (val < 2.2250738585072014e-308) {
                    mantissa = val / 5e-324;
                    writeUint(mantissa >>> 0, buf, pos + off0);
                    writeUint((sign << 31 | mantissa / 4294967296) >>> 0, buf, pos + off1);
                } else {
                    var exponent = Math.floor(Math.log(val) / Math.LN2);
                    if (exponent === 1024) exponent = 1023;
                    mantissa = val * Math.pow(2, -exponent);
                    writeUint(mantissa * 4503599627370496 >>> 0, buf, pos + off0);
                    writeUint((sign << 31 | exponent + 1023 << 20 | mantissa * 1048576 & 1048575) >>> 0, buf, pos + off1);
                }
            }
        }
        exports.writeDoubleLE = writeDouble_ieee754.bind(null, writeUintLE, 0, 4);
        exports.writeDoubleBE = writeDouble_ieee754.bind(null, writeUintBE, 4, 0);
        function readDouble_ieee754(readUint, off0, off1, buf, pos) {
            var lo = readUint(buf, pos + off0), hi = readUint(buf, pos + off1);
            var sign = (hi >> 31) * 2 + 1, exponent = hi >>> 20 & 2047, mantissa = 4294967296 * (hi & 1048575) + lo;
            return exponent === 2047 ? mantissa ? NaN : sign * Infinity : exponent === 0 // denormal
             ? sign * 5e-324 * mantissa : sign * Math.pow(2, exponent - 1075) * (mantissa + 4503599627370496);
        }
        exports.readDoubleLE = readDouble_ieee754.bind(null, readUintLE, 0, 4);
        exports.readDoubleBE = readDouble_ieee754.bind(null, readUintBE, 4, 0);
    })();
    return exports;
}
// uint helpers
function writeUintLE(val, buf, pos) {
    buf[pos] = val & 255;
    buf[pos + 1] = val >>> 8 & 255;
    buf[pos + 2] = val >>> 16 & 255;
    buf[pos + 3] = val >>> 24;
}
function writeUintBE(val, buf, pos) {
    buf[pos] = val >>> 24;
    buf[pos + 1] = val >>> 16 & 255;
    buf[pos + 2] = val >>> 8 & 255;
    buf[pos + 3] = val & 255;
}
function readUintLE(buf, pos) {
    return (buf[pos] | buf[pos + 1] << 8 | buf[pos + 2] << 16 | buf[pos + 3] << 24) >>> 0;
}
function readUintBE(buf, pos) {
    return (buf[pos] << 24 | buf[pos + 1] << 16 | buf[pos + 2] << 8 | buf[pos + 3]) >>> 0;
}

},{}],"fon4w":[function(require,module,exports) {
"use strict";
module.exports = inquire;
/**
 * Requires a module only if available.
 * @memberof util
 * @param {string} moduleName Module to require
 * @returns {?Object} Required module if available and not empty, otherwise `null`
 */ function inquire(moduleName) {
    try {
        var mod = eval("quire".replace(/^/, "re"))(moduleName); // eslint-disable-line no-eval
        if (mod && (mod.length || Object.keys(mod).length)) return mod;
    } catch (e) {} // eslint-disable-line no-empty
    return null;
}

},{}],"8DJTf":[function(require,module,exports) {
"use strict";
/**
 * A minimal UTF8 implementation for number arrays.
 * @memberof util
 * @namespace
 */ var utf8 = exports;
/**
 * Calculates the UTF8 byte length of a string.
 * @param {string} string String
 * @returns {number} Byte length
 */ utf8.length = function utf8_length(string) {
    var len = 0, c = 0;
    for(var i = 0; i < string.length; ++i){
        c = string.charCodeAt(i);
        if (c < 128) len += 1;
        else if (c < 2048) len += 2;
        else if ((c & 0xFC00) === 0xD800 && (string.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
            ++i;
            len += 4;
        } else len += 3;
    }
    return len;
};
/**
 * Reads UTF8 bytes as a string.
 * @param {Uint8Array} buffer Source buffer
 * @param {number} start Source start
 * @param {number} end Source end
 * @returns {string} String read
 */ utf8.read = function utf8_read(buffer, start, end) {
    var len = end - start;
    if (len < 1) return "";
    var parts = null, chunk = [], i = 0, t; // temporary
    while(start < end){
        t = buffer[start++];
        if (t < 128) chunk[i++] = t;
        else if (t > 191 && t < 224) chunk[i++] = (t & 31) << 6 | buffer[start++] & 63;
        else if (t > 239 && t < 365) {
            t = ((t & 7) << 18 | (buffer[start++] & 63) << 12 | (buffer[start++] & 63) << 6 | buffer[start++] & 63) - 0x10000;
            chunk[i++] = 0xD800 + (t >> 10);
            chunk[i++] = 0xDC00 + (t & 1023);
        } else chunk[i++] = (t & 15) << 12 | (buffer[start++] & 63) << 6 | buffer[start++] & 63;
        if (i > 8191) {
            (parts || (parts = [])).push(String.fromCharCode.apply(String, chunk));
            i = 0;
        }
    }
    if (parts) {
        if (i) parts.push(String.fromCharCode.apply(String, chunk.slice(0, i)));
        return parts.join("");
    }
    return String.fromCharCode.apply(String, chunk.slice(0, i));
};
/**
 * Writes a string as UTF8 bytes.
 * @param {string} string Source string
 * @param {Uint8Array} buffer Destination buffer
 * @param {number} offset Destination offset
 * @returns {number} Bytes written
 */ utf8.write = function utf8_write(string, buffer, offset) {
    var start = offset, c1, c2; // character 2
    for(var i = 0; i < string.length; ++i){
        c1 = string.charCodeAt(i);
        if (c1 < 128) buffer[offset++] = c1;
        else if (c1 < 2048) {
            buffer[offset++] = c1 >> 6 | 192;
            buffer[offset++] = c1 & 63 | 128;
        } else if ((c1 & 0xFC00) === 0xD800 && ((c2 = string.charCodeAt(i + 1)) & 0xFC00) === 0xDC00) {
            c1 = 0x10000 + ((c1 & 0x03FF) << 10) + (c2 & 0x03FF);
            ++i;
            buffer[offset++] = c1 >> 18 | 240;
            buffer[offset++] = c1 >> 12 & 63 | 128;
            buffer[offset++] = c1 >> 6 & 63 | 128;
            buffer[offset++] = c1 & 63 | 128;
        } else {
            buffer[offset++] = c1 >> 12 | 224;
            buffer[offset++] = c1 >> 6 & 63 | 128;
            buffer[offset++] = c1 & 63 | 128;
        }
    }
    return offset - start;
};

},{}],"fadtm":[function(require,module,exports) {
"use strict";
module.exports = pool;
/**
 * An allocator as used by {@link util.pool}.
 * @typedef PoolAllocator
 * @type {function}
 * @param {number} size Buffer size
 * @returns {Uint8Array} Buffer
 */ /**
 * A slicer as used by {@link util.pool}.
 * @typedef PoolSlicer
 * @type {function}
 * @param {number} start Start offset
 * @param {number} end End offset
 * @returns {Uint8Array} Buffer slice
 * @this {Uint8Array}
 */ /**
 * A general purpose buffer pool.
 * @memberof util
 * @function
 * @param {PoolAllocator} alloc Allocator
 * @param {PoolSlicer} slice Slicer
 * @param {number} [size=8192] Slab size
 * @returns {PoolAllocator} Pooled allocator
 */ function pool(alloc, slice, size) {
    var SIZE = size || 8192;
    var MAX = SIZE >>> 1;
    var slab = null;
    var offset = SIZE;
    return function pool_alloc(size) {
        if (size < 1 || size > MAX) return alloc(size);
        if (offset + size > SIZE) {
            slab = alloc(SIZE);
            offset = 0;
        }
        var buf = slice.call(slab, offset, offset += size);
        if (offset & 7) offset = (offset | 7) + 1;
        return buf;
    };
}

},{}],"c4DvK":[function(require,module,exports) {
"use strict";
module.exports = LongBits;
var util = require("../util/minimal");
/**
 * Constructs new long bits.
 * @classdesc Helper class for working with the low and high bits of a 64 bit value.
 * @memberof util
 * @constructor
 * @param {number} lo Low 32 bits, unsigned
 * @param {number} hi High 32 bits, unsigned
 */ function LongBits(lo, hi) {
    // note that the casts below are theoretically unnecessary as of today, but older statically
    // generated converter code might still call the ctor with signed 32bits. kept for compat.
    /**
     * Low bits.
     * @type {number}
     */ this.lo = lo >>> 0;
    /**
     * High bits.
     * @type {number}
     */ this.hi = hi >>> 0;
}
/**
 * Zero bits.
 * @memberof util.LongBits
 * @type {util.LongBits}
 */ var zero = LongBits.zero = new LongBits(0, 0);
zero.toNumber = function() {
    return 0;
};
zero.zzEncode = zero.zzDecode = function() {
    return this;
};
zero.length = function() {
    return 1;
};
/**
 * Zero hash.
 * @memberof util.LongBits
 * @type {string}
 */ var zeroHash = LongBits.zeroHash = "\0\0\0\0\0\0\0\0";
/**
 * Constructs new long bits from the specified number.
 * @param {number} value Value
 * @returns {util.LongBits} Instance
 */ LongBits.fromNumber = function fromNumber(value) {
    if (value === 0) return zero;
    var sign = value < 0;
    if (sign) value = -value;
    var lo = value >>> 0, hi = (value - lo) / 4294967296 >>> 0;
    if (sign) {
        hi = ~hi >>> 0;
        lo = ~lo >>> 0;
        if (++lo > 4294967295) {
            lo = 0;
            if (++hi > 4294967295) hi = 0;
        }
    }
    return new LongBits(lo, hi);
};
/**
 * Constructs new long bits from a number, long or string.
 * @param {Long|number|string} value Value
 * @returns {util.LongBits} Instance
 */ LongBits.from = function from(value) {
    if (typeof value === "number") return LongBits.fromNumber(value);
    if (util.isString(value)) {
        /* istanbul ignore else */ if (util.Long) value = util.Long.fromString(value);
        else return LongBits.fromNumber(parseInt(value, 10));
    }
    return value.low || value.high ? new LongBits(value.low >>> 0, value.high >>> 0) : zero;
};
/**
 * Converts this long bits to a possibly unsafe JavaScript number.
 * @param {boolean} [unsigned=false] Whether unsigned or not
 * @returns {number} Possibly unsafe number
 */ LongBits.prototype.toNumber = function toNumber(unsigned) {
    if (!unsigned && this.hi >>> 31) {
        var lo = ~this.lo + 1 >>> 0, hi = ~this.hi >>> 0;
        if (!lo) hi = hi + 1 >>> 0;
        return -(lo + hi * 4294967296);
    }
    return this.lo + this.hi * 4294967296;
};
/**
 * Converts this long bits to a long.
 * @param {boolean} [unsigned=false] Whether unsigned or not
 * @returns {Long} Long
 */ LongBits.prototype.toLong = function toLong(unsigned) {
    return util.Long ? new util.Long(this.lo | 0, this.hi | 0, Boolean(unsigned)) : {
        low: this.lo | 0,
        high: this.hi | 0,
        unsigned: Boolean(unsigned)
    };
};
var charCodeAt = String.prototype.charCodeAt;
/**
 * Constructs new long bits from the specified 8 characters long hash.
 * @param {string} hash Hash
 * @returns {util.LongBits} Bits
 */ LongBits.fromHash = function fromHash(hash) {
    if (hash === zeroHash) return zero;
    return new LongBits((charCodeAt.call(hash, 0) | charCodeAt.call(hash, 1) << 8 | charCodeAt.call(hash, 2) << 16 | charCodeAt.call(hash, 3) << 24) >>> 0, (charCodeAt.call(hash, 4) | charCodeAt.call(hash, 5) << 8 | charCodeAt.call(hash, 6) << 16 | charCodeAt.call(hash, 7) << 24) >>> 0);
};
/**
 * Converts this long bits to a 8 characters long hash.
 * @returns {string} Hash
 */ LongBits.prototype.toHash = function toHash() {
    return String.fromCharCode(this.lo & 255, this.lo >>> 8 & 255, this.lo >>> 16 & 255, this.lo >>> 24, this.hi & 255, this.hi >>> 8 & 255, this.hi >>> 16 & 255, this.hi >>> 24);
};
/**
 * Zig-zag encodes this long bits.
 * @returns {util.LongBits} `this`
 */ LongBits.prototype.zzEncode = function zzEncode() {
    var mask = this.hi >> 31;
    this.hi = ((this.hi << 1 | this.lo >>> 31) ^ mask) >>> 0;
    this.lo = (this.lo << 1 ^ mask) >>> 0;
    return this;
};
/**
 * Zig-zag decodes this long bits.
 * @returns {util.LongBits} `this`
 */ LongBits.prototype.zzDecode = function zzDecode() {
    var mask = -(this.lo & 1);
    this.lo = ((this.lo >>> 1 | this.hi << 31) ^ mask) >>> 0;
    this.hi = (this.hi >>> 1 ^ mask) >>> 0;
    return this;
};
/**
 * Calculates the length of this longbits when encoded as a varint.
 * @returns {number} Length
 */ LongBits.prototype.length = function length() {
    var part0 = this.lo, part1 = (this.lo >>> 28 | this.hi << 4) >>> 0, part2 = this.hi >>> 24;
    return part2 === 0 ? part1 === 0 ? part0 < 16384 ? part0 < 128 ? 1 : 2 : part0 < 2097152 ? 3 : 4 : part1 < 16384 ? part1 < 128 ? 5 : 6 : part1 < 2097152 ? 7 : 8 : part2 < 128 ? 9 : 10;
};

},{"../util/minimal":"4HDe1"}],"gIB4S":[function(require,module,exports) {
"use strict";
module.exports = BufferWriter;
// extends Writer
var Writer = require("./writer");
(BufferWriter.prototype = Object.create(Writer.prototype)).constructor = BufferWriter;
var util = require("./util/minimal");
/**
 * Constructs a new buffer writer instance.
 * @classdesc Wire format writer using node buffers.
 * @extends Writer
 * @constructor
 */ function BufferWriter() {
    Writer.call(this);
}
BufferWriter._configure = function() {
    /**
     * Allocates a buffer of the specified size.
     * @function
     * @param {number} size Buffer size
     * @returns {Buffer} Buffer
     */ BufferWriter.alloc = util._Buffer_allocUnsafe;
    BufferWriter.writeBytesBuffer = util.Buffer && util.Buffer.prototype instanceof Uint8Array && util.Buffer.prototype.set.name === "set" ? function writeBytesBuffer_set(val, buf, pos) {
        buf.set(val, pos); // faster than copy (requires node >= 4 where Buffers extend Uint8Array and set is properly inherited)
    // also works for plain array values
    } : function writeBytesBuffer_copy(val, buf, pos) {
        if (val.copy) val.copy(buf, pos, 0, val.length);
        else for(var i = 0; i < val.length;)buf[pos++] = val[i++];
    };
};
/**
 * @override
 */ BufferWriter.prototype.bytes = function write_bytes_buffer(value) {
    if (util.isString(value)) value = util._Buffer_from(value, "base64");
    var len = value.length >>> 0;
    this.uint32(len);
    if (len) this._push(BufferWriter.writeBytesBuffer, len, value);
    return this;
};
function writeStringBuffer(val, buf, pos) {
    if (val.length < 40) util.utf8.write(val, buf, pos);
    else if (buf.utf8Write) buf.utf8Write(val, pos);
    else buf.write(val, pos);
}
/**
 * @override
 */ BufferWriter.prototype.string = function write_string_buffer(value) {
    var len = util.Buffer.byteLength(value);
    this.uint32(len);
    if (len) this._push(writeStringBuffer, len, value);
    return this;
};
/**
 * Finishes the write operation.
 * @name BufferWriter#finish
 * @function
 * @returns {Buffer} Finished buffer
 */ BufferWriter._configure();

},{"./writer":"boWmp","./util/minimal":"4HDe1"}],"bN2lE":[function(require,module,exports) {
"use strict";
module.exports = Reader;
var util = require("./util/minimal");
var BufferReader; // cyclic
var LongBits = util.LongBits, utf8 = util.utf8;
/* istanbul ignore next */ function indexOutOfRange(reader, writeLength) {
    return RangeError("index out of range: " + reader.pos + " + " + (writeLength || 1) + " > " + reader.len);
}
/**
 * Constructs a new reader instance using the specified buffer.
 * @classdesc Wire format reader using `Uint8Array` if available, otherwise `Array`.
 * @constructor
 * @param {Uint8Array} buffer Buffer to read from
 */ function Reader(buffer) {
    /**
     * Read buffer.
     * @type {Uint8Array}
     */ this.buf = buffer;
    /**
     * Read buffer position.
     * @type {number}
     */ this.pos = 0;
    /**
     * Read buffer length.
     * @type {number}
     */ this.len = buffer.length;
}
var create_array = typeof Uint8Array !== "undefined" ? function create_typed_array(buffer) {
    if (buffer instanceof Uint8Array || Array.isArray(buffer)) return new Reader(buffer);
    throw Error("illegal buffer");
} : function create_array(buffer) {
    if (Array.isArray(buffer)) return new Reader(buffer);
    throw Error("illegal buffer");
};
var create = function create() {
    return util.Buffer ? function create_buffer_setup(buffer) {
        return (Reader.create = function create_buffer(buffer) {
            return util.Buffer.isBuffer(buffer) ? new BufferReader(buffer) : create_array(buffer);
        })(buffer);
    } : create_array;
};
/**
 * Creates a new reader using the specified buffer.
 * @function
 * @param {Uint8Array|Buffer} buffer Buffer to read from
 * @returns {Reader|BufferReader} A {@link BufferReader} if `buffer` is a Buffer, otherwise a {@link Reader}
 * @throws {Error} If `buffer` is not a valid buffer
 */ Reader.create = create();
Reader.prototype._slice = util.Array.prototype.subarray || /* istanbul ignore next */ util.Array.prototype.slice;
/**
 * Reads a varint as an unsigned 32 bit value.
 * @function
 * @returns {number} Value read
 */ Reader.prototype.uint32 = function read_uint32_setup() {
    var value = 4294967295; // optimizer type-hint, tends to deopt otherwise (?!)
    return function read_uint32() {
        value = (this.buf[this.pos] & 127) >>> 0;
        if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] & 127) << 7) >>> 0;
        if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] & 127) << 14) >>> 0;
        if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] & 127) << 21) >>> 0;
        if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] & 15) << 28) >>> 0;
        if (this.buf[this.pos++] < 128) return value;
        /* istanbul ignore if */ if ((this.pos += 5) > this.len) {
            this.pos = this.len;
            throw indexOutOfRange(this, 10);
        }
        return value;
    };
}();
/**
 * Reads a varint as a signed 32 bit value.
 * @returns {number} Value read
 */ Reader.prototype.int32 = function read_int32() {
    return this.uint32() | 0;
};
/**
 * Reads a zig-zag encoded varint as a signed 32 bit value.
 * @returns {number} Value read
 */ Reader.prototype.sint32 = function read_sint32() {
    var value = this.uint32();
    return value >>> 1 ^ -(value & 1) | 0;
};
/* eslint-disable no-invalid-this */ function readLongVarint() {
    // tends to deopt with local vars for octet etc.
    var bits = new LongBits(0, 0);
    var i = 0;
    if (this.len - this.pos > 4) {
        for(; i < 4; ++i){
            // 1st..4th
            bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0;
            if (this.buf[this.pos++] < 128) return bits;
        }
        // 5th
        bits.lo = (bits.lo | (this.buf[this.pos] & 127) << 28) >>> 0;
        bits.hi = (bits.hi | (this.buf[this.pos] & 127) >> 4) >>> 0;
        if (this.buf[this.pos++] < 128) return bits;
        i = 0;
    } else {
        for(; i < 3; ++i){
            /* istanbul ignore if */ if (this.pos >= this.len) throw indexOutOfRange(this);
            // 1st..3th
            bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0;
            if (this.buf[this.pos++] < 128) return bits;
        }
        // 4th
        bits.lo = (bits.lo | (this.buf[this.pos++] & 127) << i * 7) >>> 0;
        return bits;
    }
    if (this.len - this.pos > 4) for(; i < 5; ++i){
        // 6th..10th
        bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0;
        if (this.buf[this.pos++] < 128) return bits;
    }
    else for(; i < 5; ++i){
        /* istanbul ignore if */ if (this.pos >= this.len) throw indexOutOfRange(this);
        // 6th..10th
        bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0;
        if (this.buf[this.pos++] < 128) return bits;
    }
    /* istanbul ignore next */ throw Error("invalid varint encoding");
}
/* eslint-enable no-invalid-this */ /**
 * Reads a varint as a signed 64 bit value.
 * @name Reader#int64
 * @function
 * @returns {Long} Value read
 */ /**
 * Reads a varint as an unsigned 64 bit value.
 * @name Reader#uint64
 * @function
 * @returns {Long} Value read
 */ /**
 * Reads a zig-zag encoded varint as a signed 64 bit value.
 * @name Reader#sint64
 * @function
 * @returns {Long} Value read
 */ /**
 * Reads a varint as a boolean.
 * @returns {boolean} Value read
 */ Reader.prototype.bool = function read_bool() {
    return this.uint32() !== 0;
};
function readFixed32_end(buf, end) {
    return (buf[end - 4] | buf[end - 3] << 8 | buf[end - 2] << 16 | buf[end - 1] << 24) >>> 0;
}
/**
 * Reads fixed 32 bits as an unsigned 32 bit integer.
 * @returns {number} Value read
 */ Reader.prototype.fixed32 = function read_fixed32() {
    /* istanbul ignore if */ if (this.pos + 4 > this.len) throw indexOutOfRange(this, 4);
    return readFixed32_end(this.buf, this.pos += 4);
};
/**
 * Reads fixed 32 bits as a signed 32 bit integer.
 * @returns {number} Value read
 */ Reader.prototype.sfixed32 = function read_sfixed32() {
    /* istanbul ignore if */ if (this.pos + 4 > this.len) throw indexOutOfRange(this, 4);
    return readFixed32_end(this.buf, this.pos += 4) | 0;
};
/* eslint-disable no-invalid-this */ function readFixed64() {
    /* istanbul ignore if */ if (this.pos + 8 > this.len) throw indexOutOfRange(this, 8);
    return new LongBits(readFixed32_end(this.buf, this.pos += 4), readFixed32_end(this.buf, this.pos += 4));
}
/* eslint-enable no-invalid-this */ /**
 * Reads fixed 64 bits.
 * @name Reader#fixed64
 * @function
 * @returns {Long} Value read
 */ /**
 * Reads zig-zag encoded fixed 64 bits.
 * @name Reader#sfixed64
 * @function
 * @returns {Long} Value read
 */ /**
 * Reads a float (32 bit) as a number.
 * @function
 * @returns {number} Value read
 */ Reader.prototype.float = function read_float() {
    /* istanbul ignore if */ if (this.pos + 4 > this.len) throw indexOutOfRange(this, 4);
    var value = util.float.readFloatLE(this.buf, this.pos);
    this.pos += 4;
    return value;
};
/**
 * Reads a double (64 bit float) as a number.
 * @function
 * @returns {number} Value read
 */ Reader.prototype.double = function read_double() {
    /* istanbul ignore if */ if (this.pos + 8 > this.len) throw indexOutOfRange(this, 4);
    var value = util.float.readDoubleLE(this.buf, this.pos);
    this.pos += 8;
    return value;
};
/**
 * Reads a sequence of bytes preceeded by its length as a varint.
 * @returns {Uint8Array} Value read
 */ Reader.prototype.bytes = function read_bytes() {
    var length = this.uint32(), start = this.pos, end = this.pos + length;
    /* istanbul ignore if */ if (end > this.len) throw indexOutOfRange(this, length);
    this.pos += length;
    if (Array.isArray(this.buf)) return this.buf.slice(start, end);
    return start === end // fix for IE 10/Win8 and others' subarray returning array of size 1
     ? new this.buf.constructor(0) : this._slice.call(this.buf, start, end);
};
/**
 * Reads a string preceeded by its byte length as a varint.
 * @returns {string} Value read
 */ Reader.prototype.string = function read_string() {
    var bytes = this.bytes();
    return utf8.read(bytes, 0, bytes.length);
};
/**
 * Skips the specified number of bytes if specified, otherwise skips a varint.
 * @param {number} [length] Length if known, otherwise a varint is assumed
 * @returns {Reader} `this`
 */ Reader.prototype.skip = function skip(length) {
    if (typeof length === "number") {
        /* istanbul ignore if */ if (this.pos + length > this.len) throw indexOutOfRange(this, length);
        this.pos += length;
    } else do {
        /* istanbul ignore if */ if (this.pos >= this.len) throw indexOutOfRange(this);
    }while (this.buf[this.pos++] & 128);
    return this;
};
/**
 * Skips the next element of the specified wire type.
 * @param {number} wireType Wire type received
 * @returns {Reader} `this`
 */ Reader.prototype.skipType = function(wireType) {
    switch(wireType){
        case 0:
            this.skip();
            break;
        case 1:
            this.skip(8);
            break;
        case 2:
            this.skip(this.uint32());
            break;
        case 3:
            while((wireType = this.uint32() & 7) !== 4)this.skipType(wireType);
            break;
        case 5:
            this.skip(4);
            break;
        /* istanbul ignore next */ default:
            throw Error("invalid wire type " + wireType + " at offset " + this.pos);
    }
    return this;
};
Reader._configure = function(BufferReader_) {
    BufferReader = BufferReader_;
    Reader.create = create();
    BufferReader._configure();
    var fn = util.Long ? "toLong" : /* istanbul ignore next */ "toNumber";
    util.merge(Reader.prototype, {
        int64: function read_int64() {
            return readLongVarint.call(this)[fn](false);
        },
        uint64: function read_uint64() {
            return readLongVarint.call(this)[fn](true);
        },
        sint64: function read_sint64() {
            return readLongVarint.call(this).zzDecode()[fn](false);
        },
        fixed64: function read_fixed64() {
            return readFixed64.call(this)[fn](true);
        },
        sfixed64: function read_sfixed64() {
            return readFixed64.call(this)[fn](false);
        }
    });
};

},{"./util/minimal":"4HDe1"}],"1b0Ms":[function(require,module,exports) {
"use strict";
module.exports = BufferReader;
// extends Reader
var Reader = require("./reader");
(BufferReader.prototype = Object.create(Reader.prototype)).constructor = BufferReader;
var util = require("./util/minimal");
/**
 * Constructs a new buffer reader instance.
 * @classdesc Wire format reader using node buffers.
 * @extends Reader
 * @constructor
 * @param {Buffer} buffer Buffer to read from
 */ function BufferReader(buffer) {
    Reader.call(this, buffer);
/**
     * Read buffer.
     * @name BufferReader#buf
     * @type {Buffer}
     */ }
BufferReader._configure = function() {
    /* istanbul ignore else */ if (util.Buffer) BufferReader.prototype._slice = util.Buffer.prototype.slice;
};
/**
 * @override
 */ BufferReader.prototype.string = function read_string_buffer() {
    var len = this.uint32(); // modifies pos
    return this.buf.utf8Slice ? this.buf.utf8Slice(this.pos, this.pos = Math.min(this.pos + len, this.len)) : this.buf.toString("utf-8", this.pos, this.pos = Math.min(this.pos + len, this.len));
};
/**
 * Reads a sequence of bytes preceeded by its length as a varint.
 * @name BufferReader#bytes
 * @function
 * @returns {Buffer} Value read
 */ BufferReader._configure();

},{"./reader":"bN2lE","./util/minimal":"4HDe1"}],"eRwa1":[function(require,module,exports) {
"use strict";
/**
 * Streaming RPC helpers.
 * @namespace
 */ var rpc = exports;
/**
 * RPC implementation passed to {@link Service#create} performing a service request on network level, i.e. by utilizing http requests or websockets.
 * @typedef RPCImpl
 * @type {function}
 * @param {Method|rpc.ServiceMethod<Message<{}>,Message<{}>>} method Reflected or static method being called
 * @param {Uint8Array} requestData Request data
 * @param {RPCImplCallback} callback Callback function
 * @returns {undefined}
 * @example
 * function rpcImpl(method, requestData, callback) {
 *     if (protobuf.util.lcFirst(method.name) !== "myMethod") // compatible with static code
 *         throw Error("no such method");
 *     asynchronouslyObtainAResponse(requestData, function(err, responseData) {
 *         callback(err, responseData);
 *     });
 * }
 */ /**
 * Node-style callback as used by {@link RPCImpl}.
 * @typedef RPCImplCallback
 * @type {function}
 * @param {Error|null} error Error, if any, otherwise `null`
 * @param {Uint8Array|null} [response] Response data or `null` to signal end of stream, if there hasn't been an error
 * @returns {undefined}
 */ rpc.Service = require("./rpc/service");

},{"./rpc/service":"lVKlz"}],"lVKlz":[function(require,module,exports) {
"use strict";
module.exports = Service;
var util = require("../util/minimal");
// Extends EventEmitter
(Service.prototype = Object.create(util.EventEmitter.prototype)).constructor = Service;
/**
 * A service method callback as used by {@link rpc.ServiceMethod|ServiceMethod}.
 *
 * Differs from {@link RPCImplCallback} in that it is an actual callback of a service method which may not return `response = null`.
 * @typedef rpc.ServiceMethodCallback
 * @template TRes extends Message<TRes>
 * @type {function}
 * @param {Error|null} error Error, if any
 * @param {TRes} [response] Response message
 * @returns {undefined}
 */ /**
 * A service method part of a {@link rpc.Service} as created by {@link Service.create}.
 * @typedef rpc.ServiceMethod
 * @template TReq extends Message<TReq>
 * @template TRes extends Message<TRes>
 * @type {function}
 * @param {TReq|Properties<TReq>} request Request message or plain object
 * @param {rpc.ServiceMethodCallback<TRes>} [callback] Node-style callback called with the error, if any, and the response message
 * @returns {Promise<Message<TRes>>} Promise if `callback` has been omitted, otherwise `undefined`
 */ /**
 * Constructs a new RPC service instance.
 * @classdesc An RPC service as returned by {@link Service#create}.
 * @exports rpc.Service
 * @extends util.EventEmitter
 * @constructor
 * @param {RPCImpl} rpcImpl RPC implementation
 * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
 * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
 */ function Service(rpcImpl, requestDelimited, responseDelimited) {
    if (typeof rpcImpl !== "function") throw TypeError("rpcImpl must be a function");
    util.EventEmitter.call(this);
    /**
     * RPC implementation. Becomes `null` once the service is ended.
     * @type {RPCImpl|null}
     */ this.rpcImpl = rpcImpl;
    /**
     * Whether requests are length-delimited.
     * @type {boolean}
     */ this.requestDelimited = Boolean(requestDelimited);
    /**
     * Whether responses are length-delimited.
     * @type {boolean}
     */ this.responseDelimited = Boolean(responseDelimited);
}
/**
 * Calls a service method through {@link rpc.Service#rpcImpl|rpcImpl}.
 * @param {Method|rpc.ServiceMethod<TReq,TRes>} method Reflected or static method
 * @param {Constructor<TReq>} requestCtor Request constructor
 * @param {Constructor<TRes>} responseCtor Response constructor
 * @param {TReq|Properties<TReq>} request Request message or plain object
 * @param {rpc.ServiceMethodCallback<TRes>} callback Service callback
 * @returns {undefined}
 * @template TReq extends Message<TReq>
 * @template TRes extends Message<TRes>
 */ Service.prototype.rpcCall = function rpcCall(method, requestCtor, responseCtor, request, callback) {
    if (!request) throw TypeError("request must be specified");
    var self = this;
    if (!callback) return util.asPromise(rpcCall, self, method, requestCtor, responseCtor, request);
    if (!self.rpcImpl) {
        setTimeout(function() {
            callback(Error("already ended"));
        }, 0);
        return undefined;
    }
    try {
        return self.rpcImpl(method, requestCtor[self.requestDelimited ? "encodeDelimited" : "encode"](request).finish(), function rpcCallback(err, response) {
            if (err) {
                self.emit("error", err, method);
                return callback(err);
            }
            if (response === null) {
                self.end(/* endedByRPC */ true);
                return undefined;
            }
            if (!(response instanceof responseCtor)) try {
                response = responseCtor[self.responseDelimited ? "decodeDelimited" : "decode"](response);
            } catch (err1) {
                self.emit("error", err1, method);
                return callback(err1);
            }
            self.emit("data", response, method);
            return callback(null, response);
        });
    } catch (err) {
        self.emit("error", err, method);
        setTimeout(function() {
            callback(err);
        }, 0);
        return undefined;
    }
};
/**
 * Ends this service and emits the `end` event.
 * @param {boolean} [endedByRPC=false] Whether the service has been ended by the RPC implementation.
 * @returns {rpc.Service} `this`
 */ Service.prototype.end = function end(endedByRPC) {
    if (this.rpcImpl) {
        if (!endedByRPC) this.rpcImpl(null, null, null);
        this.rpcImpl = null;
        this.emit("end").off();
    }
    return this;
};

},{"../util/minimal":"4HDe1"}],"bJQDp":[function(require,module,exports) {
"use strict";
module.exports = {}; /**
 * Named roots.
 * This is where pbjs stores generated structures (the option `-r, --root` specifies a name).
 * Can also be used manually to make roots available across modules.
 * @name roots
 * @type {Object.<string,Root>}
 * @example
 * // pbjs -r myroot -o compiled.js ...
 *
 * // in another module:
 * require("./compiled.js");
 *
 * // in any subsequent module:
 * var root = protobuf.roots["myroot"];
 */ 

},{}],"2Tm2M":[function(require,module,exports) {
"use strict";
module.exports = encoder;
var Enum = require("./enum"), types = require("./types"), util = require("./util");
/**
 * Generates a partial message type encoder.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {number} fieldIndex Field index
 * @param {string} ref Variable reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */ function genTypePartial(gen, field, fieldIndex, ref) {
    return field.resolvedType.group ? gen("types[%i].encode(%s,w.uint32(%i)).uint32(%i)", fieldIndex, ref, (field.id << 3 | 3) >>> 0, (field.id << 3 | 4) >>> 0) : gen("types[%i].encode(%s,w.uint32(%i).fork()).ldelim()", fieldIndex, ref, (field.id << 3 | 2) >>> 0);
}
/**
 * Generates an encoder specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */ function encoder(mtype) {
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */ var gen = util.codegen([
        "m",
        "w"
    ], mtype.name + "$encode")("if(!w)")("w=Writer.create()");
    var i, ref;
    // "when a message is serialized its known fields should be written sequentially by field number"
    var fields = /* initializes */ mtype.fieldsArray.slice().sort(util.compareFieldsById);
    for(var i = 0; i < fields.length; ++i){
        var field = fields[i].resolve(), index = mtype._fieldsArray.indexOf(field), type = field.resolvedType instanceof Enum ? "int32" : field.type, wireType = types.basic[type];
        ref = "m" + util.safeProp(field.name);
        // Map fields
        if (field.map) {
            gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)){", ref, field.name) // !== undefined && !== null
            ("for(var ks=Object.keys(%s),i=0;i<ks.length;++i){", ref)("w.uint32(%i).fork().uint32(%i).%s(ks[i])", (field.id << 3 | 2) >>> 0, 8 | types.mapKey[field.keyType], field.keyType);
            if (wireType === undefined) gen("types[%i].encode(%s[ks[i]],w.uint32(18).fork()).ldelim().ldelim()", index, ref); // can't be groups
            else gen(".uint32(%i).%s(%s[ks[i]]).ldelim()", 16 | wireType, type, ref);
            gen("}")("}");
        // Repeated fields
        } else if (field.repeated) {
            gen("if(%s!=null&&%s.length){", ref, ref); // !== undefined && !== null
            // Packed repeated
            if (field.packed && types.packed[type] !== undefined) gen("w.uint32(%i).fork()", (field.id << 3 | 2) >>> 0)("for(var i=0;i<%s.length;++i)", ref)("w.%s(%s[i])", type, ref)("w.ldelim()");
            else {
                gen("for(var i=0;i<%s.length;++i)", ref);
                if (wireType === undefined) genTypePartial(gen, field, index, ref + "[i]");
                else gen("w.uint32(%i).%s(%s[i])", (field.id << 3 | wireType) >>> 0, type, ref);
            }
            gen("}");
        // Non-repeated
        } else {
            if (field.optional) gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j))", ref, field.name); // !== undefined && !== null
            if (wireType === undefined) genTypePartial(gen, field, index, ref);
            else gen("w.uint32(%i).%s(%s)", (field.id << 3 | wireType) >>> 0, type, ref);
        }
    }
    return gen("return w");
/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */ }

},{"./enum":"ctHUl","./types":"lER3o","./util":"lXEbJ"}],"ctHUl":[function(require,module,exports) {
"use strict";
module.exports = Enum;
// extends ReflectionObject
var ReflectionObject = require("./object");
((Enum.prototype = Object.create(ReflectionObject.prototype)).constructor = Enum).className = "Enum";
var Namespace = require("./namespace"), util = require("./util");
/**
 * Constructs a new enum instance.
 * @classdesc Reflected enum.
 * @extends ReflectionObject
 * @constructor
 * @param {string} name Unique name within its namespace
 * @param {Object.<string,number>} [values] Enum values as an object, by name
 * @param {Object.<string,*>} [options] Declared options
 * @param {string} [comment] The comment for this enum
 * @param {Object.<string,string>} [comments] The value comments for this enum
 * @param {Object.<string,Object<string,*>>|undefined} [valuesOptions] The value options for this enum
 */ function Enum(name, values, options, comment, comments, valuesOptions) {
    ReflectionObject.call(this, name, options);
    if (values && typeof values !== "object") throw TypeError("values must be an object");
    /**
     * Enum values by id.
     * @type {Object.<number,string>}
     */ this.valuesById = {};
    /**
     * Enum values by name.
     * @type {Object.<string,number>}
     */ this.values = Object.create(this.valuesById); // toJSON, marker
    /**
     * Enum comment text.
     * @type {string|null}
     */ this.comment = comment;
    /**
     * Value comment texts, if any.
     * @type {Object.<string,string>}
     */ this.comments = comments || {};
    /**
     * Values options, if any
     * @type {Object<string, Object<string, *>>|undefined}
     */ this.valuesOptions = valuesOptions;
    /**
     * Reserved ranges, if any.
     * @type {Array.<number[]|string>}
     */ this.reserved = undefined; // toJSON
    // Note that values inherit valuesById on their prototype which makes them a TypeScript-
    // compatible enum. This is used by pbts to write actual enum definitions that work for
    // static and reflection code alike instead of emitting generic object definitions.
    if (values) {
        for(var keys = Object.keys(values), i = 0; i < keys.length; ++i)if (typeof values[keys[i]] === "number") this.valuesById[this.values[keys[i]] = values[keys[i]]] = keys[i];
    }
}
/**
 * Enum descriptor.
 * @interface IEnum
 * @property {Object.<string,number>} values Enum values
 * @property {Object.<string,*>} [options] Enum options
 */ /**
 * Constructs an enum from an enum descriptor.
 * @param {string} name Enum name
 * @param {IEnum} json Enum descriptor
 * @returns {Enum} Created enum
 * @throws {TypeError} If arguments are invalid
 */ Enum.fromJSON = function fromJSON(name, json) {
    var enm = new Enum(name, json.values, json.options, json.comment, json.comments);
    enm.reserved = json.reserved;
    return enm;
};
/**
 * Converts this enum to an enum descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {IEnum} Enum descriptor
 */ Enum.prototype.toJSON = function toJSON(toJSONOptions) {
    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
    return util.toObject([
        "options",
        this.options,
        "valuesOptions",
        this.valuesOptions,
        "values",
        this.values,
        "reserved",
        this.reserved && this.reserved.length ? this.reserved : undefined,
        "comment",
        keepComments ? this.comment : undefined,
        "comments",
        keepComments ? this.comments : undefined
    ]);
};
/**
 * Adds a value to this enum.
 * @param {string} name Value name
 * @param {number} id Value id
 * @param {string} [comment] Comment, if any
 * @param {Object.<string, *>|undefined} [options] Options, if any
 * @returns {Enum} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If there is already a value with this name or id
 */ Enum.prototype.add = function add(name, id, comment, options) {
    // utilized by the parser but not by .fromJSON
    if (!util.isString(name)) throw TypeError("name must be a string");
    if (!util.isInteger(id)) throw TypeError("id must be an integer");
    if (this.values[name] !== undefined) throw Error("duplicate name '" + name + "' in " + this);
    if (this.isReservedId(id)) throw Error("id " + id + " is reserved in " + this);
    if (this.isReservedName(name)) throw Error("name '" + name + "' is reserved in " + this);
    if (this.valuesById[id] !== undefined) {
        if (!(this.options && this.options.allow_alias)) throw Error("duplicate id " + id + " in " + this);
        this.values[name] = id;
    } else this.valuesById[this.values[name] = id] = name;
    if (options) {
        if (this.valuesOptions === undefined) this.valuesOptions = {};
        this.valuesOptions[name] = options || null;
    }
    this.comments[name] = comment || null;
    return this;
};
/**
 * Removes a value from this enum
 * @param {string} name Value name
 * @returns {Enum} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If `name` is not a name of this enum
 */ Enum.prototype.remove = function remove(name) {
    if (!util.isString(name)) throw TypeError("name must be a string");
    var val = this.values[name];
    if (val == null) throw Error("name '" + name + "' does not exist in " + this);
    delete this.valuesById[val];
    delete this.values[name];
    delete this.comments[name];
    if (this.valuesOptions) delete this.valuesOptions[name];
    return this;
};
/**
 * Tests if the specified id is reserved.
 * @param {number} id Id to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */ Enum.prototype.isReservedId = function isReservedId(id) {
    return Namespace.isReservedId(this.reserved, id);
};
/**
 * Tests if the specified name is reserved.
 * @param {string} name Name to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */ Enum.prototype.isReservedName = function isReservedName(name) {
    return Namespace.isReservedName(this.reserved, name);
};

},{"./object":"aySAl","./namespace":"11udM","./util":"lXEbJ"}],"aySAl":[function(require,module,exports) {
"use strict";
module.exports = ReflectionObject;
ReflectionObject.className = "ReflectionObject";
var util = require("./util");
var Root; // cyclic
/**
 * Constructs a new reflection object instance.
 * @classdesc Base class of all reflection objects.
 * @constructor
 * @param {string} name Object name
 * @param {Object.<string,*>} [options] Declared options
 * @abstract
 */ function ReflectionObject(name, options) {
    if (!util.isString(name)) throw TypeError("name must be a string");
    if (options && !util.isObject(options)) throw TypeError("options must be an object");
    /**
     * Options.
     * @type {Object.<string,*>|undefined}
     */ this.options = options; // toJSON
    /**
     * Parsed Options.
     * @type {Array.<Object.<string,*>>|undefined}
     */ this.parsedOptions = null;
    /**
     * Unique name within its namespace.
     * @type {string}
     */ this.name = name;
    /**
     * Parent namespace.
     * @type {Namespace|null}
     */ this.parent = null;
    /**
     * Whether already resolved or not.
     * @type {boolean}
     */ this.resolved = false;
    /**
     * Comment text, if any.
     * @type {string|null}
     */ this.comment = null;
    /**
     * Defining file name.
     * @type {string|null}
     */ this.filename = null;
}
Object.defineProperties(ReflectionObject.prototype, {
    /**
     * Reference to the root namespace.
     * @name ReflectionObject#root
     * @type {Root}
     * @readonly
     */ root: {
        get: function() {
            var ptr = this;
            while(ptr.parent !== null)ptr = ptr.parent;
            return ptr;
        }
    },
    /**
     * Full name including leading dot.
     * @name ReflectionObject#fullName
     * @type {string}
     * @readonly
     */ fullName: {
        get: function() {
            var path = [
                this.name
            ], ptr = this.parent;
            while(ptr){
                path.unshift(ptr.name);
                ptr = ptr.parent;
            }
            return path.join(".");
        }
    }
});
/**
 * Converts this reflection object to its descriptor representation.
 * @returns {Object.<string,*>} Descriptor
 * @abstract
 */ ReflectionObject.prototype.toJSON = /* istanbul ignore next */ function toJSON() {
    throw Error(); // not implemented, shouldn't happen
};
/**
 * Called when this object is added to a parent.
 * @param {ReflectionObject} parent Parent added to
 * @returns {undefined}
 */ ReflectionObject.prototype.onAdd = function onAdd(parent) {
    if (this.parent && this.parent !== parent) this.parent.remove(this);
    this.parent = parent;
    this.resolved = false;
    var root = parent.root;
    if (root instanceof Root) root._handleAdd(this);
};
/**
 * Called when this object is removed from a parent.
 * @param {ReflectionObject} parent Parent removed from
 * @returns {undefined}
 */ ReflectionObject.prototype.onRemove = function onRemove(parent) {
    var root = parent.root;
    if (root instanceof Root) root._handleRemove(this);
    this.parent = null;
    this.resolved = false;
};
/**
 * Resolves this objects type references.
 * @returns {ReflectionObject} `this`
 */ ReflectionObject.prototype.resolve = function resolve() {
    if (this.resolved) return this;
    if (this.root instanceof Root) this.resolved = true; // only if part of a root
    return this;
};
/**
 * Gets an option value.
 * @param {string} name Option name
 * @returns {*} Option value or `undefined` if not set
 */ ReflectionObject.prototype.getOption = function getOption(name) {
    if (this.options) return this.options[name];
    return undefined;
};
/**
 * Sets an option.
 * @param {string} name Option name
 * @param {*} value Option value
 * @param {boolean} [ifNotSet] Sets the option only if it isn't currently set
 * @returns {ReflectionObject} `this`
 */ ReflectionObject.prototype.setOption = function setOption(name, value, ifNotSet) {
    if (!ifNotSet || !this.options || this.options[name] === undefined) (this.options || (this.options = {}))[name] = value;
    return this;
};
/**
 * Sets a parsed option.
 * @param {string} name parsed Option name
 * @param {*} value Option value
 * @param {string} propName dot '.' delimited full path of property within the option to set. if undefined\empty, will add a new option with that value
 * @returns {ReflectionObject} `this`
 */ ReflectionObject.prototype.setParsedOption = function setParsedOption(name, value, propName) {
    if (!this.parsedOptions) this.parsedOptions = [];
    var parsedOptions = this.parsedOptions;
    if (propName) {
        // If setting a sub property of an option then try to merge it
        // with an existing option
        var opt = parsedOptions.find(function(opt) {
            return Object.prototype.hasOwnProperty.call(opt, name);
        });
        if (opt) {
            // If we found an existing option - just merge the property value
            var newValue = opt[name];
            util.setProperty(newValue, propName, value);
        } else {
            // otherwise, create a new option, set it's property and add it to the list
            opt = {};
            opt[name] = util.setProperty({}, propName, value);
            parsedOptions.push(opt);
        }
    } else {
        // Always create a new option when setting the value of the option itself
        var newOpt = {};
        newOpt[name] = value;
        parsedOptions.push(newOpt);
    }
    return this;
};
/**
 * Sets multiple options.
 * @param {Object.<string,*>} options Options to set
 * @param {boolean} [ifNotSet] Sets an option only if it isn't currently set
 * @returns {ReflectionObject} `this`
 */ ReflectionObject.prototype.setOptions = function setOptions(options, ifNotSet) {
    if (options) for(var keys = Object.keys(options), i = 0; i < keys.length; ++i)this.setOption(keys[i], options[keys[i]], ifNotSet);
    return this;
};
/**
 * Converts this instance to its string representation.
 * @returns {string} Class name[, space, full name]
 */ ReflectionObject.prototype.toString = function toString() {
    var className = this.constructor.className, fullName = this.fullName;
    if (fullName.length) return className + " " + fullName;
    return className;
};
// Sets up cyclic dependencies (called in index-light)
ReflectionObject._configure = function(Root_) {
    Root = Root_;
};

},{"./util":"lXEbJ"}],"lXEbJ":[function(require,module,exports) {
"use strict";
/**
 * Various utility functions.
 * @namespace
 */ var util = module.exports = require("./util/minimal");
var roots = require("./roots");
var Type, Enum;
util.codegen = require("@protobufjs/codegen");
util.fetch = require("@protobufjs/fetch");
util.path = require("@protobufjs/path");
/**
 * Node's fs module if available.
 * @type {Object.<string,*>}
 */ util.fs = util.inquire("fs");
/**
 * Converts an object's values to an array.
 * @param {Object.<string,*>} object Object to convert
 * @returns {Array.<*>} Converted array
 */ util.toArray = function toArray(object) {
    if (object) {
        var keys = Object.keys(object), array = new Array(keys.length), index = 0;
        while(index < keys.length)array[index] = object[keys[index++]];
        return array;
    }
    return [];
};
/**
 * Converts an array of keys immediately followed by their respective value to an object, omitting undefined values.
 * @param {Array.<*>} array Array to convert
 * @returns {Object.<string,*>} Converted object
 */ util.toObject = function toObject(array) {
    var object = {}, index = 0;
    while(index < array.length){
        var key = array[index++], val = array[index++];
        if (val !== undefined) object[key] = val;
    }
    return object;
};
var safePropBackslashRe = /\\/g, safePropQuoteRe = /"/g;
/**
 * Tests whether the specified name is a reserved word in JS.
 * @param {string} name Name to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */ util.isReserved = function isReserved(name) {
    return /^(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$/.test(name);
};
/**
 * Returns a safe property accessor for the specified property name.
 * @param {string} prop Property name
 * @returns {string} Safe accessor
 */ util.safeProp = function safeProp(prop) {
    if (!/^[$\w_]+$/.test(prop) || util.isReserved(prop)) return '["' + prop.replace(safePropBackslashRe, "\\\\").replace(safePropQuoteRe, '\\"') + '"]';
    return "." + prop;
};
/**
 * Converts the first character of a string to upper case.
 * @param {string} str String to convert
 * @returns {string} Converted string
 */ util.ucFirst = function ucFirst(str) {
    return str.charAt(0).toUpperCase() + str.substring(1);
};
var camelCaseRe = /_([a-z])/g;
/**
 * Converts a string to camel case.
 * @param {string} str String to convert
 * @returns {string} Converted string
 */ util.camelCase = function camelCase(str) {
    return str.substring(0, 1) + str.substring(1).replace(camelCaseRe, function($0, $1) {
        return $1.toUpperCase();
    });
};
/**
 * Compares reflected fields by id.
 * @param {Field} a First field
 * @param {Field} b Second field
 * @returns {number} Comparison value
 */ util.compareFieldsById = function compareFieldsById(a, b) {
    return a.id - b.id;
};
/**
 * Decorator helper for types (TypeScript).
 * @param {Constructor<T>} ctor Constructor function
 * @param {string} [typeName] Type name, defaults to the constructor's name
 * @returns {Type} Reflected type
 * @template T extends Message<T>
 * @property {Root} root Decorators root
 */ util.decorateType = function decorateType(ctor, typeName) {
    /* istanbul ignore if */ if (ctor.$type) {
        if (typeName && ctor.$type.name !== typeName) {
            util.decorateRoot.remove(ctor.$type);
            ctor.$type.name = typeName;
            util.decorateRoot.add(ctor.$type);
        }
        return ctor.$type;
    }
    /* istanbul ignore next */ if (!Type) Type = require("./type");
    var type = new Type(typeName || ctor.name);
    util.decorateRoot.add(type);
    type.ctor = ctor; // sets up .encode, .decode etc.
    Object.defineProperty(ctor, "$type", {
        value: type,
        enumerable: false
    });
    Object.defineProperty(ctor.prototype, "$type", {
        value: type,
        enumerable: false
    });
    return type;
};
var decorateEnumIndex = 0;
/**
 * Decorator helper for enums (TypeScript).
 * @param {Object} object Enum object
 * @returns {Enum} Reflected enum
 */ util.decorateEnum = function decorateEnum(object) {
    /* istanbul ignore if */ if (object.$type) return object.$type;
    /* istanbul ignore next */ if (!Enum) Enum = require("./enum");
    var enm = new Enum("Enum" + decorateEnumIndex++, object);
    util.decorateRoot.add(enm);
    Object.defineProperty(object, "$type", {
        value: enm,
        enumerable: false
    });
    return enm;
};
/**
 * Sets the value of a property by property path. If a value already exists, it is turned to an array
 * @param {Object.<string,*>} dst Destination object
 * @param {string} path dot '.' delimited path of the property to set
 * @param {Object} value the value to set
 * @returns {Object.<string,*>} Destination object
 */ util.setProperty = function setProperty(dst, path, value) {
    function setProp(dst, path, value) {
        var part = path.shift();
        if (part === "__proto__") return dst;
        if (path.length > 0) dst[part] = setProp(dst[part] || {}, path, value);
        else {
            var prevValue = dst[part];
            if (prevValue) value = [].concat(prevValue).concat(value);
            dst[part] = value;
        }
        return dst;
    }
    if (typeof dst !== "object") throw TypeError("dst must be an object");
    if (!path) throw TypeError("path must be specified");
    path = path.split(".");
    return setProp(dst, path, value);
};
/**
 * Decorator root (TypeScript).
 * @name util.decorateRoot
 * @type {Root}
 * @readonly
 */ Object.defineProperty(util, "decorateRoot", {
    get: function() {
        return roots["decorated"] || (roots["decorated"] = new (require("./root"))());
    }
});

},{"./util/minimal":"4HDe1","./roots":"bJQDp","@protobufjs/codegen":"dvBqc","@protobufjs/fetch":"foy5j","@protobufjs/path":"cwUir","./type":"6v8Mj","./enum":"ctHUl","./root":"8raSc"}],"dvBqc":[function(require,module,exports) {
"use strict";
module.exports = codegen;
/**
 * Begins generating a function.
 * @memberof util
 * @param {string[]} functionParams Function parameter names
 * @param {string} [functionName] Function name if not anonymous
 * @returns {Codegen} Appender that appends code to the function's body
 */ function codegen(functionParams, functionName) {
    /* istanbul ignore if */ if (typeof functionParams === "string") {
        functionName = functionParams;
        functionParams = undefined;
    }
    var body = [];
    /**
     * Appends code to the function's body or finishes generation.
     * @typedef Codegen
     * @type {function}
     * @param {string|Object.<string,*>} [formatStringOrScope] Format string or, to finish the function, an object of additional scope variables, if any
     * @param {...*} [formatParams] Format parameters
     * @returns {Codegen|Function} Itself or the generated function if finished
     * @throws {Error} If format parameter counts do not match
     */ function Codegen(formatStringOrScope) {
        // note that explicit array handling below makes this ~50% faster
        // finish the function
        if (typeof formatStringOrScope !== "string") {
            var source = toString();
            if (codegen.verbose) console.log("codegen: " + source); // eslint-disable-line no-console
            source = "return " + source;
            if (formatStringOrScope) {
                var scopeKeys = Object.keys(formatStringOrScope), scopeParams = new Array(scopeKeys.length + 1), scopeValues = new Array(scopeKeys.length), scopeOffset = 0;
                while(scopeOffset < scopeKeys.length){
                    scopeParams[scopeOffset] = scopeKeys[scopeOffset];
                    scopeValues[scopeOffset] = formatStringOrScope[scopeKeys[scopeOffset++]];
                }
                scopeParams[scopeOffset] = source;
                return Function.apply(null, scopeParams).apply(null, scopeValues); // eslint-disable-line no-new-func
            }
            return Function(source)(); // eslint-disable-line no-new-func
        }
        // otherwise append to body
        var formatParams = new Array(arguments.length - 1), formatOffset = 0;
        while(formatOffset < formatParams.length)formatParams[formatOffset] = arguments[++formatOffset];
        formatOffset = 0;
        formatStringOrScope = formatStringOrScope.replace(/%([%dfijs])/g, function replace($0, $1) {
            var value = formatParams[formatOffset++];
            switch($1){
                case "d":
                case "f":
                    return String(Number(value));
                case "i":
                    return String(Math.floor(value));
                case "j":
                    return JSON.stringify(value);
                case "s":
                    return String(value);
            }
            return "%";
        });
        if (formatOffset !== formatParams.length) throw Error("parameter count mismatch");
        body.push(formatStringOrScope);
        return Codegen;
    }
    function toString(functionNameOverride) {
        return "function " + (functionNameOverride || functionName || "") + "(" + (functionParams && functionParams.join(",") || "") + "){\n  " + body.join("\n  ") + "\n}";
    }
    Codegen.toString = toString;
    return Codegen;
}
/**
 * Begins generating a function.
 * @memberof util
 * @function codegen
 * @param {string} [functionName] Function name if not anonymous
 * @returns {Codegen} Appender that appends code to the function's body
 * @variation 2
 */ /**
 * When set to `true`, codegen will log generated code to console. Useful for debugging.
 * @name util.codegen.verbose
 * @type {boolean}
 */ codegen.verbose = false;

},{}],"foy5j":[function(require,module,exports) {
"use strict";
module.exports = fetch;
var asPromise = require("@protobufjs/aspromise"), inquire = require("@protobufjs/inquire");
var fs = inquire("fs");
/**
 * Node-style callback as used by {@link util.fetch}.
 * @typedef FetchCallback
 * @type {function}
 * @param {?Error} error Error, if any, otherwise `null`
 * @param {string} [contents] File contents, if there hasn't been an error
 * @returns {undefined}
 */ /**
 * Options as used by {@link util.fetch}.
 * @typedef FetchOptions
 * @type {Object}
 * @property {boolean} [binary=false] Whether expecting a binary response
 * @property {boolean} [xhr=false] If `true`, forces the use of XMLHttpRequest
 */ /**
 * Fetches the contents of a file.
 * @memberof util
 * @param {string} filename File path or url
 * @param {FetchOptions} options Fetch options
 * @param {FetchCallback} callback Callback function
 * @returns {undefined}
 */ function fetch(filename, options, callback) {
    if (typeof options === "function") {
        callback = options;
        options = {};
    } else if (!options) options = {};
    if (!callback) return asPromise(fetch, this, filename, options); // eslint-disable-line no-invalid-this
    // if a node-like filesystem is present, try it first but fall back to XHR if nothing is found.
    if (!options.xhr && fs && fs.readFile) return fs.readFile(filename, function fetchReadFileCallback(err, contents) {
        return err && typeof XMLHttpRequest !== "undefined" ? fetch.xhr(filename, options, callback) : err ? callback(err) : callback(null, options.binary ? contents : contents.toString("utf8"));
    });
    // use the XHR version otherwise.
    return fetch.xhr(filename, options, callback);
}
/**
 * Fetches the contents of a file.
 * @name util.fetch
 * @function
 * @param {string} path File path or url
 * @param {FetchCallback} callback Callback function
 * @returns {undefined}
 * @variation 2
 */ /**
 * Fetches the contents of a file.
 * @name util.fetch
 * @function
 * @param {string} path File path or url
 * @param {FetchOptions} [options] Fetch options
 * @returns {Promise<string|Uint8Array>} Promise
 * @variation 3
 */ /**/ fetch.xhr = function fetch_xhr(filename, options, callback) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange /* works everywhere */  = function fetchOnReadyStateChange() {
        if (xhr.readyState !== 4) return undefined;
        // local cors security errors return status 0 / empty string, too. afaik this cannot be
        // reliably distinguished from an actually empty file for security reasons. feel free
        // to send a pull request if you are aware of a solution.
        if (xhr.status !== 0 && xhr.status !== 200) return callback(Error("status " + xhr.status));
        // if binary data is expected, make sure that some sort of array is returned, even if
        // ArrayBuffers are not supported. the binary string fallback, however, is unsafe.
        if (options.binary) {
            var buffer = xhr.response;
            if (!buffer) {
                buffer = [];
                for(var i = 0; i < xhr.responseText.length; ++i)buffer.push(xhr.responseText.charCodeAt(i) & 255);
            }
            return callback(null, typeof Uint8Array !== "undefined" ? new Uint8Array(buffer) : buffer);
        }
        return callback(null, xhr.responseText);
    };
    if (options.binary) {
        // ref: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Sending_and_Receiving_Binary_Data#Receiving_binary_data_in_older_browsers
        if ("overrideMimeType" in xhr) xhr.overrideMimeType("text/plain; charset=x-user-defined");
        xhr.responseType = "arraybuffer";
    }
    xhr.open("GET", filename);
    xhr.send();
};

},{"@protobufjs/aspromise":"gv7US","@protobufjs/inquire":"fon4w"}],"cwUir":[function(require,module,exports) {
"use strict";
/**
 * A minimal path module to resolve Unix, Windows and URL paths alike.
 * @memberof util
 * @namespace
 */ var path = exports;
var isAbsolute = /**
 * Tests if the specified path is absolute.
 * @param {string} path Path to test
 * @returns {boolean} `true` if path is absolute
 */ path.isAbsolute = function isAbsolute(path) {
    return /^(?:\/|\w+:)/.test(path);
};
var normalize = /**
 * Normalizes the specified path.
 * @param {string} path Path to normalize
 * @returns {string} Normalized path
 */ path.normalize = function normalize(path) {
    path = path.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
    var parts = path.split("/"), absolute = isAbsolute(path), prefix = "";
    if (absolute) prefix = parts.shift() + "/";
    for(var i = 0; i < parts.length;){
        if (parts[i] === "..") {
            if (i > 0 && parts[i - 1] !== "..") parts.splice(--i, 2);
            else if (absolute) parts.splice(i, 1);
            else ++i;
        } else if (parts[i] === ".") parts.splice(i, 1);
        else ++i;
    }
    return prefix + parts.join("/");
};
/**
 * Resolves the specified include path against the specified origin path.
 * @param {string} originPath Path to the origin file
 * @param {string} includePath Include path relative to origin path
 * @param {boolean} [alreadyNormalized=false] `true` if both paths are already known to be normalized
 * @returns {string} Path to the include file
 */ path.resolve = function resolve(originPath, includePath, alreadyNormalized) {
    if (!alreadyNormalized) includePath = normalize(includePath);
    if (isAbsolute(includePath)) return includePath;
    if (!alreadyNormalized) originPath = normalize(originPath);
    return (originPath = originPath.replace(/(?:\/|^)[^/]+$/, "")).length ? normalize(originPath + "/" + includePath) : includePath;
};

},{}],"6v8Mj":[function(require,module,exports) {
"use strict";
module.exports = Type;
// extends Namespace
var Namespace = require("./namespace");
((Type.prototype = Object.create(Namespace.prototype)).constructor = Type).className = "Type";
var Enum = require("./enum"), OneOf = require("./oneof"), Field = require("./field"), MapField = require("./mapfield"), Service = require("./service"), Message = require("./message"), Reader = require("./reader"), Writer = require("./writer"), util = require("./util"), encoder = require("./encoder"), decoder = require("./decoder"), verifier = require("./verifier"), converter = require("./converter"), wrappers = require("./wrappers");
/**
 * Constructs a new reflected message type instance.
 * @classdesc Reflected message type.
 * @extends NamespaceBase
 * @constructor
 * @param {string} name Message name
 * @param {Object.<string,*>} [options] Declared options
 */ function Type(name, options) {
    Namespace.call(this, name, options);
    /**
     * Message fields.
     * @type {Object.<string,Field>}
     */ this.fields = {}; // toJSON, marker
    /**
     * Oneofs declared within this namespace, if any.
     * @type {Object.<string,OneOf>}
     */ this.oneofs = undefined; // toJSON
    /**
     * Extension ranges, if any.
     * @type {number[][]}
     */ this.extensions = undefined; // toJSON
    /**
     * Reserved ranges, if any.
     * @type {Array.<number[]|string>}
     */ this.reserved = undefined; // toJSON
    /*?
     * Whether this type is a legacy group.
     * @type {boolean|undefined}
     */ this.group = undefined; // toJSON
    /**
     * Cached fields by id.
     * @type {Object.<number,Field>|null}
     * @private
     */ this._fieldsById = null;
    /**
     * Cached fields as an array.
     * @type {Field[]|null}
     * @private
     */ this._fieldsArray = null;
    /**
     * Cached oneofs as an array.
     * @type {OneOf[]|null}
     * @private
     */ this._oneofsArray = null;
    /**
     * Cached constructor.
     * @type {Constructor<{}>}
     * @private
     */ this._ctor = null;
}
Object.defineProperties(Type.prototype, {
    /**
     * Message fields by id.
     * @name Type#fieldsById
     * @type {Object.<number,Field>}
     * @readonly
     */ fieldsById: {
        get: function() {
            /* istanbul ignore if */ if (this._fieldsById) return this._fieldsById;
            this._fieldsById = {};
            for(var names = Object.keys(this.fields), i = 0; i < names.length; ++i){
                var field = this.fields[names[i]], id = field.id;
                /* istanbul ignore if */ if (this._fieldsById[id]) throw Error("duplicate id " + id + " in " + this);
                this._fieldsById[id] = field;
            }
            return this._fieldsById;
        }
    },
    /**
     * Fields of this message as an array for iteration.
     * @name Type#fieldsArray
     * @type {Field[]}
     * @readonly
     */ fieldsArray: {
        get: function() {
            return this._fieldsArray || (this._fieldsArray = util.toArray(this.fields));
        }
    },
    /**
     * Oneofs of this message as an array for iteration.
     * @name Type#oneofsArray
     * @type {OneOf[]}
     * @readonly
     */ oneofsArray: {
        get: function() {
            return this._oneofsArray || (this._oneofsArray = util.toArray(this.oneofs));
        }
    },
    /**
     * The registered constructor, if any registered, otherwise a generic constructor.
     * Assigning a function replaces the internal constructor. If the function does not extend {@link Message} yet, its prototype will be setup accordingly and static methods will be populated. If it already extends {@link Message}, it will just replace the internal constructor.
     * @name Type#ctor
     * @type {Constructor<{}>}
     */ ctor: {
        get: function() {
            return this._ctor || (this.ctor = Type.generateConstructor(this)());
        },
        set: function(ctor) {
            // Ensure proper prototype
            var prototype = ctor.prototype;
            if (!(prototype instanceof Message)) {
                (ctor.prototype = new Message()).constructor = ctor;
                util.merge(ctor.prototype, prototype);
            }
            // Classes and messages reference their reflected type
            ctor.$type = ctor.prototype.$type = this;
            // Mix in static methods
            util.merge(ctor, Message, true);
            this._ctor = ctor;
            // Messages have non-enumerable default values on their prototype
            var i = 0;
            for(; i < /* initializes */ this.fieldsArray.length; ++i)this._fieldsArray[i].resolve(); // ensures a proper value
            // Messages have non-enumerable getters and setters for each virtual oneof field
            var ctorProperties = {};
            for(i = 0; i < /* initializes */ this.oneofsArray.length; ++i)ctorProperties[this._oneofsArray[i].resolve().name] = {
                get: util.oneOfGetter(this._oneofsArray[i].oneof),
                set: util.oneOfSetter(this._oneofsArray[i].oneof)
            };
            if (i) Object.defineProperties(ctor.prototype, ctorProperties);
        }
    }
});
/**
 * Generates a constructor function for the specified type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */ Type.generateConstructor = function generateConstructor(mtype) {
    /* eslint-disable no-unexpected-multiline */ var gen = util.codegen([
        "p"
    ], mtype.name);
    // explicitly initialize mutable object/array fields so that these aren't just inherited from the prototype
    for(var i = 0, field; i < mtype.fieldsArray.length; ++i)if ((field = mtype._fieldsArray[i]).map) gen("this%s={}", util.safeProp(field.name));
    else if (field.repeated) gen("this%s=[]", util.safeProp(field.name));
    return gen("if(p)for(var ks=Object.keys(p),i=0;i<ks.length;++i)if(p[ks[i]]!=null)") // omit undefined or null
    ("this[ks[i]]=p[ks[i]]");
/* eslint-enable no-unexpected-multiline */ };
function clearCache(type) {
    type._fieldsById = type._fieldsArray = type._oneofsArray = null;
    delete type.encode;
    delete type.decode;
    delete type.verify;
    return type;
}
/**
 * Message type descriptor.
 * @interface IType
 * @extends INamespace
 * @property {Object.<string,IOneOf>} [oneofs] Oneof descriptors
 * @property {Object.<string,IField>} fields Field descriptors
 * @property {number[][]} [extensions] Extension ranges
 * @property {number[][]} [reserved] Reserved ranges
 * @property {boolean} [group=false] Whether a legacy group or not
 */ /**
 * Creates a message type from a message type descriptor.
 * @param {string} name Message name
 * @param {IType} json Message type descriptor
 * @returns {Type} Created message type
 */ Type.fromJSON = function fromJSON(name, json) {
    var type = new Type(name, json.options);
    type.extensions = json.extensions;
    type.reserved = json.reserved;
    var names = Object.keys(json.fields), i = 0;
    for(; i < names.length; ++i)type.add((typeof json.fields[names[i]].keyType !== "undefined" ? MapField.fromJSON : Field.fromJSON)(names[i], json.fields[names[i]]));
    if (json.oneofs) for(names = Object.keys(json.oneofs), i = 0; i < names.length; ++i)type.add(OneOf.fromJSON(names[i], json.oneofs[names[i]]));
    if (json.nested) for(names = Object.keys(json.nested), i = 0; i < names.length; ++i){
        var nested = json.nested[names[i]];
        type.add((nested.id !== undefined ? Field.fromJSON : nested.fields !== undefined ? Type.fromJSON : nested.values !== undefined ? Enum.fromJSON : nested.methods !== undefined ? Service.fromJSON : Namespace.fromJSON)(names[i], nested));
    }
    if (json.extensions && json.extensions.length) type.extensions = json.extensions;
    if (json.reserved && json.reserved.length) type.reserved = json.reserved;
    if (json.group) type.group = true;
    if (json.comment) type.comment = json.comment;
    return type;
};
/**
 * Converts this message type to a message type descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {IType} Message type descriptor
 */ Type.prototype.toJSON = function toJSON(toJSONOptions) {
    var inherited = Namespace.prototype.toJSON.call(this, toJSONOptions);
    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
    return util.toObject([
        "options",
        inherited && inherited.options || undefined,
        "oneofs",
        Namespace.arrayToJSON(this.oneofsArray, toJSONOptions),
        "fields",
        Namespace.arrayToJSON(this.fieldsArray.filter(function(obj) {
            return !obj.declaringField;
        }), toJSONOptions) || {},
        "extensions",
        this.extensions && this.extensions.length ? this.extensions : undefined,
        "reserved",
        this.reserved && this.reserved.length ? this.reserved : undefined,
        "group",
        this.group || undefined,
        "nested",
        inherited && inherited.nested || undefined,
        "comment",
        keepComments ? this.comment : undefined
    ]);
};
/**
 * @override
 */ Type.prototype.resolveAll = function resolveAll() {
    var fields = this.fieldsArray, i = 0;
    while(i < fields.length)fields[i++].resolve();
    var oneofs = this.oneofsArray;
    i = 0;
    while(i < oneofs.length)oneofs[i++].resolve();
    return Namespace.prototype.resolveAll.call(this);
};
/**
 * @override
 */ Type.prototype.get = function get(name) {
    return this.fields[name] || this.oneofs && this.oneofs[name] || this.nested && this.nested[name] || null;
};
/**
 * Adds a nested object to this type.
 * @param {ReflectionObject} object Nested object to add
 * @returns {Type} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If there is already a nested object with this name or, if a field, when there is already a field with this id
 */ Type.prototype.add = function add(object) {
    if (this.get(object.name)) throw Error("duplicate name '" + object.name + "' in " + this);
    if (object instanceof Field && object.extend === undefined) {
        // NOTE: Extension fields aren't actual fields on the declaring type, but nested objects.
        // The root object takes care of adding distinct sister-fields to the respective extended
        // type instead.
        // avoids calling the getter if not absolutely necessary because it's called quite frequently
        if (this._fieldsById ? /* istanbul ignore next */ this._fieldsById[object.id] : this.fieldsById[object.id]) throw Error("duplicate id " + object.id + " in " + this);
        if (this.isReservedId(object.id)) throw Error("id " + object.id + " is reserved in " + this);
        if (this.isReservedName(object.name)) throw Error("name '" + object.name + "' is reserved in " + this);
        if (object.parent) object.parent.remove(object);
        this.fields[object.name] = object;
        object.message = this;
        object.onAdd(this);
        return clearCache(this);
    }
    if (object instanceof OneOf) {
        if (!this.oneofs) this.oneofs = {};
        this.oneofs[object.name] = object;
        object.onAdd(this);
        return clearCache(this);
    }
    return Namespace.prototype.add.call(this, object);
};
/**
 * Removes a nested object from this type.
 * @param {ReflectionObject} object Nested object to remove
 * @returns {Type} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If `object` is not a member of this type
 */ Type.prototype.remove = function remove(object) {
    if (object instanceof Field && object.extend === undefined) {
        // See Type#add for the reason why extension fields are excluded here.
        /* istanbul ignore if */ if (!this.fields || this.fields[object.name] !== object) throw Error(object + " is not a member of " + this);
        delete this.fields[object.name];
        object.parent = null;
        object.onRemove(this);
        return clearCache(this);
    }
    if (object instanceof OneOf) {
        /* istanbul ignore if */ if (!this.oneofs || this.oneofs[object.name] !== object) throw Error(object + " is not a member of " + this);
        delete this.oneofs[object.name];
        object.parent = null;
        object.onRemove(this);
        return clearCache(this);
    }
    return Namespace.prototype.remove.call(this, object);
};
/**
 * Tests if the specified id is reserved.
 * @param {number} id Id to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */ Type.prototype.isReservedId = function isReservedId(id) {
    return Namespace.isReservedId(this.reserved, id);
};
/**
 * Tests if the specified name is reserved.
 * @param {string} name Name to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */ Type.prototype.isReservedName = function isReservedName(name) {
    return Namespace.isReservedName(this.reserved, name);
};
/**
 * Creates a new message of this type using the specified properties.
 * @param {Object.<string,*>} [properties] Properties to set
 * @returns {Message<{}>} Message instance
 */ Type.prototype.create = function create(properties) {
    return new this.ctor(properties);
};
/**
 * Sets up {@link Type#encode|encode}, {@link Type#decode|decode} and {@link Type#verify|verify}.
 * @returns {Type} `this`
 */ Type.prototype.setup = function setup() {
    // Sets up everything at once so that the prototype chain does not have to be re-evaluated
    // multiple times (V8, soft-deopt prototype-check).
    var fullName = this.fullName, types = [];
    for(var i = 0; i < /* initializes */ this.fieldsArray.length; ++i)types.push(this._fieldsArray[i].resolve().resolvedType);
    // Replace setup methods with type-specific generated functions
    this.encode = encoder(this)({
        Writer: Writer,
        types: types,
        util: util
    });
    this.decode = decoder(this)({
        Reader: Reader,
        types: types,
        util: util
    });
    this.verify = verifier(this)({
        types: types,
        util: util
    });
    this.fromObject = converter.fromObject(this)({
        types: types,
        util: util
    });
    this.toObject = converter.toObject(this)({
        types: types,
        util: util
    });
    // Inject custom wrappers for common types
    var wrapper = wrappers[fullName];
    if (wrapper) {
        var originalThis = Object.create(this);
        // if (wrapper.fromObject) {
        originalThis.fromObject = this.fromObject;
        this.fromObject = wrapper.fromObject.bind(originalThis);
        // }
        // if (wrapper.toObject) {
        originalThis.toObject = this.toObject;
        this.toObject = wrapper.toObject.bind(originalThis);
    // }
    }
    return this;
};
/**
 * Encodes a message of this type. Does not implicitly {@link Type#verify|verify} messages.
 * @param {Message<{}>|Object.<string,*>} message Message instance or plain object
 * @param {Writer} [writer] Writer to encode to
 * @returns {Writer} writer
 */ Type.prototype.encode = function encode_setup(message, writer) {
    return this.setup().encode(message, writer); // overrides this method
};
/**
 * Encodes a message of this type preceeded by its byte length as a varint. Does not implicitly {@link Type#verify|verify} messages.
 * @param {Message<{}>|Object.<string,*>} message Message instance or plain object
 * @param {Writer} [writer] Writer to encode to
 * @returns {Writer} writer
 */ Type.prototype.encodeDelimited = function encodeDelimited(message, writer) {
    return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
};
/**
 * Decodes a message of this type.
 * @param {Reader|Uint8Array} reader Reader or buffer to decode from
 * @param {number} [length] Length of the message, if known beforehand
 * @returns {Message<{}>} Decoded message
 * @throws {Error} If the payload is not a reader or valid buffer
 * @throws {util.ProtocolError<{}>} If required fields are missing
 */ Type.prototype.decode = function decode_setup(reader, length) {
    return this.setup().decode(reader, length); // overrides this method
};
/**
 * Decodes a message of this type preceeded by its byte length as a varint.
 * @param {Reader|Uint8Array} reader Reader or buffer to decode from
 * @returns {Message<{}>} Decoded message
 * @throws {Error} If the payload is not a reader or valid buffer
 * @throws {util.ProtocolError} If required fields are missing
 */ Type.prototype.decodeDelimited = function decodeDelimited(reader) {
    if (!(reader instanceof Reader)) reader = Reader.create(reader);
    return this.decode(reader, reader.uint32());
};
/**
 * Verifies that field values are valid and that required fields are present.
 * @param {Object.<string,*>} message Plain object to verify
 * @returns {null|string} `null` if valid, otherwise the reason why it is not
 */ Type.prototype.verify = function verify_setup(message) {
    return this.setup().verify(message); // overrides this method
};
/**
 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
 * @param {Object.<string,*>} object Plain object to convert
 * @returns {Message<{}>} Message instance
 */ Type.prototype.fromObject = function fromObject(object) {
    return this.setup().fromObject(object);
};
/**
 * Conversion options as used by {@link Type#toObject} and {@link Message.toObject}.
 * @interface IConversionOptions
 * @property {Function} [longs] Long conversion type.
 * Valid values are `String` and `Number` (the global types).
 * Defaults to copy the present value, which is a possibly unsafe number without and a {@link Long} with a long library.
 * @property {Function} [enums] Enum value conversion type.
 * Only valid value is `String` (the global type).
 * Defaults to copy the present value, which is the numeric id.
 * @property {Function} [bytes] Bytes value conversion type.
 * Valid values are `Array` and (a base64 encoded) `String` (the global types).
 * Defaults to copy the present value, which usually is a Buffer under node and an Uint8Array in the browser.
 * @property {boolean} [defaults=false] Also sets default values on the resulting object
 * @property {boolean} [arrays=false] Sets empty arrays for missing repeated fields even if `defaults=false`
 * @property {boolean} [objects=false] Sets empty objects for missing map fields even if `defaults=false`
 * @property {boolean} [oneofs=false] Includes virtual oneof properties set to the present field's name, if any
 * @property {boolean} [json=false] Performs additional JSON compatibility conversions, i.e. NaN and Infinity to strings
 */ /**
 * Creates a plain object from a message of this type. Also converts values to other types if specified.
 * @param {Message<{}>} message Message instance
 * @param {IConversionOptions} [options] Conversion options
 * @returns {Object.<string,*>} Plain object
 */ Type.prototype.toObject = function toObject(message, options) {
    return this.setup().toObject(message, options);
};
/**
 * Decorator function as returned by {@link Type.d} (TypeScript).
 * @typedef TypeDecorator
 * @type {function}
 * @param {Constructor<T>} target Target constructor
 * @returns {undefined}
 * @template T extends Message<T>
 */ /**
 * Type decorator (TypeScript).
 * @param {string} [typeName] Type name, defaults to the constructor's name
 * @returns {TypeDecorator<T>} Decorator function
 * @template T extends Message<T>
 */ Type.d = function decorateType(typeName) {
    return function typeDecorator(target) {
        util.decorateType(target, typeName);
    };
};

},{"./namespace":"11udM","./enum":"ctHUl","./oneof":"jIa8c","./field":"eqf59","./mapfield":"2RIZG","./service":"bWLAN","./message":"46CgL","./reader":"bN2lE","./writer":"boWmp","./util":"lXEbJ","./encoder":"2Tm2M","./decoder":"em0YB","./verifier":"bOenx","./converter":"dDM7d","./wrappers":"gMoL0"}],"11udM":[function(require,module,exports) {
"use strict";
module.exports = Namespace;
// extends ReflectionObject
var ReflectionObject = require("./object");
((Namespace.prototype = Object.create(ReflectionObject.prototype)).constructor = Namespace).className = "Namespace";
var Field = require("./field"), util = require("./util"), OneOf = require("./oneof");
var Type, Service, Enum;
/**
 * Constructs a new namespace instance.
 * @name Namespace
 * @classdesc Reflected namespace.
 * @extends NamespaceBase
 * @constructor
 * @param {string} name Namespace name
 * @param {Object.<string,*>} [options] Declared options
 */ /**
 * Constructs a namespace from JSON.
 * @memberof Namespace
 * @function
 * @param {string} name Namespace name
 * @param {Object.<string,*>} json JSON object
 * @returns {Namespace} Created namespace
 * @throws {TypeError} If arguments are invalid
 */ Namespace.fromJSON = function fromJSON(name, json) {
    return new Namespace(name, json.options).addJSON(json.nested);
};
/**
 * Converts an array of reflection objects to JSON.
 * @memberof Namespace
 * @param {ReflectionObject[]} array Object array
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {Object.<string,*>|undefined} JSON object or `undefined` when array is empty
 */ function arrayToJSON(array, toJSONOptions) {
    if (!(array && array.length)) return undefined;
    var obj = {};
    for(var i = 0; i < array.length; ++i)obj[array[i].name] = array[i].toJSON(toJSONOptions);
    return obj;
}
Namespace.arrayToJSON = arrayToJSON;
/**
 * Tests if the specified id is reserved.
 * @param {Array.<number[]|string>|undefined} reserved Array of reserved ranges and names
 * @param {number} id Id to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */ Namespace.isReservedId = function isReservedId(reserved, id) {
    if (reserved) {
        for(var i = 0; i < reserved.length; ++i)if (typeof reserved[i] !== "string" && reserved[i][0] <= id && reserved[i][1] > id) return true;
    }
    return false;
};
/**
 * Tests if the specified name is reserved.
 * @param {Array.<number[]|string>|undefined} reserved Array of reserved ranges and names
 * @param {string} name Name to test
 * @returns {boolean} `true` if reserved, otherwise `false`
 */ Namespace.isReservedName = function isReservedName(reserved, name) {
    if (reserved) {
        for(var i = 0; i < reserved.length; ++i)if (reserved[i] === name) return true;
    }
    return false;
};
/**
 * Not an actual constructor. Use {@link Namespace} instead.
 * @classdesc Base class of all reflection objects containing nested objects. This is not an actual class but here for the sake of having consistent type definitions.
 * @exports NamespaceBase
 * @extends ReflectionObject
 * @abstract
 * @constructor
 * @param {string} name Namespace name
 * @param {Object.<string,*>} [options] Declared options
 * @see {@link Namespace}
 */ function Namespace(name, options) {
    ReflectionObject.call(this, name, options);
    /**
     * Nested objects by name.
     * @type {Object.<string,ReflectionObject>|undefined}
     */ this.nested = undefined; // toJSON
    /**
     * Cached nested objects as an array.
     * @type {ReflectionObject[]|null}
     * @private
     */ this._nestedArray = null;
}
function clearCache(namespace) {
    namespace._nestedArray = null;
    return namespace;
}
/**
 * Nested objects of this namespace as an array for iteration.
 * @name NamespaceBase#nestedArray
 * @type {ReflectionObject[]}
 * @readonly
 */ Object.defineProperty(Namespace.prototype, "nestedArray", {
    get: function() {
        return this._nestedArray || (this._nestedArray = util.toArray(this.nested));
    }
});
/**
 * Namespace descriptor.
 * @interface INamespace
 * @property {Object.<string,*>} [options] Namespace options
 * @property {Object.<string,AnyNestedObject>} [nested] Nested object descriptors
 */ /**
 * Any extension field descriptor.
 * @typedef AnyExtensionField
 * @type {IExtensionField|IExtensionMapField}
 */ /**
 * Any nested object descriptor.
 * @typedef AnyNestedObject
 * @type {IEnum|IType|IService|AnyExtensionField|INamespace|IOneOf}
 */ /**
 * Converts this namespace to a namespace descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {INamespace} Namespace descriptor
 */ Namespace.prototype.toJSON = function toJSON(toJSONOptions) {
    return util.toObject([
        "options",
        this.options,
        "nested",
        arrayToJSON(this.nestedArray, toJSONOptions)
    ]);
};
/**
 * Adds nested objects to this namespace from nested object descriptors.
 * @param {Object.<string,AnyNestedObject>} nestedJson Any nested object descriptors
 * @returns {Namespace} `this`
 */ Namespace.prototype.addJSON = function addJSON(nestedJson) {
    var ns = this;
    /* istanbul ignore else */ if (nestedJson) for(var names = Object.keys(nestedJson), i = 0, nested; i < names.length; ++i){
        nested = nestedJson[names[i]];
        ns.add((nested.fields !== undefined ? Type.fromJSON : nested.values !== undefined ? Enum.fromJSON : nested.methods !== undefined ? Service.fromJSON : nested.id !== undefined ? Field.fromJSON : Namespace.fromJSON)(names[i], nested));
    }
    return this;
};
/**
 * Gets the nested object of the specified name.
 * @param {string} name Nested object name
 * @returns {ReflectionObject|null} The reflection object or `null` if it doesn't exist
 */ Namespace.prototype.get = function get(name) {
    return this.nested && this.nested[name] || null;
};
/**
 * Gets the values of the nested {@link Enum|enum} of the specified name.
 * This methods differs from {@link Namespace#get|get} in that it returns an enum's values directly and throws instead of returning `null`.
 * @param {string} name Nested enum name
 * @returns {Object.<string,number>} Enum values
 * @throws {Error} If there is no such enum
 */ Namespace.prototype.getEnum = function getEnum(name) {
    if (this.nested && this.nested[name] instanceof Enum) return this.nested[name].values;
    throw Error("no such enum: " + name);
};
/**
 * Adds a nested object to this namespace.
 * @param {ReflectionObject} object Nested object to add
 * @returns {Namespace} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If there is already a nested object with this name
 */ Namespace.prototype.add = function add(object) {
    if (!(object instanceof Field && object.extend !== undefined || object instanceof Type || object instanceof OneOf || object instanceof Enum || object instanceof Service || object instanceof Namespace)) throw TypeError("object must be a valid nested object");
    if (!this.nested) this.nested = {};
    else {
        var prev = this.get(object.name);
        if (prev) {
            if (prev instanceof Namespace && object instanceof Namespace && !(prev instanceof Type || prev instanceof Service)) {
                // replace plain namespace but keep existing nested elements and options
                var nested = prev.nestedArray;
                for(var i = 0; i < nested.length; ++i)object.add(nested[i]);
                this.remove(prev);
                if (!this.nested) this.nested = {};
                object.setOptions(prev.options, true);
            } else throw Error("duplicate name '" + object.name + "' in " + this);
        }
    }
    this.nested[object.name] = object;
    object.onAdd(this);
    return clearCache(this);
};
/**
 * Removes a nested object from this namespace.
 * @param {ReflectionObject} object Nested object to remove
 * @returns {Namespace} `this`
 * @throws {TypeError} If arguments are invalid
 * @throws {Error} If `object` is not a member of this namespace
 */ Namespace.prototype.remove = function remove(object) {
    if (!(object instanceof ReflectionObject)) throw TypeError("object must be a ReflectionObject");
    if (object.parent !== this) throw Error(object + " is not a member of " + this);
    delete this.nested[object.name];
    if (!Object.keys(this.nested).length) this.nested = undefined;
    object.onRemove(this);
    return clearCache(this);
};
/**
 * Defines additial namespaces within this one if not yet existing.
 * @param {string|string[]} path Path to create
 * @param {*} [json] Nested types to create from JSON
 * @returns {Namespace} Pointer to the last namespace created or `this` if path is empty
 */ Namespace.prototype.define = function define(path, json) {
    if (util.isString(path)) path = path.split(".");
    else if (!Array.isArray(path)) throw TypeError("illegal path");
    if (path && path.length && path[0] === "") throw Error("path must be relative");
    var ptr = this;
    while(path.length > 0){
        var part = path.shift();
        if (ptr.nested && ptr.nested[part]) {
            ptr = ptr.nested[part];
            if (!(ptr instanceof Namespace)) throw Error("path conflicts with non-namespace objects");
        } else ptr.add(ptr = new Namespace(part));
    }
    if (json) ptr.addJSON(json);
    return ptr;
};
/**
 * Resolves this namespace's and all its nested objects' type references. Useful to validate a reflection tree, but comes at a cost.
 * @returns {Namespace} `this`
 */ Namespace.prototype.resolveAll = function resolveAll() {
    var nested = this.nestedArray, i = 0;
    while(i < nested.length)if (nested[i] instanceof Namespace) nested[i++].resolveAll();
    else nested[i++].resolve();
    return this.resolve();
};
/**
 * Recursively looks up the reflection object matching the specified path in the scope of this namespace.
 * @param {string|string[]} path Path to look up
 * @param {*|Array.<*>} filterTypes Filter types, any combination of the constructors of `protobuf.Type`, `protobuf.Enum`, `protobuf.Service` etc.
 * @param {boolean} [parentAlreadyChecked=false] If known, whether the parent has already been checked
 * @returns {ReflectionObject|null} Looked up object or `null` if none could be found
 */ Namespace.prototype.lookup = function lookup(path, filterTypes, parentAlreadyChecked) {
    /* istanbul ignore next */ if (typeof filterTypes === "boolean") {
        parentAlreadyChecked = filterTypes;
        filterTypes = undefined;
    } else if (filterTypes && !Array.isArray(filterTypes)) filterTypes = [
        filterTypes
    ];
    if (util.isString(path) && path.length) {
        if (path === ".") return this.root;
        path = path.split(".");
    } else if (!path.length) return this;
    // Start at root if path is absolute
    if (path[0] === "") return this.root.lookup(path.slice(1), filterTypes);
    // Test if the first part matches any nested object, and if so, traverse if path contains more
    var found = this.get(path[0]);
    if (found) {
        if (path.length === 1) {
            if (!filterTypes || filterTypes.indexOf(found.constructor) > -1) return found;
        } else if (found instanceof Namespace && (found = found.lookup(path.slice(1), filterTypes, true))) return found;
    // Otherwise try each nested namespace
    } else for(var i = 0; i < this.nestedArray.length; ++i)if (this._nestedArray[i] instanceof Namespace && (found = this._nestedArray[i].lookup(path, filterTypes, true))) return found;
    // If there hasn't been a match, try again at the parent
    if (this.parent === null || parentAlreadyChecked) return null;
    return this.parent.lookup(path, filterTypes);
};
/**
 * Looks up the reflection object at the specified path, relative to this namespace.
 * @name NamespaceBase#lookup
 * @function
 * @param {string|string[]} path Path to look up
 * @param {boolean} [parentAlreadyChecked=false] Whether the parent has already been checked
 * @returns {ReflectionObject|null} Looked up object or `null` if none could be found
 * @variation 2
 */ // lookup(path: string, [parentAlreadyChecked: boolean])
/**
 * Looks up the {@link Type|type} at the specified path, relative to this namespace.
 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
 * @param {string|string[]} path Path to look up
 * @returns {Type} Looked up type
 * @throws {Error} If `path` does not point to a type
 */ Namespace.prototype.lookupType = function lookupType(path) {
    var found = this.lookup(path, [
        Type
    ]);
    if (!found) throw Error("no such type: " + path);
    return found;
};
/**
 * Looks up the values of the {@link Enum|enum} at the specified path, relative to this namespace.
 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
 * @param {string|string[]} path Path to look up
 * @returns {Enum} Looked up enum
 * @throws {Error} If `path` does not point to an enum
 */ Namespace.prototype.lookupEnum = function lookupEnum(path) {
    var found = this.lookup(path, [
        Enum
    ]);
    if (!found) throw Error("no such Enum '" + path + "' in " + this);
    return found;
};
/**
 * Looks up the {@link Type|type} or {@link Enum|enum} at the specified path, relative to this namespace.
 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
 * @param {string|string[]} path Path to look up
 * @returns {Type} Looked up type or enum
 * @throws {Error} If `path` does not point to a type or enum
 */ Namespace.prototype.lookupTypeOrEnum = function lookupTypeOrEnum(path) {
    var found = this.lookup(path, [
        Type,
        Enum
    ]);
    if (!found) throw Error("no such Type or Enum '" + path + "' in " + this);
    return found;
};
/**
 * Looks up the {@link Service|service} at the specified path, relative to this namespace.
 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
 * @param {string|string[]} path Path to look up
 * @returns {Service} Looked up service
 * @throws {Error} If `path` does not point to a service
 */ Namespace.prototype.lookupService = function lookupService(path) {
    var found = this.lookup(path, [
        Service
    ]);
    if (!found) throw Error("no such Service '" + path + "' in " + this);
    return found;
};
// Sets up cyclic dependencies (called in index-light)
Namespace._configure = function(Type_, Service_, Enum_) {
    Type = Type_;
    Service = Service_;
    Enum = Enum_;
};

},{"./object":"aySAl","./field":"eqf59","./util":"lXEbJ","./oneof":"jIa8c"}],"eqf59":[function(require,module,exports) {
"use strict";
module.exports = Field;
// extends ReflectionObject
var ReflectionObject = require("./object");
((Field.prototype = Object.create(ReflectionObject.prototype)).constructor = Field).className = "Field";
var Enum = require("./enum"), types = require("./types"), util = require("./util");
var Type; // cyclic
var ruleRe = /^required|optional|repeated$/;
/**
 * Constructs a new message field instance. Note that {@link MapField|map fields} have their own class.
 * @name Field
 * @classdesc Reflected message field.
 * @extends FieldBase
 * @constructor
 * @param {string} name Unique name within its namespace
 * @param {number} id Unique id within its namespace
 * @param {string} type Value type
 * @param {string|Object.<string,*>} [rule="optional"] Field rule
 * @param {string|Object.<string,*>} [extend] Extended type if different from parent
 * @param {Object.<string,*>} [options] Declared options
 */ /**
 * Constructs a field from a field descriptor.
 * @param {string} name Field name
 * @param {IField} json Field descriptor
 * @returns {Field} Created field
 * @throws {TypeError} If arguments are invalid
 */ Field.fromJSON = function fromJSON(name, json) {
    return new Field(name, json.id, json.type, json.rule, json.extend, json.options, json.comment);
};
/**
 * Not an actual constructor. Use {@link Field} instead.
 * @classdesc Base class of all reflected message fields. This is not an actual class but here for the sake of having consistent type definitions.
 * @exports FieldBase
 * @extends ReflectionObject
 * @constructor
 * @param {string} name Unique name within its namespace
 * @param {number} id Unique id within its namespace
 * @param {string} type Value type
 * @param {string|Object.<string,*>} [rule="optional"] Field rule
 * @param {string|Object.<string,*>} [extend] Extended type if different from parent
 * @param {Object.<string,*>} [options] Declared options
 * @param {string} [comment] Comment associated with this field
 */ function Field(name, id, type, rule, extend, options, comment) {
    if (util.isObject(rule)) {
        comment = extend;
        options = rule;
        rule = extend = undefined;
    } else if (util.isObject(extend)) {
        comment = options;
        options = extend;
        extend = undefined;
    }
    ReflectionObject.call(this, name, options);
    if (!util.isInteger(id) || id < 0) throw TypeError("id must be a non-negative integer");
    if (!util.isString(type)) throw TypeError("type must be a string");
    if (rule !== undefined && !ruleRe.test(rule = rule.toString().toLowerCase())) throw TypeError("rule must be a string rule");
    if (extend !== undefined && !util.isString(extend)) throw TypeError("extend must be a string");
    /**
     * Field rule, if any.
     * @type {string|undefined}
     */ if (rule === "proto3_optional") rule = "optional";
    this.rule = rule && rule !== "optional" ? rule : undefined; // toJSON
    /**
     * Field type.
     * @type {string}
     */ this.type = type; // toJSON
    /**
     * Unique field id.
     * @type {number}
     */ this.id = id; // toJSON, marker
    /**
     * Extended type if different from parent.
     * @type {string|undefined}
     */ this.extend = extend || undefined; // toJSON
    /**
     * Whether this field is required.
     * @type {boolean}
     */ this.required = rule === "required";
    /**
     * Whether this field is optional.
     * @type {boolean}
     */ this.optional = !this.required;
    /**
     * Whether this field is repeated.
     * @type {boolean}
     */ this.repeated = rule === "repeated";
    /**
     * Whether this field is a map or not.
     * @type {boolean}
     */ this.map = false;
    /**
     * Message this field belongs to.
     * @type {Type|null}
     */ this.message = null;
    /**
     * OneOf this field belongs to, if any,
     * @type {OneOf|null}
     */ this.partOf = null;
    /**
     * The field type's default value.
     * @type {*}
     */ this.typeDefault = null;
    /**
     * The field's default value on prototypes.
     * @type {*}
     */ this.defaultValue = null;
    /**
     * Whether this field's value should be treated as a long.
     * @type {boolean}
     */ this.long = util.Long ? types.long[type] !== undefined : /* istanbul ignore next */ false;
    /**
     * Whether this field's value is a buffer.
     * @type {boolean}
     */ this.bytes = type === "bytes";
    /**
     * Resolved type if not a basic type.
     * @type {Type|Enum|null}
     */ this.resolvedType = null;
    /**
     * Sister-field within the extended type if a declaring extension field.
     * @type {Field|null}
     */ this.extensionField = null;
    /**
     * Sister-field within the declaring namespace if an extended field.
     * @type {Field|null}
     */ this.declaringField = null;
    /**
     * Internally remembers whether this field is packed.
     * @type {boolean|null}
     * @private
     */ this._packed = null;
    /**
     * Comment for this field.
     * @type {string|null}
     */ this.comment = comment;
}
/**
 * Determines whether this field is packed. Only relevant when repeated and working with proto2.
 * @name Field#packed
 * @type {boolean}
 * @readonly
 */ Object.defineProperty(Field.prototype, "packed", {
    get: function() {
        // defaults to packed=true if not explicity set to false
        if (this._packed === null) this._packed = this.getOption("packed") !== false;
        return this._packed;
    }
});
/**
 * @override
 */ Field.prototype.setOption = function setOption(name, value, ifNotSet) {
    if (name === "packed") this._packed = null;
    return ReflectionObject.prototype.setOption.call(this, name, value, ifNotSet);
};
/**
 * Field descriptor.
 * @interface IField
 * @property {string} [rule="optional"] Field rule
 * @property {string} type Field type
 * @property {number} id Field id
 * @property {Object.<string,*>} [options] Field options
 */ /**
 * Extension field descriptor.
 * @interface IExtensionField
 * @extends IField
 * @property {string} extend Extended type
 */ /**
 * Converts this field to a field descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {IField} Field descriptor
 */ Field.prototype.toJSON = function toJSON(toJSONOptions) {
    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
    return util.toObject([
        "rule",
        this.rule !== "optional" && this.rule || undefined,
        "type",
        this.type,
        "id",
        this.id,
        "extend",
        this.extend,
        "options",
        this.options,
        "comment",
        keepComments ? this.comment : undefined
    ]);
};
/**
 * Resolves this field's type references.
 * @returns {Field} `this`
 * @throws {Error} If any reference cannot be resolved
 */ Field.prototype.resolve = function resolve() {
    if (this.resolved) return this;
    if ((this.typeDefault = types.defaults[this.type]) === undefined) {
        this.resolvedType = (this.declaringField ? this.declaringField.parent : this.parent).lookupTypeOrEnum(this.type);
        if (this.resolvedType instanceof Type) this.typeDefault = null;
        else this.typeDefault = this.resolvedType.values[Object.keys(this.resolvedType.values)[0]]; // first defined
    } else if (this.options && this.options.proto3_optional) // proto3 scalar value marked optional; should default to null
    this.typeDefault = null;
    // use explicitly set default value if present
    if (this.options && this.options["default"] != null) {
        this.typeDefault = this.options["default"];
        if (this.resolvedType instanceof Enum && typeof this.typeDefault === "string") this.typeDefault = this.resolvedType.values[this.typeDefault];
    }
    // remove unnecessary options
    if (this.options) {
        if (this.options.packed === true || this.options.packed !== undefined && this.resolvedType && !(this.resolvedType instanceof Enum)) delete this.options.packed;
        if (!Object.keys(this.options).length) this.options = undefined;
    }
    // convert to internal data type if necesssary
    if (this.long) {
        this.typeDefault = util.Long.fromNumber(this.typeDefault, this.type.charAt(0) === "u");
        /* istanbul ignore else */ if (Object.freeze) Object.freeze(this.typeDefault); // long instances are meant to be immutable anyway (i.e. use small int cache that even requires it)
    } else if (this.bytes && typeof this.typeDefault === "string") {
        var buf;
        if (util.base64.test(this.typeDefault)) util.base64.decode(this.typeDefault, buf = util.newBuffer(util.base64.length(this.typeDefault)), 0);
        else util.utf8.write(this.typeDefault, buf = util.newBuffer(util.utf8.length(this.typeDefault)), 0);
        this.typeDefault = buf;
    }
    // take special care of maps and repeated fields
    if (this.map) this.defaultValue = util.emptyObject;
    else if (this.repeated) this.defaultValue = util.emptyArray;
    else this.defaultValue = this.typeDefault;
    // ensure proper value on prototype
    if (this.parent instanceof Type) this.parent.ctor.prototype[this.name] = this.defaultValue;
    return ReflectionObject.prototype.resolve.call(this);
};
/**
 * Decorator function as returned by {@link Field.d} and {@link MapField.d} (TypeScript).
 * @typedef FieldDecorator
 * @type {function}
 * @param {Object} prototype Target prototype
 * @param {string} fieldName Field name
 * @returns {undefined}
 */ /**
 * Field decorator (TypeScript).
 * @name Field.d
 * @function
 * @param {number} fieldId Field id
 * @param {"double"|"float"|"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"string"|"bool"|"bytes"|Object} fieldType Field type
 * @param {"optional"|"required"|"repeated"} [fieldRule="optional"] Field rule
 * @param {T} [defaultValue] Default value
 * @returns {FieldDecorator} Decorator function
 * @template T extends number | number[] | Long | Long[] | string | string[] | boolean | boolean[] | Uint8Array | Uint8Array[] | Buffer | Buffer[]
 */ Field.d = function decorateField(fieldId, fieldType, fieldRule, defaultValue) {
    // submessage: decorate the submessage and use its name as the type
    if (typeof fieldType === "function") fieldType = util.decorateType(fieldType).name;
    else if (fieldType && typeof fieldType === "object") fieldType = util.decorateEnum(fieldType).name;
    return function fieldDecorator(prototype, fieldName) {
        util.decorateType(prototype.constructor).add(new Field(fieldName, fieldId, fieldType, fieldRule, {
            "default": defaultValue
        }));
    };
};
/**
 * Field decorator (TypeScript).
 * @name Field.d
 * @function
 * @param {number} fieldId Field id
 * @param {Constructor<T>|string} fieldType Field type
 * @param {"optional"|"required"|"repeated"} [fieldRule="optional"] Field rule
 * @returns {FieldDecorator} Decorator function
 * @template T extends Message<T>
 * @variation 2
 */ // like Field.d but without a default value
// Sets up cyclic dependencies (called in index-light)
Field._configure = function configure(Type_) {
    Type = Type_;
};

},{"./object":"aySAl","./enum":"ctHUl","./types":"lER3o","./util":"lXEbJ"}],"lER3o":[function(require,module,exports) {
"use strict";
/**
 * Common type constants.
 * @namespace
 */ var types = exports;
var util = require("./util");
var s = [
    "double",
    "float",
    "int32",
    "uint32",
    "sint32",
    "fixed32",
    "sfixed32",
    "int64",
    "uint64",
    "sint64",
    "fixed64",
    "sfixed64",
    "bool",
    "string",
    "bytes" // 14
];
function bake(values, offset) {
    var i = 0, o = {};
    offset |= 0;
    while(i < values.length)o[s[i + offset]] = values[i++];
    return o;
}
/**
 * Basic type wire types.
 * @type {Object.<string,number>}
 * @const
 * @property {number} double=1 Fixed64 wire type
 * @property {number} float=5 Fixed32 wire type
 * @property {number} int32=0 Varint wire type
 * @property {number} uint32=0 Varint wire type
 * @property {number} sint32=0 Varint wire type
 * @property {number} fixed32=5 Fixed32 wire type
 * @property {number} sfixed32=5 Fixed32 wire type
 * @property {number} int64=0 Varint wire type
 * @property {number} uint64=0 Varint wire type
 * @property {number} sint64=0 Varint wire type
 * @property {number} fixed64=1 Fixed64 wire type
 * @property {number} sfixed64=1 Fixed64 wire type
 * @property {number} bool=0 Varint wire type
 * @property {number} string=2 Ldelim wire type
 * @property {number} bytes=2 Ldelim wire type
 */ types.basic = bake([
    /* double   */ 1,
    /* float    */ 5,
    /* int32    */ 0,
    /* uint32   */ 0,
    /* sint32   */ 0,
    /* fixed32  */ 5,
    /* sfixed32 */ 5,
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 1,
    /* sfixed64 */ 1,
    /* bool     */ 0,
    /* string   */ 2,
    /* bytes    */ 2
]);
/**
 * Basic type defaults.
 * @type {Object.<string,*>}
 * @const
 * @property {number} double=0 Double default
 * @property {number} float=0 Float default
 * @property {number} int32=0 Int32 default
 * @property {number} uint32=0 Uint32 default
 * @property {number} sint32=0 Sint32 default
 * @property {number} fixed32=0 Fixed32 default
 * @property {number} sfixed32=0 Sfixed32 default
 * @property {number} int64=0 Int64 default
 * @property {number} uint64=0 Uint64 default
 * @property {number} sint64=0 Sint32 default
 * @property {number} fixed64=0 Fixed64 default
 * @property {number} sfixed64=0 Sfixed64 default
 * @property {boolean} bool=false Bool default
 * @property {string} string="" String default
 * @property {Array.<number>} bytes=Array(0) Bytes default
 * @property {null} message=null Message default
 */ types.defaults = bake([
    /* double   */ 0,
    /* float    */ 0,
    /* int32    */ 0,
    /* uint32   */ 0,
    /* sint32   */ 0,
    /* fixed32  */ 0,
    /* sfixed32 */ 0,
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 0,
    /* sfixed64 */ 0,
    /* bool     */ false,
    /* string   */ "",
    /* bytes    */ util.emptyArray,
    /* message  */ null
]);
/**
 * Basic long type wire types.
 * @type {Object.<string,number>}
 * @const
 * @property {number} int64=0 Varint wire type
 * @property {number} uint64=0 Varint wire type
 * @property {number} sint64=0 Varint wire type
 * @property {number} fixed64=1 Fixed64 wire type
 * @property {number} sfixed64=1 Fixed64 wire type
 */ types.long = bake([
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 1,
    /* sfixed64 */ 1
], 7);
/**
 * Allowed types for map keys with their associated wire type.
 * @type {Object.<string,number>}
 * @const
 * @property {number} int32=0 Varint wire type
 * @property {number} uint32=0 Varint wire type
 * @property {number} sint32=0 Varint wire type
 * @property {number} fixed32=5 Fixed32 wire type
 * @property {number} sfixed32=5 Fixed32 wire type
 * @property {number} int64=0 Varint wire type
 * @property {number} uint64=0 Varint wire type
 * @property {number} sint64=0 Varint wire type
 * @property {number} fixed64=1 Fixed64 wire type
 * @property {number} sfixed64=1 Fixed64 wire type
 * @property {number} bool=0 Varint wire type
 * @property {number} string=2 Ldelim wire type
 */ types.mapKey = bake([
    /* int32    */ 0,
    /* uint32   */ 0,
    /* sint32   */ 0,
    /* fixed32  */ 5,
    /* sfixed32 */ 5,
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 1,
    /* sfixed64 */ 1,
    /* bool     */ 0,
    /* string   */ 2
], 2);
/**
 * Allowed types for packed repeated fields with their associated wire type.
 * @type {Object.<string,number>}
 * @const
 * @property {number} double=1 Fixed64 wire type
 * @property {number} float=5 Fixed32 wire type
 * @property {number} int32=0 Varint wire type
 * @property {number} uint32=0 Varint wire type
 * @property {number} sint32=0 Varint wire type
 * @property {number} fixed32=5 Fixed32 wire type
 * @property {number} sfixed32=5 Fixed32 wire type
 * @property {number} int64=0 Varint wire type
 * @property {number} uint64=0 Varint wire type
 * @property {number} sint64=0 Varint wire type
 * @property {number} fixed64=1 Fixed64 wire type
 * @property {number} sfixed64=1 Fixed64 wire type
 * @property {number} bool=0 Varint wire type
 */ types.packed = bake([
    /* double   */ 1,
    /* float    */ 5,
    /* int32    */ 0,
    /* uint32   */ 0,
    /* sint32   */ 0,
    /* fixed32  */ 5,
    /* sfixed32 */ 5,
    /* int64    */ 0,
    /* uint64   */ 0,
    /* sint64   */ 0,
    /* fixed64  */ 1,
    /* sfixed64 */ 1,
    /* bool     */ 0
]);

},{"./util":"lXEbJ"}],"jIa8c":[function(require,module,exports) {
"use strict";
module.exports = OneOf;
// extends ReflectionObject
var ReflectionObject = require("./object");
((OneOf.prototype = Object.create(ReflectionObject.prototype)).constructor = OneOf).className = "OneOf";
var Field = require("./field"), util = require("./util");
/**
 * Constructs a new oneof instance.
 * @classdesc Reflected oneof.
 * @extends ReflectionObject
 * @constructor
 * @param {string} name Oneof name
 * @param {string[]|Object.<string,*>} [fieldNames] Field names
 * @param {Object.<string,*>} [options] Declared options
 * @param {string} [comment] Comment associated with this field
 */ function OneOf(name, fieldNames, options, comment) {
    if (!Array.isArray(fieldNames)) {
        options = fieldNames;
        fieldNames = undefined;
    }
    ReflectionObject.call(this, name, options);
    /* istanbul ignore if */ if (!(fieldNames === undefined || Array.isArray(fieldNames))) throw TypeError("fieldNames must be an Array");
    /**
     * Field names that belong to this oneof.
     * @type {string[]}
     */ this.oneof = fieldNames || []; // toJSON, marker
    /**
     * Fields that belong to this oneof as an array for iteration.
     * @type {Field[]}
     * @readonly
     */ this.fieldsArray = []; // declared readonly for conformance, possibly not yet added to parent
    /**
     * Comment for this field.
     * @type {string|null}
     */ this.comment = comment;
}
/**
 * Oneof descriptor.
 * @interface IOneOf
 * @property {Array.<string>} oneof Oneof field names
 * @property {Object.<string,*>} [options] Oneof options
 */ /**
 * Constructs a oneof from a oneof descriptor.
 * @param {string} name Oneof name
 * @param {IOneOf} json Oneof descriptor
 * @returns {OneOf} Created oneof
 * @throws {TypeError} If arguments are invalid
 */ OneOf.fromJSON = function fromJSON(name, json) {
    return new OneOf(name, json.oneof, json.options, json.comment);
};
/**
 * Converts this oneof to a oneof descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {IOneOf} Oneof descriptor
 */ OneOf.prototype.toJSON = function toJSON(toJSONOptions) {
    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
    return util.toObject([
        "options",
        this.options,
        "oneof",
        this.oneof,
        "comment",
        keepComments ? this.comment : undefined
    ]);
};
/**
 * Adds the fields of the specified oneof to the parent if not already done so.
 * @param {OneOf} oneof The oneof
 * @returns {undefined}
 * @inner
 * @ignore
 */ function addFieldsToParent(oneof) {
    if (oneof.parent) {
        for(var i = 0; i < oneof.fieldsArray.length; ++i)if (!oneof.fieldsArray[i].parent) oneof.parent.add(oneof.fieldsArray[i]);
    }
}
/**
 * Adds a field to this oneof and removes it from its current parent, if any.
 * @param {Field} field Field to add
 * @returns {OneOf} `this`
 */ OneOf.prototype.add = function add(field) {
    /* istanbul ignore if */ if (!(field instanceof Field)) throw TypeError("field must be a Field");
    if (field.parent && field.parent !== this.parent) field.parent.remove(field);
    this.oneof.push(field.name);
    this.fieldsArray.push(field);
    field.partOf = this; // field.parent remains null
    addFieldsToParent(this);
    return this;
};
/**
 * Removes a field from this oneof and puts it back to the oneof's parent.
 * @param {Field} field Field to remove
 * @returns {OneOf} `this`
 */ OneOf.prototype.remove = function remove(field) {
    /* istanbul ignore if */ if (!(field instanceof Field)) throw TypeError("field must be a Field");
    var index = this.fieldsArray.indexOf(field);
    /* istanbul ignore if */ if (index < 0) throw Error(field + " is not a member of " + this);
    this.fieldsArray.splice(index, 1);
    index = this.oneof.indexOf(field.name);
    /* istanbul ignore else */ if (index > -1) this.oneof.splice(index, 1);
    field.partOf = null;
    return this;
};
/**
 * @override
 */ OneOf.prototype.onAdd = function onAdd(parent) {
    ReflectionObject.prototype.onAdd.call(this, parent);
    var self = this;
    // Collect present fields
    for(var i = 0; i < this.oneof.length; ++i){
        var field = parent.get(this.oneof[i]);
        if (field && !field.partOf) {
            field.partOf = self;
            self.fieldsArray.push(field);
        }
    }
    // Add not yet present fields
    addFieldsToParent(this);
};
/**
 * @override
 */ OneOf.prototype.onRemove = function onRemove(parent) {
    for(var i = 0, field; i < this.fieldsArray.length; ++i)if ((field = this.fieldsArray[i]).parent) field.parent.remove(field);
    ReflectionObject.prototype.onRemove.call(this, parent);
};
/**
 * Decorator function as returned by {@link OneOf.d} (TypeScript).
 * @typedef OneOfDecorator
 * @type {function}
 * @param {Object} prototype Target prototype
 * @param {string} oneofName OneOf name
 * @returns {undefined}
 */ /**
 * OneOf decorator (TypeScript).
 * @function
 * @param {...string} fieldNames Field names
 * @returns {OneOfDecorator} Decorator function
 * @template T extends string
 */ OneOf.d = function decorateOneOf() {
    var fieldNames = new Array(arguments.length), index = 0;
    while(index < arguments.length)fieldNames[index] = arguments[index++];
    return function oneOfDecorator(prototype, oneofName) {
        util.decorateType(prototype.constructor).add(new OneOf(oneofName, fieldNames));
        Object.defineProperty(prototype, oneofName, {
            get: util.oneOfGetter(fieldNames),
            set: util.oneOfSetter(fieldNames)
        });
    };
};

},{"./object":"aySAl","./field":"eqf59","./util":"lXEbJ"}],"2RIZG":[function(require,module,exports) {
"use strict";
module.exports = MapField;
// extends Field
var Field = require("./field");
((MapField.prototype = Object.create(Field.prototype)).constructor = MapField).className = "MapField";
var types = require("./types"), util = require("./util");
/**
 * Constructs a new map field instance.
 * @classdesc Reflected map field.
 * @extends FieldBase
 * @constructor
 * @param {string} name Unique name within its namespace
 * @param {number} id Unique id within its namespace
 * @param {string} keyType Key type
 * @param {string} type Value type
 * @param {Object.<string,*>} [options] Declared options
 * @param {string} [comment] Comment associated with this field
 */ function MapField(name, id, keyType, type, options, comment) {
    Field.call(this, name, id, type, undefined, undefined, options, comment);
    /* istanbul ignore if */ if (!util.isString(keyType)) throw TypeError("keyType must be a string");
    /**
     * Key type.
     * @type {string}
     */ this.keyType = keyType; // toJSON, marker
    /**
     * Resolved key type if not a basic type.
     * @type {ReflectionObject|null}
     */ this.resolvedKeyType = null;
    // Overrides Field#map
    this.map = true;
}
/**
 * Map field descriptor.
 * @interface IMapField
 * @extends {IField}
 * @property {string} keyType Key type
 */ /**
 * Extension map field descriptor.
 * @interface IExtensionMapField
 * @extends IMapField
 * @property {string} extend Extended type
 */ /**
 * Constructs a map field from a map field descriptor.
 * @param {string} name Field name
 * @param {IMapField} json Map field descriptor
 * @returns {MapField} Created map field
 * @throws {TypeError} If arguments are invalid
 */ MapField.fromJSON = function fromJSON(name, json) {
    return new MapField(name, json.id, json.keyType, json.type, json.options, json.comment);
};
/**
 * Converts this map field to a map field descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {IMapField} Map field descriptor
 */ MapField.prototype.toJSON = function toJSON(toJSONOptions) {
    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
    return util.toObject([
        "keyType",
        this.keyType,
        "type",
        this.type,
        "id",
        this.id,
        "extend",
        this.extend,
        "options",
        this.options,
        "comment",
        keepComments ? this.comment : undefined
    ]);
};
/**
 * @override
 */ MapField.prototype.resolve = function resolve() {
    if (this.resolved) return this;
    // Besides a value type, map fields have a key type that may be "any scalar type except for floating point types and bytes"
    if (types.mapKey[this.keyType] === undefined) throw Error("invalid key type: " + this.keyType);
    return Field.prototype.resolve.call(this);
};
/**
 * Map field decorator (TypeScript).
 * @name MapField.d
 * @function
 * @param {number} fieldId Field id
 * @param {"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"bool"|"string"} fieldKeyType Field key type
 * @param {"double"|"float"|"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"bool"|"string"|"bytes"|Object|Constructor<{}>} fieldValueType Field value type
 * @returns {FieldDecorator} Decorator function
 * @template T extends { [key: string]: number | Long | string | boolean | Uint8Array | Buffer | number[] | Message<{}> }
 */ MapField.d = function decorateMapField(fieldId, fieldKeyType, fieldValueType) {
    // submessage value: decorate the submessage and use its name as the type
    if (typeof fieldValueType === "function") fieldValueType = util.decorateType(fieldValueType).name;
    else if (fieldValueType && typeof fieldValueType === "object") fieldValueType = util.decorateEnum(fieldValueType).name;
    return function mapFieldDecorator(prototype, fieldName) {
        util.decorateType(prototype.constructor).add(new MapField(fieldName, fieldId, fieldKeyType, fieldValueType));
    };
};

},{"./field":"eqf59","./types":"lER3o","./util":"lXEbJ"}],"bWLAN":[function(require,module,exports) {
"use strict";
module.exports = Service;
// extends Namespace
var Namespace = require("./namespace");
((Service.prototype = Object.create(Namespace.prototype)).constructor = Service).className = "Service";
var Method = require("./method"), util = require("./util"), rpc = require("./rpc");
/**
 * Constructs a new service instance.
 * @classdesc Reflected service.
 * @extends NamespaceBase
 * @constructor
 * @param {string} name Service name
 * @param {Object.<string,*>} [options] Service options
 * @throws {TypeError} If arguments are invalid
 */ function Service(name, options) {
    Namespace.call(this, name, options);
    /**
     * Service methods.
     * @type {Object.<string,Method>}
     */ this.methods = {}; // toJSON, marker
    /**
     * Cached methods as an array.
     * @type {Method[]|null}
     * @private
     */ this._methodsArray = null;
}
/**
 * Service descriptor.
 * @interface IService
 * @extends INamespace
 * @property {Object.<string,IMethod>} methods Method descriptors
 */ /**
 * Constructs a service from a service descriptor.
 * @param {string} name Service name
 * @param {IService} json Service descriptor
 * @returns {Service} Created service
 * @throws {TypeError} If arguments are invalid
 */ Service.fromJSON = function fromJSON(name, json) {
    var service = new Service(name, json.options);
    /* istanbul ignore else */ if (json.methods) for(var names = Object.keys(json.methods), i = 0; i < names.length; ++i)service.add(Method.fromJSON(names[i], json.methods[names[i]]));
    if (json.nested) service.addJSON(json.nested);
    service.comment = json.comment;
    return service;
};
/**
 * Converts this service to a service descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {IService} Service descriptor
 */ Service.prototype.toJSON = function toJSON(toJSONOptions) {
    var inherited = Namespace.prototype.toJSON.call(this, toJSONOptions);
    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
    return util.toObject([
        "options",
        inherited && inherited.options || undefined,
        "methods",
        Namespace.arrayToJSON(this.methodsArray, toJSONOptions) || /* istanbul ignore next */ {},
        "nested",
        inherited && inherited.nested || undefined,
        "comment",
        keepComments ? this.comment : undefined
    ]);
};
/**
 * Methods of this service as an array for iteration.
 * @name Service#methodsArray
 * @type {Method[]}
 * @readonly
 */ Object.defineProperty(Service.prototype, "methodsArray", {
    get: function() {
        return this._methodsArray || (this._methodsArray = util.toArray(this.methods));
    }
});
function clearCache(service) {
    service._methodsArray = null;
    return service;
}
/**
 * @override
 */ Service.prototype.get = function get(name) {
    return this.methods[name] || Namespace.prototype.get.call(this, name);
};
/**
 * @override
 */ Service.prototype.resolveAll = function resolveAll() {
    var methods = this.methodsArray;
    for(var i = 0; i < methods.length; ++i)methods[i].resolve();
    return Namespace.prototype.resolve.call(this);
};
/**
 * @override
 */ Service.prototype.add = function add(object) {
    /* istanbul ignore if */ if (this.get(object.name)) throw Error("duplicate name '" + object.name + "' in " + this);
    if (object instanceof Method) {
        this.methods[object.name] = object;
        object.parent = this;
        return clearCache(this);
    }
    return Namespace.prototype.add.call(this, object);
};
/**
 * @override
 */ Service.prototype.remove = function remove(object) {
    if (object instanceof Method) {
        /* istanbul ignore if */ if (this.methods[object.name] !== object) throw Error(object + " is not a member of " + this);
        delete this.methods[object.name];
        object.parent = null;
        return clearCache(this);
    }
    return Namespace.prototype.remove.call(this, object);
};
/**
 * Creates a runtime service using the specified rpc implementation.
 * @param {RPCImpl} rpcImpl RPC implementation
 * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
 * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
 * @returns {rpc.Service} RPC service. Useful where requests and/or responses are streamed.
 */ Service.prototype.create = function create(rpcImpl, requestDelimited, responseDelimited) {
    var rpcService = new rpc.Service(rpcImpl, requestDelimited, responseDelimited);
    for(var i = 0, method; i < /* initializes */ this.methodsArray.length; ++i){
        var methodName = util.lcFirst((method = this._methodsArray[i]).resolve().name).replace(/[^$\w_]/g, "");
        rpcService[methodName] = util.codegen([
            "r",
            "c"
        ], util.isReserved(methodName) ? methodName + "_" : methodName)("return this.rpcCall(m,q,s,r,c)")({
            m: method,
            q: method.resolvedRequestType.ctor,
            s: method.resolvedResponseType.ctor
        });
    }
    return rpcService;
};

},{"./namespace":"11udM","./method":"gpCFJ","./util":"lXEbJ","./rpc":"eRwa1"}],"gpCFJ":[function(require,module,exports) {
"use strict";
module.exports = Method;
// extends ReflectionObject
var ReflectionObject = require("./object");
((Method.prototype = Object.create(ReflectionObject.prototype)).constructor = Method).className = "Method";
var util = require("./util");
/**
 * Constructs a new service method instance.
 * @classdesc Reflected service method.
 * @extends ReflectionObject
 * @constructor
 * @param {string} name Method name
 * @param {string|undefined} type Method type, usually `"rpc"`
 * @param {string} requestType Request message type
 * @param {string} responseType Response message type
 * @param {boolean|Object.<string,*>} [requestStream] Whether the request is streamed
 * @param {boolean|Object.<string,*>} [responseStream] Whether the response is streamed
 * @param {Object.<string,*>} [options] Declared options
 * @param {string} [comment] The comment for this method
 * @param {Object.<string,*>} [parsedOptions] Declared options, properly parsed into an object
 */ function Method(name, type, requestType, responseType, requestStream, responseStream, options, comment, parsedOptions) {
    /* istanbul ignore next */ if (util.isObject(requestStream)) {
        options = requestStream;
        requestStream = responseStream = undefined;
    } else if (util.isObject(responseStream)) {
        options = responseStream;
        responseStream = undefined;
    }
    /* istanbul ignore if */ if (!(type === undefined || util.isString(type))) throw TypeError("type must be a string");
    /* istanbul ignore if */ if (!util.isString(requestType)) throw TypeError("requestType must be a string");
    /* istanbul ignore if */ if (!util.isString(responseType)) throw TypeError("responseType must be a string");
    ReflectionObject.call(this, name, options);
    /**
     * Method type.
     * @type {string}
     */ this.type = type || "rpc"; // toJSON
    /**
     * Request type.
     * @type {string}
     */ this.requestType = requestType; // toJSON, marker
    /**
     * Whether requests are streamed or not.
     * @type {boolean|undefined}
     */ this.requestStream = requestStream ? true : undefined; // toJSON
    /**
     * Response type.
     * @type {string}
     */ this.responseType = responseType; // toJSON
    /**
     * Whether responses are streamed or not.
     * @type {boolean|undefined}
     */ this.responseStream = responseStream ? true : undefined; // toJSON
    /**
     * Resolved request type.
     * @type {Type|null}
     */ this.resolvedRequestType = null;
    /**
     * Resolved response type.
     * @type {Type|null}
     */ this.resolvedResponseType = null;
    /**
     * Comment for this method
     * @type {string|null}
     */ this.comment = comment;
    /**
     * Options properly parsed into an object
     */ this.parsedOptions = parsedOptions;
}
/**
 * Method descriptor.
 * @interface IMethod
 * @property {string} [type="rpc"] Method type
 * @property {string} requestType Request type
 * @property {string} responseType Response type
 * @property {boolean} [requestStream=false] Whether requests are streamed
 * @property {boolean} [responseStream=false] Whether responses are streamed
 * @property {Object.<string,*>} [options] Method options
 * @property {string} comment Method comments
 * @property {Object.<string,*>} [parsedOptions] Method options properly parsed into an object
 */ /**
 * Constructs a method from a method descriptor.
 * @param {string} name Method name
 * @param {IMethod} json Method descriptor
 * @returns {Method} Created method
 * @throws {TypeError} If arguments are invalid
 */ Method.fromJSON = function fromJSON(name, json) {
    return new Method(name, json.type, json.requestType, json.responseType, json.requestStream, json.responseStream, json.options, json.comment, json.parsedOptions);
};
/**
 * Converts this method to a method descriptor.
 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
 * @returns {IMethod} Method descriptor
 */ Method.prototype.toJSON = function toJSON(toJSONOptions) {
    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
    return util.toObject([
        "type",
        this.type !== "rpc" && /* istanbul ignore next */ this.type || undefined,
        "requestType",
        this.requestType,
        "requestStream",
        this.requestStream,
        "responseType",
        this.responseType,
        "responseStream",
        this.responseStream,
        "options",
        this.options,
        "comment",
        keepComments ? this.comment : undefined,
        "parsedOptions",
        this.parsedOptions, 
    ]);
};
/**
 * @override
 */ Method.prototype.resolve = function resolve() {
    /* istanbul ignore if */ if (this.resolved) return this;
    this.resolvedRequestType = this.parent.lookupType(this.requestType);
    this.resolvedResponseType = this.parent.lookupType(this.responseType);
    return ReflectionObject.prototype.resolve.call(this);
};

},{"./object":"aySAl","./util":"lXEbJ"}],"46CgL":[function(require,module,exports) {
"use strict";
module.exports = Message;
var util = require("./util/minimal");
/**
 * Constructs a new message instance.
 * @classdesc Abstract runtime message.
 * @constructor
 * @param {Properties<T>} [properties] Properties to set
 * @template T extends object = object
 */ function Message(properties) {
    // not used internally
    if (properties) for(var keys = Object.keys(properties), i = 0; i < keys.length; ++i)this[keys[i]] = properties[keys[i]];
}
/**
 * Reference to the reflected type.
 * @name Message.$type
 * @type {Type}
 * @readonly
 */ /**
 * Reference to the reflected type.
 * @name Message#$type
 * @type {Type}
 * @readonly
 */ /*eslint-disable valid-jsdoc*/ /**
 * Creates a new message of this type using the specified properties.
 * @param {Object.<string,*>} [properties] Properties to set
 * @returns {Message<T>} Message instance
 * @template T extends Message<T>
 * @this Constructor<T>
 */ Message.create = function create(properties) {
    return this.$type.create(properties);
};
/**
 * Encodes a message of this type.
 * @param {T|Object.<string,*>} message Message to encode
 * @param {Writer} [writer] Writer to use
 * @returns {Writer} Writer
 * @template T extends Message<T>
 * @this Constructor<T>
 */ Message.encode = function encode(message, writer) {
    return this.$type.encode(message, writer);
};
/**
 * Encodes a message of this type preceeded by its length as a varint.
 * @param {T|Object.<string,*>} message Message to encode
 * @param {Writer} [writer] Writer to use
 * @returns {Writer} Writer
 * @template T extends Message<T>
 * @this Constructor<T>
 */ Message.encodeDelimited = function encodeDelimited(message, writer) {
    return this.$type.encodeDelimited(message, writer);
};
/**
 * Decodes a message of this type.
 * @name Message.decode
 * @function
 * @param {Reader|Uint8Array} reader Reader or buffer to decode
 * @returns {T} Decoded message
 * @template T extends Message<T>
 * @this Constructor<T>
 */ Message.decode = function decode(reader) {
    return this.$type.decode(reader);
};
/**
 * Decodes a message of this type preceeded by its length as a varint.
 * @name Message.decodeDelimited
 * @function
 * @param {Reader|Uint8Array} reader Reader or buffer to decode
 * @returns {T} Decoded message
 * @template T extends Message<T>
 * @this Constructor<T>
 */ Message.decodeDelimited = function decodeDelimited(reader) {
    return this.$type.decodeDelimited(reader);
};
/**
 * Verifies a message of this type.
 * @name Message.verify
 * @function
 * @param {Object.<string,*>} message Plain object to verify
 * @returns {string|null} `null` if valid, otherwise the reason why it is not
 */ Message.verify = function verify(message) {
    return this.$type.verify(message);
};
/**
 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
 * @param {Object.<string,*>} object Plain object
 * @returns {T} Message instance
 * @template T extends Message<T>
 * @this Constructor<T>
 */ Message.fromObject = function fromObject(object) {
    return this.$type.fromObject(object);
};
/**
 * Creates a plain object from a message of this type. Also converts values to other types if specified.
 * @param {T} message Message instance
 * @param {IConversionOptions} [options] Conversion options
 * @returns {Object.<string,*>} Plain object
 * @template T extends Message<T>
 * @this Constructor<T>
 */ Message.toObject = function toObject(message, options) {
    return this.$type.toObject(message, options);
};
/**
 * Converts this message to JSON.
 * @returns {Object.<string,*>} JSON object
 */ Message.prototype.toJSON = function toJSON() {
    return this.$type.toObject(this, util.toJSONOptions);
}; /*eslint-enable valid-jsdoc*/ 

},{"./util/minimal":"4HDe1"}],"em0YB":[function(require,module,exports) {
"use strict";
module.exports = decoder;
var Enum = require("./enum"), types = require("./types"), util = require("./util");
function missing(field) {
    return "missing required '" + field.name + "'";
}
/**
 * Generates a decoder specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */ function decoder(mtype) {
    /* eslint-disable no-unexpected-multiline */ var gen = util.codegen([
        "r",
        "l"
    ], mtype.name + "$decode")("if(!(r instanceof Reader))")("r=Reader.create(r)")("var c=l===undefined?r.len:r.pos+l,m=new this.ctor" + (mtype.fieldsArray.filter(function(field) {
        return field.map;
    }).length ? ",k,value" : ""))("while(r.pos<c){")("var t=r.uint32()");
    if (mtype.group) gen("if((t&7)===4)")("break");
    gen("switch(t>>>3){");
    var i = 0;
    for(; i < /* initializes */ mtype.fieldsArray.length; ++i){
        var field = mtype._fieldsArray[i].resolve(), type = field.resolvedType instanceof Enum ? "int32" : field.type, ref = "m" + util.safeProp(field.name);
        gen("case %i: {", field.id);
        // Map fields
        if (field.map) {
            gen("if(%s===util.emptyObject)", ref)("%s={}", ref)("var c2 = r.uint32()+r.pos");
            if (types.defaults[field.keyType] !== undefined) gen("k=%j", types.defaults[field.keyType]);
            else gen("k=null");
            if (types.defaults[type] !== undefined) gen("value=%j", types.defaults[type]);
            else gen("value=null");
            gen("while(r.pos<c2){")("var tag2=r.uint32()")("switch(tag2>>>3){")("case 1: k=r.%s(); break", field.keyType)("case 2:");
            if (types.basic[type] === undefined) gen("value=types[%i].decode(r,r.uint32())", i); // can't be groups
            else gen("value=r.%s()", type);
            gen("break")("default:")("r.skipType(tag2&7)")("break")("}")("}");
            if (types.long[field.keyType] !== undefined) gen('%s[typeof k==="object"?util.longToHash(k):k]=value', ref);
            else gen("%s[k]=value", ref);
        // Repeated fields
        } else if (field.repeated) {
            gen("if(!(%s&&%s.length))", ref, ref)("%s=[]", ref);
            // Packable (always check for forward and backward compatiblity)
            if (types.packed[type] !== undefined) gen("if((t&7)===2){")("var c2=r.uint32()+r.pos")("while(r.pos<c2)")("%s.push(r.%s())", ref, type)("}else");
            // Non-packed
            if (types.basic[type] === undefined) gen(field.resolvedType.group ? "%s.push(types[%i].decode(r))" : "%s.push(types[%i].decode(r,r.uint32()))", ref, i);
            else gen("%s.push(r.%s())", ref, type);
        // Non-repeated
        } else if (types.basic[type] === undefined) gen(field.resolvedType.group ? "%s=types[%i].decode(r)" : "%s=types[%i].decode(r,r.uint32())", ref, i);
        else gen("%s=r.%s()", ref, type);
        gen("break")("}");
    // Unknown fields
    }
    gen("default:")("r.skipType(t&7)")("break")("}")("}");
    // Field presence
    for(i = 0; i < mtype._fieldsArray.length; ++i){
        var rfield = mtype._fieldsArray[i];
        if (rfield.required) gen("if(!m.hasOwnProperty(%j))", rfield.name)("throw util.ProtocolError(%j,{instance:m})", missing(rfield));
    }
    return gen("return m");
/* eslint-enable no-unexpected-multiline */ }

},{"./enum":"ctHUl","./types":"lER3o","./util":"lXEbJ"}],"bOenx":[function(require,module,exports) {
"use strict";
module.exports = verifier;
var Enum = require("./enum"), util = require("./util");
function invalid(field, expected) {
    return field.name + ": " + expected + (field.repeated && expected !== "array" ? "[]" : field.map && expected !== "object" ? "{k:" + field.keyType + "}" : "") + " expected";
}
/**
 * Generates a partial value verifier.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {number} fieldIndex Field index
 * @param {string} ref Variable reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */ function genVerifyValue(gen, field, fieldIndex, ref) {
    /* eslint-disable no-unexpected-multiline */ if (field.resolvedType) {
        if (field.resolvedType instanceof Enum) {
            gen("switch(%s){", ref)("default:")("return%j", invalid(field, "enum value"));
            for(var keys = Object.keys(field.resolvedType.values), j = 0; j < keys.length; ++j)gen("case %i:", field.resolvedType.values[keys[j]]);
            gen("break")("}");
        } else gen("{")("var e=types[%i].verify(%s);", fieldIndex, ref)("if(e)")("return%j+e", field.name + ".")("}");
    } else switch(field.type){
        case "int32":
        case "uint32":
        case "sint32":
        case "fixed32":
        case "sfixed32":
            gen("if(!util.isInteger(%s))", ref)("return%j", invalid(field, "integer"));
            break;
        case "int64":
        case "uint64":
        case "sint64":
        case "fixed64":
        case "sfixed64":
            gen("if(!util.isInteger(%s)&&!(%s&&util.isInteger(%s.low)&&util.isInteger(%s.high)))", ref, ref, ref, ref)("return%j", invalid(field, "integer|Long"));
            break;
        case "float":
        case "double":
            gen('if(typeof %s!=="number")', ref)("return%j", invalid(field, "number"));
            break;
        case "bool":
            gen('if(typeof %s!=="boolean")', ref)("return%j", invalid(field, "boolean"));
            break;
        case "string":
            gen("if(!util.isString(%s))", ref)("return%j", invalid(field, "string"));
            break;
        case "bytes":
            gen('if(!(%s&&typeof %s.length==="number"||util.isString(%s)))', ref, ref, ref)("return%j", invalid(field, "buffer"));
            break;
    }
    return gen;
/* eslint-enable no-unexpected-multiline */ }
/**
 * Generates a partial key verifier.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {string} ref Variable reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */ function genVerifyKey(gen, field, ref) {
    /* eslint-disable no-unexpected-multiline */ switch(field.keyType){
        case "int32":
        case "uint32":
        case "sint32":
        case "fixed32":
        case "sfixed32":
            gen("if(!util.key32Re.test(%s))", ref)("return%j", invalid(field, "integer key"));
            break;
        case "int64":
        case "uint64":
        case "sint64":
        case "fixed64":
        case "sfixed64":
            gen("if(!util.key64Re.test(%s))", ref) // see comment above: x is ok, d is not
            ("return%j", invalid(field, "integer|Long key"));
            break;
        case "bool":
            gen("if(!util.key2Re.test(%s))", ref)("return%j", invalid(field, "boolean key"));
            break;
    }
    return gen;
/* eslint-enable no-unexpected-multiline */ }
/**
 * Generates a verifier specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */ function verifier(mtype) {
    /* eslint-disable no-unexpected-multiline */ var gen = util.codegen([
        "m"
    ], mtype.name + "$verify")('if(typeof m!=="object"||m===null)')("return%j", "object expected");
    var oneofs = mtype.oneofsArray, seenFirstField = {};
    if (oneofs.length) gen("var p={}");
    for(var i = 0; i < /* initializes */ mtype.fieldsArray.length; ++i){
        var field = mtype._fieldsArray[i].resolve(), ref = "m" + util.safeProp(field.name);
        if (field.optional) gen("if(%s!=null&&m.hasOwnProperty(%j)){", ref, field.name); // !== undefined && !== null
        // map fields
        if (field.map) {
            gen("if(!util.isObject(%s))", ref)("return%j", invalid(field, "object"))("var k=Object.keys(%s)", ref)("for(var i=0;i<k.length;++i){");
            genVerifyKey(gen, field, "k[i]");
            genVerifyValue(gen, field, i, ref + "[k[i]]")("}");
        // repeated fields
        } else if (field.repeated) {
            gen("if(!Array.isArray(%s))", ref)("return%j", invalid(field, "array"))("for(var i=0;i<%s.length;++i){", ref);
            genVerifyValue(gen, field, i, ref + "[i]")("}");
        // required or present fields
        } else {
            if (field.partOf) {
                var oneofProp = util.safeProp(field.partOf.name);
                if (seenFirstField[field.partOf.name] === 1) gen("if(p%s===1)", oneofProp)("return%j", field.partOf.name + ": multiple values");
                seenFirstField[field.partOf.name] = 1;
                gen("p%s=1", oneofProp);
            }
            genVerifyValue(gen, field, i, ref);
        }
        if (field.optional) gen("}");
    }
    return gen("return null");
/* eslint-enable no-unexpected-multiline */ }

},{"./enum":"ctHUl","./util":"lXEbJ"}],"dDM7d":[function(require,module,exports) {
"use strict";
/**
 * Runtime message from/to plain object converters.
 * @namespace
 */ var converter = exports;
var Enum = require("./enum"), util = require("./util");
/**
 * Generates a partial value fromObject conveter.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {number} fieldIndex Field index
 * @param {string} prop Property reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */ function genValuePartial_fromObject(gen, field, fieldIndex, prop) {
    var defaultAlreadyEmitted = false;
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */ if (field.resolvedType) {
        if (field.resolvedType instanceof Enum) {
            gen("switch(d%s){", prop);
            for(var values = field.resolvedType.values, keys = Object.keys(values), i = 0; i < keys.length; ++i){
                // enum unknown values passthrough
                if (values[keys[i]] === field.typeDefault && !defaultAlreadyEmitted) {
                    gen("default:")('if(typeof(d%s)==="number"){m%s=d%s;break}', prop, prop, prop);
                    if (!field.repeated) gen // fallback to default value only for
                    ("break"); // for non-repeated fields, just ignore
                    defaultAlreadyEmitted = true;
                }
                gen("case%j:", keys[i])("case %i:", values[keys[i]])("m%s=%j", prop, values[keys[i]])("break");
            }
            gen("}");
        } else gen('if(typeof d%s!=="object")', prop)("throw TypeError(%j)", field.fullName + ": object expected")("m%s=types[%i].fromObject(d%s)", prop, fieldIndex, prop);
    } else {
        var isUnsigned = false;
        switch(field.type){
            case "double":
            case "float":
                gen("m%s=Number(d%s)", prop, prop); // also catches "NaN", "Infinity"
                break;
            case "uint32":
            case "fixed32":
                gen("m%s=d%s>>>0", prop, prop);
                break;
            case "int32":
            case "sint32":
            case "sfixed32":
                gen("m%s=d%s|0", prop, prop);
                break;
            case "uint64":
                isUnsigned = true;
            // eslint-disable-line no-fallthrough
            case "int64":
            case "sint64":
            case "fixed64":
            case "sfixed64":
                gen("if(util.Long)")("(m%s=util.Long.fromValue(d%s)).unsigned=%j", prop, prop, isUnsigned)('else if(typeof d%s==="string")', prop)("m%s=parseInt(d%s,10)", prop, prop)('else if(typeof d%s==="number")', prop)("m%s=d%s", prop, prop)('else if(typeof d%s==="object")', prop)("m%s=new util.LongBits(d%s.low>>>0,d%s.high>>>0).toNumber(%s)", prop, prop, prop, isUnsigned ? "true" : "");
                break;
            case "bytes":
                gen('if(typeof d%s==="string")', prop)("util.base64.decode(d%s,m%s=util.newBuffer(util.base64.length(d%s)),0)", prop, prop, prop)("else if(d%s.length >= 0)", prop)("m%s=d%s", prop, prop);
                break;
            case "string":
                gen("m%s=String(d%s)", prop, prop);
                break;
            case "bool":
                gen("m%s=Boolean(d%s)", prop, prop);
                break;
        }
    }
    return gen;
/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */ }
/**
 * Generates a plain object to runtime message converter specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */ converter.fromObject = function fromObject(mtype) {
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */ var fields = mtype.fieldsArray;
    var gen = util.codegen([
        "d"
    ], mtype.name + "$fromObject")("if(d instanceof this.ctor)")("return d");
    if (!fields.length) return gen("return new this.ctor");
    gen("var m=new this.ctor");
    for(var i = 0; i < fields.length; ++i){
        var field = fields[i].resolve(), prop = util.safeProp(field.name);
        // Map fields
        if (field.map) {
            gen("if(d%s){", prop)('if(typeof d%s!=="object")', prop)("throw TypeError(%j)", field.fullName + ": object expected")("m%s={}", prop)("for(var ks=Object.keys(d%s),i=0;i<ks.length;++i){", prop);
            genValuePartial_fromObject(gen, field, /* not sorted */ i, prop + "[ks[i]]")("}")("}");
        // Repeated fields
        } else if (field.repeated) {
            gen("if(d%s){", prop)("if(!Array.isArray(d%s))", prop)("throw TypeError(%j)", field.fullName + ": array expected")("m%s=[]", prop)("for(var i=0;i<d%s.length;++i){", prop);
            genValuePartial_fromObject(gen, field, /* not sorted */ i, prop + "[i]")("}")("}");
        // Non-repeated fields
        } else {
            if (!(field.resolvedType instanceof Enum)) gen // no need to test for null/undefined if an enum (uses switch)
            ("if(d%s!=null){", prop); // !== undefined && !== null
            genValuePartial_fromObject(gen, field, /* not sorted */ i, prop);
            if (!(field.resolvedType instanceof Enum)) gen("}");
        }
    }
    return gen("return m");
/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */ };
/**
 * Generates a partial value toObject converter.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {number} fieldIndex Field index
 * @param {string} prop Property reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */ function genValuePartial_toObject(gen, field, fieldIndex, prop) {
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */ if (field.resolvedType) {
        if (field.resolvedType instanceof Enum) gen("d%s=o.enums===String?(types[%i].values[m%s]===undefined?m%s:types[%i].values[m%s]):m%s", prop, fieldIndex, prop, prop, fieldIndex, prop, prop);
        else gen("d%s=types[%i].toObject(m%s,o)", prop, fieldIndex, prop);
    } else {
        var isUnsigned = false;
        switch(field.type){
            case "double":
            case "float":
                gen("d%s=o.json&&!isFinite(m%s)?String(m%s):m%s", prop, prop, prop, prop);
                break;
            case "uint64":
                isUnsigned = true;
            // eslint-disable-line no-fallthrough
            case "int64":
            case "sint64":
            case "fixed64":
            case "sfixed64":
                gen('if(typeof m%s==="number")', prop)("d%s=o.longs===String?String(m%s):m%s", prop, prop, prop)("else") // Long-like
                ("d%s=o.longs===String?util.Long.prototype.toString.call(m%s):o.longs===Number?new util.LongBits(m%s.low>>>0,m%s.high>>>0).toNumber(%s):m%s", prop, prop, prop, prop, isUnsigned ? "true" : "", prop);
                break;
            case "bytes":
                gen("d%s=o.bytes===String?util.base64.encode(m%s,0,m%s.length):o.bytes===Array?Array.prototype.slice.call(m%s):m%s", prop, prop, prop, prop, prop);
                break;
            default:
                gen("d%s=m%s", prop, prop);
                break;
        }
    }
    return gen;
/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */ }
/**
 * Generates a runtime message to plain object converter specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */ converter.toObject = function toObject(mtype) {
    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */ var fields = mtype.fieldsArray.slice().sort(util.compareFieldsById);
    if (!fields.length) return util.codegen()("return {}");
    var gen = util.codegen([
        "m",
        "o"
    ], mtype.name + "$toObject")("if(!o)")("o={}")("var d={}");
    var repeatedFields = [], mapFields = [], normalFields = [], i = 0;
    for(; i < fields.length; ++i)if (!fields[i].partOf) (fields[i].resolve().repeated ? repeatedFields : fields[i].map ? mapFields : normalFields).push(fields[i]);
    if (repeatedFields.length) {
        gen("if(o.arrays||o.defaults){");
        for(i = 0; i < repeatedFields.length; ++i)gen("d%s=[]", util.safeProp(repeatedFields[i].name));
        gen("}");
    }
    if (mapFields.length) {
        gen("if(o.objects||o.defaults){");
        for(i = 0; i < mapFields.length; ++i)gen("d%s={}", util.safeProp(mapFields[i].name));
        gen("}");
    }
    if (normalFields.length) {
        gen("if(o.defaults){");
        for(i = 0; i < normalFields.length; ++i){
            var field = normalFields[i], prop = util.safeProp(field.name);
            if (field.resolvedType instanceof Enum) gen("d%s=o.enums===String?%j:%j", prop, field.resolvedType.valuesById[field.typeDefault], field.typeDefault);
            else if (field.long) gen("if(util.Long){")("var n=new util.Long(%i,%i,%j)", field.typeDefault.low, field.typeDefault.high, field.typeDefault.unsigned)("d%s=o.longs===String?n.toString():o.longs===Number?n.toNumber():n", prop)("}else")("d%s=o.longs===String?%j:%i", prop, field.typeDefault.toString(), field.typeDefault.toNumber());
            else if (field.bytes) {
                var arrayDefault = "[" + Array.prototype.slice.call(field.typeDefault).join(",") + "]";
                gen("if(o.bytes===String)d%s=%j", prop, String.fromCharCode.apply(String, field.typeDefault))("else{")("d%s=%s", prop, arrayDefault)("if(o.bytes!==Array)d%s=util.newBuffer(d%s)", prop, prop)("}");
            } else gen("d%s=%j", prop, field.typeDefault); // also messages (=null)
        }
        gen("}");
    }
    var hasKs2 = false;
    for(i = 0; i < fields.length; ++i){
        var field = fields[i], index = mtype._fieldsArray.indexOf(field), prop = util.safeProp(field.name);
        if (field.map) {
            if (!hasKs2) {
                hasKs2 = true;
                gen("var ks2");
            }
            gen("if(m%s&&(ks2=Object.keys(m%s)).length){", prop, prop)("d%s={}", prop)("for(var j=0;j<ks2.length;++j){");
            genValuePartial_toObject(gen, field, /* sorted */ index, prop + "[ks2[j]]")("}");
        } else if (field.repeated) {
            gen("if(m%s&&m%s.length){", prop, prop)("d%s=[]", prop)("for(var j=0;j<m%s.length;++j){", prop);
            genValuePartial_toObject(gen, field, /* sorted */ index, prop + "[j]")("}");
        } else {
            gen("if(m%s!=null&&m.hasOwnProperty(%j)){", prop, field.name); // !== undefined && !== null
            genValuePartial_toObject(gen, field, /* sorted */ index, prop);
            if (field.partOf) gen("if(o.oneofs)")("d%s=%j", util.safeProp(field.partOf.name), field.name);
        }
        gen("}");
    }
    return gen("return d");
/* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */ };

},{"./enum":"ctHUl","./util":"lXEbJ"}],"gMoL0":[function(require,module,exports) {
"use strict";
/**
 * Wrappers for common types.
 * @type {Object.<string,IWrapper>}
 * @const
 */ var wrappers = exports;
var Message = require("./message");
/**
 * From object converter part of an {@link IWrapper}.
 * @typedef WrapperFromObjectConverter
 * @type {function}
 * @param {Object.<string,*>} object Plain object
 * @returns {Message<{}>} Message instance
 * @this Type
 */ /**
 * To object converter part of an {@link IWrapper}.
 * @typedef WrapperToObjectConverter
 * @type {function}
 * @param {Message<{}>} message Message instance
 * @param {IConversionOptions} [options] Conversion options
 * @returns {Object.<string,*>} Plain object
 * @this Type
 */ /**
 * Common type wrapper part of {@link wrappers}.
 * @interface IWrapper
 * @property {WrapperFromObjectConverter} [fromObject] From object converter
 * @property {WrapperToObjectConverter} [toObject] To object converter
 */ // Custom wrapper for Any
wrappers[".google.protobuf.Any"] = {
    fromObject: function(object) {
        // unwrap value type if mapped
        if (object && object["@type"]) {
            // Only use fully qualified type name after the last '/'
            var name = object["@type"].substring(object["@type"].lastIndexOf("/") + 1);
            var type = this.lookup(name);
            /* istanbul ignore else */ if (type) {
                // type_url does not accept leading "."
                var type_url = object["@type"].charAt(0) === "." ? object["@type"].slice(1) : object["@type"];
                // type_url prefix is optional, but path seperator is required
                if (type_url.indexOf("/") === -1) type_url = "/" + type_url;
                return this.create({
                    type_url: type_url,
                    value: type.encode(type.fromObject(object)).finish()
                });
            }
        }
        return this.fromObject(object);
    },
    toObject: function(message, options) {
        // Default prefix
        var googleApi = "type.googleapis.com/";
        var prefix = "";
        var name = "";
        // decode value if requested and unmapped
        if (options && options.json && message.type_url && message.value) {
            // Only use fully qualified type name after the last '/'
            name = message.type_url.substring(message.type_url.lastIndexOf("/") + 1);
            // Separate the prefix used
            prefix = message.type_url.substring(0, message.type_url.lastIndexOf("/") + 1);
            var type = this.lookup(name);
            /* istanbul ignore else */ if (type) message = type.decode(message.value);
        }
        // wrap value if unmapped
        if (!(message instanceof this.ctor) && message instanceof Message) {
            var object = message.$type.toObject(message, options);
            var messageName = message.$type.fullName[0] === "." ? message.$type.fullName.slice(1) : message.$type.fullName;
            // Default to type.googleapis.com prefix if no prefix is used
            if (prefix === "") prefix = googleApi;
            name = prefix + messageName;
            object["@type"] = name;
            return object;
        }
        return this.toObject(message, options);
    }
};

},{"./message":"46CgL"}],"8raSc":[function(require,module,exports) {
"use strict";
module.exports = Root;
// extends Namespace
var Namespace = require("./namespace");
((Root.prototype = Object.create(Namespace.prototype)).constructor = Root).className = "Root";
var Field = require("./field"), Enum = require("./enum"), OneOf = require("./oneof"), util = require("./util");
var Type, parse, common; // "
/**
 * Constructs a new root namespace instance.
 * @classdesc Root namespace wrapping all types, enums, services, sub-namespaces etc. that belong together.
 * @extends NamespaceBase
 * @constructor
 * @param {Object.<string,*>} [options] Top level options
 */ function Root(options) {
    Namespace.call(this, "", options);
    /**
     * Deferred extension fields.
     * @type {Field[]}
     */ this.deferred = [];
    /**
     * Resolved file names of loaded files.
     * @type {string[]}
     */ this.files = [];
}
/**
 * Loads a namespace descriptor into a root namespace.
 * @param {INamespace} json Nameespace descriptor
 * @param {Root} [root] Root namespace, defaults to create a new one if omitted
 * @returns {Root} Root namespace
 */ Root.fromJSON = function fromJSON(json, root) {
    if (!root) root = new Root();
    if (json.options) root.setOptions(json.options);
    return root.addJSON(json.nested);
};
/**
 * Resolves the path of an imported file, relative to the importing origin.
 * This method exists so you can override it with your own logic in case your imports are scattered over multiple directories.
 * @function
 * @param {string} origin The file name of the importing file
 * @param {string} target The file name being imported
 * @returns {string|null} Resolved path to `target` or `null` to skip the file
 */ Root.prototype.resolvePath = util.path.resolve;
/**
 * Fetch content from file path or url
 * This method exists so you can override it with your own logic.
 * @function
 * @param {string} path File path or url
 * @param {FetchCallback} callback Callback function
 * @returns {undefined}
 */ Root.prototype.fetch = util.fetch;
// A symbol-like function to safely signal synchronous loading
/* istanbul ignore next */ function SYNC() {} // eslint-disable-line no-empty-function
/**
 * Loads one or multiple .proto or preprocessed .json files into this root namespace and calls the callback.
 * @param {string|string[]} filename Names of one or multiple files to load
 * @param {IParseOptions} options Parse options
 * @param {LoadCallback} callback Callback function
 * @returns {undefined}
 */ Root.prototype.load = function load(filename, options, callback) {
    if (typeof options === "function") {
        callback = options;
        options = undefined;
    }
    var self = this;
    if (!callback) return util.asPromise(load, self, filename, options);
    var sync = callback === SYNC; // undocumented
    // Finishes loading by calling the callback (exactly once)
    function finish(err, root) {
        /* istanbul ignore if */ if (!callback) return;
        var cb = callback;
        callback = null;
        if (sync) throw err;
        cb(err, root);
    }
    // Bundled definition existence checking
    function getBundledFileName(filename) {
        var idx = filename.lastIndexOf("google/protobuf/");
        if (idx > -1) {
            var altname = filename.substring(idx);
            if (altname in common) return altname;
        }
        return null;
    }
    // Processes a single file
    function process(filename, source) {
        try {
            if (util.isString(source) && source.charAt(0) === "{") source = JSON.parse(source);
            if (!util.isString(source)) self.setOptions(source.options).addJSON(source.nested);
            else {
                parse.filename = filename;
                var parsed = parse(source, self, options), resolved, i = 0;
                if (parsed.imports) {
                    for(; i < parsed.imports.length; ++i)if (resolved = getBundledFileName(parsed.imports[i]) || self.resolvePath(filename, parsed.imports[i])) fetch(resolved);
                }
                if (parsed.weakImports) {
                    for(i = 0; i < parsed.weakImports.length; ++i)if (resolved = getBundledFileName(parsed.weakImports[i]) || self.resolvePath(filename, parsed.weakImports[i])) fetch(resolved, true);
                }
            }
        } catch (err) {
            finish(err);
        }
        if (!sync && !queued) finish(null, self); // only once anyway
    }
    // Fetches a single file
    function fetch(filename, weak) {
        // Skip if already loaded / attempted
        if (self.files.indexOf(filename) > -1) return;
        self.files.push(filename);
        // Shortcut bundled definitions
        if (filename in common) {
            if (sync) process(filename, common[filename]);
            else {
                ++queued;
                setTimeout(function() {
                    --queued;
                    process(filename, common[filename]);
                });
            }
            return;
        }
        // Otherwise fetch from disk or network
        if (sync) {
            var source;
            try {
                source = util.fs.readFileSync(filename).toString("utf8");
            } catch (err) {
                if (!weak) finish(err);
                return;
            }
            process(filename, source);
        } else {
            ++queued;
            self.fetch(filename, function(err, source) {
                --queued;
                /* istanbul ignore if */ if (!callback) return; // terminated meanwhile
                if (err) {
                    /* istanbul ignore else */ if (!weak) finish(err);
                    else if (!queued) finish(null, self);
                    return;
                }
                process(filename, source);
            });
        }
    }
    var queued = 0;
    // Assembling the root namespace doesn't require working type
    // references anymore, so we can load everything in parallel
    if (util.isString(filename)) filename = [
        filename
    ];
    for(var i = 0, resolved; i < filename.length; ++i)if (resolved = self.resolvePath("", filename[i])) fetch(resolved);
    if (sync) return self;
    if (!queued) finish(null, self);
    return undefined;
};
// function load(filename:string, options:IParseOptions, callback:LoadCallback):undefined
/**
 * Loads one or multiple .proto or preprocessed .json files into this root namespace and calls the callback.
 * @function Root#load
 * @param {string|string[]} filename Names of one or multiple files to load
 * @param {LoadCallback} callback Callback function
 * @returns {undefined}
 * @variation 2
 */ // function load(filename:string, callback:LoadCallback):undefined
/**
 * Loads one or multiple .proto or preprocessed .json files into this root namespace and returns a promise.
 * @function Root#load
 * @param {string|string[]} filename Names of one or multiple files to load
 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
 * @returns {Promise<Root>} Promise
 * @variation 3
 */ // function load(filename:string, [options:IParseOptions]):Promise<Root>
/**
 * Synchronously loads one or multiple .proto or preprocessed .json files into this root namespace (node only).
 * @function Root#loadSync
 * @param {string|string[]} filename Names of one or multiple files to load
 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
 * @returns {Root} Root namespace
 * @throws {Error} If synchronous fetching is not supported (i.e. in browsers) or if a file's syntax is invalid
 */ Root.prototype.loadSync = function loadSync(filename, options) {
    if (!util.isNode) throw Error("not supported");
    return this.load(filename, options, SYNC);
};
/**
 * @override
 */ Root.prototype.resolveAll = function resolveAll() {
    if (this.deferred.length) throw Error("unresolvable extensions: " + this.deferred.map(function(field) {
        return "'extend " + field.extend + "' in " + field.parent.fullName;
    }).join(", "));
    return Namespace.prototype.resolveAll.call(this);
};
// only uppercased (and thus conflict-free) children are exposed, see below
var exposeRe = /^[A-Z]/;
/**
 * Handles a deferred declaring extension field by creating a sister field to represent it within its extended type.
 * @param {Root} root Root instance
 * @param {Field} field Declaring extension field witin the declaring type
 * @returns {boolean} `true` if successfully added to the extended type, `false` otherwise
 * @inner
 * @ignore
 */ function tryHandleExtension(root, field) {
    var extendedType = field.parent.lookup(field.extend);
    if (extendedType) {
        var sisterField = new Field(field.fullName, field.id, field.type, field.rule, undefined, field.options);
        sisterField.declaringField = field;
        field.extensionField = sisterField;
        extendedType.add(sisterField);
        return true;
    }
    return false;
}
/**
 * Called when any object is added to this root or its sub-namespaces.
 * @param {ReflectionObject} object Object added
 * @returns {undefined}
 * @private
 */ Root.prototype._handleAdd = function _handleAdd(object) {
    if (object instanceof Field) {
        if (/* an extension field (implies not part of a oneof) */ object.extend !== undefined && /* not already handled */ !object.extensionField) {
            if (!tryHandleExtension(this, object)) this.deferred.push(object);
        }
    } else if (object instanceof Enum) {
        if (exposeRe.test(object.name)) object.parent[object.name] = object.values; // expose enum values as property of its parent
    } else if (!(object instanceof OneOf)) /* everything else is a namespace */ {
        if (object instanceof Type) for(var i = 0; i < this.deferred.length;)if (tryHandleExtension(this, this.deferred[i])) this.deferred.splice(i, 1);
        else ++i;
        for(var j = 0; j < /* initializes */ object.nestedArray.length; ++j)this._handleAdd(object._nestedArray[j]);
        if (exposeRe.test(object.name)) object.parent[object.name] = object; // expose namespace as property of its parent
    }
// The above also adds uppercased (and thus conflict-free) nested types, services and enums as
// properties of namespaces just like static code does. This allows using a .d.ts generated for
// a static module with reflection-based solutions where the condition is met.
};
/**
 * Called when any object is removed from this root or its sub-namespaces.
 * @param {ReflectionObject} object Object removed
 * @returns {undefined}
 * @private
 */ Root.prototype._handleRemove = function _handleRemove(object) {
    if (object instanceof Field) {
        if (/* an extension field */ object.extend !== undefined) {
            if (/* already handled */ object.extensionField) {
                object.extensionField.parent.remove(object.extensionField);
                object.extensionField = null;
            } else {
                var index = this.deferred.indexOf(object);
                /* istanbul ignore else */ if (index > -1) this.deferred.splice(index, 1);
            }
        }
    } else if (object instanceof Enum) {
        if (exposeRe.test(object.name)) delete object.parent[object.name]; // unexpose enum values
    } else if (object instanceof Namespace) {
        for(var i = 0; i < /* initializes */ object.nestedArray.length; ++i)this._handleRemove(object._nestedArray[i]);
        if (exposeRe.test(object.name)) delete object.parent[object.name]; // unexpose namespaces
    }
};
// Sets up cyclic dependencies (called in index-light)
Root._configure = function(Type_, parse_, common_) {
    Type = Type_;
    parse = parse_;
    common = common_;
};

},{"./namespace":"11udM","./field":"eqf59","./enum":"ctHUl","./oneof":"jIa8c","./util":"lXEbJ"}],"e7uya":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * @enum {number}
 */ const Status = {
    /**
     * This interim response indicates that the client should continue the request or ignore the response if the request is already finished.
     */ CONTINUE: 100,
    /**
     * This code is sent in response to an Upgrade request header from the client and indicates the protocol the server is switching to.
     */ SWITCHING_PROTOCOLS: 101,
    /**
     * This status code is primarily intended to be used with the Link header, letting the user agent start preloading resources while the server prepares a response.
     */ EARLY_HINTS: 103,
    /**
     * The request succeeded. The result meaning of "success" depends on the HTTP method.
     */ OK: 200,
    /**
     * The request succeeded, and a new resource was created as a result. This is typically the response sent after POST requests, or some PUT requests.
     */ CREATED: 201,
    /**
     * The request has been received but not yet acted upon. It is noncommittal, since there is no way in HTTP to later send an asynchronous response indicating the outcome of the request. It is intended for cases where another process or server handles the request, or for batch processing.
     */ ACCEPTED: 202,
    /**
     * This response code means the returned metadata is not exactly the same as is available from the origin server, but is collected from a local or a third-party copy. This is mostly used for mirrors or backups of another resource. Except for that specific case, the 200 OK response is preferred to this status.
     */ NONAUTHORITATIVE_INFORMATION: 203,
    /**
     * There is no content to send for this request, but the headers may be useful. The user agent may update its cached headers for this resource with the new ones.
     */ NO_CONTENT: 204,
    /**
     * Tells the user agent to reset the document which sent this request.
     */ RESET_CONTENT: 205,
    /**
     * This response code is used when the Range header is sent from the client to request only part of a resource.
     */ PARCIAL_CONTENT: 206,
    /**
     * The request has more than one possible response. The user agent or user should choose one of them. (There is no standardized way of choosing one of the responses, but HTML links to the possibilities are recommended so the user can pick.)
     */ MULTIPLE_CHOICES: 300,
    /**
     * The URL of the requested resource has been changed permanently. The new URL is given in the response.
     */ MOVED_PERMANENTLY: 301,
    /**
     * This response code means that the URI of requested resource has been changed temporarily. Further changes in the URI might be made in the future. Therefore, this same URI should be used by the client in future requests.
     */ FOUND: 302,
    /**
     * The server sent this response to direct the client to get the requested resource at another URI with a GET request.
     */ SEE_OTHER: 303,
    /**
     * This is used for caching purposes. It tells the client that the response has not been modified, so the client can continue to use the same cached version of the response.
     */ NOT_MODIFIED: 304,
    /**
     * The server sends this response to direct the client to get the requested resource at another URI with same method that was used in the prior request. This has the same semantics as the 302 Found HTTP response code, with the exception that the user agent must not change the HTTP method used: if a POST was used in the first request, a POST must be used in the second request.
     */ TEMPORARY_REDIRECT: 307,
    /**
     * This means that the resource is now permanently located at another URI, specified by the Location: HTTP Response header. This has the same semantics as the 301 Moved Permanently HTTP response code, with the exception that the user agent must not change the HTTP method used: if a POST was used in the first request, a POST must be used in the second request.
     */ PERMANENT_REDIRECT: 308,
    /**
     * The server cannot or will not process the request due to something that is perceived to be a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).
     */ BAD_REQUEST: 400,
    /**
     * Although the HTTP standard specifies "unauthorized", semantically this response means "unauthenticated". That is, the client must authenticate itself to get the requested response.
     */ UNAUTHORIZED: 401,
    /**
     * This response code is reserved for future use. The initial aim for creating this code was using it for digital payment systems, however this status code is used very rarely and no standard convention exists.
     */ PAYMENT_REQUIRED: 402,
    /**
     * The client does not have access rights to the content; that is, it is unauthorized, so the server is refusing to give the requested resource. Unlike 401 Unauthorized, the client's identity is known to the server.
     */ FORBIDDEN: 403,
    /**
     * The server can not find the requested resource. In the browser, this means the URL is not recognized. In an API, this can also mean that the endpoint is valid but the resource itself does not exist. Servers may also send this response instead of 403 Forbidden to hide the existence of a resource from an unauthorized client. This response code is probably the most well known due to its frequent occurrence on the web.
     */ NOT_FOUND: 404,
    /**
     * The request method is known by the server but is not supported by the target resource. For example, an API may not allow calling DELETE to remove a resource.
     */ METHOD_NOT_ALLOWED: 405,
    /**
     * This response is sent when the web server, after performing server-driven content negotiation, doesn't find any content that conforms to the criteria given by the user agent.
     */ NOT_ACCEPTABLE: 406,
    /**
     * This is similar to 401 Unauthorized but authentication is needed to be done by a proxy.
     */ PROXY_AUTHENTICATION_REQUIRED: 407,
    /**
     * This response is sent on an idle connection by some servers, even without any previous request by the client. It means that the server would like to shut down this unused connection. This response is used much more since some browsers, like Chrome, Firefox 27+, or IE9, use HTTP pre-connection mechanisms to speed up surfing. Also note that some servers merely shut down the connection without sending this message.
     */ REQUEST_TIMEOUT: 408,
    /**
     * This response is sent when a request conflicts with the current state of the server.
     */ CONFLICT: 409,
    /**
     * This response is sent when the requested content has been permanently deleted from server, with no forwarding address. Clients are expected to remove their caches and links to the resource. The HTTP specification intends this status code to be used for "limited-time, promotional services". APIs should not feel compelled to indicate resources that have been deleted with this status code.
     */ GONE: 410,
    /**
     * Server rejected the request because the Content-Length header field is not defined and the server requires it.
     */ LENGTH_REQUIRED: 411,
    /**
     * The client has indicated preconditions in its headers which the server does not meet.
     */ PRECONDITION_FAILED: 412,
    /**
     * Request entity is larger than limits defined by server. The server might close the connection or return an Retry-After header field.
     */ PAYLOAD_TOO_LARGE: 413,
    /**
     * The URI requested by the client is longer than the server is willing to interpret.
     */ URI_TOO_LONG: 414,
    /**
     * The media format of the requested data is not supported by the server, so the server is rejecting the request.
     */ UNSUPPORTED_MEDIA_TYPE: 415,
    /**
     * The range specified by the Range header field in the request cannot be fulfilled. It's possible that the range is outside the size of the target URI's data.
     */ RANGE_NOT_SATISFIABLE: 416,
    /**
     * This response code means the expectation indicated by the Expect request header field cannot be met by the server.
     */ EXPECTATION_FAILED: 417,
    /**
     * The server refuses the attempt to brew coffee with a teapot.
     */ IM_A_TEAPOT: 418,
    /**
     * The request was well-formed but was unable to be followed due to semantic errors.
     */ UNPROCESSABLE_ENTITY: 422,
    /**
     * Indicates that the server is unwilling to risk processing a request that might be replayed.
     */ TOO_EARLY: 425,
    /**
     * The server refuses to perform the request using the current protocol but might be willing to do so after the client upgrades to a different protocol. The server sends an Upgrade header in a 426 response to indicate the required protocol(s).
     */ UPGRADE_REQUIRED: 426,
    /**
     * The origin server requires the request to be conditional. This response is intended to prevent the 'lost update' problem, where a client GETs a resource's state, modifies it and PUTs it back to the server, when meanwhile a third party has modified the state on the server, leading to a conflict.
     */ PRECONDITION_REQUIRED: 428,
    /**
     * The user has sent too many requests in a given amount of time ("rate limiting").
     */ TOO_MANY_REQUESTS: 429,
    /**
     * The server is unwilling to process the request because its header fields are too large. The request may be resubmitted after reducing the size of the request header fields.
     */ REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
    /**
     * The user agent requested a resource that cannot legally be provided, such as a web page censored by a government.
     */ UNAVAILABLE_FOR_LEGAL_REASONS: 451,
    /**
     * The server has encountered a situation it does not know how to handle.
     */ INTERNAL_SERVER_ERROR: 500,
    /**
     * The request method is not supported by the server and cannot be handled. The only methods that servers are required to support (and therefore that must not return this code) are GET and HEAD.
     */ NOT_IMPLEMENTED: 501,
    /**
     * This error response means that the server, while working as a gateway to get a response needed to handle the request, got an invalid response.
     */ BAD_GATEWAY: 502,
    /**
     * The server is not ready to handle the request. Common causes are a server that is down for maintenance or that is overloaded. Note that together with this response, a user-friendly page explaining the problem should be sent. This response should be used for temporary conditions and the Retry-After HTTP header should, if possible, contain the estimated time before the recovery of the service. The webmaster must also take care about the caching-related headers that are sent along with this response, as these temporary condition responses should usually not be cached.
     */ SERVICE_UNAVAILABLE: 503,
    /**
     * This error response is given when the server is acting as a gateway and cannot get a response in time.
     */ GATEWAY_TIMEOUT: 504,
    /**
     * The HTTP version used in the request is not supported by the server.
     */ HTTP_VERSION_NOT_SUPPORTED: 505,
    /**
     * The server has an internal configuration error: the chosen variant resource is configured to engage in transparent content negotiation itself, and is therefore not a proper end point in the negotiation process.
     */ VARIANT_ALSO_NEGOTIATES: 506,
    /**
     * The method could not be performed on the resource because the server is unable to store the representation needed to successfully complete the request.
     */ INSUFFICIENT_STORAGE: 507,
    /**
     * The server detected an infinite loop while processing the request.
     */ LOOP_DETECTED: 508,
    /**
     * Further extensions to the request are required for the server to fulfill it.
     */ NOT_EXTENDED: 510,
    /**
     * Indicates that the client needs to authenticate to gain network access.
     */ NETWORK_AUTHENTICATION_REQUIRED: 511
};
exports.default = Status;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"fvlz8":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var _status = require("./Status");
var _statusDefault = parcelHelpers.interopDefault(_status);
class RESTError extends Error {
    /**
     * @readonly
     * @type {Status}
     */ status = null;
    /**
     * 
     * @param {string} message 
     * @param {Status} status 
     */ constructor(status, message){
        super(message);
        this.status = status;
    }
    toJSON() {
        return {
            status: "rejected",
            cause: this.message
        };
    }
}
RESTError.NOT_FOUND = new RESTError((0, _statusDefault.default).NOT_FOUND, "resource not found");
RESTError.NOT_IMPLEMENTED = new RESTError((0, _statusDefault.default).NOT_IMPLEMENTED, "not implemented");
RESTError.INTERNAL_SERVER_ERROR = new RESTError((0, _statusDefault.default).INTERNAL_SERVER_ERROR, "internal server error");
exports.default = RESTError;

},{"./Status":"e7uya","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"7srda":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var _status = require("./Status");
var _statusDefault = parcelHelpers.interopDefault(_status);
/**
 * @template T
 */ class RESTResponse {
    /**
     * @readonly
     * @type {Status}
     */ status = null;
    /**
     * @readonly
     * @type {T}
     */ data = null;
    /**
     * @readonly
     * @type {number|undefined}
     */ count = null;
    /**
     * 
     * @param {Status} status 
     * @param {T} data 
     * @param {number} count 
     */ constructor(status, data, count = null){
        this.status = status;
        this.data = data;
        if (typeof count === "number") this.count = count;
    }
    toJSON() {
        return {
            status: "OK",
            count: this.count === null ? undefined : this.count,
            data: this.data
        };
    }
}
exports.default = RESTResponse;

},{"./Status":"e7uya","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"cB7AC":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "Logger", ()=>(0, _loggerDefault.default));
parcelHelpers.export(exports, "Level", ()=>(0, _levelDefault.default));
parcelHelpers.export(exports, "LoggerFactory", ()=>(0, _loggerFactoryDefault.default));
parcelHelpers.export(exports, "LogReporter", ()=>(0, _logReporterDefault.default));
parcelHelpers.export(exports, "ConsoleLogReporter", ()=>(0, _consoleLogReporterDefault.default));
var _logger = require("./Logger");
var _loggerDefault = parcelHelpers.interopDefault(_logger);
var _level = require("./Level");
var _levelDefault = parcelHelpers.interopDefault(_level);
var _loggerFactory = require("./LoggerFactory");
var _loggerFactoryDefault = parcelHelpers.interopDefault(_loggerFactory);
var _logReporter = require("./LogReporter");
var _logReporterDefault = parcelHelpers.interopDefault(_logReporter);
var _consoleLogReporter = require("./ConsoleLogReporter");
var _consoleLogReporterDefault = parcelHelpers.interopDefault(_consoleLogReporter);
const logging = new (0, _loggerFactoryDefault.default)([
    new (0, _consoleLogReporterDefault.default)()
]);
exports.default = logging;

},{"./Logger":"kEcM6","./Level":"8ZNXM","./LoggerFactory":"6pJIP","./LogReporter":"cYBq8","./ConsoleLogReporter":"go9iH","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"kEcM6":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
/**
 * @callback LogMessageFn
 * @param {import('./Level').LoggerLevel} level
 * @param {string} scope
 * @param {string} time
 * @param {Array<any>} messages
 */ class Logger {
    /**
     * @private
     * @type {string}
     */ scope = null;
    /**
     * @private
     * @type {LogMessageFn}
     */ logMessageFn = null;
    /**
     * 
     * @param {string} scope 
     * @param {LogMessageFn} logMessage 
     */ constructor(scope, logMessage){
        this.scope = scope;
        this.logMessageFn = logMessage;
    }
    error(...args) {
        this.log("error", ...args);
    }
    warning(...args) {
        this.log("warning", ...args);
    }
    info(...args) {
        this.log("info", ...args);
    }
    debug(...args) {
        this.log("debug", ...args);
    }
    verbose(...args) {
        this.log("verbose", ...args);
    }
    /**
     * 
     * @param {import('./Level').LoggerLevel} level 
     * @param  {...any} args 
     */ log(level, ...args) {
        let time = new Date().toISOString();
        this.logMessageFn(level, this.scope, time, args);
    }
}
exports.default = Logger;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"8ZNXM":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "getLevelOrder", ()=>getLevelOrder);
parcelHelpers.export(exports, "getLevel", ()=>getLevel);
/**
 * @typedef LoggerLevel
 * @type {('silent'|'error'|'warning'|'info'|'debug'|'verbose')}
 */ const LevelOrder = {
    silent: -1,
    error: 0,
    warning: 1,
    info: 2,
    debug: 3,
    verbose: 4
};
/**
 * @enum {string}
 */ const Level = {
    SILENT: "silent",
    ERROR: "error",
    WARNING: "warning",
    INFO: "info",
    DEBUG: "debug",
    VERBOSE: "verbose"
};
/**
 * 
 * @param {LoggerLevel} level 
 */ const getLevelOrder = (level)=>{
    let order = LevelOrder[level] || null;
    if (typeof order !== "number") return -1;
    return order;
};
/**
 * 
 * @param {number} levelOrder 
 * @returns {LoggerLevel}
 */ const getLevel = (levelOrder)=>{
    let level = Object.keys(LevelOrder).find((key)=>LevelOrder[key] === levelOrder) || null;
    if (level === null) return "silent";
    return level;
};
exports.default = Level;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"6pJIP":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var _level = require("./Level");
var _logger = require("./Logger");
var _loggerDefault = parcelHelpers.interopDefault(_logger);
var _logReporter = require("./LogReporter");
var _logReporterDefault = parcelHelpers.interopDefault(_logReporter);
class LoggerFactory {
    /**
     * @private
     * @type {Map<string,Logger>}
     */ loggers = new Map();
    /**
     * @private
     * @type {Array<LogReporter>}
     */ reporters = [];
    /**
     * @private
     * @type {number}
     */ levelOrder = null;
    /**
     * 
     * @param {Array<LogReporter>} reporters 
     */ constructor(reporters = []){
        this.reporters = reporters;
        this.level = "info";
    }
    set level(level) {
        this.levelOrder = (0, _level.getLevelOrder)(level);
    }
    get level() {
        return (0, _level.getLevel)(this.levelOrder);
    }
    getLogger(scope = "default") {
        if (!this.loggers.has(scope)) {
            let logger = new (0, _loggerDefault.default)(scope, this.onLog);
            this.loggers.set(scope, logger);
        }
        return this.loggers.get(scope);
    }
    /**
     * @private
     * @param {import('./Level').LoggerLevel} level 
     * @param {string} scope 
     * @param {string} time
     * @param {Array<any>} messages
     */ onLog = (level, scope, time, messages)=>{
        let order = (0, _level.getLevelOrder)(level);
        if (this.levelOrder < order) return;
        for (let reporter of this.reporters)reporter.log(level, scope, time, messages);
    };
}
exports.default = LoggerFactory;

},{"./Level":"8ZNXM","./Logger":"kEcM6","./LogReporter":"cYBq8","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"cYBq8":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
class LogReporter {
    /**
     * 
     * @param {import('./Level').LoggerLevel} level 
     * @param {string} scope 
     * @param {string} time
     * @param {Array<any>} messages 
     */ log(level, scope, time, messages) {}
}
exports.default = LogReporter;

},{"@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"go9iH":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
var _logReporter = require("./LogReporter");
var _logReporterDefault = parcelHelpers.interopDefault(_logReporter);
class ConsoleLogReporter extends (0, _logReporterDefault.default) {
    /**
     * 
     * @param {import('./Level').LoggerLevel} level 
     * @param {string} scope 
     * @param {string} time
     * @param {Array<any>} messages 
     */ log(level, scope, time, messages) {
        if (level === "error") console.error(`${level.toUpperCase()} [${time}] | ${scope}:`, ...messages);
        else if (level === "warning") console.warn(`${level.toUpperCase()} [${time}] | ${scope}:`, ...messages);
        else console.log(`${level.toUpperCase()} [${time}] | ${scope}:`, ...messages);
    }
}
exports.default = ConsoleLogReporter;

},{"./LogReporter":"cYBq8","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}],"htyGI":[function(require,module,exports) {
var parcelHelpers = require("@parcel/transformer-js/src/esmodule-helpers.js");
parcelHelpers.defineInteropFlag(exports);
parcelHelpers.export(exports, "encode", ()=>encode);
parcelHelpers.export(exports, "decode", ()=>decode);
var _base = require("@toolcase/base");
const serializer = new (0, _base.Serializer)("@toolcase/realtime");
const DATA_MODEL = "realtime_message";
serializer.define(DATA_MODEL, [
    {
        key: "topic",
        type: "string",
        rule: "required"
    },
    {
        key: "payload",
        type: "bytes",
        rule: "required"
    }
]);
const encode = (topic, payload)=>{
    return serializer.encode(DATA_MODEL, {
        topic,
        payload
    });
};
const decode = (buffer)=>{
    return serializer.decode(DATA_MODEL, buffer);
};

},{"@toolcase/base":"cNzzF","@parcel/transformer-js/src/esmodule-helpers.js":"gkKU3"}]},["iFasa","gQInm"], "gQInm", "parcelRequireacae")

//# sourceMappingURL=webapp.9c67bce7.js.map
