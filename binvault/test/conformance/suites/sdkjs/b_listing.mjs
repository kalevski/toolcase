// Area b: listing - V1/V2, paginators, delimiter, encoding-type, ordering, versions listing.
import {
    PutObjectCommand, ListObjectsCommand, ListObjectsV2Command, ListObjectVersionsCommand, DeleteObjectCommand, paginateListObjectsV2,
} from '@aws-sdk/client-s3';
import { test, client, tap, B, ok, eq, rejects, pool, decodeS3 } from './harness.mjs';

const PB = B.plain.name;
const VB = B.versioned.name;
const putMany = (c, bucket, keys, body = 'x') => pool(keys, 16, (k) => c.send(new PutObjectCommand({ Bucket: bucket, Key: k, Body: body }))).then((rs) => {
    const bad = rs.find((r) => r instanceof Error);
    if (bad) throw bad;
});
const bytewise = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const sorted = (keys) => [...keys].sort(bytewise);

async function allKeys(c, Bucket, extra = {}) {
    const out = [];
    for await (const page of paginateListObjectsV2({ client: c }, { Bucket, ...extra })) for (const o of page.Contents || []) out.push(o.Key);
    return out;
}

test('list/v2-paginator-walks-2351-keys', async (t) => {
    const c = client('plain');
    const keys = Array.from({ length: 2345 }, (_, i) => t.key('k/' + String(i).padStart(5, '0'))).concat(['a.txt', 'b.txt', 'c/1', 'c/2', 'c/d/3', 'e/1'].map((k) => t.key(k)));
    await putMany(c, PB, keys);
    const sizes = [];
    const got = [];
    for await (const page of paginateListObjectsV2({ client: c }, { Bucket: PB, Prefix: t.prefix })) {
        sizes.push(page.Contents.length);
        got.push(...page.Contents.map((o) => o.Key));
    }
    eq(sizes, [1000, 1000, 351], 'page sizes');
    eq(got, sorted(keys), 'keys in raw UTF-8 byte order');
});

test('list/v1-with-delimiter-and-marker', async (t) => {
    const c = client('plain');
    await putMany(c, PB, ['a.txt', 'b.txt', 'c/1', 'c/2', 'c/d/3', 'e/1', 'f'].map((k) => t.key(k)));
    const contents = [], prefixes = [];
    let marker;
    for (let i = 0; i < 20; i++) {
        const r = await c.send(new ListObjectsCommand({ Bucket: PB, Prefix: t.prefix, Delimiter: '/', MaxKeys: 2, Marker: marker }));
        contents.push(...(r.Contents || []).map((o) => o.Key.slice(t.prefix.length)));
        prefixes.push(...(r.CommonPrefixes || []).map((p) => p.Prefix.slice(t.prefix.length)));
        if (!r.IsTruncated) break;
        ok(r.NextMarker, 'a truncated V1 listing with a delimiter must carry NextMarker');
        marker = r.NextMarker;
    }
    eq(contents, ['a.txt', 'b.txt', 'f']);
    eq(prefixes, ['c/', 'e/']);
});

test('list/prefix-delimiter-keycount', async (t) => {
    const c = client('plain');
    await putMany(c, PB, ['c/1', 'c/2', 'c/d/3', 'c/d/4', 'e/1'].map((k) => t.key(k)));
    const r = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.key('c/'), Delimiter: '/' }));
    eq((r.Contents || []).map((o) => o.Key), [t.key('c/1'), t.key('c/2')]);
    eq((r.CommonPrefixes || []).map((p) => p.Prefix), [t.key('c/d/')]);
    eq(r.KeyCount, 3, 'KeyCount counts keys and common prefixes');
    eq(r.Delimiter, '/');
    eq(r.IsTruncated, false);
});

test('list/start-after-continuation-token-and-max-keys', async (t) => {
    const c = client('plain');
    const keys = ['a', 'b', 'c', 'd', 'e'].map((k) => t.key(k));
    await putMany(c, PB, keys);
    const r1 = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix, MaxKeys: 2 }));
    eq(r1.IsTruncated, true);
    ok(r1.NextContinuationToken, 'NextContinuationToken');
    const r2 = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix, MaxKeys: 2, ContinuationToken: r1.NextContinuationToken }));
    eq(r2.ContinuationToken, r1.NextContinuationToken);
    eq(r2.Contents.map((o) => o.Key), [keys[2], keys[3]]);
    const r3 = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix, StartAfter: keys[1] }));
    eq(r3.Contents.map((o) => o.Key), keys.slice(2));
    const r0 = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix, MaxKeys: 0 }));
    eq([r0.KeyCount, r0.IsTruncated, (r0.Contents || []).length], [0, false, 0], 'max-keys=0');
});

test('list/entry-fields', async (t) => {
    const c = client('plain');
    await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('f'), Body: 'twelve bytes', ChecksumAlgorithm: 'CRC32' }));
    const r = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix, FetchOwner: true }));
    const o = r.Contents[0];
    eq(o.Size, 12);
    eq(o.StorageClass, 'STANDARD');
    ok(/^"[0-9a-f]{32}"$/.test(o.ETag), 'ETag ' + o.ETag);
    ok(o.LastModified instanceof Date && !isNaN(o.LastModified), 'LastModified');
    ok(o.Owner && o.Owner.ID, 'Owner with fetch-owner');
    eq(o.ChecksumAlgorithm, ['CRC32'], 'ChecksumAlgorithm of an object stored with a CRC32');
});

test('list/encoding-type-url-keys-and-prefixes', async (t) => {
    const c = client('plain');
    const keys = ['sp ace/k 1', 'sp ace/é', 'plus+/x', 'sp ace/日本', 'amp&/y'].map((k) => t.key(k));
    await putMany(c, PB, keys);
    const r = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix, Delimiter: '/', EncodingType: 'url' }));
    eq(r.EncodingType, 'url');
    eq((r.CommonPrefixes || []).map((p) => decodeS3(p.Prefix)).sort(), ['amp&/', 'plus+/', 'sp ace/'].map((k) => t.key(k)).sort());
    const r2 = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.key('sp ace/'), EncodingType: 'url' }));
    const got = r2.Contents.map((o) => decodeS3(o.Key));
    eq(got, sorted([t.key('sp ace/k 1'), t.key('sp ace/é'), t.key('sp ace/日本')]));
    ok(r2.Contents.every((o) => !/[ é日]/.test(o.Key)), 'keys must come back percent-encoded');
    eq(decodeS3(r2.Prefix), t.key('sp ace/'));
});

test('list/control-characters-need-url-encoding', async (t) => {
    const c = client('plain');
    const key = t.key('ctl\u0001\u001f-key');
    await putMany(c, PB, [key, t.key('plain')]);
    // the SDK asks for no encoding by default: the node must say so instead of sending invalid XML
    const e = await rejects(c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix })), { status: 400 });
    ok(/encoding/i.test(e.message), 'the message should point at encoding-type=url: ' + e.message);
    const r = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix, EncodingType: 'url' }));
    eq(r.Contents.map((o) => decodeS3(o.Key)), sorted([key, t.key('plain')]));
});

test('list/raw-utf8-byte-order', async (t) => {
    const c = client('plain');
    const names = ['a', 'a b', 'a-b', 'a.b', 'a/b', 'a0', 'A', 'Z', '_', '~', 'é', 'ÿ', 'Ā', '߿', 'ࠀ', '�', '～', '\u{10000}', '\u{1f600}', '\u{10ffff}', ' ', '!', 'あ'];
    const keys = names.map((n) => t.key(n));
    await putMany(c, PB, keys);
    const got = [];
    for await (const page of paginateListObjectsV2({ client: c }, { Bucket: PB, Prefix: t.prefix, EncodingType: 'url' })) got.push(...page.Contents.map((o) => decodeS3(o.Key)));
    eq(got, sorted(keys), 'raw UTF-8 byte order (not UTF-16 order)');
    ok(got.indexOf(t.key('～')) < got.indexOf(t.key('\u{1f600}')), 'U+FF5E sorts before U+1F600 in UTF-8 (the opposite of UTF-16)');
});

test('list/missing-bucket', async () => {
    const c = client('plain');
    await rejects(c.send(new ListObjectsV2Command({ Bucket: 'bvt-js-no-such-bucket' })), { name: 'NoSuchBucket', status: 404 });
});

test('list/virtual-hosted-style-listing', async (t) => {
    const c = client('plain', { vhost: true });
    await putMany(c, PB, [t.key('a'), t.key('b/c')]);
    const r = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix, Delimiter: '/' }));
    eq(r.Contents.map((o) => o.Key), [t.key('a')]);
    eq(r.CommonPrefixes.map((p) => p.Prefix), [t.key('b/')]);
});

test('list/versions-paging-with-markers', async (t) => {
    const c = client('versioned');
    const key = t.key('v');
    const ids = [];
    for (let i = 0; i < 4; i++) ids.push((await c.send(new PutObjectCommand({ Bucket: VB, Key: key, Body: 'v' + i }))).VersionId);
    await c.send(new DeleteObjectCommand({ Bucket: VB, Key: key }));
    const versions = [], markers = [];
    let pages = 0, km, vm;
    for (;;) {
        const page = await c.send(new ListObjectVersionsCommand({ Bucket: VB, Prefix: key, MaxKeys: 2, KeyMarker: km, VersionIdMarker: vm }));
        pages++;
        versions.push(...(page.Versions || []).map((v) => v.VersionId));
        markers.push(...(page.DeleteMarkers || []).map((m) => m.VersionId));
        if (!page.IsTruncated) break;
        km = page.NextKeyMarker;
        vm = page.NextVersionIdMarker;
        ok(km !== undefined, 'NextKeyMarker on a truncated page');
    }
    eq(versions, [...ids].reverse(), 'versions newest first');
    eq(markers.length, 1, 'one delete marker');
    eq(pages, 3, 'five entries in pages of two');
    const r = await c.send(new ListObjectVersionsCommand({ Bucket: VB, Prefix: key }));
    eq(r.DeleteMarkers[0].IsLatest, true);
    eq(r.Versions.every((v) => v.IsLatest === false), true);
});

test('list/after-write-visibility', async (t) => {
    const c = client('plain');
    for (let i = 0; i < 15; i++) {
        await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('k' + String(i).padStart(2, '0')), Body: 'x'.repeat(i + 1) }));
        const keys = await allKeys(c, PB, { Prefix: t.prefix });
        eq(keys.length, i + 1, 'list-after-write');
    }
    for (let i = 0; i < 15; i++) {
        await c.send(new DeleteObjectCommand({ Bucket: PB, Key: t.key('k' + String(i).padStart(2, '0')) }));
        eq((await allKeys(c, PB, { Prefix: t.prefix })).length, 14 - i, 'list-after-delete');
    }
});

test('list/listing-sends-the-expected-query', async (t) => {
    const c = client('plain');
    const recs = tap(c);
    await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix, Delimiter: '/', MaxKeys: 5 }));
    const q = recs[0].query;
    eq(q['list-type'], '2');
    eq(q.delimiter, '/');
    eq(q['max-keys'], '5');
    eq(q.prefix, t.prefix);
});
