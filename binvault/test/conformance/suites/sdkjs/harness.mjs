// Shared harness of the sdkjs suite: environment, S3 clients, mini test runner, assertions, helpers.
// No test framework: cases register with test(id, fn) and run() prints one @@RESULT line per case.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import dns from 'node:dns';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { S3Client } from '@aws-sdk/client-s3';

// ----------------------------------------------------------------------------------------------
// environment (written by support/bootstrap.py and suites/sdkjs/run.sh)

export const ENV = JSON.parse(fs.readFileSync(process.env.BV_ENV_JSON, 'utf8'));
export const SUITE_DIR = path.dirname(process.env.BV_ENV_JSON);
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TOOL_ENDPOINT = process.env.BV_TOOL_ENDPOINT || ENV.tool_endpoint || ENV.endpoint;
const te = new URL(TOOL_ENDPOINT);
export const TOOL_HOST = te.hostname;
export const TOOL_PORT = Number(te.port || 80);
export const DOMAIN = process.env.BV_DOMAIN || ENV.domain;
export const REGION = ENV.region || 'us-east-1';
export const B = ENV.buckets; // {plain, versioned, public, quota, ctype} -> {name, access_key, secret_key}
export const QUOTA_BYTES = ENV.quota_bytes;
export const EXTRA = (() => {
    try {
        return JSON.parse(fs.readFileSync(path.join(SUITE_DIR, 'extra.json'), 'utf8'));
    } catch {
        return {};
    }
})();
export const KiB = 1024;
export const MiB = 1024 * 1024;

// ----------------------------------------------------------------------------------------------
// networking: every client shares one keep-alive agent whose DNS lookup sends <anything>.DOMAIN
// to the node, so virtual-hosted style works offline and from inside a container alike.

function lookup(hostname, options, cb) {
    if (typeof options === 'function') {
        cb = options;
        options = {};
    }
    const h = DOMAIN && (hostname === DOMAIN || hostname.endsWith('.' + DOMAIN)) ? TOOL_HOST : hostname;
    return dns.lookup(h, options, cb);
}
export const agent = new http.Agent({ keepAlive: true, maxSockets: 128, lookup });

/** o: { vhost, region, maxAttempts, endpoint, anonymous, config, requestTimeout } */
export function client(kind = 'plain', o = {}) {
    const bk = typeof kind === 'string' ? B[kind] : kind;
    const cfg = {
        endpoint: o.endpoint ?? (o.vhost ? `http://${DOMAIN}:${TOOL_PORT}` : TOOL_ENDPOINT),
        region: o.region ?? REGION,
        forcePathStyle: !o.vhost,
        maxAttempts: o.maxAttempts ?? 1,
        requestHandler: { httpAgent: agent, requestTimeout: o.requestTimeout ?? 90000, connectionTimeout: 10000 },
        ...(o.config || {}),
    };
    if (!o.anonymous) cfg.credentials = { accessKeyId: bk.access_key, secretAccessKey: bk.secret_key };
    return new S3Client(cfg);
}

let _noAuth;
/** A client that sends unsigned requests (no Authorization header at all). */
export async function anonClient(o = {}) {
    if (_noAuth === undefined) {
        try {
            _noAuth = (await import('@smithy/core')).NoAuthSigner;
        } catch {
            _noAuth = null;
        }
    }
    const c = client('plain', { ...o, anonymous: true });
    if (_noAuth) {
        c.config.httpAuthSchemeProvider = () => [{ schemeId: 'smithy.api#noAuth' }];
        c.config.httpAuthSchemes = [{ schemeId: 'smithy.api#noAuth', identityProvider: () => async () => ({}), signer: new _noAuth() }];
    } else {
        // fallback: strip the signature after the signing middleware ran
        c.middlewareStack.add((next) => async (args) => {
            for (const h of Object.keys(args.request.headers)) if (/^(authorization|x-amz-date|x-amz-content-sha256|x-amz-security-token)$/i.test(h)) delete args.request.headers[h];
            return next(args);
        }, { step: 'finalizeRequest', priority: 'low', name: 'stripAuth' });
    }
    return c;
}

/** Record every request/response that passes through the client's finalizeRequest step. */
export function tap(c) {
    const recs = [];
    c.middlewareStack.add((next) => async (args) => {
        const r = args.request;
        const rec = { method: r.method, path: r.path, query: r.query, headers: { ...r.headers }, hostname: r.hostname };
        recs.push(rec);
        try {
            const out = await next(args);
            rec.status = out.response.statusCode;
            rec.resHeaders = out.response.headers;
            return out;
        } catch (e) {
            rec.error = e;
            rec.status = e?.$metadata?.httpStatusCode;
            rec.resHeaders = e?.$response?.headers;
            throw e;
        }
    }, { step: 'finalizeRequest', priority: 'low', name: 'tap' });
    return recs;
}

// ----------------------------------------------------------------------------------------------
// plain HTTP with exact bytes: no URL normalisation (WHATWG URL would collapse /./ and /../ in keys)

export function splitUrl(u) {
    const m = /^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/.exec(u);
    if (!m) throw new Error('bad url ' + u);
    const [hostname, port] = m[2].split(':');
    return { protocol: m[1], host: m[2], hostname, port: Number(port || 80), path: (m[3] || '/') + (m[4] || '') };
}

/** httpReq(method, url, {headers, body}) -> {status, headers, body: Buffer, text}. Never throws on HTTP errors. */
export function httpReq(method, url, { headers = {}, body = null, timeout = 60000 } = {}) {
    const u = splitUrl(url);
    return new Promise((resolve, reject) => {
        const req = http.request({ host: u.hostname, port: u.port, method, path: u.path, headers: { host: u.host, ...headers }, agent: false, lookup }, (res) => {
            const chunks = [];
            res.on('data', (d) => chunks.push(d));
            res.on('end', () => {
                const b = Buffer.concat(chunks);
                resolve({ status: res.statusCode, headers: res.headers, body: b, text: b.toString('utf8') });
            });
            res.on('error', reject);
        });
        req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
        req.on('error', reject);
        if (body != null) req.write(body);
        req.end();
    });
}

export function xmlCode(text) {
    const m = /<Code>([^<]*)<\/Code>/.exec(text || '');
    return m ? m[1] : '';
}

// ----------------------------------------------------------------------------------------------
// recording proxy: sits between an SDK client and the node and records what is really on the wire

export function startProxy(target = TOOL_ENDPOINT) {
    const t = new URL(target);
    const recs = [];
    const server = http.createServer((req, res) => {
        const rec = { method: req.method, url: req.url, headers: { ...req.headers }, raw: req.rawHeaders.slice(), bytes: 0, head: Buffer.alloc(0), tail: Buffer.alloc(0), t0: Date.now() };
        recs.push(rec);
        const up = http.request({ host: t.hostname, port: t.port, method: req.method, path: req.url, headers: req.headers, agent: false, lookup }, (ur) => {
            rec.status = ur.statusCode;
            rec.resHeaders = ur.headers;
            res.writeHead(ur.statusCode, ur.headers);
            ur.pipe(res);
        });
        up.on('error', (e) => {
            rec.err = String(e);
            res.destroy();
        });
        req.on('data', (d) => {
            rec.bytes += d.length;
            if (rec.head.length < 400) rec.head = Buffer.concat([rec.head, d]).subarray(0, 400);
            rec.tail = Buffer.concat([rec.tail, d]).subarray(-400);
        });
        req.pipe(up);
    });
    return new Promise((resolve) =>
        server.listen(0, '127.0.0.1', () => {
            const url = `http://127.0.0.1:${server.address().port}`;
            resolve({ url, recs, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) });
        }),
    );
}

/** Short description of the body framing of a captured request, for log lines. */
export function wireSummary(rec) {
    const h = rec.headers;
    return JSON.stringify({
        sha256: h['x-amz-content-sha256'], enc: h['content-encoding'], trailer: h['x-amz-trailer'], te: h['transfer-encoding'],
        cl: h['content-length'], decoded: h['x-amz-decoded-content-length'], alg: h['x-amz-sdk-checksum-algorithm'], expect: h.expect,
    });
}

// ----------------------------------------------------------------------------------------------
// assertions

export class Skip extends Error {}
export const skip = (msg) => {
    throw new Skip(msg);
};

function show(v) {
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) return `<${v.length} bytes>`;
    if (typeof v === 'string') return JSON.stringify(v.length > 200 ? v.slice(0, 200) + '...' : v);
    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
}

export function ok(cond, msg) {
    if (!cond) throw new Error(msg ?? 'assertion failed');
}

export function eq(actual, expected, msg) {
    if (Object.is(actual, expected)) return;
    if (typeof actual === 'object' && typeof expected === 'object' && actual !== null && expected !== null && JSON.stringify(actual) === JSON.stringify(expected)) return;
    throw new Error(`${msg ?? 'values differ'}: expected ${show(expected)}, got ${show(actual)}`);
}

export function eqBuf(actual, expected, msg) {
    const a = Buffer.from(actual), e = Buffer.from(expected);
    if (a.length !== e.length) throw new Error(`${msg ?? 'bodies differ'}: length ${a.length}, expected ${e.length}`);
    if (!a.equals(e)) {
        let i = 0;
        while (a[i] === e[i]) i++;
        throw new Error(`${msg ?? 'bodies differ'}: first difference at offset ${i} (got ${a[i]}, expected ${e[i]}), length ${a.length}`);
    }
}

export function describeError(e) {
    if (e && e.$metadata) {
        const code = e.Code && e.Code !== e.name ? ` Code=${e.Code}` : '';
        return `${e.name} (HTTP ${e.$metadata.httpStatusCode}${code}): ${String(e.message).slice(0, 200)}`;
    }
    return e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e);
}

/** rejects(promiseOrFn, {name, status, code, message}) - the call must fail with an S3 error that matches. */
export async function rejects(p, expect = {}, msg) {
    let err;
    try {
        await (typeof p === 'function' ? p() : p);
    } catch (e) {
        err = e;
    }
    if (!err) throw new Error(`${msg ?? 'call'}: expected error ${show(expect)} but it succeeded`);
    const status = err.$metadata?.httpStatusCode;
    const bad = [];
    if (expect.name !== undefined) {
        const names = [].concat(expect.name);
        if (!names.includes(err.name) && !names.includes(err.Code)) bad.push(`name ${err.name}${err.Code ? '/' + err.Code : ''} (wanted ${names.join('|')})`);
    }
    if (expect.status !== undefined) {
        const sts = [].concat(expect.status);
        if (!sts.includes(status)) bad.push(`HTTP ${status} (wanted ${sts.join('|')})`);
    }
    if (expect.message !== undefined && !String(err.message).toLowerCase().includes(expect.message.toLowerCase())) bad.push(`message ${show(err.message)} lacks ${show(expect.message)}`);
    if (bad.length) {
        const e2 = new Error(`${msg ?? 'unexpected error'}: ${bad.join('; ')} -- got ${describeError(err)}`);
        e2.cause = err;
        throw e2;
    }
    return err;
}

// ----------------------------------------------------------------------------------------------
// data helpers

export const md5hex = (b) => crypto.createHash('md5').update(b).digest('hex');
export const sha256hex = (b) => crypto.createHash('sha256').update(b).digest('hex');
export const b64 = (b) => Buffer.from(b).toString('base64');
export const uid = () => crypto.randomBytes(5).toString('hex');

/** Deterministic pseudo-random bytes (fast xorshift): same (n, seed) -> same bytes. */
export function det(n, seed = 1) {
    const out = Buffer.allocUnsafe(n);
    let x = (seed * 2654435761) >>> 0 || 1;
    for (let i = 0; i < n; i++) {
        x ^= x << 13; x >>>= 0;
        x ^= x >>> 17;
        x ^= x << 5; x >>>= 0;
        out[i] = x & 0xff;
    }
    return out;
}

/** Bytes whose value reveals their offset: byte i == i % 251 (so any slice is easy to verify). */
export function ramp(n) {
    const out = Buffer.allocUnsafe(n);
    for (let i = 0; i < n; i++) out[i] = i % 251;
    return out;
}

export function multipartEtag(parts) {
    const h = crypto.createHash('md5');
    for (const p of parts) h.update(crypto.createHash('md5').update(p).digest());
    return `${h.digest('hex')}-${parts.length}`;
}

export const unq = (s) => (s ? s.replace(/^"|"$/g, '') : s);

/** S3 EncodingType=url decoding ('+' is a space, %XX escapes). */
export function decodeS3(s) {
    return decodeURIComponent(String(s).replace(/\+/g, ' '));
}

export async function bodyBytes(res) {
    return Buffer.from(await res.Body.transformToByteArray());
}

/** Run fns with at most `limit` in flight; returns results in order (errors are returned, not thrown). */
export async function pool(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (true) {
            const i = next++;
            if (i >= items.length) return;
            try {
                results[i] = await fn(items[i], i);
            } catch (e) {
                results[i] = e instanceof Error ? e : new Error(String(e));
                results[i].failed = true;
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ----------------------------------------------------------------------------------------------
// admin API (only used as a fallback; run.sh pre-creates what the suite needs from the host side)

export function adminUrl() {
    const u = new URL(ENV.admin_url);
    if (TOOL_HOST !== '127.0.0.1' && TOOL_HOST !== 'localhost') u.hostname = TOOL_HOST; // inside Docker
    return u.origin;
}

export async function admin(method, p, body) {
    const r = await httpReq(method, adminUrl() + '/_admin/v1' + p, {
        headers: { authorization: 'Bearer ' + ENV.admin_token, 'content-type': 'application/json' },
        body: body === undefined ? null : JSON.stringify(body),
    });
    let json = null;
    try {
        json = r.text ? JSON.parse(r.text) : null;
    } catch { /* not JSON */ }
    return { status: r.status, json };
}

// ----------------------------------------------------------------------------------------------
// odd keys (support/oddkeys.json, copied next to this file by run.sh)

export function loadOddKeys() {
    const f = ['oddkeys.json', '../../support/oddkeys.json'].map((p) => path.join(HERE, p)).find((p) => fs.existsSync(p));
    if (!f) throw new Error('oddkeys.json not found next to the suite');
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    const expand = (e) => (e.gen ? e.gen.char.repeat(e.gen.count) : e.key);
    return {
        keys: j.keys.map((e) => ({ id: e.id, note: e.note, key: expand(e) })),
        tooLong: expand({ gen: j.too_long }),
    };
}

// ----------------------------------------------------------------------------------------------
// mini test runner

const cases = [];

/** test('area/what', async (t) => {...}, {timeout}) - t.prefix is a key prefix unique to the case. */
export function test(id, fn, opts = {}) {
    cases.push({ id, fn, timeout: opts.timeout ?? 90000 });
}

function oneLine(s) {
    return String(s ?? '').replace(/[\t\r\n]+/g, ' ').slice(0, 600);
}

function emit(status, id, detail) {
    process.stdout.write(`@@RESULT\t${status}\t${id}\t${oneLine(detail)}\n`);
}

export function note(...a) {
    process.stdout.write('# ' + a.join(' ') + '\n');
}

export async function run() {
    const only = process.env.BV_JS_ONLY ? new RegExp(process.env.BV_JS_ONLY) : null;
    const dup = new Set();
    let n = 0;
    for (const c of cases) {
        if (only && !only.test(c.id)) continue;
        if (dup.has(c.id)) {
            emit('FAIL', c.id, 'duplicate case id in the suite');
            continue;
        }
        dup.add(c.id);
        const t = { id: c.id, prefix: `js/${c.id.replace(/[^a-z0-9]+/gi, '-')}-${uid()}/` };
        t.key = (name) => t.prefix + name;
        const t0 = Date.now();
        let timer;
        try {
            await Promise.race([
                c.fn(t),
                new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`case timed out after ${c.timeout} ms`)), c.timeout); }),
            ]);
            emit('PASS', c.id, '');
        } catch (e) {
            if (e instanceof Skip) emit('SKIP', c.id, e.message);
            else emit('FAIL', c.id, describeError(e));
        } finally {
            clearTimeout(timer);
        }
        n++;
        const ms = Date.now() - t0;
        if (ms > 15000) note(`slow case ${c.id}: ${ms} ms`);
    }
    note(`ran ${n} cases`);
}
