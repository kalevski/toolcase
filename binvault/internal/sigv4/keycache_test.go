package sigv4

import (
	"bytes"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestKeyCacheLRU(t *testing.T) {
	c := NewKeyCache(2)
	k := func(b byte) []byte { return bytes.Repeat([]byte{b}, 32) }
	c.add("a", "s", "d", "r1", k(1))
	c.add("a", "s", "d", "r2", k(2))
	if got, ok := c.get("a", "s", "d", "r1"); !ok || !bytes.Equal(got, k(1)) {
		t.Fatal("r1 missing")
	}
	c.add("a", "s", "d", "r3", k(3)) // evicts r2, the least recently used
	if _, ok := c.get("a", "s", "d", "r2"); ok {
		t.Fatal("r2 should have been evicted")
	}
	for _, r := range []string{"r1", "r3"} {
		if _, ok := c.get("a", "s", "d", r); !ok {
			t.Fatalf("%s missing", r)
		}
	}
	if c.Len() != 2 {
		t.Fatalf("len %d", c.Len())
	}
	if _, ok := c.get("a", "other secret", "d", "r1"); ok {
		t.Fatal("a key derived from another secret was served")
	}
	c.add("a", "s2", "d", "r1", k(9)) // replaces in place
	if got, ok := c.get("a", "s2", "d", "r1"); !ok || !bytes.Equal(got, k(9)) || c.Len() != 2 {
		t.Fatal("replacement failed")
	}
	if _, ok := c.get("a", "s", "d", "r1"); ok {
		t.Fatal("the old secret still matches")
	}
	c.add("a", "s", "d", strings.Repeat("r", maxCachedRegion+1), k(4))
	if c.Len() != 2 {
		t.Fatal("an overlong region was cached")
	}
	c.add("b", "s", "d", "r1", k(5))
	c.Invalidate("a")
	if c.Len() != 1 {
		t.Fatalf("len %d after Invalidate", c.Len())
	}
	if _, ok := c.get("b", "s", "d", "r1"); !ok {
		t.Fatal("Invalidate dropped another key")
	}

	var nilCache *KeyCache
	nilCache.add("a", "s", "d", "r", k(1))
	nilCache.Invalidate("a")
	if _, ok := nilCache.get("a", "s", "d", "r"); ok || nilCache.Len() != 0 {
		t.Fatal("nil cache")
	}
	if d := NewKeyCache(0); d.max != DefaultKeyCacheSize {
		t.Fatalf("default size %d", d.max)
	}
}

func TestKeyCacheWithVerify(t *testing.T) {
	cache := NewKeyCache(8)
	opt := at(tnow)
	opt.Cache = cache
	r := signed(t, "GET", "/bucket/k", bvAKID, bvSecret, "us-east-1", tnow, EmptySHA256)
	wantCode(t, mustErr(verify(r, awsKeys, opt)), "")
	if got, ok := cache.get(bvAKID, bvSecret, "20250115", "us-east-1"); !ok || !bytes.Equal(got, deriveKey(bvSecret, "20250115", "us-east-1")) {
		t.Fatal("verified key not cached")
	}
	// Served from the cache.
	wantCode(t, mustErr(verify(r, awsKeys, opt)), "")

	// Failures are never cached.
	bad := signed(t, "GET", "/bucket/k", bvAKID, "wrong", "eu-x", tnow, EmptySHA256)
	wantCode(t, mustErr(verify(bad, awsKeys, opt)), "SignatureDoesNotMatch")
	p := presigned(t, "GET", "/bucket/k", tnow, time.Hour)
	wantCode(t, mustErr(verify(p, keys(bvAKID, "wrong"), opt)), "SignatureDoesNotMatch")
	if cache.Len() != 1 {
		t.Fatalf("len %d", cache.Len())
	}

	// A rotated secret: the cached key no longer applies.
	rotated := keys(bvAKID, "new-secret")
	r2 := signed(t, "GET", "/bucket/k", bvAKID, "new-secret", "us-east-1", tnow, EmptySHA256)
	wantCode(t, mustErr(verify(r2, rotated, opt)), "")
	wantCode(t, mustErr(verify(r, rotated, opt)), "SignatureDoesNotMatch")
	wantCode(t, mustErr(verify(r, awsKeys, opt)), "")

	// Streaming continues with the key of a cached verification.
	sr := signed(t, "PUT", "/bucket/k", bvAKID, bvSecret, "auto", tnow, StreamingPayload)
	vres, err := verify(sr, awsKeys, opt)
	wantCode(t, err, "")
	vres2, err := verify(sr, awsKeys, opt) // cached this time
	wantCode(t, err, "")
	body := EncodeStream(vres, StreamSigned, []byte("payload"), 3, nil)
	if got, _, err := decode(body, vres2, 0); err != nil || string(got) != "payload" {
		t.Fatalf("%q %v", got, err)
	}
}

func TestKeyCacheConcurrent(t *testing.T) {
	cache := NewKeyCache(4)
	opt := at(tnow)
	opt.Cache = cache
	var reqs []*http.Request
	for i := 0; i < 12; i++ {
		secret := bvSecret
		if i%5 == 4 {
			secret = "wrong"
		}
		reqs = append(reqs, signed(t, "GET", "/bucket/k", bvAKID, secret, "r"+itoa(int64(i%6)), tnow, EmptySHA256))
	}
	var wg sync.WaitGroup
	errs := make(chan string, 1000)
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for i := 0; i < 60; i++ {
				n := (g + i) % len(reqs)
				_, err := verify(reqs[n], awsKeys, opt)
				if (err == nil) != (n%5 != 4) {
					errs <- "request " + itoa(int64(n)) + ": unexpected result"
				}
			}
		}(g)
	}
	wg.Wait()
	close(errs)
	for e := range errs {
		t.Fatal(e)
	}
	if cache.Len() > 4 {
		t.Fatalf("cache grew to %d", cache.Len())
	}
}
