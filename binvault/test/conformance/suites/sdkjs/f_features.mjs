// Area f: versioning, SSE-S3, bucket level calls, ACL stubs, anonymous access, quota and content rules, throttling and the SDK's retries.
import {
    PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, CopyObjectCommand, ListObjectsV2Command,
    ListObjectVersionsCommand, ListBucketsCommand, HeadBucketCommand, GetBucketLocationCommand, GetBucketVersioningCommand, GetBucketEncryptionCommand,
    GetBucketLifecycleConfigurationCommand, GetBucketCorsCommand, GetBucketAclCommand, PutBucketAclCommand, PutObjectAclCommand, GetObjectAclCommand,
    PutBucketVersioningCommand, DeleteBucketCommand, CreateBucketCommand, GetBucketPolicyCommand, GetObjectAttributesCommand, RestoreObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import {
    test, client, anonClient, tap, B, EXTRA, KiB, MiB, ok, eq, eqBuf, rejects, det, md5hex, unq, bodyBytes, skip, httpReq, xmlCode, sleep,
} from './harness.mjs';

const PB = B.plain.name, VB = B.versioned.name, PUB = B.public.name, QB = B.quota.name, CB = B.ctype.name;
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' + '00'.repeat(64), 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');

// ---- versioning + SSE ------------------------------------------------------------------------
test('versioning/put-get-list-delete-flow', async (t) => {
    const c = client('versioned');
    const key = t.key('k');
    const ids = [];
    for (let i = 0; i < 3; i++) {
        const r = await c.send(new PutObjectCommand({ Bucket: VB, Key: key, Body: 'version ' + i }));
        ok(r.VersionId, 'VersionId');
        eq(r.ServerSideEncryption, 'AES256', 'the bucket default encrypts');
        ids.push(r.VersionId);
    }
    eq(new Set(ids).size, 3, 'distinct ids');
    for (let i = 0; i < 3; i++) {
        const g = await c.send(new GetObjectCommand({ Bucket: VB, Key: key, VersionId: ids[i] }));
        eq((await bodyBytes(g)).toString(), 'version ' + i);
        eq(g.VersionId, ids[i]);
    }
    const d = await c.send(new DeleteObjectCommand({ Bucket: VB, Key: key }));
    eq(d.DeleteMarker, true);
    await rejects(c.send(new GetObjectCommand({ Bucket: VB, Key: key })), { name: 'NoSuchKey', status: 404 });
    await rejects(c.send(new GetObjectCommand({ Bucket: VB, Key: key, VersionId: d.VersionId })), { status: 405 });
    await c.send(new DeleteObjectCommand({ Bucket: VB, Key: key, VersionId: d.VersionId }));      // purge the marker: the key is back
    eq((await bodyBytes(await c.send(new GetObjectCommand({ Bucket: VB, Key: key })))).toString(), 'version 2');
    await rejects(c.send(new GetObjectCommand({ Bucket: VB, Key: key, VersionId: '01JNOSUCHVERSIONXXXXXXXXXX' })), { name: 'NoSuchVersion', status: 404 });
    const lv = await c.send(new ListObjectVersionsCommand({ Bucket: VB, Prefix: key }));
    eq(lv.Versions.map((v) => v.VersionId), [...ids].reverse());
});

test('versioning/copy-restores-an-old-version', async (t) => {
    const c = client('versioned');
    const key = t.key('r');
    const v1 = (await c.send(new PutObjectCommand({ Bucket: VB, Key: key, Body: 'first' }))).VersionId;
    await c.send(new PutObjectCommand({ Bucket: VB, Key: key, Body: 'second' }));
    const r = await c.send(new CopyObjectCommand({ Bucket: VB, Key: key, CopySource: `${VB}/${encodeURIComponent(key).replace(/%2F/g, '/')}?versionId=${v1}` }));
    ok(r.VersionId && r.CopySourceVersionId === v1, 'copy source version id echoed');
    eq((await bodyBytes(await c.send(new GetObjectCommand({ Bucket: VB, Key: key })))).toString(), 'first');
});

test('versioning/delete-objects-with-version-ids', async (t) => {
    const c = client('versioned');
    const v = (await c.send(new PutObjectCommand({ Bucket: VB, Key: t.key('a'), Body: 'a' }))).VersionId;
    const r = await c.send(new DeleteObjectsCommand({ Bucket: VB, Delete: { Objects: [{ Key: t.key('a'), VersionId: v }, { Key: t.key('never') }] } }));
    eq(r.Errors || [], []);
    ok(r.Deleted.some((d) => d.Key === t.key('a') && d.VersionId === v), 'purged version reported');
    ok(r.Deleted.some((d) => d.Key === t.key('never')), 'plain delete of a missing key reported');
});

test('sse/s3-per-request-and-bucket-default', async (t) => {
    const c = client('plain');
    const data = det(300 * KiB, 140);
    const p = await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('e'), Body: data, ServerSideEncryption: 'AES256' }));
    eq(p.ServerSideEncryption, 'AES256');
    const g = await c.send(new GetObjectCommand({ Bucket: PB, Key: t.key('e'), Range: 'bytes=65530-65545' }));
    eqBuf(await bodyBytes(g), data.subarray(65530, 65546), 'range across a 64 KiB encryption chunk');
    eq(g.ServerSideEncryption, 'AES256');
    await rejects(c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('k'), Body: 'x', ServerSideEncryption: 'aws:kms' })), { name: 'NotImplemented', status: 501 });
    await rejects(c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('c'), Body: 'x', SSECustomerAlgorithm: 'AES256', SSECustomerKey: '0123456789abcdef0123456789abcdef' })), { status: [400, 501] });
});

test('sse/multipart-into-the-encrypted-bucket-and-copy', async (t) => {
    const c = client('versioned');
    const data = det(11 * MiB, 141);
    await new Upload({ client: c, params: { Bucket: VB, Key: t.key('m'), Body: data }, partSize: 5 * MiB }).done();
    await c.send(new CopyObjectCommand({ Bucket: VB, Key: t.key('copy'), CopySource: `${VB}/${t.key('m').split('/').map(encodeURIComponent).join('/')}` }));
    const g = await c.send(new GetObjectCommand({ Bucket: VB, Key: t.key('copy') }));
    eq(g.ServerSideEncryption, 'AES256');
    eqBuf(await bodyBytes(g), data);
});

// ---- bucket level ----------------------------------------------------------------------------
test('bucket/list-head-location-versioning-encryption', async () => {
    const c = client('plain');
    const lb = await c.send(new ListBucketsCommand({}));
    eq(lb.Buckets.map((b) => b.Name), [PB], 'ListBuckets shows only the token bucket');
    ok(lb.Buckets[0].CreationDate instanceof Date, 'CreationDate');
    await c.send(new HeadBucketCommand({ Bucket: PB }));
    eq((await c.send(new GetBucketLocationCommand({ Bucket: PB }))).LocationConstraint ?? '', '');
    eq((await c.send(new GetBucketVersioningCommand({ Bucket: PB }))).Status, undefined);
    eq((await client('versioned').send(new GetBucketVersioningCommand({ Bucket: VB }))).Status, 'Enabled');
    await rejects(c.send(new GetBucketEncryptionCommand({ Bucket: PB })), { name: 'ServerSideEncryptionConfigurationNotFoundError', status: 404 });
    const enc = await client('versioned').send(new GetBucketEncryptionCommand({ Bucket: VB }));
    eq(enc.ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm, 'AES256');
    await rejects(c.send(new GetBucketLifecycleConfigurationCommand({ Bucket: PB })), { name: 'NoSuchLifecycleConfiguration', status: 404 });
    const cors = await client('public').send(new GetBucketCorsCommand({ Bucket: PUB }));
    ok(cors.CORSRules.length >= 1 && cors.CORSRules[0].AllowedOrigins.includes('https://app.example.com'), 'GetBucketCors shows the admin rules');
    await rejects(c.send(new GetBucketPolicyCommand({ Bucket: PB })), { name: 'NoSuchBucketPolicy', status: 404 });
});

test('bucket/restricted-calls-are-access-denied', async () => {
    const c = client('plain');
    await rejects(c.send(new PutBucketVersioningCommand({ Bucket: PB, VersioningConfiguration: { Status: 'Enabled' } })), { name: 'AccessDenied', status: 403 });
    await rejects(c.send(new DeleteBucketCommand({ Bucket: PB })), { name: 'AccessDenied', status: 403 });
    await c.send(new CreateBucketCommand({ Bucket: PB }));       // the token's own bucket: 200, nothing changes
});

test('bucket/acl-stubs', async (t) => {
    const c = client('plain');
    await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('o'), Body: 'x' }));
    const acl = await c.send(new GetBucketAclCommand({ Bucket: PB }));
    eq(acl.Grants.map((g) => g.Permission), ['FULL_CONTROL']);
    eq((await c.send(new GetObjectAclCommand({ Bucket: PB, Key: t.key('o') }))).Grants.length, 1);
    await c.send(new PutObjectAclCommand({ Bucket: PB, Key: t.key('o'), ACL: 'private' }));
    await c.send(new PutBucketAclCommand({ Bucket: PB, ACL: 'bucket-owner-full-control' }));
    await rejects(c.send(new PutObjectAclCommand({ Bucket: PB, Key: t.key('o'), ACL: 'public-read' })), { name: 'AccessControlListNotSupported', status: 400 });
    await rejects(c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('o2'), Body: 'x', ACL: 'public-read' })), { name: 'AccessControlListNotSupported', status: 400 });
});

test('bucket/object-attributes', async (t) => {
    const c = client('plain');
    await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('a'), Body: 'attributes', ChecksumAlgorithm: 'SHA256' }));
    const a = await c.send(new GetObjectAttributesCommand({ Bucket: PB, Key: t.key('a'), ObjectAttributes: ['ETag', 'ObjectSize', 'StorageClass', 'Checksum'] }));
    eq(a.ObjectSize, 10);
    eq(a.StorageClass, 'STANDARD');
    eq(unq(a.ETag), md5hex(Buffer.from('attributes')));
    ok(a.Checksum && a.Checksum.ChecksumSHA256, 'Checksum section');
});

test('bucket/restore-object-is-not-implemented', async (t) => {
    const c = client('plain');
    await c.send(new PutObjectCommand({ Bucket: PB, Key: t.key('r'), Body: 'x' }));
    await rejects(c.send(new RestoreObjectCommand({ Bucket: PB, Key: t.key('r'), RestoreRequest: { Days: 1 } })), { name: 'NotImplemented', status: 501 });
});

// ---- anonymous access ------------------------------------------------------------------------
test('anonymous/public-bucket-read-only', async (t) => {
    const owner = client('public');
    await owner.send(new PutObjectCommand({ Bucket: PUB, Key: t.key('pub.html'), Body: '<b>hi</b>', ContentType: 'text/html', CacheControl: 'public, max-age=60' }));
    const a = await anonClient();
    const g = await a.send(new GetObjectCommand({ Bucket: PUB, Key: t.key('pub.html') }));
    eq((await bodyBytes(g)).toString(), '<b>hi</b>');
    eq(g.CacheControl, 'public, max-age=60');
    const raw = await httpReq('GET', `${(await import('./harness.mjs')).TOOL_ENDPOINT}/${PUB}/${t.key('pub.html')}`);
    eq(raw.headers['content-security-policy'], 'sandbox');
    eq(raw.headers['x-content-type-options'], 'nosniff');
    await rejects(a.send(new ListObjectsV2Command({ Bucket: PUB })), { name: 'AccessDenied', status: 403 });
    await rejects(a.send(new PutObjectCommand({ Bucket: PUB, Key: t.key('evil'), Body: 'x' })), { name: 'AccessDenied', status: 403 });
    await rejects(a.send(new GetObjectCommand({ Bucket: PB, Key: 'anything' })), { name: 'AccessDenied', status: 403 });
});

// ---- quota and content rules -----------------------------------------------------------------
test('rules/quota-refuses-the-write-that-does-not-fit', async (t) => {
    const c = client('quota');
    // (a refused upload is answered before its body is read: keep the refused body small enough for the socket buffers, a
    // large one makes some clients report a reset connection instead of the answer)
    const a = det(7 * MiB + 900 * KiB, 150);
    await c.send(new PutObjectCommand({ Bucket: QB, Key: t.key('a'), Body: a }));
    await rejects(c.send(new PutObjectCommand({ Bucket: QB, Key: t.key('b'), Body: det(200 * KiB, 151) })), { name: 'QuotaExceeded', status: 403 });
    await rejects(new Upload({ client: c, params: { Bucket: QB, Key: t.key('mp'), Body: det(12 * MiB, 152) }, partSize: 5 * MiB, queueSize: 1 }).done(), {});
    const l = await c.send(new ListObjectsV2Command({ Bucket: QB, Prefix: t.prefix }));
    eq(l.Contents.map((o) => o.Key), [t.key('a')], 'only the first object was stored');
    await c.send(new DeleteObjectCommand({ Bucket: QB, Key: t.key('a') }));
});

test('rules/content-types-are-sniffed', async (t) => {
    const c = client('ctype');
    await c.send(new PutObjectCommand({ Bucket: CB, Key: t.key('pic.png'), Body: PNG, ContentType: 'text/html' }));
    await c.send(new PutObjectCommand({ Bucket: CB, Key: t.key('note.txt'), Body: 'just text\n' }));
    await rejects(c.send(new PutObjectCommand({ Bucket: CB, Key: t.key('doc.pdf'), Body: PDF, ContentType: 'image/png' })), { name: 'ContentTypeNotAllowed', status: 415 });
    await rejects(c.send(new PutObjectCommand({ Bucket: CB, Key: t.key('big.pdf'), Body: Buffer.concat([PDF, det(4 * MiB, 153)]) })), { name: 'ContentTypeNotAllowed', status: 415 });
    await rejects(c.send(new HeadObjectCommand({ Bucket: CB, Key: t.key('doc.pdf') })), { status: 404 });
});

// ---- throttling: the SDK's standard retries ride out SlowDown ---------------------------------------
test('throttle/slowdown-503-with-retry-after', async (t) => {
    if (!EXTRA.limited) skip('the rate-limited bucket could not be created by run.sh');
    const L = EXTRA.limited;
    const c = client({ name: L.name, access_key: L.access_key, secret_key: L.secret_key }, { maxAttempts: 1 });
    await sleep(1200);
    const statuses = [];
    let retryAfter;
    for (let i = 0; i < 12; i++) {
        try {
            await c.send(new PutObjectCommand({ Bucket: L.name, Key: t.key('k' + i), Body: 'x' }));
            statuses.push(200);
        } catch (e) {
            statuses.push(e.$metadata?.httpStatusCode);
            if (e.$metadata?.httpStatusCode === 503) {
                eq(e.name, 'SlowDown');
                retryAfter = e.$response?.headers?.['retry-after'];
            }
        }
    }
    ok(statuses.includes(503), 'the limit (2/s, burst 2) must trigger: ' + statuses.join(','));
    ok(statuses.filter((s) => s === 200).length >= 2, 'the burst gets through: ' + statuses.join(','));
    ok(retryAfter && Number(retryAfter) >= 1, 'Retry-After: ' + retryAfter);
});

test('throttle/standard-retries-succeed', async (t) => {
    if (!EXTRA.limited) skip('the rate-limited bucket could not be created by run.sh');
    const L = EXTRA.limited;
    const c = client({ name: L.name, access_key: L.access_key, secret_key: L.secret_key }, { maxAttempts: 12 });
    await sleep(1500);
    const t0 = Date.now();
    for (let i = 0; i < 8; i++) await c.send(new PutObjectCommand({ Bucket: L.name, Key: t.key('r' + i), Body: 'x' }));
    ok(Date.now() - t0 >= 800, '8 requests at 2/s cannot be instant');
});
