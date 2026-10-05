// Area a: addressing styles, regions, object round trips, ranges, conditionals, errors, tagging, copy, deletes.
import {
    PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, CopyObjectCommand,
    GetObjectTaggingCommand, PutObjectTaggingCommand, DeleteObjectTaggingCommand, ListObjectsV2Command, HeadBucketCommand,
} from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import {
    test, client, tap, B, DOMAIN, KiB, MiB, ok, eq, eqBuf, rejects, det, ramp, md5hex, sha256hex, unq, bodyBytes, pool, httpReq,
    TOOL_ENDPOINT, TOOL_PORT, xmlCode, note,
} from './harness.mjs';

const PB = B.plain.name;
const enc = (key) => key.split('/').map(encodeURIComponent).join('/'); // CopySource wants the key URL-encoded
const put = (c, key, body, extra = {}) => c.send(new PutObjectCommand({ Bucket: PB, Key: key, Body: body, ...extra }));
const get = (c, key, extra = {}) => c.send(new GetObjectCommand({ Bucket: PB, Key: key, ...extra }));
const head = (c, key, extra = {}) => c.send(new HeadObjectCommand({ Bucket: PB, Key: key, ...extra }));
const del = (c, key, extra = {}) => c.send(new DeleteObjectCommand({ Bucket: PB, Key: key, ...extra }));

// ---------------------------------------------------------------------------------------------
// addressing and regions

test('addr/path-style-roundtrip', async (t) => {
    const c = client('plain');
    const recs = tap(c);
    const data = det(5000, 3);
    await put(c, t.key('a b.bin'), data);
    eqBuf(await bodyBytes(await get(c, t.key('a b.bin'))), data);
    eq(recs[0].hostname, new URL(TOOL_ENDPOINT).hostname, 'path style keeps the endpoint host');
    ok(recs[0].path.startsWith('/' + PB + '/'), 'bucket is the first path segment, got ' + recs[0].path);
});

test('addr/virtual-hosted-roundtrip', async (t) => {
    const c = client('plain', { vhost: true });
    const recs = tap(c);
    const data = det(70000, 4);
    const key = t.key('vh object.bin');
    await put(c, key, data);
    eqBuf(await bodyBytes(await get(c, key)), data);
    eq(unq((await head(c, key)).ETag), md5hex(data));
    const l = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix }));
    eq((l.Contents || []).map((o) => o.Key), [key], 'listing in virtual-hosted style');
    await del(c, key);
    await rejects(head(c, key), { name: 'NotFound', status: 404 });
    eq(recs[0].hostname, `${PB}.${DOMAIN}`, 'the SDK must put the bucket in the host name');
    ok(!recs[0].path.includes(PB), 'bucket must not appear in the path: ' + recs[0].path);
});

test('addr/virtual-hosted-key-starting-with-underscore', async (t) => {
    // spec 2.4: in virtual-hosted style the whole path is the key, even '/_next/app.js' or '/_healthz'
    const c = client('plain', { vhost: true });
    for (const k of ['_next/app.js', '_healthz', '_peer/x']) {
        const data = Buffer.from('underscore ' + k);
        await put(c, k, data);
        eqBuf(await bodyBytes(await get(c, k)), data, 'GET ' + k);
        await del(c, k);
    }
});

test('addr/virtual-hosted-multipart-and-copy', async (t) => {
    const c = client('plain', { vhost: true });
    const { Upload } = await import('@aws-sdk/lib-storage');
    const data = det(11 * MiB, 5);
    const key = t.key('vh-mpu.bin');
    const out = await new Upload({ client: c, params: { Bucket: PB, Key: key, Body: data }, partSize: 5 * MiB, queueSize: 2 }).done();
    ok(/-3"?$/.test(out.ETag), 'multipart etag with 3 parts, got ' + out.ETag);
    await c.send(new CopyObjectCommand({ Bucket: PB, Key: t.key('vh-copy.bin'), CopySource: `${PB}/${enc(key)}` }));
    eqBuf(await bodyBytes(await get(c, t.key('vh-copy.bin'))), data);
});

for (const region of ['us-east-1', 'eu-west-1', 'auto']) {
    test(`addr/region-${region}`, async (t) => {
        // spec 4.5: any SigV4 region is accepted; apps configured for another region (or "auto") work unchanged
        const c = client('plain', { region });
        const data = det(3000, 6);
        await put(c, t.key('r.bin'), data);
        eqBuf(await bodyBytes(await get(c, t.key('r.bin'))), data);
        await c.send(new HeadBucketCommand({ Bucket: PB }));
    });
}

test('addr/reserved-service-paths', async () => {
    const base = TOOL_ENDPOINT;
    const h = await httpReq('GET', base + '/_healthz');
    eq(h.status, 200, 'GET /_healthz');
    const v = await httpReq('GET', base + '/_version');
    eq(v.status, 200, 'GET /_version');
    ok(v.text.includes('version'), '_version body: ' + v.text);
    for (const p of ['/_admin/v1/buckets', '/_metrics']) {
        const r = await httpReq('GET', base + p);
        eq(r.status, 404, `GET ${p} on the public listener must be 404 (spec 2.4)`);
    }
});

// ---------------------------------------------------------------------------------------------
// round trips

for (const [label, n] of [['0b', 0], ['1b', 1], ['64k-1', 65535], ['64k', 65536], ['64k+1', 65537], ['1m', MiB], ['8m', 8 * MiB]]) {
    test(`objects/roundtrip-${label}`, async (t) => {
        const c = client('plain');
        const data = det(n, n + 11);
        const key = t.key('o.bin');
        const p = await put(c, key, data);
        eq(unq(p.ETag), md5hex(data), 'PutObject ETag is the MD5');
        eq(p.$metadata.httpStatusCode, 200);
        const g = await get(c, key);
        eq(g.ContentLength, n, 'GetObject ContentLength');
        eq(unq(g.ETag), md5hex(data), 'GetObject ETag');
        eqBuf(await bodyBytes(g), data, 'GetObject body');
        const h = await head(c, key);
        eq(h.ContentLength, n, 'HeadObject ContentLength');
        ok(h.LastModified instanceof Date && !isNaN(h.LastModified), 'LastModified');
        const d = await del(c, key);
        eq(d.$metadata.httpStatusCode, 204, 'DeleteObject status');
        await rejects(head(c, key), { name: 'NotFound', status: 404 });
    });
}

test('objects/body-consumption-modes', async (t) => {
    const c = client('plain');
    const data = Buffer.from('line one\nline two\n'.repeat(20000)); // ~360 KB of text
    const key = t.key('text.txt');
    await put(c, key, data, { ContentType: 'text/plain' });
    eqBuf(await bodyBytes(await get(c, key)), data, 'transformToByteArray');
    eq(await (await get(c, key)).Body.transformToString(), data.toString('utf8'), 'transformToString');
    const chunks = [];
    for await (const ch of (await get(c, key)).Body) chunks.push(ch);
    ok(chunks.length > 1, 'a 360 KB body should arrive in several chunks');
    eqBuf(Buffer.concat(chunks), data, 'async iteration');
    const hash = crypto.createHash('sha256');
    await new Promise((res, rej) => { (async () => (await get(c, key)).Body.on('error', rej).on('end', res).pipe(hash))(); });
    eq(hash.digest('hex'), sha256hex(data), 'piped through a hash');
    const web = (await get(c, key)).Body.transformToWebStream();
    let n = 0;
    for await (const ch of web) n += ch.length;
    eq(n, data.length, 'transformToWebStream byte count');
});

test('objects/metadata-and-content-headers', async (t) => {
    const c = client('plain');
    const key = t.key('hdr.txt');
    const expires = new Date('2031-01-02T03:04:05Z');
    await put(c, key, 'hello', {
        ContentType: 'text/plain; charset=utf-8', ContentEncoding: 'gzip', ContentLanguage: 'en-GB',
        ContentDisposition: 'attachment; filename="a b.txt"', CacheControl: 'max-age=60, public', Expires: expires,
        Metadata: { Foo: 'Bar', 'multi-word': 'a b c', 'Mixed-CASE': 'v1' },
    });
    for (const [what, r] of [['HEAD', await head(c, key)], ['GET', await get(c, key)]]) {
        eq(r.ContentType, 'text/plain; charset=utf-8', what + ' ContentType');
        eq(r.ContentEncoding, 'gzip', what + ' ContentEncoding (aws-chunked must never be stored, spec 5.8)');
        eq(r.ContentLanguage, 'en-GB', what + ' ContentLanguage');
        eq(r.ContentDisposition, 'attachment; filename="a b.txt"', what + ' ContentDisposition');
        eq(r.CacheControl, 'max-age=60, public', what + ' CacheControl');
        eq(r.Expires?.toISOString(), expires.toISOString(), what + ' Expires');
        eq(Object.entries(r.Metadata).sort(), [['foo', 'Bar'], ['mixed-case', 'v1'], ['multi-word', 'a b c']], what + ' user metadata (names lower-cased, spec 3.3)');
    }
});

test('objects/default-content-type-is-binary-octet-stream', async (t) => {
    // the SDK always sends a Content-Type; strip it before signing to see the server's own default (spec 3.3)
    const c = client('plain');
    c.middlewareStack.add((next) => async (args) => {
        delete args.request.headers['content-type'];
        delete args.request.headers['Content-Type'];
        return next(args);
    }, { step: 'build', priority: 'low', name: 'noContentType' });
    const key = t.key('noct');
    await put(c, key, 'x');
    eq((await head(client('plain'), key)).ContentType, 'binary/octet-stream');
});

test('objects/overwrite-replaces', async (t) => {
    const c = client('plain');
    const key = t.key('ow.bin');
    await put(c, key, det(1000, 1), { ContentType: 'a/b', Metadata: { v: '1' } });
    const second = det(2500, 2);
    await put(c, key, second, { ContentType: 'c/d' });
    const g = await get(c, key);
    eqBuf(await bodyBytes(g), second);
    eq(g.ContentType, 'c/d');
    eq(g.Metadata, {}, 'metadata of the first version must not leak into the second');
});

test('objects/delete-is-idempotent-204', async (t) => {
    const c = client('plain');
    const r = await del(c, t.key('never-existed'));
    eq(r.$metadata.httpStatusCode, 204);
    await put(c, t.key('x'), 'x');
    eq((await del(c, t.key('x'))).$metadata.httpStatusCode, 204);
    eq((await del(c, t.key('x'))).$metadata.httpStatusCode, 204);
});

test('objects/storage-class', async (t) => {
    const c = client('plain');
    for (const sc of ['STANDARD', 'REDUCED_REDUNDANCY']) {
        const k = t.key(sc);
        await put(c, k, 'x', { StorageClass: sc });
        const h = await head(c, k);
        ok(h.StorageClass === undefined || h.StorageClass === 'STANDARD', `${sc} is stored and reported as STANDARD (or omitted), got ${h.StorageClass}`);
    }
    await rejects(put(c, t.key('glacier'), 'x', { StorageClass: 'GLACIER' }), { name: 'InvalidStorageClass', status: 400 });
});

test('objects/response-header-overrides', async (t) => {
    const c = client('plain');
    const key = t.key('ro.bin');
    await put(c, key, 'override me', { ContentType: 'application/x-orig' });
    const g = await get(c, key, {
        ResponseContentType: 'text/x-override', ResponseContentDisposition: 'inline; filename="o.txt"', ResponseCacheControl: 'no-store',
        ResponseContentEncoding: 'identity', ResponseContentLanguage: 'de', ResponseExpires: new Date('2032-05-06T07:08:09Z'),
    });
    eq(g.ContentType, 'text/x-override');
    eq(g.ContentDisposition, 'inline; filename="o.txt"');
    eq(g.CacheControl, 'no-store');
    eq(g.ContentLanguage, 'de');
    eq(g.ExpiresString ?? g.Expires?.toUTCString(), 'Thu, 06 May 2032 07:08:09 GMT');
    eq((await head(c, key)).ContentType, 'application/x-orig', 'stored type is untouched');
});

test('objects/metadata-too-large', async (t) => {
    const c = client('plain');
    await put(c, t.key('small-md'), 'x', { Metadata: { a: 'x'.repeat(900), b: 'y'.repeat(900) } }); // 1.8 KB: fine
    await rejects(put(c, t.key('big-md'), 'x', { Metadata: { a: 'x'.repeat(1500), b: 'y'.repeat(1500) } }), { name: 'MetadataTooLarge', status: 400 });
});

// ---------------------------------------------------------------------------------------------
// ranges

const RANGE_N = 1000;
const rangeCases = [
    ['first-bytes', 'bytes=0-9', 0, 9],
    ['middle', 'bytes=100-199', 100, 199],
    ['open-ended', 'bytes=990-', 990, 999],
    ['suffix', 'bytes=-5', 995, 999],
    ['suffix-larger-than-object', 'bytes=-5000', 0, 999],
    ['end-clamped', 'bytes=500-5000', 500, 999],
    ['single-byte', 'bytes=7-7', 7, 7],
    ['last-byte', 'bytes=999-999', 999, 999],
];
for (const [name, range, from, to] of rangeCases) {
    test(`ranges/${name}`, async (t) => {
        const c = client('plain');
        const key = t.key('r.bin');
        const data = ramp(RANGE_N);
        await put(c, key, data);
        const g = await get(c, key, { Range: range });
        eq(g.$metadata.httpStatusCode, 206, 'status');
        eq(g.ContentRange, `bytes ${from}-${to}/${RANGE_N}`, 'Content-Range');
        eq(g.ContentLength, to - from + 1, 'Content-Length');
        eqBuf(await bodyBytes(g), data.subarray(from, to + 1), 'body');
        eq(g.AcceptRanges, 'bytes');
    });
}

test('ranges/unsatisfiable-416', async (t) => {
    const c = client('plain');
    await put(c, t.key('r'), ramp(10));
    await rejects(get(c, t.key('r'), { Range: 'bytes=100-' }), { name: 'InvalidRange', status: 416 });
    await rejects(get(c, t.key('r'), { Range: 'bytes=10-20' }), { name: 'InvalidRange', status: 416 });
});

test('ranges/empty-object-416', async (t) => {
    const c = client('plain');
    await put(c, t.key('e'), '');
    await rejects(get(c, t.key('e'), { Range: 'bytes=0-0' }), { name: 'InvalidRange', status: 416 });
});

test('ranges/multiple-ranges-ignored-full-body', async (t) => {
    // spec 5.4.2: multiple ranges are ignored and the full object comes back with 200, as S3 does
    const c = client('plain');
    const data = ramp(300);
    await put(c, t.key('m'), data);
    const g = await get(c, t.key('m'), { Range: 'bytes=0-1,5-6' });
    eq(g.$metadata.httpStatusCode, 200);
    eqBuf(await bodyBytes(g), data);
});

test('ranges/malformed-header-ignored', async (t) => {
    const c = client('plain');
    const data = ramp(100);
    await put(c, t.key('m'), data);
    const g = await get(c, t.key('m'), { Range: 'bytes=abc' });
    eq(g.$metadata.httpStatusCode, 200, 'a malformed Range header is ignored (RFC 9110)');
    eqBuf(await bodyBytes(g), data);
});

test('ranges/head-with-range', async (t) => {
    const c = client('plain');
    await put(c, t.key('h'), ramp(500));
    const h = await head(c, t.key('h'), { Range: 'bytes=10-19' });
    eq(h.$metadata.httpStatusCode, 206);
    eq(h.ContentLength, 10);
    eq(h.ContentRange, 'bytes 10-19/500');
});

test('ranges/checksum-validation-on-partial-content', async (t) => {
    // the SDK asks for ChecksumMode ENABLED by default and validates what comes back; a ranged answer must not
    // carry a whole-object checksum that the SDK would then compare against the partial body
    const c = client('plain');
    const recs = tap(c);
    await put(c, t.key('r'), det(100000, 9), { ChecksumAlgorithm: 'SHA256' });
    const g = await get(c, t.key('r'), { Range: 'bytes=1000-1999' });
    eq(g.ContentLength, 1000);
    await bodyBytes(g);
    const h = recs.at(-1).resHeaders || {};
    note('206 response checksum headers:', JSON.stringify(Object.keys(h).filter((k) => k.startsWith('x-amz-checksum'))));
});

// ---------------------------------------------------------------------------------------------
// conditional requests

test('conditional/get-if-match', async (t) => {
    const c = client('plain');
    const p = await put(c, t.key('c'), 'cond');
    eq((await get(c, t.key('c'), { IfMatch: p.ETag })).$metadata.httpStatusCode, 200);
    await rejects(get(c, t.key('c'), { IfMatch: '"00000000000000000000000000000000"' }), { name: 'PreconditionFailed', status: 412 });
});

test('conditional/get-if-none-match-304', async (t) => {
    const c = client('plain');
    const p = await put(c, t.key('c'), 'cond');
    await rejects(get(c, t.key('c'), { IfNoneMatch: p.ETag }), { status: 304 });      // (the SDK has no modelled name for 304: it says "Unknown")
    eq((await get(c, t.key('c'), { IfNoneMatch: '"00000000000000000000000000000000"' })).$metadata.httpStatusCode, 200);
});

test('conditional/head-if-none-match-304', async (t) => {
    const c = client('plain');
    const p = await put(c, t.key('c'), 'cond');
    await rejects(head(c, t.key('c'), { IfNoneMatch: p.ETag }), { status: 304 });
});

test('conditional/modified-since', async (t) => {
    const c = client('plain');
    await put(c, t.key('c'), 'cond');
    await rejects(get(c, t.key('c'), { IfModifiedSince: new Date(Date.now() + 3600e3) }), { status: 304 });
    eq((await get(c, t.key('c'), { IfModifiedSince: new Date(Date.now() - 3600e3) })).$metadata.httpStatusCode, 200);
});

test('conditional/unmodified-since', async (t) => {
    const c = client('plain');
    await put(c, t.key('c'), 'cond');
    await rejects(get(c, t.key('c'), { IfUnmodifiedSince: new Date(Date.now() - 3600e3) }), { name: 'PreconditionFailed', status: 412 });
    eq((await get(c, t.key('c'), { IfUnmodifiedSince: new Date(Date.now() + 3600e3) })).$metadata.httpStatusCode, 200);
});

test('conditional/put-if-none-match-star-create-only', async (t) => {
    const c = client('plain');
    const k = t.key('once');
    eq((await put(c, k, 'first', { IfNoneMatch: '*' })).$metadata.httpStatusCode, 200);
    await rejects(put(c, k, 'second', { IfNoneMatch: '*' }), { name: 'PreconditionFailed', status: 412 });
    eq(await (await get(c, k)).Body.transformToString(), 'first', 'the losing write must not have replaced the object');
});

test('conditional/put-if-match-compare-and-swap', async (t) => {
    const c = client('plain');
    const k = t.key('cas');
    const p1 = await put(c, k, 'v1');
    const p2 = await put(c, k, 'v2', { IfMatch: p1.ETag });
    eq(p2.$metadata.httpStatusCode, 200);
    await rejects(put(c, k, 'v3', { IfMatch: p1.ETag }), { name: 'PreconditionFailed', status: 412 }, 'stale ETag');
    eq(await (await get(c, k)).Body.transformToString(), 'v2');
});

test('conditional/put-if-none-match-star-race', async (t) => {
    const c = client('plain');
    const k = t.key('race');
    const res = await pool(Array.from({ length: 16 }, (_, i) => i), 16, (i) => put(c, k, 'writer-' + i, { IfNoneMatch: '*' }));
    const wins = res.filter((r) => !r.failed);
    const lost = res.filter((r) => r.failed);
    eq(wins.length, 1, 'exactly one If-None-Match:* writer may win (spec 5.5), errors: ' + lost.map((e) => e.name + '/' + e.$metadata?.httpStatusCode).join(','));
    ok(lost.every((e) => e.$metadata?.httpStatusCode === 412), 'losers must get 412: ' + lost.map((e) => e.name + '/' + e.$metadata?.httpStatusCode));
});

test('conditional/copy-source-if-match-and-none-match', async (t) => {
    const c = client('plain');
    const p = await put(c, t.key('src'), 'source');
    const base = { Bucket: PB, CopySource: `${PB}/${enc(t.key('src'))}` };
    await c.send(new CopyObjectCommand({ ...base, Key: t.key('d1'), CopySourceIfMatch: p.ETag }));
    await rejects(c.send(new CopyObjectCommand({ ...base, Key: t.key('d2'), CopySourceIfMatch: '"00000000000000000000000000000000"' })), { name: 'PreconditionFailed', status: 412 });
    await rejects(c.send(new CopyObjectCommand({ ...base, Key: t.key('d3'), CopySourceIfNoneMatch: p.ETag })), { name: 'PreconditionFailed', status: 412 });
    await rejects(head(c, t.key('d2')), { name: 'NotFound' });
});

// ---------------------------------------------------------------------------------------------
// error shapes

test('errors/nosuchkey-shape', async (t) => {
    const c = client('plain');
    const e = await rejects(get(c, t.key('missing')), { name: 'NoSuchKey', status: 404 });
    eq(e.Code, 'NoSuchKey');
    ok(e.$metadata.requestId && e.$metadata.requestId.length >= 10, 'x-amz-request-id must reach the SDK');
    ok(/does not exist/i.test(e.message), 'message: ' + e.message);
});

test('errors/head-missing-is-notfound', async (t) => {
    await rejects(head(client('plain'), t.key('missing')), { name: 'NotFound', status: 404 });
});

test('errors/nosuchbucket', async (t) => {
    const c = client('plain');
    await rejects(c.send(new GetObjectCommand({ Bucket: 'bvt-sdkjs-no-such-bucket', Key: 'k' })), { name: 'NoSuchBucket', status: 404 });
});

test('errors/other-buckets-token-is-accessdenied', async (t) => {
    // a bucket token authorises exactly one bucket (spec 4.3)
    const c = client('plain');
    await rejects(c.send(new GetObjectCommand({ Bucket: B.versioned.name, Key: 'k' })), { name: 'AccessDenied', status: 403 });
    await rejects(c.send(new PutObjectCommand({ Bucket: B.public.name, Key: 'k', Body: 'x' })), { name: 'AccessDenied', status: 403 });
    await rejects(c.send(new HeadObjectCommand({ Bucket: B.versioned.name, Key: 'k' })), { status: 403 });       // (HEAD has no body: the SDK names it "Unknown")
});

test('errors/wrong-secret-signature-mismatch', async (t) => {
    const c = client({ name: PB, access_key: B.plain.access_key, secret_key: 'x'.repeat(40) });
    await rejects(get(c, t.key('k')), { name: 'SignatureDoesNotMatch', status: 403 });
});

test('errors/unknown-access-key', async (t) => {
    const c = client({ name: PB, access_key: 'BVKAAAAAAAAAAAAAAAAA', secret_key: 'x'.repeat(40) });
    await rejects(get(c, t.key('k')), { name: 'InvalidAccessKeyId', status: 403 });
});

test('errors/key-too-long', async (t) => {
    const c = client('plain');
    await put(c, 'k'.repeat(1024), 'ok'); // exactly 1024 bytes is legal
    await del(c, 'k'.repeat(1024));
    await rejects(put(c, 'k'.repeat(1025), 'no'), { name: 'KeyTooLongError', status: 400 });
});

// ---------------------------------------------------------------------------------------------
// tagging

const tagMap = (r) => Object.fromEntries((r.TagSet || []).map((x) => [x.Key, x.Value]));

test('tagging/put-header-then-get-head-count', async (t) => {
    const c = client('plain');
    const k = t.key('tagged');
    await put(c, k, 'x', { Tagging: 'a=1&b=two%20words&c=%C3%BC' });
    const g = await c.send(new GetObjectTaggingCommand({ Bucket: PB, Key: k }));
    eq(tagMap(g), { a: '1', b: 'two words', c: 'ü' });
    eq((await head(c, k)).TagCount, 3, 'x-amz-tagging-count on HEAD');
    eq((await get(c, k)).TagCount, 3, 'x-amz-tagging-count on GET');
});

test('tagging/put-replace-delete', async (t) => {
    const c = client('plain');
    const k = t.key('tags');
    await put(c, k, 'x');
    await c.send(new PutObjectTaggingCommand({ Bucket: PB, Key: k, Tagging: { TagSet: [{ Key: 'env', Value: 'prod' }, { Key: 'team', Value: 'a b' }] } }));
    eq(tagMap(await c.send(new GetObjectTaggingCommand({ Bucket: PB, Key: k }))), { env: 'prod', team: 'a b' });
    await c.send(new PutObjectTaggingCommand({ Bucket: PB, Key: k, Tagging: { TagSet: [{ Key: 'only', Value: '1' }] } }));
    eq(tagMap(await c.send(new GetObjectTaggingCommand({ Bucket: PB, Key: k }))), { only: '1' }, 'PutObjectTagging replaces the whole set');
    const d = await c.send(new DeleteObjectTaggingCommand({ Bucket: PB, Key: k }));
    eq(d.$metadata.httpStatusCode, 204);
    eq(tagMap(await c.send(new GetObjectTaggingCommand({ Bucket: PB, Key: k }))), {});
    eq((await head(c, k)).TagCount, undefined, 'no tags -> no x-amz-tagging-count');
});

test('tagging/limits-and-validation', async (t) => {
    const c = client('plain');
    const k = t.key('lim');
    await put(c, k, 'x');
    const ten = Array.from({ length: 10 }, (_, i) => ({ Key: 'k' + i, Value: 'v' }));
    await c.send(new PutObjectTaggingCommand({ Bucket: PB, Key: k, Tagging: { TagSet: ten } }));
    await rejects(c.send(new PutObjectTaggingCommand({ Bucket: PB, Key: k, Tagging: { TagSet: [...ten, { Key: 'k10', Value: 'v' }] } })), { name: 'InvalidTag', status: 400 }, '11 tags');
    await rejects(c.send(new PutObjectTaggingCommand({ Bucket: PB, Key: k, Tagging: { TagSet: [{ Key: 'k'.repeat(129), Value: 'v' }] } })), { name: 'InvalidTag', status: 400 }, 'key of 129 chars');
    await rejects(c.send(new PutObjectTaggingCommand({ Bucket: PB, Key: k, Tagging: { TagSet: [{ Key: 'k', Value: 'v'.repeat(257) }] } })), { name: 'InvalidTag', status: 400 }, 'value of 257 chars');
    await c.send(new PutObjectTaggingCommand({ Bucket: PB, Key: k, Tagging: { TagSet: [{ Key: 'k'.repeat(128), Value: 'v'.repeat(256) }] } }));
    await rejects(put(c, t.key('too-many'), 'x', { Tagging: Array.from({ length: 11 }, (_, i) => `k${i}=v`).join('&') }), { name: 'InvalidTag', status: 400 }, '11 tags in the PutObject header');
});

test('tagging/does-not-change-etag-or-last-modified', async (t) => {
    const c = client('plain');
    const k = t.key('stable');
    await put(c, k, 'x');
    const before = await head(c, k);
    await new Promise((r) => setTimeout(r, 1100));
    await c.send(new PutObjectTaggingCommand({ Bucket: PB, Key: k, Tagging: { TagSet: [{ Key: 'a', Value: 'b' }] } }));
    const after = await head(c, k);
    eq(after.ETag, before.ETag, 'ETag');
    eq(after.LastModified.getTime(), before.LastModified.getTime(), 'Last-Modified (spec 5.7)');
});

test('tagging/missing-key', async (t) => {
    const c = client('plain');
    await rejects(c.send(new GetObjectTaggingCommand({ Bucket: PB, Key: t.key('nope') })), { name: 'NoSuchKey', status: 404 });
    await rejects(c.send(new PutObjectTaggingCommand({ Bucket: PB, Key: t.key('nope'), Tagging: { TagSet: [] } })), { name: 'NoSuchKey', status: 404 });
});

// ---------------------------------------------------------------------------------------------
// copy

test('copy/basic-and-independence', async (t) => {
    const c = client('plain');
    const data = det(300000, 21);
    await put(c, t.key('src'), data, { ContentType: 'application/x-src', Metadata: { m: '1' } });
    const r = await c.send(new CopyObjectCommand({ Bucket: PB, Key: t.key('dst'), CopySource: `${PB}/${enc(t.key('src'))}` }));
    eq(unq(r.CopyObjectResult.ETag), md5hex(data), 'CopyObjectResult.ETag');
    ok(r.CopyObjectResult.LastModified instanceof Date, 'CopyObjectResult.LastModified');
    const g = await get(c, t.key('dst'));
    eqBuf(await bodyBytes(g), data);
    eq(g.ContentType, 'application/x-src', 'default metadata directive COPY keeps the content type');
    eq(g.Metadata, { m: '1' }, 'and the user metadata');
    await del(c, t.key('src'));
    eqBuf(await bodyBytes(await get(c, t.key('dst'))), data, 'destination survives deleting the source');
});

test('copy/metadata-directive-replace', async (t) => {
    const c = client('plain');
    await put(c, t.key('src'), 'body', { ContentType: 'a/a', Metadata: { old: '1' }, CacheControl: 'max-age=1' });
    await c.send(new CopyObjectCommand({ Bucket: PB, Key: t.key('dst'), CopySource: `${PB}/${enc(t.key('src'))}`, MetadataDirective: 'REPLACE', ContentType: 'b/b', Metadata: { fresh: '2' } }));
    const g = await head(c, t.key('dst'));
    eq(g.ContentType, 'b/b');
    eq(g.Metadata, { fresh: '2' });
    eq(g.CacheControl, undefined, 'REPLACE drops headers that were not re-sent');
});

test('copy/tagging-directive', async (t) => {
    const c = client('plain');
    await put(c, t.key('src'), 'body', { Tagging: 'a=1' });
    const src = `${PB}/${enc(t.key('src'))}`;
    await c.send(new CopyObjectCommand({ Bucket: PB, Key: t.key('copied'), CopySource: src }));
    eq(tagMap(await c.send(new GetObjectTaggingCommand({ Bucket: PB, Key: t.key('copied') }))), { a: '1' }, 'TaggingDirective COPY (default)');
    await c.send(new CopyObjectCommand({ Bucket: PB, Key: t.key('replaced'), CopySource: src, TaggingDirective: 'REPLACE', Tagging: 'b=2&c=3' }));
    eq(tagMap(await c.send(new GetObjectTaggingCommand({ Bucket: PB, Key: t.key('replaced') }))), { b: '2', c: '3' }, 'TaggingDirective REPLACE');
});

test('copy/self-copy-unchanged-is-invalid-request', async (t) => {
    const c = client('plain');
    await put(c, t.key('s'), 'x');
    await rejects(c.send(new CopyObjectCommand({ Bucket: PB, Key: t.key('s'), CopySource: `${PB}/${enc(t.key('s'))}` })), { name: 'InvalidRequest', status: 400 });
});

test('copy/self-copy-with-replaced-metadata-is-ok', async (t) => {
    const c = client('plain');
    await put(c, t.key('s'), 'x', { Metadata: { a: '1' } });
    await c.send(new CopyObjectCommand({ Bucket: PB, Key: t.key('s'), CopySource: `${PB}/${enc(t.key('s'))}`, MetadataDirective: 'REPLACE', Metadata: { a: '2' } }));
    eq((await head(c, t.key('s'))).Metadata, { a: '2' });
});

test('copy/source-key-needing-url-encoding', async (t) => {
    const c = client('plain');
    const src = t.key('dir with space/ü+%25 &=.txt');
    const data = det(1234, 8);
    await put(c, src, data);
    await c.send(new CopyObjectCommand({ Bucket: PB, Key: t.key('copy-of-odd'), CopySource: `${PB}/${enc(src)}` }));
    eqBuf(await bodyBytes(await get(c, t.key('copy-of-odd'))), data);
    await c.send(new CopyObjectCommand({ Bucket: PB, Key: t.key('copy-of-odd-2'), CopySource: `/${PB}/${enc(src)}` }));
    eqBuf(await bodyBytes(await get(c, t.key('copy-of-odd-2'))), data, 'leading slash in x-amz-copy-source');
});

test('copy/other-bucket-is-accessdenied', async (t) => {
    const c = client('plain');
    await rejects(c.send(new CopyObjectCommand({ Bucket: PB, Key: t.key('d'), CopySource: `${B.versioned.name}/whatever` })), { name: 'AccessDenied', status: 403 });
});

test('copy/missing-source', async (t) => {
    const c = client('plain');
    await rejects(c.send(new CopyObjectCommand({ Bucket: PB, Key: t.key('d'), CopySource: `${PB}/${enc(t.key('nope'))}` })), { name: 'NoSuchKey', status: 404 });
});

test('copy/large-8m', async (t) => {
    const c = client('plain');
    const data = det(8 * MiB, 33);
    await put(c, t.key('big'), data);
    await c.send(new CopyObjectCommand({ Bucket: PB, Key: t.key('big2'), CopySource: `${PB}/${enc(t.key('big'))}` }));
    eqBuf(await bodyBytes(await get(c, t.key('big2'))), data);
});

// ---------------------------------------------------------------------------------------------
// DeleteObjects

test('delete/objects-reports-every-key', async (t) => {
    const c = client('plain');
    for (const k of ['a', 'b']) await put(c, t.key(k), k);
    const r = await c.send(new DeleteObjectsCommand({ Bucket: PB, Delete: { Objects: [t.key('a'), t.key('b'), t.key('never-existed')].map((Key) => ({ Key })) } }));
    eq(r.$metadata.httpStatusCode, 200);
    eq((r.Deleted || []).map((d) => d.Key).sort(), [t.key('a'), t.key('b'), t.key('never-existed')].sort(), 'S3 reports a missing key as Deleted too');
    eq(r.Errors, undefined);
    await rejects(head(c, t.key('a')), { name: 'NotFound' });
});

test('delete/objects-quiet', async (t) => {
    const c = client('plain');
    for (const k of ['a', 'b', 'c']) await put(c, t.key(k), k);
    const r = await c.send(new DeleteObjectsCommand({ Bucket: PB, Delete: { Quiet: true, Objects: ['a', 'b', 'c'].map((k) => ({ Key: t.key(k) })) } }));
    eq(r.Deleted, undefined, 'Quiet mode: no <Deleted> entries');
    eq(r.Errors, undefined);
    const l = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix }));
    eq(l.KeyCount, 0);
});

test('delete/objects-special-keys-and-duplicates', async (t) => {
    const c = client('plain');
    const keys = [t.key('sp ace'), t.key('ü/ö+&=<>'), t.key('quote"\'s')];
    for (const k of keys) await put(c, k, 'x');
    const r = await c.send(new DeleteObjectsCommand({ Bucket: PB, Delete: { Objects: [...keys, keys[0]].map((Key) => ({ Key })) } }));
    ok(keys.every((k) => (r.Deleted || []).some((d) => d.Key === k)), 'every key (XML-escaped on the wire) is reported back verbatim: ' + JSON.stringify(r.Deleted));
    eq(r.Errors, undefined);
    eq((await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix }))).KeyCount, 0);
});

test('delete/objects-1100-keys-in-two-batches', async (t) => {
    const c = client('plain', { maxAttempts: 3 });
    const keys = Array.from({ length: 1100 }, (_, i) => t.key(`k${String(i).padStart(4, '0')}`));
    const res = await pool(keys, 32, (k) => put(c, k, 'x'));
    const bad = res.filter((r) => r.failed);
    ok(bad.length === 0, `${bad.length} of 1100 puts failed, first: ${bad[0]?.name} ${bad[0]?.message}`);
    let deleted = 0;
    for (let i = 0; i < keys.length; i += 1000) {
        const r = await c.send(new DeleteObjectsCommand({ Bucket: PB, Delete: { Quiet: false, Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) } }));
        eq(r.Errors, undefined, 'batch errors');
        deleted += (r.Deleted || []).length;
    }
    eq(deleted, 1100, 'Deleted entries across both batches');
    eq((await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix }))).KeyCount, 0, 'nothing left');
}, { timeout: 120000 });

test('delete/objects-more-than-1000-in-one-request', async (t) => {
    // spec 3.8 / 5.4.4: at most 1000 keys per request; S3 answers MalformedXML for 1001
    const c = client('plain');
    const objs = Array.from({ length: 1001 }, (_, i) => ({ Key: t.key('absent' + i) }));
    await rejects(c.send(new DeleteObjectsCommand({ Bucket: PB, Delete: { Objects: objs } })), { name: 'MalformedXML', status: 400 });
});
