# Merges go_vectors.json, boto_vectors.json and java_vectors.jsonl into
# ../vectors.json, adding alternative wire spellings and storing aws-chunked
# bodies as chunk lines plus tail (payload byte i is i % 251).

import json, base64
from urllib.parse import unquote_to_bytes

def noncanonical(raw_path):
    # Same bytes, different wire spelling: lower-case hex, sub-delims raw,
    # '~' and one letter needlessly escaped.
    b = unquote_to_bytes(raw_path)
    out = []
    for i, c in enumerate(b):
        ch = chr(c)
        if ch.isalnum() and c < 128:
            out.append('%%%02x' % c if (ch == 'p' and i < 12) else ch)
        elif ch in "-_./":
            out.append(ch)
        elif ch in "!$&'()*+,;=:@":
            out.append(ch)
        else:
            out.append('%%%02x' % c)
    return ''.join(out)

vecs = []
for v in json.load(open('go_vectors.json')):
    v['headers'] = v['headers'] or []
    alts = []
    if v['name'] == 'go-odd-key-put-region-auto':
        alts.append(noncanonical(v['request_uri']))
    if v['name'] == 'go-dot-segments-unsigned-payload':
        alts.append('/bucket//a/%2E/../b//c/')
    if v['name'] == 'go-query-plus-is-space':
        alts.append('/bucket?prefix=a+b&list-type=2&delimiter=%2F&empty=&flag&encoding-type=url&start-after=caf%C3%A9%20%2B&max-keys=1000')
        alts.append('/bucket?&max-keys=1000&&start-after=caf%c3%a9+%2b&prefix=a%20b&list-type=2&delimiter=/&empty&flag=&encoding-type=url&')
    if v['name'] == 'go-presign-get-odd-key-auto':
        p, q = v['request_uri'].split('?', 1)
        parts = q.split('&')
        alts.append(noncanonical(p) + '?' + '&'.join(reversed(parts)))
    v['alt_request_uris'] = alts
    vecs.append(v)

for v in json.load(open('boto_vectors.json')):
    v.pop('policy_json', None)
    alts = []
    if v['name'] == 'boto-repeated-params-tab-header':
        alts.append('/bucket?list-type=2&c=x%2by&b&a=1&a=2')
    if v['name'] == 'boto-presign-unicode-week':
        p, q = v['request_uri'].split('?', 1)
        parts = q.split('&')
        parts = [x.replace('%2F', '%2f') if x.startswith('X-Amz-Credential') else x for x in parts]
        alts.append(p + '?' + '&'.join(parts[::-1]))
    if alts:
        v['alt_request_uris'] = alts
    vecs.append(v)

for line in open('java_vectors.jsonl'):
    j = json.loads(line)
    body = base64.b64decode(j['body_b64'])
    n = j['payload_len']
    payload = bytes(i % 251 for i in range(n))
    lines, i, off = [], 0, 0
    while True:
        e = body.index(b'\r\n', i)
        ln = body[i:e]
        lines.append(ln.decode())
        size = int(ln.split(b';')[0], 16)
        i = e + 2
        if size == 0:
            tail = body[i:].decode()
            break
        assert body[i:i+size] == payload[off:off+size]
        off += size
        i += size + 2
    # Reassemble and check.
    rb, off = b'', 0
    for ln in lines[:-1]:
        size = int(ln.split(';')[0], 16)
        rb += ln.encode() + b'\r\n' + payload[off:off+size] + b'\r\n'
        off += size
    rb += lines[-1].encode() + b'\r\n' + tail.encode()
    assert rb == body, j['name']
    hs = [[k, v] for k, v in j['headers'] if k.lower() != 'host']
    host = [v for k, v in j['headers'] if k.lower() == 'host'][0]
    auth = [v for k, v in j['headers'] if k == 'Authorization'][0]
    vecs.append(dict(name=j['name'], source='aws-sdk-java-v2 2.55.10 AwsV4HttpSigner', kind='stream',
                     method='PUT', host=host, request_uri=j['path'], headers=hs,
                     access_key_id='BVKABCDEFGHIJKLMNOPQ', region=j['region'], now='2025-01-15T12:34:56Z',
                     signature=auth.split('Signature=')[1], payload_len=n, chunk_lines=lines, tail=tail))

json.dump(vecs, open('vectors.json', 'w'),
          indent=1, ensure_ascii=False)
print(len(vecs), 'vectors')
for v in vecs: print(' ', v['kind'], v['name'], v.get('alt_request_uris', ''))
