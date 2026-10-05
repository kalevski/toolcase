// Command load is binvault's load and robustness test (spec 12): a 1 GiB multipart object with RSS sampling of the server, 20,000
// small objects with 16 workers, listings of 20,000 keys with delimiter paging, and kill -9 during uploads followed by
// `binvault validate --deep`. It starts nodes of its own, prints numbers, and fails only on functional properties:
// bytes in = bytes out, no partial object ever visible, acknowledged writes survive, memory independent of the object size.
//
//	load -bin ./binvault [-scale 1.0] [-only bigmpu,small,kill] [-work DIR]
//
// Results are printed in the harness protocol: "@@RESULT<TAB>STATUS<TAB>load/<case><TAB>detail"; lines starting with '#' are numbers.
package main

import (
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

const (
	KiB = 1 << 10
	MiB = 1 << 20
	GiB = 1 << 30
)

var (
	binPath string
	scale   float64
	workDir string
	failed  int
)

func result(status, name, detail string) {
	detail = strings.NewReplacer("\t", " ", "\n", " ", "\r", " ").Replace(detail)
	if len(detail) > 600 {
		detail = detail[:600]
	}
	if status == "FAIL" {
		failed++
	}
	fmt.Printf("@@RESULT\t%s\tload/%s\t%s\n", status, name, detail)
}
func pass(name, detail string) { result("PASS", name, detail) }
func fail(name string, format string, a ...any) {
	result("FAIL", name, fmt.Sprintf(format, a...))
}
func skip(name, why string)        { result("SKIP", name, why) }
func info(format string, a ...any) { fmt.Printf("# "+format+"\n", a...) }
func check(name string, ok bool, format string, a ...any) {
	if ok {
		pass(name, "")
	} else {
		fail(name, format, a...)
	}
}

func envFloat(name string, def float64) float64 {
	if v := os.Getenv(name); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f > 0 {
			return f
		}
	}
	return def
}

func freeDiskBytes(dir string) int64 {
	var st syscall.Statfs_t
	if err := syscall.Statfs(dir, &st); err != nil {
		return -1
	}
	return int64(st.Bavail) * int64(st.Bsize)
}

func main() {
	bin := flag.String("bin", os.Getenv("BV_BIN"), "path of the binvault binary")
	flag.Float64Var(&scale, "scale", envFloat("BV_LOAD_SCALE", 1.0), "size factor (1.0 = 1 GiB object, 20,000 small objects)")
	only := flag.String("only", os.Getenv("BV_LOAD_ONLY"), "comma separated subset: bigmpu,small,kill")
	work := flag.String("work", os.Getenv("BV_LOAD_DIR"), "directory for the nodes' data (default: a temp dir)")
	flag.Parse()
	if *bin == "" {
		fmt.Fprintln(os.Stderr, "load: -bin (or BV_BIN) is required")
		os.Exit(2)
	}
	abs, err := filepath.Abs(*bin)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	binPath = abs
	if *work == "" {
		*work, err = os.MkdirTemp("", "binvault-load-")
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
	} else if err := os.MkdirAll(*work, 0o755); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	workDir = *work
	defer os.RemoveAll(workDir)

	need := int64(float64(5*GiB) * scale)
	if free := freeDiskBytes(workDir); free >= 0 && free < need {
		info("only %d MiB free under %s: scale %.2f needs about %d MiB; scaling down", free/MiB, workDir, scale, need/MiB)
		scale = scale * float64(free) / float64(need) * 0.8
		if scale < 0.02 {
			skip("all", fmt.Sprintf("not enough free disk space (%d MiB)", free/MiB))
			return
		}
	}
	want := map[string]bool{}
	for _, s := range strings.Split(*only, ",") {
		if s = strings.TrimSpace(s); s != "" {
			want[s] = true
		}
	}
	run := func(name string, fn func()) {
		if len(want) > 0 && !want[name] {
			return
		}
		t0 := time.Now()
		info("== %s (scale %.2f)", name, scale)
		fn()
		info("== %s took %s", name, time.Since(t0).Round(time.Millisecond))
	}
	run("bigmpu", scenBigMPU)
	run("small", scenSmallAndList)
	run("kill", scenKill)
	if failed > 0 {
		os.Exit(1)
	}
}

// ---------------------------------------------------------------------------------------------------------------------
// 1 GiB multipart object: memory stays flat, bytes in == bytes out

func scenBigMPU() {
	size := int64(float64(GiB) * scale)
	if size < 64*MiB {
		size = 64 * MiB
	}
	nparts := int64(16)
	partSize := (size/nparts + MiB - 1) / MiB * MiB
	if partSize < 5*MiB {
		partSize = 5 * MiB
	}
	nparts = (size + partSize - 1) / partSize
	n := newNode(binPath, filepath.Join(workDir, "big"), false)
	if err := n.start(); err != nil {
		fail("bigmpu/start", "%v", err)
		return
	}
	defer n.stop()
	c, err := n.bucket("load-big", nil)
	if err != nil {
		fail("bigmpu/bucket", "%v", err)
		return
	}
	idle := readRSS(n.pid())
	rs := sampleRSS(n.pid())
	const seed = 0xB16
	key := "big/object.bin"

	// ---- upload
	t0 := time.Now()
	uid, err := c.createMPU(key)
	if err != nil {
		fail("bigmpu/create", "%v", err)
		return
	}
	etags := make([]string, nparts)
	var wg sync.WaitGroup
	sem := make(chan struct{}, 4)
	var uploadErr atomic.Value
	for i := int64(0); i < nparts; i++ {
		wg.Add(1)
		sem <- struct{}{}
		go func(i int64) {
			defer wg.Done()
			defer func() { <-sem }()
			off := i * partSize
			ln := partSize
			if off+ln > size {
				ln = size - off
			}
			et, err := c.uploadPart(key, uid, int(i)+1, newGenAt(seed, off, ln), ln)
			if err != nil {
				uploadErr.Store(err)
				return
			}
			etags[i] = et
		}(i)
	}
	wg.Wait()
	if e := uploadErr.Load(); e != nil {
		fail("bigmpu/upload-parts", "%v", e)
		return
	}
	tParts := time.Since(t0)
	var parts []part
	for i := int64(0); i < nparts; i++ {
		parts = append(parts, part{int(i) + 1, etags[i]})
	}
	t1 := time.Now()
	etag, err := c.completeMPU(key, uid, parts)
	if err != nil {
		fail("bigmpu/complete", "%v", err)
		return
	}
	tComplete := time.Since(t1)
	info("upload of %d MiB in %d parts of %d MiB: parts %s (%.0f MiB/s), complete %s", size/MiB, nparts, partSize/MiB, tParts.Round(time.Millisecond), float64(size)/MiB/tParts.Seconds(), tComplete.Round(time.Millisecond))
	// expected composite ETag
	h := md5.New()
	for i := int64(0); i < nparts; i++ {
		raw, _ := hex.DecodeString(etags[i])
		h.Write(raw)
	}
	wantETag := fmt.Sprintf("%x-%d", h.Sum(nil), nparts)
	check("bigmpu/etag-is-the-composite-md5", etag == wantETag, "ETag %q, want %q", etag, wantETag)
	for i := int64(0); i < nparts; i++ {
		off, ln := i*partSize, partSize
		if off+ln > size {
			ln = size - off
		}
		if want := md5Of(seed, off, ln); etags[i] != want {
			fail("bigmpu/part-etags", "part %d: ETag %s, md5 of what was sent %s", i+1, etags[i], want)
			return
		}
	}
	pass("bigmpu/part-etags", "")
	st, ln, err := c.head(key)
	check("bigmpu/head-size", err == nil && st == 200 && ln == size, "HEAD %d length %d (want %d) %v", st, ln, size, err)

	// ---- download
	t2 := time.Now()
	hs := sha256.New()
	cw := &countWriter{w: hs}
	if st, err := c.get(key, "", cw); err != nil || st != 200 {
		fail("bigmpu/download", "GET: %d %v", st, err)
		return
	}
	tGet := time.Since(t2)
	wantSum := sha256Of(seed, 0, size)
	check("bigmpu/download-bytes", cw.n == size, "downloaded %d bytes, want %d", cw.n, size)
	check("bigmpu/download-sha256", hex.EncodeToString(hs.Sum(nil)) == wantSum, "sha256 differs after a %d byte download", cw.n)
	info("download of %d MiB in %s (%.0f MiB/s)", size/MiB, tGet.Round(time.Millisecond), float64(size)/MiB/tGet.Seconds())

	// ---- ranged reads across part boundaries
	rng := rand.New(rand.NewSource(7))
	bad := 0
	for i := 0; i < 24; i++ {
		var a, b int64
		if i < 8 { // straddle a part boundary
			bnd := (int64(i%int(nparts-1)) + 1) * partSize
			a, b = bnd-int64(rng.Intn(100000)+1), bnd+int64(rng.Intn(100000))
		} else {
			a = rng.Int63n(size - 1)
			b = a + int64(rng.Intn(2*MiB))
		}
		if b >= size {
			b = size - 1
		}
		var buf sinkBuf
		if st, err := c.get(key, fmt.Sprintf("bytes=%d-%d", a, b), &buf); err != nil || st != 206 {
			bad++
			continue
		}
		want := make([]byte, b-a+1)
		fillAt(want, seed, a)
		if string(buf.b) != string(want) {
			bad++
		}
	}
	check("bigmpu/ranged-reads", bad == 0, "%d of 24 ranged reads returned wrong bytes", bad)

	peak := rs.finish()
	info("server RSS: idle %d MiB, peak %d MiB while moving %d MiB (object size %d MiB)", idle/1024, peak/1024, size/MiB, size/MiB)
	if size >= 512*MiB {
		check("bigmpu/memory-is-independent-of-the-object-size", peak*1024 < size/2, "server RSS peaked at %d MiB for a %d MiB object", peak/1024, size/MiB)
	} else {
		skip("bigmpu/memory-is-independent-of-the-object-size", fmt.Sprintf("object of %d MiB is too small to tell; peak RSS %d MiB", size/MiB, peak/1024))
	}

	// ---- one more with a single PUT of a quarter of the size (Content-Length body streamed straight to disk)
	psz := size / 4
	rs2 := sampleRSS(n.pid())
	t3 := time.Now()
	g := newGen(0x51, psz)
	g.h = sha256.New()
	et, err := c.put("big/single.bin", g, psz)
	if err != nil {
		fail("bigmpu/single-put", "%v", err)
		rs2.finish()
		return
	}
	peak2 := rs2.finish()
	check("bigmpu/single-put-etag", et == md5Of(0x51, 0, psz), "ETag %s", et)
	info("single PUT of %d MiB in %s (%.0f MiB/s), RSS peak %d MiB", psz/MiB, time.Since(t3).Round(time.Millisecond), float64(psz)/MiB/time.Since(t3).Seconds(), peak2/1024)
	hs2 := sha256.New()
	if st, err := c.get("big/single.bin", "", hs2); err != nil || st != 200 {
		fail("bigmpu/single-get", "%d %v", st, err)
		return
	}
	check("bigmpu/single-roundtrip", hex.EncodeToString(hs2.Sum(nil)) == sha256Of(0x51, 0, psz), "sha256 differs")
	dataBytes := dirBytes(n.data)
	info("data dir holds %d MiB for two objects of %d + %d MiB", dataBytes/MiB, size/MiB, psz/MiB)
	_ = c.del(key)
	_ = c.del("big/single.bin")
	code, out := n.cli("validate", "--deep")
	check("bigmpu/validate-deep", code == 0, "binvault validate --deep exited %d: %s", code, out)
}

type countWriter struct {
	w io.Writer
	n int64
}

func (c *countWriter) Write(p []byte) (int, error) { c.n += int64(len(p)); return c.w.Write(p) }

type sinkBuf struct{ b []byte }

func (s *sinkBuf) Write(p []byte) (int, error) { s.b = append(s.b, p...); return len(p), nil }

// ---------------------------------------------------------------------------------------------------------------------
// 20,000 small objects, then listings of them

var unicodeRanges = [][2]rune{{0x20, 0x7e}, {0xa1, 0xff}, {0x100, 0x17f}, {0x370, 0x3ff}, {0x400, 0x4ff}, {0x5d0, 0x5ea}, {0x4e00, 0x4e50}, {0x3040, 0x3090}, {0xff61, 0xff9f}, {0x1f300, 0x1f330}, {0x10000, 0x10020}, {0x20000, 0x20010}}

func oddName(i int, rng *rand.Rand) string {
	var b strings.Builder
	for j := 0; j < 3; j++ {
		r := unicodeRanges[rng.Intn(len(unicodeRanges))]
		ch := r[0] + rune(rng.Intn(int(r[1]-r[0])+1))
		if ch == '/' || ch == '%' || ch < 0x20 {
			ch = 'x'
		}
		b.WriteRune(ch)
	}
	return fmt.Sprintf("%s-%04d", b.String(), i) // the index keeps every name unique
}

func scenSmallAndList() {
	total := int(20000 * scale)
	if total < 1500 {
		total = 1500
	}
	n := newNode(binPath, filepath.Join(workDir, "small"), false)
	if err := n.start(); err != nil {
		fail("small/start", "%v", err)
		return
	}
	defer n.stop()
	c, err := n.bucket("load-small", nil)
	if err != nil {
		fail("small/bucket", "%v", err)
		return
	}
	rng := rand.New(rand.NewSource(11))
	nU, nR := total/20, total/20
	nN := total - nU - nR
	var keys []string
	for i := 0; i < nN; i++ {
		keys = append(keys, fmt.Sprintf("n/%05d", i))
	}
	for i := 0; i < nU; i++ {
		keys = append(keys, "u/"+oddName(i, rng))
	}
	punct := []string{"-", ".", " ", "!", "_", "~", "0", "a", "z", "é", "中", "\U0001f600"}
	for i := 0; i < nR; i++ {
		keys = append(keys, fmt.Sprintf("r%04d%s%s", i, punct[i%len(punct)], punct[(i/len(punct))%len(punct)]))
	}
	rng.Shuffle(len(keys), func(i, j int) { keys[i], keys[j] = keys[j], keys[i] })
	bodyOf := func(i int) []byte {
		b := make([]byte, 64+(i*37)%1900)
		fillAt(b, uint64(i)+1, 0)
		return b
	}

	// ---- PUT with 16 workers
	lat := make([]time.Duration, len(keys))
	var next atomic.Int64
	var errCount atomic.Int64
	var firstErr atomic.Value
	var bytesIn atomic.Int64
	t0 := time.Now()
	var wg sync.WaitGroup
	for w := 0; w < 16; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				i := int(next.Add(1) - 1)
				if i >= len(keys) {
					return
				}
				body := bodyOf(i)
				s := time.Now()
				if _, err := c.putBytes(keys[i], body); err != nil {
					errCount.Add(1)
					firstErr.Store(err)
					continue
				}
				lat[i] = time.Since(s)
				bytesIn.Add(int64(len(body)))
			}
		}()
	}
	wg.Wait()
	el := time.Since(t0)
	sorted := append([]time.Duration(nil), lat...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
	pc := func(p float64) time.Duration { return sorted[int(float64(len(sorted)-1)*p)] }
	info("PUT %d objects with 16 workers: %s, %.0f ops/s, %.1f MiB/s, latency p50 %s p95 %s p99 %s max %s", len(keys), el.Round(time.Millisecond), float64(len(keys))/el.Seconds(),
		float64(bytesIn.Load())/MiB/el.Seconds(), pc(0.5).Round(10*time.Microsecond), pc(0.95).Round(10*time.Microsecond), pc(0.99).Round(10*time.Microsecond), sorted[len(sorted)-1].Round(10*time.Microsecond))
	if errCount.Load() > 0 {
		fail("small/put", "%d of %d PUTs failed; first: %v", errCount.Load(), len(keys), firstErr.Load())
		return
	}
	pass("small/put", fmt.Sprintf("%d objects, %.0f ops/s", len(keys), float64(len(keys))/el.Seconds()))

	// ---- GET all back and compare
	next.Store(0)
	var badGet atomic.Int64
	t1 := time.Now()
	for w := 0; w < 16; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				i := int(next.Add(1) - 1)
				if i >= len(keys) {
					return
				}
				var sb sinkBuf
				if st, err := c.get(keys[i], "", &sb); err != nil || st != 200 || string(sb.b) != string(bodyOf(i)) {
					badGet.Add(1)
				}
			}
		}()
	}
	wg.Wait()
	info("GET %d objects with 16 workers: %s, %.0f ops/s", len(keys), time.Since(t1).Round(time.Millisecond), float64(len(keys))/time.Since(t1).Seconds())
	check("small/get-roundtrip", badGet.Load() == 0, "%d of %d objects came back wrong", badGet.Load(), len(keys))

	// ---- listings
	byteSorted := func(ss []string) []string {
		o := append([]string(nil), ss...)
		sort.Strings(o) // Go compares strings bytewise: raw UTF-8 order
		return o
	}
	// flat listing at 1000 per page
	var flat []string
	pages, token := 0, ""
	t2 := time.Now()
	for {
		p, err := c.listV2("", "", 1000, token)
		if err != nil {
			fail("list/flat", "%v", err)
			return
		}
		pages++
		flat = append(flat, p.Keys...)
		if !p.Truncated {
			break
		}
		token = p.Token
	}
	info("flat listing of %d keys in %d pages: %s", len(flat), pages, time.Since(t2).Round(time.Millisecond))
	wantPages := (len(keys) + 999) / 1000
	check("list/flat-count-and-pages", len(flat) == len(keys) && pages == wantPages, "listed %d keys in %d pages, want %d in %d", len(flat), pages, len(keys), wantPages)
	check("list/flat-raw-utf8-byte-order", fmt.Sprint(flat) == fmt.Sprint(byteSorted(keys)), "the flat listing differs from the byte-sorted key set")

	// delimiter paging of the big directory
	var inN []string
	pages, token = 0, ""
	for {
		p, err := c.listV2("n/", "/", 1000, token)
		if err != nil {
			fail("list/delimiter-dir", "%v", err)
			return
		}
		pages++
		if len(p.Prefixes) != 0 {
			fail("list/delimiter-dir", "unexpected common prefixes %v", p.Prefixes)
			return
		}
		inN = append(inN, p.Keys...)
		if !p.Truncated {
			break
		}
		token = p.Token
	}
	check("list/delimiter-dir-count-and-pages", len(inN) == nN && pages == (nN+999)/1000, "n/: %d keys in %d pages, want %d in %d", len(inN), pages, nN, (nN+999)/1000)
	var wantN []string
	for _, k := range keys {
		if strings.HasPrefix(k, "n/") {
			wantN = append(wantN, k)
		}
	}
	check("list/delimiter-dir-order", fmt.Sprint(inN) == fmt.Sprint(byteSorted(wantN)), "n/ listing differs from the sorted key set")

	// the unicode directory
	var inU []string
	token = ""
	for {
		p, err := c.listV2("u/", "/", 1000, token)
		if err != nil {
			fail("list/unicode-dir", "%v", err)
			return
		}
		inU = append(inU, p.Keys...)
		if !p.Truncated {
			break
		}
		token = p.Token
	}
	var wantU []string
	for _, k := range keys {
		if strings.HasPrefix(k, "u/") {
			wantU = append(wantU, k)
		}
	}
	check("list/unicode-dir-raw-utf8-order", fmt.Sprint(inU) == fmt.Sprint(byteSorted(wantU)), "u/ listing (%d keys) differs from the byte-sorted set (%d keys)", len(inU), len(wantU))

	// the root with a delimiter: root keys and two common prefixes share the page budget, in byte order
	var rootKeys []string
	for _, k := range keys {
		if !strings.Contains(k, "/") {
			rootKeys = append(rootKeys, k)
		}
	}
	merged := byteSorted(append(append([]string(nil), rootKeys...), "n/", "u/"))
	var gotKeys, gotPrefixes []string
	pageNo, token := 0, ""
	pageBad := ""
	for {
		p, err := c.listV2("", "/", 1000, token)
		if err != nil {
			fail("list/root-delimiter", "%v", err)
			return
		}
		lo, hi := pageNo*1000, (pageNo+1)*1000
		if hi > len(merged) {
			hi = len(merged)
		}
		got := append(append([]string(nil), p.Keys...), p.Prefixes...)
		sort.Strings(got)
		want := append([]string(nil), merged[lo:hi]...)
		sort.Strings(want)
		if fmt.Sprint(got) != fmt.Sprint(want) && pageBad == "" {
			pageBad = fmt.Sprintf("page %d holds %d entries, expected the %d entries [%d,%d) of the merged byte order", pageNo, len(got), len(want), lo, hi)
		}
		gotKeys = append(gotKeys, p.Keys...)
		gotPrefixes = append(gotPrefixes, p.Prefixes...)
		pageNo++
		if !p.Truncated {
			break
		}
		token = p.Token
	}
	check("list/root-delimiter-pages", pageBad == "", "%s", pageBad)
	check("list/root-delimiter-counts", len(gotKeys) == len(rootKeys) && fmt.Sprint(gotPrefixes) == "[n/ u/]", "%d root keys (want %d), prefixes %v", len(gotKeys), len(rootKeys), gotPrefixes)
	n.stop()
	code, out := n.cli("validate", "--deep")
	check("small/validate-deep", code == 0, "binvault validate --deep exited %d: %s", code, out)
}

// ---------------------------------------------------------------------------------------------------------------------
// kill -9 during uploads

func tmpFiles(n *node) int { return countFiles(filepath.Join(n.data, "tmp")) }

// afterCrash restarts the node on the same data dir and checks the crash invariants; returns the reopened client.
func afterCrash(name string, n *node, c *client) *client {
	code, out := n.cli("validate", "--deep")
	check(name+"/validate-deep-before-restart", code == 0, "validate --deep after kill -9 exited %d: %s", code, out)
	if err := n.start(); err != nil {
		fail(name+"/restart", "%v", err)
		return nil
	}
	pass(name+"/restart", "")
	c2 := n.reopen(c)
	check(name+"/staging-files-are-gone", tmpFiles(n) == 0, "%d files left under tmp/ after the restart (spec 3.9: tmp/ is emptied at boot)", tmpFiles(n))
	return c2
}

func scenKill() {
	if os.Getenv("BV_LOAD_NO_KILL") != "" {
		skip("kill", "BV_LOAD_NO_KILL is set")
		return
	}
	scenKillSinglePut()
	scenKillOverwrite()
	scenKillPart()
	for _, d := range []time.Duration{15 * time.Millisecond, 120 * time.Millisecond, 700 * time.Millisecond, 1500 * time.Millisecond, 1900 * time.Millisecond, 2300 * time.Millisecond} {
		scenKillComplete(d)
	}
	scenKillStorm()
}

func killSize() int64 {
	s := int64(float64(400*MiB) * scale)
	if s < 48*MiB {
		s = 48 * MiB
	}
	return s
}

func scenKillSinglePut() {
	const name = "kill-put"
	n := newNode(binPath, filepath.Join(workDir, name), true)
	if err := n.start(); err != nil {
		fail(name+"/start", "%v", err)
		return
	}
	c, err := n.bucket("load-kill", nil)
	if err != nil {
		fail(name+"/bucket", "%v", err)
		n.kill9()
		return
	}
	acked := map[string]string{}
	for i := 0; i < 50; i++ {
		k := fmt.Sprintf("before/%02d", i)
		b := make([]byte, 5000+i)
		fillAt(b, uint64(i)+100, 0)
		if _, err := c.putBytes(k, b); err != nil {
			fail(name+"/seed", "%v", err)
			n.kill9()
			return
		}
		sum := sha256.Sum256(b)
		acked[k] = hex.EncodeToString(sum[:])
	}
	size := killSize()
	var sent atomic.Int64
	g := newGen(0xC1, size)
	g.sent = &sent
	done := make(chan error, 1)
	go func() { _, err := c.put("victim/big.bin", g, size); done <- err }()
	for sent.Load() < size*2/5 {
		select {
		case err := <-done:
			fail(name+"/timing", "the upload ended (%v) before it could be interrupted: raise the size", err)
			n.kill9()
			return
		default:
		}
		time.Sleep(time.Millisecond)
	}
	n.kill9()
	<-done
	info("%s: killed the node after %d of %d MiB were sent", name, sent.Load()/MiB, size/MiB)
	c2 := afterCrash(name, n, c)
	if c2 == nil {
		return
	}
	defer n.stop()
	st, _, _ := c2.head("victim/big.bin")
	check(name+"/no-partial-object", st == 404, "HEAD of the interrupted upload answers %d, want 404", st)
	p, err := c2.listV2("victim/", "", 1000, "")
	check(name+"/not-listed", err == nil && len(p.Keys) == 0, "the interrupted object is listed: %v %v", p, err)
	verifyAcked(name, c2, acked)
	// the node is healthy: the same key can be uploaded again in full
	g2 := newGen(0xC2, 3*MiB)
	_, err = c2.put("victim/big.bin", g2, 3*MiB)
	check(name+"/same-key-uploads-again", err == nil, "%v", err)
}

func verifyAcked(name string, c *client, acked map[string]string) {
	bad := 0
	for k, want := range acked {
		h := sha256.New()
		if st, err := c.get(k, "", h); err != nil || st != 200 || hex.EncodeToString(h.Sum(nil)) != want {
			bad++
		}
	}
	check(name+"/acknowledged-objects-intact", bad == 0, "%d of %d acknowledged objects are missing or damaged", bad, len(acked))
}

func scenKillOverwrite() {
	const name = "kill-overwrite"
	n := newNode(binPath, filepath.Join(workDir, name), true)
	if err := n.start(); err != nil {
		fail(name+"/start", "%v", err)
		return
	}
	c, err := n.bucket("load-kill", nil)
	if err != nil {
		fail(name+"/bucket", "%v", err)
		n.kill9()
		return
	}
	oldSize := int64(3 * MiB)
	if _, err := c.put("doc/key.bin", newGen(0xA1, oldSize), oldSize); err != nil {
		fail(name+"/seed", "%v", err)
		n.kill9()
		return
	}
	size := killSize()
	var sent atomic.Int64
	g := newGen(0xA2, size)
	g.sent = &sent
	done := make(chan error, 1)
	go func() { _, err := c.put("doc/key.bin", g, size); done <- err }()
	for sent.Load() < size/2 {
		select {
		case err := <-done:
			fail(name+"/timing", "the overwrite ended (%v) before it could be interrupted", err)
			n.kill9()
			return
		default:
		}
		time.Sleep(time.Millisecond)
	}
	n.kill9()
	<-done
	c2 := afterCrash(name, n, c)
	if c2 == nil {
		return
	}
	defer n.stop()
	h := sha256.New()
	st, err := c2.get("doc/key.bin", "", h)
	check(name+"/old-version-is-still-complete", err == nil && st == 200 && hex.EncodeToString(h.Sum(nil)) == sha256Of(0xA1, 0, oldSize), "GET %d %v: the old object must survive an interrupted overwrite", st, err)
}

func scenKillPart() {
	const name = "kill-part"
	n := newNode(binPath, filepath.Join(workDir, name), true)
	if err := n.start(); err != nil {
		fail(name+"/start", "%v", err)
		return
	}
	c, err := n.bucket("load-kill", nil)
	if err != nil {
		fail(name+"/bucket", "%v", err)
		n.kill9()
		return
	}
	const seed = 0xD1
	ps := int64(8 * MiB)
	key := "mp/object.bin"
	uid, err := c.createMPU(key)
	if err != nil {
		fail(name+"/create", "%v", err)
		n.kill9()
		return
	}
	var parts []part
	for i := 0; i < 3; i++ {
		et, err := c.uploadPart(key, uid, i+1, newGenAt(seed, int64(i)*ps, ps), ps)
		if err != nil {
			fail(name+"/parts", "%v", err)
			n.kill9()
			return
		}
		parts = append(parts, part{i + 1, et})
	}
	big := killSize()
	var sent atomic.Int64
	g := newGenAt(seed, 3*ps, big)
	g.sent = &sent
	done := make(chan error, 1)
	go func() { _, err := c.uploadPart(key, uid, 4, g, big); done <- err }()
	for sent.Load() < big/2 {
		select {
		case err := <-done:
			fail(name+"/timing", "part 4 ended (%v) before it could be interrupted", err)
			n.kill9()
			return
		default:
		}
		time.Sleep(time.Millisecond)
	}
	n.kill9()
	<-done
	c2 := afterCrash(name, n, c)
	if c2 == nil {
		return
	}
	defer n.stop()
	listed, err := c2.listParts(key, uid)
	if err != nil {
		fail(name+"/upload-survives", "the open upload is gone after the crash: %v", err)
		return
	}
	pass(name+"/upload-survives", fmt.Sprintf("%d parts listed", len(listed)))
	for _, p := range listed {
		if p.N == 4 {
			fail(name+"/interrupted-part-is-not-listed", "part 4 was cut off by the crash but is listed with ETag %s", p.ETag)
			return
		}
	}
	pass(name+"/interrupted-part-is-not-listed", "")
	st, _, _ := c2.head(key)
	check(name+"/no-object-yet", st == 404, "HEAD answers %d before Complete", st)
	etag, err := c2.completeMPU(key, uid, parts)
	if err != nil {
		fail(name+"/complete-after-the-crash", "%v", err)
		return
	}
	h := sha256.New()
	st, err = c2.get(key, "", h)
	check(name+"/completed-object-is-exact", err == nil && st == 200 && hex.EncodeToString(h.Sum(nil)) == sha256Of(seed, 0, 3*ps), "GET %d %v (ETag %s)", st, err, etag)
}

func scenKillComplete(after time.Duration) {
	name := fmt.Sprintf("kill-complete-%dms", after/time.Millisecond)
	n := newNode(binPath, filepath.Join(workDir, name), true)
	if err := n.start(); err != nil {
		fail(name+"/start", "%v", err)
		return
	}
	c, err := n.bucket("load-kill", nil)
	if err != nil {
		fail(name+"/bucket", "%v", err)
		n.kill9()
		return
	}
	const seed = 0xE1
	total := killSize() * 2
	ps := (total/6 + MiB - 1) / MiB * MiB
	key := "mp/complete.bin"
	uid, err := c.createMPU(key)
	if err != nil {
		fail(name+"/create", "%v", err)
		n.kill9()
		return
	}
	var parts []part
	var size int64
	for i := 0; size < total; i++ {
		ln := ps
		if size+ln > total {
			ln = total - size
		}
		et, err := c.uploadPart(key, uid, i+1, newGenAt(seed, size, ln), ln)
		if err != nil {
			fail(name+"/parts", "%v", err)
			n.kill9()
			return
		}
		parts = append(parts, part{i + 1, et})
		size += ln
	}
	done := make(chan error, 1)
	go func() { _, err := c.completeMPU(key, uid, parts); done <- err }()
	finished := false
	select {
	case err := <-done:
		finished = true
		info("%s: Complete had already finished (%v) when the kill came", name, err)
	case <-time.After(after):
	}
	n.kill9()
	if !finished {
		<-done
	}
	c2 := afterCrash(name, n, c)
	if c2 == nil {
		return
	}
	defer n.stop()
	want := sha256Of(seed, 0, size)
	h := sha256.New()
	st, err := c2.get(key, "", h)
	switch {
	case err == nil && st == 200:
		check(name+"/object-is-complete-or-absent", hex.EncodeToString(h.Sum(nil)) == want, "the object is visible but its content is not the assembled upload (a partial object)")
		info("%s: Complete had committed before the kill", name)
	case st == 404:
		pass(name+"/object-is-complete-or-absent", "absent")
		etag, err := c2.completeMPU(key, uid, parts)
		if err != nil {
			fail(name+"/complete-can-be-retried", "%v", err)
			return
		}
		h2 := sha256.New()
		st, err = c2.get(key, "", h2)
		check(name+"/complete-can-be-retried", err == nil && st == 200 && hex.EncodeToString(h2.Sum(nil)) == want, "after the retry GET %d %v (ETag %s)", st, err, etag)
	default:
		fail(name+"/object-is-complete-or-absent", "GET answered %d %v", st, err)
	}
}

func scenKillStorm() {
	const name = "kill-storm"
	n := newNode(binPath, filepath.Join(workDir, name), true)
	if err := n.start(); err != nil {
		fail(name+"/start", "%v", err)
		return
	}
	c, err := n.bucket("load-kill", nil)
	if err != nil {
		fail(name+"/bucket", "%v", err)
		n.kill9()
		return
	}
	type rec struct {
		key  string
		sum  string
		size int
		ack  bool
	}
	var mu sync.Mutex
	var recs []*rec
	var stopFlag atomic.Bool
	var wg sync.WaitGroup
	var seq atomic.Int64
	for w := 0; w < 16; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for !stopFlag.Load() {
				i := int(seq.Add(1))
				size := 2000 + (i*7919)%60000
				b := make([]byte, size)
				fillAt(b, uint64(i)+5000, 0)
				sum := sha256.Sum256(b)
				r := &rec{key: fmt.Sprintf("storm/%06d", i), sum: hex.EncodeToString(sum[:]), size: size}
				mu.Lock()
				recs = append(recs, r)
				mu.Unlock()
				if _, err := c.putBytes(r.key, b); err == nil {
					mu.Lock()
					r.ack = true
					mu.Unlock()
				}
			}
		}()
	}
	time.Sleep(time.Duration(1500+rand.Intn(1500)) * time.Millisecond)
	n.kill9()
	stopFlag.Store(true)
	wg.Wait()
	mu.Lock()
	acked := 0
	for _, r := range recs {
		if r.ack {
			acked++
		}
	}
	total := len(recs)
	mu.Unlock()
	info("%s: killed with %d PUTs started, %d acknowledged", name, total, acked)
	c2 := afterCrash(name, n, c)
	if c2 == nil {
		return
	}
	defer n.stop()
	lostAcked, partial := 0, 0
	for _, r := range recs {
		h := sha256.New()
		st, err := c2.get(r.key, "", h)
		switch {
		case err == nil && st == 200:
			if hex.EncodeToString(h.Sum(nil)) != r.sum {
				partial++
			}
		case st == 404:
			if r.ack {
				lostAcked++
			}
		default:
			if r.ack {
				lostAcked++
			}
		}
	}
	check(name+"/acknowledged-puts-survive", lostAcked == 0, "%d of %d acknowledged PUTs are gone after kill -9 with BINVAULT_FSYNC=true", lostAcked, acked)
	check(name+"/no-object-is-damaged", partial == 0, "%d visible objects have the wrong content", partial)
	_, err = c2.listV2("storm/", "", 1000, "")
	check(name+"/listing-works", err == nil, "%v", err)
}
