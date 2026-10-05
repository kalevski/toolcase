package seal

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
)

// testKey returns a distinct, deterministic 32-byte key per seed.
func testKey(seed string) []byte {
	sum := sha256.Sum256([]byte("binvault seal test key " + seed))
	return sum[:]
}

// refID computes a key id independently of the package.
func refID(key []byte) KeyID {
	sum := sha256.Sum256(key)
	return KeyID{sum[0], sum[1], sum[2], sum[3]}
}

func mustRing(t *testing.T, current []byte, old ...[]byte) *Keyring {
	t.Helper()
	r, err := New(current, old...)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return r
}

func TestKeyID(t *testing.T) {
	k := testKey("a")
	r := mustRing(t, k)
	id := r.CurrentID()
	if want := refID(k); id != want {
		t.Fatalf("CurrentID = %v, want first 4 bytes of SHA-256(key) %v", id, want)
	}
	s := id.String()
	if len(s) != 8 || s != strings.ToLower(s) || s != hex.EncodeToString(id[:]) {
		t.Fatalf("String = %q, want 8 lower-case hex chars", s)
	}

	parse := []struct {
		in   string
		want KeyID
		ok   bool
	}{
		{s, id, true},
		{strings.ToUpper(s), id, true},
		{"00000000", KeyID{}, true},
		{"0a0B0c0D", KeyID{0x0a, 0x0b, 0x0c, 0x0d}, true},
		{"", KeyID{}, false},
		{"abc", KeyID{}, false},
		{"zzzzzzzz", KeyID{}, false},
		{"123456789", KeyID{}, false},
		{"1234567", KeyID{}, false},
		{" 1234567", KeyID{}, false},
	}
	for _, tc := range parse {
		got, err := ParseKeyID(tc.in)
		if (err == nil) != tc.ok || got != tc.want {
			t.Errorf("ParseKeyID(%q) = %v, %v; want %v ok=%v", tc.in, got, err, tc.want, tc.ok)
		}
	}

	ids := mustRing(t, testKey("a"), testKey("b")).IDs()
	js, err := json.Marshal(ids)
	if err != nil {
		t.Fatal(err)
	}
	want := fmt.Sprintf(`[%q,%q]`, ids[0], ids[1])
	if string(js) != want {
		t.Fatalf("json = %s, want %s", js, want)
	}
	var back []KeyID
	if err := json.Unmarshal(js, &back); err != nil || len(back) != 2 || back[0] != ids[0] || back[1] != ids[1] {
		t.Fatalf("json round trip = %v, %v", back, err)
	}
	if err := json.Unmarshal([]byte(`["nothex!!"]`), &back); err == nil {
		t.Fatal("bad key id accepted by UnmarshalText")
	}
}

func TestRoundTrip(t *testing.T) {
	r := mustRing(t, testKey("current"), testKey("old"))
	big := make([]byte, MaxPlaintext)
	if _, err := rand.Read(big); err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name, recordType, id string
		plaintext            []byte
	}{
		{"empty", "token", "BVK0000000000000000", []byte{}},
		{"nil", "token", "BVK0000000000000001", nil},
		{"one byte", "token", "BVK0000000000000002", []byte{0}},
		{"token secret", "token", "BVKABCDEFGHIJKLMNOP", []byte("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY")},
		{"bucket data key", "bucket_key", "photos", testKey("data key")},
		{"header value", "pipeline_header", "thumbs/Authorization", []byte("Bearer abc.def.ghi")},
		{"id with colons", "pipeline_signing", "a:b:c", []byte("signing secret of at least 32 chars!")},
		{"binary with NULs", "t", "x", bytes.Repeat([]byte{0, 1, 0, 255}, 1024)},
		{"max size", "t", "big", big},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sealed, err := r.Seal(tc.recordType, tc.id, tc.plaintext)
			if err != nil {
				t.Fatalf("Seal: %v", err)
			}
			if len(sealed) != Overhead+len(tc.plaintext) {
				t.Fatalf("len = %d, want %d", len(sealed), Overhead+len(tc.plaintext))
			}
			if kid, err := SealedKeyID(sealed); err != nil || kid != r.CurrentID() {
				t.Fatalf("SealedKeyID = %v, %v; want %v", kid, err, r.CurrentID())
			}
			got, err := r.Open(tc.recordType, tc.id, sealed)
			if err != nil {
				t.Fatalf("Open: %v", err)
			}
			if got == nil || !bytes.Equal(got, tc.plaintext) {
				t.Fatalf("Open = %d bytes (nil=%v), want %d", len(got), got == nil, len(tc.plaintext))
			}
		})
	}
	if _, err := r.Seal("t", "x", make([]byte, MaxPlaintext+1)); err == nil {
		t.Fatal("Seal accepted more than MaxPlaintext")
	}
}

// TestReferenceFormat pins the documented layout and associated data with an
// independent implementation, in both directions.
func TestReferenceFormat(t *testing.T) {
	k := testKey("ref")
	r := mustRing(t, k)
	block, err := aes.NewCipher(k)
	if err != nil {
		t.Fatal(err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatal(err)
	}
	secret := []byte("the raw SigV4 secret")
	aad := []byte("token:BVK1")
	id := refID(k)

	nonce := make([]byte, 12)
	if _, err := rand.Read(nonce); err != nil {
		t.Fatal(err)
	}
	ref := append(append(append([]byte{}, id[:]...), nonce...), gcm.Seal(nil, nonce, secret, aad)...)
	got, err := r.Open("token", "BVK1", ref)
	if err != nil || !bytes.Equal(got, secret) {
		t.Fatalf("Open(reference) = %q, %v", got, err)
	}

	sealed, err := r.Seal("token", "BVK1", secret)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(sealed[:4], id[:]) {
		t.Fatalf("key id prefix = %x, want %x", sealed[:4], id[:])
	}
	plain, err := gcm.Open(nil, sealed[4:16], sealed[16:], aad)
	if err != nil || !bytes.Equal(plain, secret) {
		t.Fatalf("reference open = %q, %v", plain, err)
	}
}

func TestRecordBinding(t *testing.T) {
	r := mustRing(t, testKey("bind"))
	sealed, err := r.Seal("token", "BVKA", []byte("secret"))
	if err != nil {
		t.Fatal(err)
	}
	wrong := []struct{ recordType, id string }{
		{"token", "BVKB"},
		{"token", "BVKA "},
		{"token", "bvka"},
		{"tokens", "BVKA"},
		{"Token", "BVKA"},
		{"bucket_key", "BVKA"},
		{"pipeline_header", "BVKA"},
	}
	for _, w := range wrong {
		if got, err := r.Open(w.recordType, w.id, sealed); !errors.Is(err, ErrCorrupt) || got != nil {
			t.Errorf("Open(%q, %q) = %q, %v; want ErrCorrupt", w.recordType, w.id, got, err)
		}
	}

	// "a"+":"+"b:c" must not be reachable as "a:b"+":"+"c": record types
	// with ':' are refused, so the associated data is unambiguous.
	s2, err := r.Seal("a", "b:c", []byte("x"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.Open("a:b", "c", s2); err == nil {
		t.Fatal("ambiguous record split accepted")
	}

	invalid := []struct{ recordType, id string }{
		{"", "x"},
		{"a:b", "c"},
		{":", "x"},
		{"token", ""},
	}
	for _, iv := range invalid {
		if _, err := r.Seal(iv.recordType, iv.id, []byte("x")); err == nil {
			t.Errorf("Seal(%q, %q) accepted", iv.recordType, iv.id)
		}
		_, err := r.Open(iv.recordType, iv.id, sealed)
		if err == nil || errors.Is(err, ErrCorrupt) || errors.Is(err, ErrUnknownKey) {
			t.Errorf("Open(%q, %q) = %v; want a usage error", iv.recordType, iv.id, err)
		}
	}
}

func TestTamper(t *testing.T) {
	k1, k2 := testKey("t1"), testKey("t2")
	r := mustRing(t, k1, k2)
	secret := []byte("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY")
	sealed, err := r.Seal("token", "BVKT", secret)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.Open("token", "BVKT", sealed); err != nil {
		t.Fatal(err)
	}

	regions := []struct {
		name     string
		from, to int
		want     error
	}{
		{"key id", 0, 4, ErrUnknownKey},
		{"nonce", 4, 16, ErrCorrupt},
		{"ciphertext", 16, 16 + len(secret), ErrCorrupt},
		{"tag", 16 + len(secret), len(sealed), ErrCorrupt},
	}
	for _, rg := range regions {
		t.Run(rg.name, func(t *testing.T) {
			for i := rg.from; i < rg.to; i++ {
				for bit := 0; bit < 8; bit++ {
					mod := bytes.Clone(sealed)
					mod[i] ^= 1 << bit
					got, err := r.Open("token", "BVKT", mod)
					if !errors.Is(err, rg.want) || got != nil {
						t.Fatalf("byte %d bit %d: Open = %q, %v; want %v", i, bit, got, err, rg.want)
					}
				}
			}
		})
	}

	t.Run("truncated", func(t *testing.T) {
		for n := 0; n < len(sealed); n++ {
			if got, err := r.Open("token", "BVKT", sealed[:n]); !errors.Is(err, ErrCorrupt) || got != nil {
				t.Fatalf("len %d: Open = %q, %v; want ErrCorrupt", n, got, err)
			}
			if n < Overhead {
				if _, err := SealedKeyID(sealed[:n]); !errors.Is(err, ErrCorrupt) {
					t.Fatalf("len %d: SealedKeyID err = %v", n, err)
				}
			}
		}
	})
	t.Run("extended", func(t *testing.T) {
		mod := append(bytes.Clone(sealed), 0)
		if _, err := r.Open("token", "BVKT", mod); !errors.Is(err, ErrCorrupt) {
			t.Fatalf("Open = %v; want ErrCorrupt", err)
		}
		huge := make([]byte, Overhead+MaxPlaintext+1)
		copy(huge, sealed[:4])
		if _, err := r.Open("token", "BVKT", huge); !errors.Is(err, ErrCorrupt) {
			t.Fatalf("oversized Open = %v; want ErrCorrupt", err)
		}
		if _, err := SealedKeyID(huge); !errors.Is(err, ErrCorrupt) {
			t.Fatalf("oversized SealedKeyID = %v; want ErrCorrupt", err)
		}
	})
	t.Run("key id swapped to another ring key", func(t *testing.T) {
		mod := bytes.Clone(sealed)
		id2 := refID(k2)
		copy(mod, id2[:])
		if _, err := r.Open("token", "BVKT", mod); !errors.Is(err, ErrCorrupt) {
			t.Fatalf("Open = %v; want ErrCorrupt", err)
		}
	})
}

func TestRotation(t *testing.T) {
	k1, k2 := testKey("rot1"), testKey("rot2")
	secret := []byte("token secret")

	before := mustRing(t, k1)
	s1, err := before.Seal("token", "BVKR", secret)
	if err != nil {
		t.Fatal(err)
	}

	// Restart with the new key current and the previous one old.
	during := mustRing(t, k2, k1)
	if during.CurrentID() != refID(k2) || !during.Can(refID(k1)) {
		t.Fatal("rotated ring has the wrong keys")
	}
	if got, err := during.Open("token", "BVKR", s1); err != nil || !bytes.Equal(got, secret) {
		t.Fatalf("old value under rotated ring = %q, %v", got, err)
	}

	// rekey moves it to the current key.
	s2, changed, err := during.Reseal("token", "BVKR", s1)
	if err != nil || !changed {
		t.Fatalf("Reseal = changed %v, %v", changed, err)
	}
	if kid, _ := SealedKeyID(s2); kid != refID(k2) {
		t.Fatalf("resealed under %v, want %v", kid, refID(k2))
	}
	if got, err := during.Open("token", "BVKR", s2); err != nil || !bytes.Equal(got, secret) {
		t.Fatalf("Open(resealed) = %q, %v", got, err)
	}
	if _, err := during.Open("token", "BVKX", s2); !errors.Is(err, ErrCorrupt) {
		t.Fatalf("resealed value lost its record binding: %v", err)
	}

	// A second rekey changes nothing and hands the value back as is.
	s3, changed, err := during.Reseal("token", "BVKR", s2)
	if err != nil || changed || &s3[0] != &s2[0] {
		t.Fatalf("Reseal of a current value = changed %v, same %v, %v", changed, &s3[0] == &s2[0], err)
	}

	// The old key can now be dropped.
	after := mustRing(t, k2)
	if got, err := after.Open("token", "BVKR", s2); err != nil || !bytes.Equal(got, secret) {
		t.Fatalf("Open after dropping the old key = %q, %v", got, err)
	}
	if _, err := after.Open("token", "BVKR", s1); !errors.Is(err, ErrUnknownKey) {
		t.Fatalf("value under a dropped key: %v; want ErrUnknownKey", err)
	}
	if !strings.Contains(fmt.Sprint(after.Open("token", "BVKR", s1)), refID(k1).String()) {
		t.Fatal("ErrUnknownKey does not name the missing key id")
	}
	if out, changed, err := after.Reseal("token", "BVKR", s1); !errors.Is(err, ErrUnknownKey) || out != nil || changed {
		t.Fatalf("Reseal under a dropped key = %v, %v, %v; want ErrUnknownKey", out, changed, err)
	}
	// And a node still on the old key alone cannot open the new value.
	if _, err := before.Open("token", "BVKR", s2); !errors.Is(err, ErrUnknownKey) {
		t.Fatalf("old ring opened a value under the new key: %v", err)
	}
	// Reseal never rewrites a value it cannot open.
	bad := bytes.Clone(s1)
	bad[len(bad)-1] ^= 1
	if out, changed, err := during.Reseal("token", "BVKR", bad); !errors.Is(err, ErrCorrupt) || out != nil || changed {
		t.Fatalf("Reseal(corrupt) = %v, %v, %v; want ErrCorrupt", out, changed, err)
	}
	if out, _, err := during.Reseal("token", "BVKZ", s1); !errors.Is(err, ErrCorrupt) || out != nil {
		t.Fatalf("Reseal(wrong record) = %v, %v; want ErrCorrupt", out, err)
	}
}

// TestClusterRotation walks the three-step key roll of §4.7: at every step,
// whatever any node seals, every node can open.
func TestClusterRotation(t *testing.T) {
	k1, k2 := testKey("c1"), testKey("c2")
	steps := [][]*Keyring{
		{mustRing(t, k1), mustRing(t, k1)},         // start
		{mustRing(t, k1, k2), mustRing(t, k1)},     // (1) node a adds k2 as old
		{mustRing(t, k1, k2), mustRing(t, k1, k2)}, // (1) done on every node
		{mustRing(t, k2, k1), mustRing(t, k1, k2)}, // (2) node a switches
		{mustRing(t, k2, k1), mustRing(t, k2, k1)}, // (2) done on every node
		{mustRing(t, k2), mustRing(t, k2, k1)},     // (3) a rekeyed, dropped k1
		{mustRing(t, k2), mustRing(t, k2)},         // (3) done
	}
	for i, nodes := range steps {
		for from, sealer := range nodes {
			s, err := sealer.Seal("pipeline_signing", "thumbs", []byte("secret"))
			if err != nil {
				t.Fatal(err)
			}
			for to, opener := range nodes {
				if _, err := opener.Open("pipeline_signing", "thumbs", s); err != nil {
					t.Errorf("step %d: node %d cannot open what node %d sealed: %v", i, to, from, err)
				}
			}
		}
	}
}

func TestIDsAndCan(t *testing.T) {
	k1, k2, k3, k4 := testKey("i1"), testKey("i2"), testKey("i3"), testKey("i4")
	r := mustRing(t, k3, k1, k2)
	ids := r.IDs()
	want := []KeyID{refID(k3), refID(k1), refID(k2)}
	if len(ids) != len(want) {
		t.Fatalf("IDs = %v, want %v", ids, want)
	}
	for i := range want {
		if ids[i] != want[i] {
			t.Fatalf("IDs = %v, want %v (current first)", ids, want)
		}
		if !r.Can(want[i]) {
			t.Fatalf("Can(%v) = false", want[i])
		}
	}
	if r.CurrentID() != refID(k3) {
		t.Fatalf("CurrentID = %v", r.CurrentID())
	}
	if r.Can(refID(k4)) || r.Can(KeyID{}) {
		t.Fatal("Can reports a key the ring does not hold")
	}
	ids[0] = KeyID{}
	if r.IDs()[0] != refID(k3) {
		t.Fatal("IDs exposes the ring's internal slice")
	}
	if one := mustRing(t, k4).IDs(); len(one) != 1 || one[0] != refID(k4) {
		t.Fatalf("single-key IDs = %v", one)
	}
}

func TestNewErrors(t *testing.T) {
	k1, k2 := testKey("n1"), testKey("n2")
	cases := []struct {
		name    string
		current []byte
		old     [][]byte
	}{
		{"nil current", nil, nil},
		{"empty current", []byte{}, nil},
		{"16-byte current", k1[:16], nil},
		{"31-byte current", k1[:31], nil},
		{"33-byte current", append(bytes.Clone(k1), 0), nil},
		{"64-byte current", append(bytes.Clone(k1), k2...), nil},
		{"all-zero current", make([]byte, 32), nil},
		{"short old", k1, [][]byte{k2[:31]}},
		{"nil old", k1, [][]byte{nil}},
		{"all-zero old", k1, [][]byte{make([]byte, 32)}},
		{"old repeats current", k1, [][]byte{bytes.Clone(k1)}},
		{"old repeats old", k1, [][]byte{k2, bytes.Clone(k2)}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r, err := New(tc.current, tc.old...)
			if err == nil || r != nil {
				t.Fatalf("New = %v, %v; want an error", r, err)
			}
			t.Logf("error: %v", err)
			for _, key := range append([][]byte{tc.current}, tc.old...) {
				if len(key) >= 8 && (strings.Contains(err.Error(), hex.EncodeToString(key[:8])) ||
					strings.Contains(err.Error(), base64.StdEncoding.EncodeToString(key)[:8])) {
					t.Fatalf("error leaks key material: %v", err)
				}
			}
		})
	}
	if _, err := New(k1, k2, testKey("n3")); err != nil {
		t.Fatalf("valid ring refused: %v", err)
	}
}

func TestParse(t *testing.T) {
	// A key whose base64 has '+' and '/' (std) or '-' and '_' (URL-safe).
	special := bytes.Repeat([]byte{0xfb, 0xef, 0xbe, 0xff, 0xff, 0xff}, 6)[:32]
	k1, k2 := testKey("p1"), testKey("p2")
	std := base64.StdEncoding.EncodeToString
	if s := std(special); !strings.ContainsAny(s, "+/") {
		t.Fatalf("test key %q lacks std-only characters", s)
	}

	ok := []struct {
		name, master, old string
		want              [][]byte
	}{
		{"std padded", std(k1), "", [][]byte{k1}},
		{"raw std", base64.RawStdEncoding.EncodeToString(special), "", [][]byte{special}},
		{"std special", std(special), "", [][]byte{special}},
		{"url padded", base64.URLEncoding.EncodeToString(special), "", [][]byte{special}},
		{"raw url", base64.RawURLEncoding.EncodeToString(special), "", [][]byte{special}},
		{"whitespace and newline (_FILE)", "  " + std(k1) + "\n", " \n", [][]byte{k1}},
		{"one old", std(k2), std(k1), [][]byte{k2, k1}},
		{"two old, spaced", std(k2), " " + std(k1) + " ,\t" + std(special) + "\n", [][]byte{k2, k1, special}},
		{"empty entries skipped", std(k2), "," + std(k1) + ",, ," + base64.RawURLEncoding.EncodeToString(special) + ",", [][]byte{k2, k1, special}},
	}
	for _, tc := range ok {
		t.Run(tc.name, func(t *testing.T) {
			r, err := Parse(tc.master, tc.old)
			if err != nil {
				t.Fatalf("Parse: %v", err)
			}
			ids := r.IDs()
			if len(ids) != len(tc.want) {
				t.Fatalf("IDs = %v, want %d keys", ids, len(tc.want))
			}
			for i, key := range tc.want {
				if ids[i] != refID(key) {
					t.Fatalf("key %d id = %v, want %v", i, ids[i], refID(key))
				}
			}
		})
	}

	hexKey := hex.EncodeToString(k1) // the `openssl rand -hex 32` mistake
	bad := []struct {
		name, master, old, wantText string
	}{
		{"empty master", "", "", "master key is empty"},
		{"blank master", " \n ", "", "master key is empty"},
		{"not base64", "this is not base64 at all!!", "", "not valid base64"},
		{"16 bytes", std(k1[:16]), "", "decodes to 16 bytes"},
		{"33 bytes", std(append(bytes.Clone(k1), 1)), "", "decodes to 33 bytes"},
		{"hex instead of base64", hexKey, "", "decodes to 48 bytes"},
		{"zero key", std(make([]byte, 32)), "", "all zero"},
		{"too long", strings.Repeat("A", 400), "", "too long"},
		{"bad old entry", std(k2), std(k1) + ",not-base64!!", "old master key 2"},
		{"short old entry", std(k2), std(k1[:8]), "old master key 1"},
		{"position counts empty entries", std(k2), ",," + std(k1[:8]), "old master key 3"},
		{"old repeats master", std(k1), std(k2) + "," + base64.RawURLEncoding.EncodeToString(k1), "more than once"},
	}
	for _, tc := range bad {
		t.Run(tc.name, func(t *testing.T) {
			r, err := Parse(tc.master, tc.old)
			if err == nil || r != nil {
				t.Fatalf("Parse = %v, %v; want an error", r, err)
			}
			t.Logf("error: %v", err)
			if !strings.Contains(err.Error(), tc.wantText) {
				t.Fatalf("error %q does not mention %q", err, tc.wantText)
			}
			for _, field := range append(strings.Split(tc.old, ","), tc.master) {
				if field = strings.TrimSpace(field); len(field) >= 8 && strings.Contains(err.Error(), field[:8]) {
					t.Fatalf("error leaks configured key text: %v", err)
				}
			}
		})
	}
}

func TestNoncesDiffer(t *testing.T) {
	r := mustRing(t, testKey("nonce"))
	const n = 2000
	nonces := make(map[string]bool, n)
	outputs := make(map[string]bool, n)
	for i := 0; i < n; i++ {
		s, err := r.Seal("token", "BVKN", []byte("same secret every time"))
		if err != nil {
			t.Fatal(err)
		}
		if nonces[string(s[4:16])] || outputs[string(s)] {
			t.Fatalf("seal %d repeated a nonce or an output", i)
		}
		nonces[string(s[4:16])] = true
		outputs[string(s)] = true
	}
}

func TestEmptyRing(t *testing.T) {
	for _, r := range []*Keyring{nil, {}} {
		if _, err := r.Seal("t", "x", []byte("a")); err == nil {
			t.Error("Seal on an empty ring succeeded")
		}
		if _, err := r.Open("t", "x", make([]byte, Overhead)); err == nil {
			t.Error("Open on an empty ring succeeded")
		}
		if _, _, err := r.Reseal("t", "x", make([]byte, Overhead)); err == nil {
			t.Error("Reseal on an empty ring succeeded")
		}
		if r.Can(KeyID{}) || len(r.IDs()) != 0 || r.CurrentID() != (KeyID{}) {
			t.Error("empty ring reports keys")
		}
	}
}

func TestConcurrentUse(t *testing.T) {
	r := mustRing(t, testKey("cc1"), testKey("cc2"))
	old := mustRing(t, testKey("cc2"))
	legacy, err := old.Seal("token", "BVKC", []byte("legacy"))
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for g := 0; g < 8; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for i := 0; i < 300; i++ {
				id := fmt.Sprintf("BVK%d-%d", g, i)
				want := []byte(id + " secret")
				s, err := r.Seal("token", id, want)
				if err != nil {
					errs <- err
					return
				}
				got, err := r.Open("token", id, s)
				if err != nil || !bytes.Equal(got, want) {
					errs <- fmt.Errorf("open %s: %q, %v", id, got, err)
					return
				}
				if _, changed, err := r.Reseal("token", "BVKC", legacy); err != nil || !changed {
					errs <- fmt.Errorf("reseal: %v %v", changed, err)
					return
				}
			}
		}(g)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatal(err)
	}
}
