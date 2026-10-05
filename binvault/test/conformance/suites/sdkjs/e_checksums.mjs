// Area e: checksums as the current JS SDK sends and verifies them: headers, aws-chunked trailers (plain and TLS), multipart composites.
import {
    PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectsCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import tls from 'node:tls';
import net from 'node:net';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { test, client, tap, B, KiB, MiB, TOOL_HOST, TOOL_PORT, ok, eq, eqBuf, rejects, det, md5hex, unq, b64, bodyBytes, skip, httpReq, agent } from './harness.mjs';

const PB = B.plain.name;

// ---- reference checksum implementations --------------------------------------------------------
const T32C = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0x82f63b78 : c >>> 1;
        t[i] = c >>> 0;
    }
    return t;
})();
const crc32c = (b) => {
    let c = 0xffffffff;
    for (const x of b) c = T32C[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};
const T64 = (() => {
    const t = new Array(256);
    for (let i = 0; i < 256; i++) {
        let c = BigInt(i);
        for (let k = 0; k < 8; k++) c = c & 1n ? (c >> 1n) ^ 0x9a6c9329ac4bc9b5n : c >> 1n;
        t[i] = c;
    }
    return t;
})();
const crc64nvme = (b) => {
    let c = 0xffffffffffffffffn;
    for (const x of b) c = T64[Number((c ^ BigInt(x)) & 0xffn)] ^ (c >> 8n);
    return c ^ 0xffffffffffffffffn;
};
const be32 = (n) => { const o = Buffer.alloc(4); o.writeUInt32BE(n >>> 0); return o; };
const be64 = (n) => { const o = Buffer.alloc(8); o.writeBigUInt64BE(n); return o; };
const RAW = {
    CRC32: (b) => be32(zlib.crc32(b)),
    CRC32C: (b) => be32(crc32c(b)),
    CRC64NVME: (b) => be64(crc64nvme(b)),
    SHA1: (b) => crypto.createHash('sha1').update(b).digest(),
    SHA256: (b) => crypto.createHash('sha256').update(b).digest(),
};
const ck = (alg, b) => b64(RAW[alg](b));
const composite = (alg, parts) => b64(RAW[alg](Buffer.concat(parts.map((p) => RAW[alg](p))))) + '-' + parts.length;
const FIELD = (alg) => 'Checksum' + alg;
const ALGS = Object.keys(RAW);

// the SDK may lack an optional implementation (CRC32C, CRC64NVME) in this install: that is not binvault's business
function sdkMissing(e) {
    return /crc32c|crc64|crt|Cannot find (module|package)|not installed|unsupported checksum/i.test(String(e?.message)) && !e?.$metadata;
}
async function sdk(fn) {
    try {
        return await fn();
    } catch (e) {
        if (sdkMissing(e)) skip('this SDK install cannot compute the checksum: ' + String(e.message).slice(0, 150));
        throw e;
    }
}
const streamOf = (buf, chunk = 64 * KiB) => Readable.from((function* () { for (let i = 0; i < buf.length; i += chunk) yield buf.subarray(i, i + chunk); if (!buf.length) yield Buffer.alloc(0); })());

// ---- headers (buffer bodies) -------------------------------------------------------------------
test('checksum/default-put-sends-and-keeps-crc32', async (t) => {
    const c = client('plain');
    const recs = tap(c);
    const data = det(100 * KiB, 101);
    await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('d'), Body: data }));
    eq(recs[0].headers['x-amz-checksum-crc32'], ck('CRC32', data), 'the SDK puts the CRC32 in a header for a buffer body');
    const h = await c.send(new HeadObjectCommand({ Bucket: PB, Key: t.key('d'), ChecksumMode: 'ENABLED' }));
    eq(h.ChecksumCRC32, ck('CRC32', data));
});

for (const alg of ALGS) {
    test(`checksum/buffer-body-${alg}`, async (t) => {
        const c = client('plain');
        const data = det(200 * KiB + 3, 102);
        const out = await sdk(() => c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('b'), Body: data, ChecksumAlgorithm: alg })));
        eq(out[FIELD(alg)], ck(alg, data), 'the response echoes the stored checksum');
        const g = await c.send(new GetObjectCommand({ Bucket: PB, Key: t.key('b'), ChecksumMode: 'ENABLED' }));
        eq(g[FIELD(alg)], ck(alg, data));
        eqBuf(await bodyBytes(g), data);
    });
}

for (const alg of ALGS) {
    test(`checksum/streaming-body-${alg}`, async (t) => {
        // a Readable body is sent as aws-chunked with a trailing checksum, even over plain http in the JS SDK
        const c = client('plain');
        const recs = tap(c);
        const data = det(300 * KiB + 7, 103);
        const out = await sdk(() => c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('s'), Body: streamOf(data), ContentLength: data.length, ChecksumAlgorithm: alg })));
        eq(unq(out.ETag), md5hex(data), 'ETag');
        const hd = recs[0].headers;
        note_wire(t, hd);
        const g = await c.send(new GetObjectCommand({ Bucket: PB, Key: t.key('s'), ChecksumMode: 'ENABLED' }));
        eq(g[FIELD(alg)], ck(alg, data), 'stored checksum (header or trailer form)');
        eqBuf(await bodyBytes(g), data);
        ok(!/aws-chunked/.test(g.ContentEncoding || ''), 'aws-chunked must not be stored as Content-Encoding');
    });
}
function note_wire(t, h) {
    t.wire = JSON.stringify({ sha: h['x-amz-content-sha256'], enc: h['content-encoding'], trailer: h['x-amz-trailer'], decoded: h['x-amz-decoded-content-length'] });
}

for (const size of [0, 1, 1000, 64 * KiB, 64 * KiB + 1, 3 * MiB]) {
    test(`checksum/streaming-body-sizes-${size}`, async (t) => {
        const c = client('plain');
        const data = det(size, 104 + size);
        const out = await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('z'), Body: streamOf(data), ContentLength: size }));
        eq(unq(out.ETag), md5hex(data));
        const g = await c.send(new GetObjectCommand({ Bucket: PB, Key: t.key('z'), ChecksumMode: 'ENABLED' }));
        eq(g.ChecksumCRC32, ck('CRC32', data));
        eqBuf(await bodyBytes(g), data);
    });
}

test('checksum/trailer-framing-on-the-wire', async (t) => {
    const c = client('plain');
    const recs = tap(c);
    const data = det(5000, 105);
    await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('w'), Body: streamOf(data), ContentLength: data.length }));
    const h = recs[0].headers;
    ok(h['x-amz-trailer'] || h['x-amz-checksum-crc32'], 'a checksum travels as a trailer or a header: ' + JSON.stringify(h));
    if (h['x-amz-trailer']) {
        eq(h['x-amz-content-sha256'], 'STREAMING-UNSIGNED-PAYLOAD-TRAILER');
        eq(h['x-amz-trailer'], 'x-amz-checksum-crc32');
        ok(/aws-chunked/.test(h['content-encoding'] || ''), 'Content-Encoding: aws-chunked');
        eq(h['x-amz-decoded-content-length'], String(data.length));
    }
});

test('checksum/wrong-checksum-is-baddigest-and-stores-nothing', async (t) => {
    const c = client('plain');
    const data = det(1000, 106);
    await rejects(c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('bad'), Body: data, ChecksumSHA256: ck('SHA256', Buffer.from('other')) })), { name: 'BadDigest', status: 400 });
    await rejects(c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('bad'), Body: data, ChecksumCRC32: ck('CRC32', Buffer.from('other')) })), { name: 'BadDigest', status: 400 });
    await rejects(c.send(new HeadObjectCommand({ Bucket: PB, Key: t.key('bad') })), { status: 404 });
});

test('checksum/when-required-sends-none', async (t) => {
    const c = client('plain', { config: { requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' } });
    const recs = tap(c);
    await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('r'), Body: Buffer.from('no checksum') }));
    ok(!Object.keys(recs[0].headers).some((h) => /^x-amz-(checksum|sdk-checksum|trailer)/.test(h)), 'headers: ' + Object.keys(recs[0].headers).join(','));
    const h = await c.send(new HeadObjectCommand({ Bucket: PB, Key: t.key('r'), ChecksumMode: 'ENABLED' }));
    ok(!h.ChecksumCRC32 && !h.ChecksumSHA256, 'nothing stored');
});

test('checksum/response-validation-passes-for-single-and-multipart-objects', async (t) => {
    const c = client('plain');
    const data = det(11 * MiB, 107);
    await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('single'), Body: data.subarray(0, MiB) }));
    eq((await bodyBytes(await c.send(new GetObjectCommand({ Bucket: PB, Key: t.key('single') })))).length, MiB);
    await new Upload({ client: c, params: { Bucket: PB, Key: t.key('multi'), Body: data }, partSize: 5 * MiB }).done();
    eqBuf(await bodyBytes(await c.send(new GetObjectCommand({ Bucket: PB, Key: t.key('multi') }))), data);
});

test('checksum/delete-objects-carries-its-own-checksum', async (t) => {
    const c = client('plain');
    const recs = tap(c);
    await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('x'), Body: 'x' }));
    const r = await c.send(new DeleteObjectsCommand({ Bucket: PB, Delete: { Objects: [{ Key: t.key('x') }] } }));
    eq(r.Deleted.length, 1);
    const h = recs[recs.length - 1].headers;
    ok(h['x-amz-checksum-crc32'] || h['content-md5'], 'DeleteObjects needs an integrity header: ' + Object.keys(h).join(','));
});

test('checksum/content-md5-is-verified', async (t) => {
    const c = client('plain');
    const data = det(500, 108);
    const md5 = crypto.createHash('md5').update(data).digest('base64');
    await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('md5'), Body: data, ContentMD5: md5 }));
    await rejects(c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('md5bad'), Body: data, ContentMD5: crypto.createHash('md5').update('x').digest('base64') })), { name: 'BadDigest', status: 400 });
});

// ---- multipart ---------------------------------------------------------------------------------
for (const alg of ALGS) {
    test(`checksum/multipart-upload-${alg}`, async (t) => {
        const c = client('plain');
        const data = det(11 * MiB + 9, 109);
        await sdk(() => new Upload({ client: c, params: { Bucket: PB, Key: t.key('m'), Body: data, ChecksumAlgorithm: alg }, partSize: 5 * MiB, queueSize: 2 }).done());
        const h = await c.send(new HeadObjectCommand({ Bucket: PB, Key: t.key('m'), ChecksumMode: 'ENABLED' }));
        const parts = [data.subarray(0, 5 * MiB), data.subarray(5 * MiB, 10 * MiB), data.subarray(10 * MiB)];
        eq(h[FIELD(alg)], alg === 'CRC64NVME' ? ck(alg, data) : composite(alg, parts), alg === 'CRC64NVME' ? 'full-object checksum' : 'composite checksum');
    });
}

test('checksum/multipart-low-level-wrong-part-checksum', async (t) => {
    const c = client('plain');
    const { UploadId } = await c.send(new CreateMultipartUploadCommand({ Bucket: PB, Key: t.key('lp'), ChecksumAlgorithm: 'CRC32' }));
    await rejects(c.send(new UploadPartCommand({ Bucket: PB, Key: t.key('lp'), UploadId, PartNumber: 1, Body: det(1000, 110), ChecksumCRC32: ck('CRC32', Buffer.from('other')) })), { name: 'BadDigest', status: 400 });
    const good = det(5 * MiB, 111);
    const r = await c.send(new UploadPartCommand({ Bucket: PB, Key: t.key('lp'), UploadId, PartNumber: 1, Body: good, ChecksumAlgorithm: 'CRC32' }));
    eq(r.ChecksumCRC32, ck('CRC32', good));
    await rejects(c.send(new CompleteMultipartUploadCommand({ Bucket: PB, Key: t.key('lp'), UploadId, MultipartUpload: { Parts: [{ PartNumber: 1, ETag: r.ETag, ChecksumCRC32: ck('CRC32', Buffer.from('lie')) }] } })), { status: 400 });
});

// ---- TLS: the https path (needs openssl to make a certificate) ------------------------------------
function makeCert() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvjs-tls-'));
    const key = path.join(dir, 'k.pem'), cert = path.join(dir, 'c.pem');
    try {
        execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '2', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost'], { stdio: 'ignore' });
    } catch {
        return null;
    }
    return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}

async function withTls(fn) {
    const pem = makeCert();
    if (!pem) skip('openssl is not available to make a certificate');
    const server = tls.createServer({ ...pem, ALPNProtocols: ['http/1.1'] }, (s) => {
        const up = net.connect(TOOL_PORT, TOOL_HOST);
        s.pipe(up);
        up.pipe(s);
        s.on('error', () => up.destroy());
        up.on('error', () => s.destroy());
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const httpsAgent = new https.Agent({ ca: pem.cert, keepAlive: true });
    try {
        await fn({ endpoint: `https://127.0.0.1:${server.address().port}`, httpsAgent });
    } finally {
        httpsAgent.destroy();
        await new Promise((r) => server.close(r));
    }
}

test('checksum/tls-default-put-and-get', async (t) => {
    await withTls(async ({ endpoint, httpsAgent }) => {
        const c = client('plain', { endpoint, config: { requestHandler: { httpsAgent, requestTimeout: 60000 } } });
        const recs = tap(c);
        for (const size of [1, 70000, 3 * MiB]) {
            const data = det(size, 120 + size);
            const out = await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('t' + size), Body: streamOf(data), ContentLength: size }));
            eq(unq(out.ETag), md5hex(data), 'size ' + size);
            const g = await c.send(new GetObjectCommand({ Bucket: PB, Key: t.key('t' + size), ChecksumMode: 'ENABLED' }));
            eq(g.ChecksumCRC32, ck('CRC32', data));
            eqBuf(await bodyBytes(g), data);
        }
        ok(recs.some((r) => r.headers['x-amz-trailer']), 'at least one request used a trailing checksum');
    });
});

test('checksum/tls-multipart', async (t) => {
    await withTls(async ({ endpoint, httpsAgent }) => {
        const c = client('plain', { endpoint, config: { requestHandler: { httpsAgent, requestTimeout: 60000 } } });
        const data = det(11 * MiB, 130);
        await new Upload({ client: c, params: { Bucket: PB, Key: t.key('mp'), Body: streamOf(data, 1 * MiB) }, partSize: 5 * MiB, queueSize: 2 }).done();
        eqBuf(await bodyBytes(await c.send(new GetObjectCommand({ Bucket: PB, Key: t.key('mp') }))), data);
    });
});
