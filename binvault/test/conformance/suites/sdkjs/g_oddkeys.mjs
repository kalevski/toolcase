// Area g: the odd-keys table through the JS SDK (path-style and virtual-hosted style), listing order, too-long keys.
import {
    PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, CopyObjectCommand, ListObjectsV2Command, DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { test, client, B, ok, eq, eqBuf, rejects, bodyBytes, loadOddKeys, decodeS3, unq, md5hex } from './harness.mjs';

const PB = B.plain.name;
const { keys: ODD, tooLong } = loadOddKeys();
const sorted = (ks) => [...ks].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
const copySrc = (bucket, key) => `${bucket}/${key.split('/').map((s) => encodeURIComponent(s).replace(/[!'()*]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase())).join('/')}`;

for (const style of ['path', 'virtual']) {
    for (const { id, key } of ODD) {
        test(`oddkeys-${style}/${id}`, async (t) => {
            const c = client('plain', { vhost: style === 'virtual' });
            const real = key;                                  // the exact key of the table, no prefix: keys are byte-exact
            const body = Buffer.from('body of ' + id);
            const put = await c.send(new PutObjectCommand({ Bucket: PB, Key: real, Body: body }));
            eq(unq(put.ETag), md5hex(body), 'ETag');
            const g = await c.send(new GetObjectCommand({ Bucket: PB, Key: real }));
            eqBuf(await bodyBytes(g), body, 'GET');
            const h = await c.send(new HeadObjectCommand({ Bucket: PB, Key: real }));
            eq(h.ContentLength, body.length, 'HEAD');
            const l = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: real, EncodingType: 'url' }));
            ok((l.Contents || []).some((o) => decodeS3(o.Key) === real), 'listed byte-exact: ' + JSON.stringify((l.Contents || []).map((o) => o.Key)));
            if (style === 'path') {
                const dst = t.key('copy-of-' + id);
                await c.send(new CopyObjectCommand({ Bucket: PB, Key: dst, CopySource: copySrc(PB, real) }));
                eqBuf(await bodyBytes(await c.send(new GetObjectCommand({ Bucket: PB, Key: dst }))), body, 'copy');
                await c.send(new DeleteObjectCommand({ Bucket: PB, Key: dst }));
            }
            const r = await c.send(new DeleteObjectsCommand({ Bucket: PB, Delete: { Objects: [{ Key: real }] } }));
            eq((r.Deleted || []).map((d) => d.Key), [real], 'DeleteObjects reports the key byte-exact');
            await rejects(c.send(new HeadObjectCommand({ Bucket: PB, Key: real })), { status: 404 });
        });
    }
}

test('oddkeys/listing-order-of-the-whole-table', async (t) => {
    const c = client('plain');
    const keys = ODD.filter((e) => Buffer.byteLength(e.key) < 900 && !e.key.startsWith('/')).map((e) => t.prefix + e.key);
    for (const k of keys) await c.send(new PutObjectCommand({ Bucket: PB, Key: k, Body: 'x' }));
    const got = [];
    let token;
    do {
        const r = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix, EncodingType: 'url', ContinuationToken: token, MaxKeys: 7 }));
        got.push(...r.Contents.map((o) => decodeS3(o.Key)));
        token = r.NextContinuationToken;
    } while (token);
    eq(got, sorted(keys), 'raw UTF-8 byte order, paged by 7');
});

test('oddkeys/too-long-key', async () => {
    const c = client('plain');
    await rejects(c.send(new PutObjectCommand({ Bucket: PB, Key: tooLong, Body: 'x' })), { name: 'KeyTooLongError', status: 400 });
});

test('oddkeys/dot-segments-are-literal-key-text', async (t) => {
    // WHATWG URL parsing collapses /./ and /../ - the SDK has to keep them; the node must not clean them either
    const c = client('plain');
    for (const k of ['dir/./x.txt', 'dir/../x.txt', './a', '../a', 'a/.', 'a/..']) {
        await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key(k), Body: 'dots ' + k }));
        eq((await bodyBytes(await c.send(new GetObjectCommand({ Bucket: PB, Key: t.key(k) })))).toString(), 'dots ' + k, k);
    }
    const l = await c.send(new ListObjectsV2Command({ Bucket: PB, Prefix: t.prefix, EncodingType: 'url' }));
    eq(l.Contents.length, 6);
});
