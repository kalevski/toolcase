// Area d: multipart uploads - lib-storage Upload (buffers, streams, failures), the low-level commands, part reads, part copies.
import {
    PutObjectCommand, GetObjectCommand, HeadObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, UploadPartCopyCommand, CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand, ListPartsCommand, ListMultipartUploadsCommand, GetObjectAttributesCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'node:stream';
import { test, client, tap, B, KiB, MiB, ok, eq, eqBuf, rejects, det, md5hex, unq, multipartEtag, bodyBytes } from './harness.mjs';

const PB = B.plain.name;
const VB = B.versioned.name;
const enc = (key) => key.split('/').map(encodeURIComponent).join('/');
const parts5 = (data, size = 5 * MiB) => {
    const out = [];
    for (let i = 0; i < data.length; i += size) out.push(data.subarray(i, i + size));
    return out;
};

test('multipart/upload-buffer-3-parts', async (t) => {
    const c = client('plain');
    const data = det(11 * MiB + 17, 51);
    const key = t.key('b.bin');
    const out = await new Upload({ client: c, params: { Bucket: PB, Key: key, Body: data, ContentType: 'application/x-mp', Metadata: { m: '1' }, Tagging: 'a=1' }, partSize: 5 * MiB, queueSize: 3 }).done();
    eq(unq(out.ETag), multipartEtag(parts5(data)), 'composite ETag');
    const h = await c.send(new HeadObjectCommand({ Bucket: PB, Key: key, ChecksumMode: 'ENABLED' }));
    eq(h.ContentLength, data.length);
    eq(h.ContentType, 'application/x-mp');
    eq(h.Metadata, { m: '1' });
    ok(/-3$/.test(h.ChecksumCRC32 || ''), 'default CRC32 of a 3-part upload is composite: ' + h.ChecksumCRC32);
    eqBuf(await bodyBytes(await c.send(new GetObjectCommand({ Bucket: PB, Key: key }))), data);
});

test('multipart/upload-small-body-is-one-put', async (t) => {
    const c = client('plain');
    const recs = tap(c);
    const out = await new Upload({ client: c, params: { Bucket: PB, Key: t.key('s'), Body: Buffer.from('tiny') } }).done();
    eq(unq(out.ETag), md5hex(Buffer.from('tiny')));
    eq(recs.map((r) => r.method + ' ' + (r.query?.uploads !== undefined ? 'uploads' : '')).join(','), 'PUT ', 'a single PutObject');
});

test('multipart/upload-readable-stream-unknown-length', async (t) => {
    const c = client('plain');
    const data = det(13 * MiB + 5, 52);
    const stream = Readable.from((function* () { for (let i = 0; i < data.length; i += 100000) yield data.subarray(i, i + 100000); })());
    const out = await new Upload({ client: c, params: { Bucket: PB, Key: t.key('stream'), Body: stream }, partSize: 5 * MiB, queueSize: 2 }).done();
    eq(unq(out.ETag), multipartEtag(parts5(data)));
    eqBuf(await bodyBytes(await c.send(new GetObjectCommand({ Bucket: PB, Key: t.key('stream') }))), data);
});

test('multipart/upload-failure-aborts-the-upload', async (t) => {
    const c = client('plain');
    let n = 0;
    const bad = new Readable({
        read() {
            if (n++ < 3) this.push(det(5 * MiB, 60 + n));
            else this.destroy(new Error('source died'));
        },
    });
    await rejects(new Upload({ client: c, params: { Bucket: PB, Key: t.key('never'), Body: bad }, partSize: 5 * MiB, queueSize: 1 }).done(), {});
    const l = await c.send(new ListMultipartUploadsCommand({ Bucket: PB, Prefix: t.prefix }));
    eq(l.Uploads || [], [], 'lib-storage aborts a failed upload');
    await rejects(c.send(new HeadObjectCommand({ Bucket: PB, Key: t.key('never') })), { status: 404 });
});

test('multipart/upload-abort-signal', async (t) => {
    const c = client('plain');
    const up = new Upload({ client: c, params: { Bucket: PB, Key: t.key('aborted'), Body: det(30 * MiB, 53) }, partSize: 5 * MiB, queueSize: 1 });
    up.on('httpUploadProgress', () => up.abort());       // abort as soon as the first part is through
    const p = up.done();
    await rejects(p, {});
    let open = 1;
    for (let i = 0; i < 30 && open; i++) {                 // lib-storage sends AbortMultipartUpload right after the rejection
        open = ((await c.send(new ListMultipartUploadsCommand({ Bucket: PB, Prefix: t.prefix }))).Uploads || []).length;
        if (open) await new Promise((r) => setTimeout(r, 200));
    }
    eq(open, 0, 'no open upload after abort()');
});

test('multipart/low-level-commands', async (t) => {
    const c = client('plain');
    const key = t.key('low');
    const data = [det(5 * MiB, 71), det(5 * MiB + 3, 72), det(1234, 73)];
    const { UploadId } = await c.send(new CreateMultipartUploadCommand({ Bucket: PB, Key: key, ContentType: 'text/x-low', Metadata: { k: 'v' }, ChecksumAlgorithm: 'SHA256' }));
    ok(UploadId, 'UploadId');
    const done = [];
    for (let i = 0; i < data.length; i++) {
        const r = await c.send(new UploadPartCommand({ Bucket: PB, Key: key, UploadId, PartNumber: i + 1, Body: data[i], ChecksumAlgorithm: 'SHA256' }));
        eq(unq(r.ETag), md5hex(data[i]), 'part ETag');
        ok(r.ChecksumSHA256, 'part checksum echoed');
        done.push({ PartNumber: i + 1, ETag: r.ETag, ChecksumSHA256: r.ChecksumSHA256 });
    }
    const lp = await c.send(new ListPartsCommand({ Bucket: PB, Key: key, UploadId, MaxParts: 2 }));
    eq([lp.Parts.length, lp.IsTruncated, String(lp.NextPartNumberMarker)], [2, true, '2']);
    const lp2 = await c.send(new ListPartsCommand({ Bucket: PB, Key: key, UploadId, PartNumberMarker: lp.NextPartNumberMarker }));
    eq(lp2.Parts.map((p) => [p.PartNumber, p.Size]), [[3, 1234]]);
    const lu = await c.send(new ListMultipartUploadsCommand({ Bucket: PB, Prefix: t.prefix }));
    eq(lu.Uploads.map((u) => u.UploadId), [UploadId]);
    await rejects(c.send(new CompleteMultipartUploadCommand({ Bucket: PB, Key: key, UploadId, MultipartUpload: { Parts: [done[1], done[0], done[2]] } })), { name: 'InvalidPartOrder', status: 400 });
    await rejects(c.send(new CompleteMultipartUploadCommand({ Bucket: PB, Key: key, UploadId, MultipartUpload: { Parts: [{ ...done[0], ETag: '"00000000000000000000000000000000"' }, done[1], done[2]] } })), { name: 'InvalidPart', status: 400 });
    const out = await c.send(new CompleteMultipartUploadCommand({ Bucket: PB, Key: key, UploadId, MultipartUpload: { Parts: done } }));
    eq(unq(out.ETag), multipartEtag(data));
    const g = await c.send(new GetObjectCommand({ Bucket: PB, Key: key }));
    eq(g.ContentType, 'text/x-low');
    eq(g.Metadata, { k: 'v' });
    eqBuf(await bodyBytes(g), Buffer.concat(data));
    await rejects(c.send(new ListPartsCommand({ Bucket: PB, Key: key, UploadId })), { name: 'NoSuchUpload', status: 404 });
});

test('multipart/entity-too-small-and-abort', async (t) => {
    const c = client('plain');
    const key = t.key('small');
    const { UploadId } = await c.send(new CreateMultipartUploadCommand({ Bucket: PB, Key: key }));
    const done = [];
    for (const n of [1, 2]) {
        const r = await c.send(new UploadPartCommand({ Bucket: PB, Key: key, UploadId, PartNumber: n, Body: Buffer.from('tiny' + n) }));
        done.push({ PartNumber: n, ETag: r.ETag });
    }
    await rejects(c.send(new CompleteMultipartUploadCommand({ Bucket: PB, Key: key, UploadId, MultipartUpload: { Parts: done } })), { name: 'EntityTooSmall', status: 400 });
    eq((await c.send(new AbortMultipartUploadCommand({ Bucket: PB, Key: key, UploadId }))).$metadata.httpStatusCode, 204);
    await rejects(c.send(new UploadPartCommand({ Bucket: PB, Key: key, UploadId, PartNumber: 1, Body: Buffer.from('late') })), { name: 'NoSuchUpload', status: 404 });
});

test('multipart/part-number-limits', async (t) => {
    const c = client('plain');
    const key = t.key('pn');
    const { UploadId } = await c.send(new CreateMultipartUploadCommand({ Bucket: PB, Key: key }));
    for (const n of [0, 10001]) await rejects(c.send(new UploadPartCommand({ Bucket: PB, Key: key, UploadId, PartNumber: n, Body: Buffer.from('x') })), { status: 400 }, 'part number ' + n);
    const r = await c.send(new UploadPartCommand({ Bucket: PB, Key: key, UploadId, PartNumber: 10000, Body: Buffer.from('last') }));
    await c.send(new CompleteMultipartUploadCommand({ Bucket: PB, Key: key, UploadId, MultipartUpload: { Parts: [{ PartNumber: 10000, ETag: r.ETag }] } }));
    eq((await bodyBytes(await c.send(new GetObjectCommand({ Bucket: PB, Key: key })))).toString(), 'last');
});

test('multipart/get-by-part-number-and-attributes', async (t) => {
    const c = client('plain');
    const key = t.key('pn-read');
    const data = [det(5 * MiB, 81), det(5 * MiB + 11, 82), det(77, 83)];
    const out = await new Upload({ client: c, params: { Bucket: PB, Key: key, Body: Buffer.concat(data) }, partSize: 5 * MiB, queueSize: 1 }).done();
    eq(unq(out.ETag), multipartEtag([data[0], Buffer.concat(data).subarray(5 * MiB, 10 * MiB), Buffer.concat(data).subarray(10 * MiB)]));
    const all = Buffer.concat(data);
    const sizes = [5 * MiB, 5 * MiB, all.length - 10 * MiB];
    let off = 0;
    for (let n = 1; n <= 3; n++) {
        const g = await c.send(new GetObjectCommand({ Bucket: PB, Key: key, PartNumber: n }));
        eqBuf(await bodyBytes(g), all.subarray(off, off + sizes[n - 1]), 'part ' + n);
        eq(g.PartsCount, 3);
        off += sizes[n - 1];
    }
    await rejects(c.send(new GetObjectCommand({ Bucket: PB, Key: key, PartNumber: 4 })), { status: 416 });
    const a = await c.send(new GetObjectAttributesCommand({ Bucket: PB, Key: key, ObjectAttributes: ['ETag', 'ObjectSize', 'ObjectParts', 'StorageClass', 'Checksum'] }));
    eq(a.ObjectSize, all.length);
    eq(a.ObjectParts.TotalPartsCount, 3);
    eq(a.ObjectParts.Parts.map((p) => p.PartNumber), [1, 2, 3]);
});

test('multipart/upload-part-copy', async (t) => {
    const c = client('plain');
    const src = det(11 * MiB, 91);
    await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('src'), Body: src }));
    const key = t.key('copied');
    const { UploadId } = await c.send(new CreateMultipartUploadCommand({ Bucket: PB, Key: key }));
    const done = [];
    const ranges = [[0, 5 * MiB - 1], [5 * MiB, 10 * MiB - 1], [10 * MiB, 11 * MiB - 1]];
    for (let i = 0; i < ranges.length; i++) {
        const r = await c.send(new UploadPartCopyCommand({ Bucket: PB, Key: key, UploadId, PartNumber: i + 1, CopySource: `${PB}/${enc(t.key('src'))}`, CopySourceRange: `bytes=${ranges[i][0]}-${ranges[i][1]}` }));
        done.push({ PartNumber: i + 1, ETag: r.CopyPartResult.ETag });
    }
    await c.send(new CompleteMultipartUploadCommand({ Bucket: PB, Key: key, UploadId, MultipartUpload: { Parts: done } }));
    eqBuf(await bodyBytes(await c.send(new GetObjectCommand({ Bucket: PB, Key: key }))), src);
});

test('multipart/into-a-versioned-encrypted-bucket', async (t) => {
    const c = client('versioned');
    const data = det(11 * MiB, 92);
    const out = await new Upload({ client: c, params: { Bucket: VB, Key: t.key('v'), Body: data }, partSize: 5 * MiB, queueSize: 2 }).done();
    ok(out.VersionId, 'a completed upload adds a version');
    const h = await c.send(new HeadObjectCommand({ Bucket: VB, Key: t.key('v') }));
    eq(h.ServerSideEncryption, 'AES256');
    eqBuf(await bodyBytes(await c.send(new GetObjectCommand({ Bucket: VB, Key: t.key('v'), VersionId: out.VersionId }))), data);
});

test('multipart/complete-is-idempotent-for-retries', async (t) => {
    const c = client('plain');
    const key = t.key('retry');
    const { UploadId } = await c.send(new CreateMultipartUploadCommand({ Bucket: PB, Key: key }));
    const r = await c.send(new UploadPartCommand({ Bucket: PB, Key: key, UploadId, PartNumber: 1, Body: Buffer.from('one part') }));
    const cmd = () => new CompleteMultipartUploadCommand({ Bucket: PB, Key: key, UploadId, MultipartUpload: { Parts: [{ PartNumber: 1, ETag: r.ETag }] } });
    const first = await c.send(cmd());
    const again = await c.send(cmd());
    eq(again.ETag, first.ETag, 'a repeated Complete within 10 minutes returns the same result (spec 5.6)');
});
