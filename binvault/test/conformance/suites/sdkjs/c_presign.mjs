// Area c: presigned URLs (getSignedUrl), presigned POST forms (createPresignedPost), expiry, tampering, signed headers.
import { PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, UploadPartCommand, CreateMultipartUploadCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import {
    test, client, B, DOMAIN, MiB, ok, eq, eqBuf, det, md5hex, unq, bodyBytes, httpReq, xmlCode, sleep, TOOL_PORT, TOOL_HOST, admin, skip,
} from './harness.mjs';

const PB = B.plain.name;
const sign = (c, cmd, o = {}) => getSignedUrl(c, cmd, { expiresIn: 300, ...o });

test('presign/get-and-head', async (t) => {
    const c = client('plain');
    const data = det(30000, 21);
    const key = t.key('a b+c.bin');
    await c.send(new PutObjectCommand({ Bucket: PB, Key: key, Body: data, ContentType: 'application/x-presign' }));
    const url = await sign(c, new GetObjectCommand({ Bucket: PB, Key: key }));
    ok(url.includes('X-Amz-Signature=') && url.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256'), 'SigV4 query form: ' + url);
    const r = await httpReq('GET', url);
    eq(r.status, 200);
    eqBuf(r.body, data);
    eq(r.headers['content-type'], 'application/x-presign');
    const h = await httpReq('HEAD', await sign(c, new HeadObjectCommand({ Bucket: PB, Key: key })));
    eq(h.status, 200);
    eq(h.headers['content-length'], String(data.length));
});

test('presign/response-overrides', async (t) => {
    const c = client('plain');
    const key = t.key('o');
    await c.send(new PutObjectCommand({ Bucket: PB, Key: key, Body: 'x', ContentType: 'text/plain' }));
    const url = await sign(c, new GetObjectCommand({ Bucket: PB, Key: key, ResponseContentType: 'image/x-test', ResponseContentDisposition: 'attachment; filename="x y.png"', ResponseCacheControl: 'no-store' }));
    const r = await httpReq('GET', url);
    eq(r.status, 200);
    eq(r.headers['content-type'], 'image/x-test');
    eq(r.headers['content-disposition'], 'attachment; filename="x y.png"');
    eq(r.headers['cache-control'], 'no-store');
});

test('presign/put-content-type-is-a-signed-header', async (t) => {
    const c = client('plain');
    const key = t.key('put.txt');
    // (the JS presigner signs only the host unless told otherwise: ask for Content-Type to be a signed header)
    const url = await sign(c, new PutObjectCommand({ Bucket: PB, Key: key, ContentType: 'text/x-signed' }), { signableHeaders: new Set(['content-type']) });
    ok(/X-Amz-SignedHeaders=[^&]*content-type/i.test(decodeURIComponent(url)), 'content-type is signed: ' + url);
    const body = Buffer.from('uploaded through a presigned url');
    let r = await httpReq('PUT', url, { headers: { 'content-type': 'text/x-signed', 'content-length': String(body.length) }, body });
    eq(r.status, 200, 'PUT with the signed header: ' + r.text.slice(0, 200));
    const g = await c.send(new GetObjectCommand({ Bucket: PB, Key: key }));
    eq(g.ContentType, 'text/x-signed');
    eqBuf(await bodyBytes(g), body);
    r = await httpReq('PUT', url, { headers: { 'content-type': 'text/x-other', 'content-length': String(body.length) }, body });
    eq(r.status, 403, 'a changed signed header');
    r = await httpReq('PUT', url, { headers: { 'content-length': String(body.length) }, body });
    eq(r.status, 403, 'a missing signed header');
});

test('presign/put-metadata-tags-and-sse-hoisted-into-the-query', async (t) => {
    // the JS SDK moves x-amz-* headers into the query string of a presigned URL (x-amz-meta-*, x-amz-tagging,
    // x-amz-server-side-encryption ...); S3 treats them as if they were headers
    const c = client('plain');
    const key = t.key('hoisted');
    const url = await sign(c, new PutObjectCommand({ Bucket: PB, Key: key, ContentType: 'text/x-signed', Metadata: { who: 'presign' }, Tagging: 'a=1', ServerSideEncryption: 'AES256' }));
    ok(/x-amz-meta-who=presign/.test(url) && /x-amz-tagging=/.test(url), 'the SDK hoists the headers into the URL: ' + url);
    const body = Buffer.from('hoisted headers');
    // the SDK keeps x-amz-server-side-encryption as a signed header (it is "unhoistable"): whoever uses the URL must send it
    const headers = { 'content-type': 'text/x-signed', 'content-length': String(body.length) };
    if (/X-Amz-SignedHeaders=[^&]*x-amz-server-side-encryption/i.test(decodeURIComponent(url))) headers['x-amz-server-side-encryption'] = 'AES256';
    const r = await httpReq('PUT', url, { headers, body });
    eq(r.status, 200, 'PUT: ' + r.text.slice(0, 200));
    const h = await c.send(new HeadObjectCommand({ Bucket: PB, Key: key }));
    eq(h.Metadata, { who: 'presign' }, 'user metadata given in the query string');
    eq(h.TagCount, 1, 'tags given in the query string');
    eq(h.ServerSideEncryption, 'AES256', 'encryption requested in the query string');
});

test('presign/put-with-default-sdk-settings', async (t) => {
    const c = client('plain');
    const key = t.key('plain-put');
    const url = await sign(c, new PutObjectCommand({ Bucket: PB, Key: key }));
    const body = Buffer.from('default presign');
    const r = await httpReq('PUT', url, { headers: { 'content-length': String(body.length) }, body });
    eq(r.status, 200, 'presigned PUT as the SDK builds it by default: ' + r.text.slice(0, 300) + ' url=' + url);
    eqBuf(await bodyBytes(await c.send(new GetObjectCommand({ Bucket: PB, Key: key }))), body);
});

test('presign/delete', async (t) => {
    const c = client('plain');
    const key = t.key('d');
    await c.send(new PutObjectCommand({ Bucket: PB, Key: key, Body: 'x' }));
    const r = await httpReq('DELETE', await sign(c, new DeleteObjectCommand({ Bucket: PB, Key: key })));
    eq(r.status, 204);
    eq((await httpReq('GET', await sign(c, new GetObjectCommand({ Bucket: PB, Key: key })))).status, 404);
});

test('presign/multipart-with-presigned-parts', async (t) => {
    const c = client('plain');
    const key = t.key('mp');
    const { UploadId } = await c.send(new CreateMultipartUploadCommand({ Bucket: PB, Key: key }));
    const parts = [det(5 * MiB, 31), det(1234, 32)];
    const done = [];
    for (let i = 0; i < parts.length; i++) {
        const url = await sign(c, new UploadPartCommand({ Bucket: PB, Key: key, UploadId, PartNumber: i + 1 }));
        const r = await httpReq('PUT', url, { headers: { 'content-length': String(parts[i].length) }, body: parts[i] });
        eq(r.status, 200, 'part ' + (i + 1) + ': ' + r.text.slice(0, 200));
        done.push({ PartNumber: i + 1, ETag: r.headers.etag });
    }
    await c.send(new CompleteMultipartUploadCommand({ Bucket: PB, Key: key, UploadId, MultipartUpload: { Parts: done } }));
    eqBuf(await bodyBytes(await c.send(new GetObjectCommand({ Bucket: PB, Key: key }))), Buffer.concat(parts));
});

test('presign/expiry-and-tampering', async (t) => {
    const c = client('plain');
    const key = t.key('e');
    await c.send(new PutObjectCommand({ Bucket: PB, Key: key, Body: 'expiry' }));
    const short = await getSignedUrl(c, new GetObjectCommand({ Bucket: PB, Key: key }), { expiresIn: 1 });
    eq((await httpReq('GET', short)).status, 200);
    await sleep(2500);
    const r = await httpReq('GET', short);
    eq(r.status, 403);
    eq(xmlCode(r.text), 'AccessDenied', 'expired URL');
    const url = await sign(c, new GetObjectCommand({ Bucket: PB, Key: key }));
    const sig = /X-Amz-Signature=([0-9a-f]{64})/.exec(url)[1];
    eq((await httpReq('GET', url.replace(sig, (sig[0] === '0' ? '1' : '0') + sig.slice(1)))).status, 403, 'bad signature');
    eq((await httpReq('GET', url.replace(key.slice(-3), 'zzz'))).status, 403, 'altered key');
    eq((await httpReq('GET', url + '&response-content-type=text/html')).status, 403, 'extra query parameter');
    const week = await getSignedUrl(c, new GetObjectCommand({ Bucket: PB, Key: key }), { expiresIn: 604800 });
    eq((await httpReq('GET', week)).status, 200, 'seven days');
});

test('presign/virtual-hosted-style', async (t) => {
    const c = client('plain', { vhost: true });
    const key = t.key('vh.bin');
    const data = det(2000, 41);
    await c.send(new PutObjectCommand({ Bucket: PB, Key: key, Body: data }));
    const url = await sign(c, new GetObjectCommand({ Bucket: PB, Key: key }));
    ok(url.startsWith(`http://${PB}.${DOMAIN}:${TOOL_PORT}/`), 'virtual-hosted URL: ' + url);
    const r = await httpReq('GET', url);
    eq(r.status, 200);
    eqBuf(r.body, data);
    const put = await sign(c, new PutObjectCommand({ Bucket: PB, Key: t.key('vh-put') }));
    eq((await httpReq('PUT', put, { headers: { 'content-length': '3' }, body: Buffer.from('abc') })).status, 200);
});

test('presign/revoking-the-token-kills-the-url', async (t) => {
    // a fresh token on the plain bucket via the admin API
    let tok;
    try {
        tok = await admin('POST', `/buckets/${PB}/tokens`, { name: 'js-presign', grants: [{ actions: ['read', 'write', 'list', 'delete'] }] });
    } catch (e) {
        skip('the admin listener is not reachable from here (' + e.code + '): it listens on the host loopback only');
    }
    eq(tok.status, 201, 'create a token');
    const c = client({ name: PB, access_key: tok.json.access_key_id, secret_key: tok.json.secret_access_key });
    const key = t.key('rev');
    await c.send(new PutObjectCommand({ Bucket: PB, Key: key, Body: 'x' }));
    const url = await sign(c, new GetObjectCommand({ Bucket: PB, Key: key }));
    eq((await httpReq('GET', url)).status, 200);
    const del = await admin('DELETE', `/buckets/${PB}/tokens/${tok.json.access_key_id}`);
    ok(del.status < 300, 'revoke: HTTP ' + del.status);
    eq((await httpReq('GET', url)).status, 403, 'the URL of a revoked token');
});

// ---------------------------------------------------------------------------------------------
// presigned POST forms (@aws-sdk/s3-presigned-post)

function multipart(fields, file) {
    const boundary = '----bvjs' + Math.random().toString(16).slice(2);
    const parts = [];
    for (const [k, v] of Object.entries(fields)) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`), file.body, Buffer.from(`\r\n--${boundary}--\r\n`));
    return { body: Buffer.concat(parts), type: `multipart/form-data; boundary=${boundary}` };
}

test('post/createPresignedPost-roundtrip', async (t) => {
    const c = client('plain');
    const key = t.key('form/${filename}');
    const { url, fields } = await createPresignedPost(c, {
        Bucket: PB, Key: key, Expires: 300,
        Fields: { 'Content-Type': 'text/plain', 'x-amz-meta-origin': 'js', success_action_status: '201' },
        Conditions: [['content-length-range', 1, 100000], ['starts-with', '$Content-Type', 'text/'], { 'x-amz-meta-origin': 'js' }, { success_action_status: '201' }],
    });
    const data = Buffer.from('browser upload through a presigned POST');
    const mp = multipart(fields, { name: 'hello world.txt', type: 'text/plain', body: data });
    const r = await httpReq('POST', url, { headers: { 'content-type': mp.type, 'content-length': String(mp.body.length) }, body: mp.body });
    eq(r.status, 201, 'POST: ' + r.text.slice(0, 300));
    ok(r.text.includes('<PostResponse'), 'PostResponse document');
    const g = await c.send(new GetObjectCommand({ Bucket: PB, Key: t.key('form/hello world.txt') }));
    eqBuf(await bodyBytes(g), data);
    eq(g.ContentType, 'text/plain');
    eq(g.Metadata, { origin: 'js' });
});

test('post/condition-violations', async (t) => {
    const c = client('plain');
    const { url, fields } = await createPresignedPost(c, { Bucket: PB, Key: t.key('limited'), Expires: 300, Conditions: [['content-length-range', 1, 10]] });
    const small = multipart(fields, { name: 'f', body: Buffer.from('tiny') });
    eq((await httpReq('POST', url, { headers: { 'content-type': small.type }, body: small.body })).status, 204, 'inside the range');
    const big = multipart(fields, { name: 'f', body: Buffer.from('this is more than ten bytes') });
    const r = await httpReq('POST', url, { headers: { 'content-type': big.type }, body: big.body });
    eq(r.status, 400);
    eq(xmlCode(r.text), 'EntityTooLarge');
    const extra = multipart({ ...fields, 'x-amz-meta-sneaky': '1' }, { name: 'f', body: Buffer.from('x') });
    const r2 = await httpReq('POST', url, { headers: { 'content-type': extra.type }, body: extra.body });
    eq(r2.status, 403, 'a field the policy does not cover');
});
