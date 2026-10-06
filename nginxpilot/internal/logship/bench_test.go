package logship

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"testing"
	"time"
)

func benchLine(i int) []byte {
	return []byte(fmt.Sprintf(`{"ts":"2026-10-06T10:00:00+00:00","msec":"1790000000.%03d","host":"www.example.com","server_name":"example.com","remote_addr":"203.0.113.%d","method":"GET","path":"/assets/app-%d.js","query":"v=%d&token=abc123&utm=x","status":200,"bytes_sent":1234,"request_time":0.002,"scheme":"https","protocol":"HTTP/2.0","referer":"https://example.com/","user_agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36","resource":"example.com","resource_type":"site"}`, i%1000, i%250, i, i))
}

func BenchmarkParseAccessLine(b *testing.B) {
	line := benchLine(1)
	opts := ParseOptions{AnonymizeIP: true}
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		ParseAccessLine(line, opts)
	}
}

func BenchmarkParseAccessLineClean(b *testing.B) {
	line := []byte(`{"ts":"2026-10-06T10:00:00+00:00","msec":"1790000000.123","host":"www.example.com","server_name":"example.com","remote_addr":"203.0.113.9","method":"GET","path":"/a.js","query":"v=1","status":200,"scheme":"https","user_agent":"curl","resource":"example.com","resource_type":"site"}`)
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		ParseAccessLine(line, ParseOptions{})
	}
}

func BenchmarkFilterMatch(b *testing.B) {
	f, err := CompileFilter(map[string][]string{
		"host": {"*.example.com", "!admin.*"}, "status": {"4xx", ">=500"}, "method": {"GET", "POST"}, "path": {"/assets/*"},
	}, FieldsAccess)
	if err != nil {
		b.Fatal(err)
	}
	e := ParseAccessLine(benchLine(1), ParseOptions{})
	e.F.Status = 404
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		f.Match(&e)
	}
}

func BenchmarkDispatch(b *testing.B) {
	s := NewShipper(testLogger())
	var dests []Destination
	for i := 0; i < 3; i++ {
		f, _ := CompileFilter(map[string][]string{"status": {"2xx"}}, FieldsAccess)
		dests = append(dests, Destination{Name: fmt.Sprintf("d%d", i), Type: DestFile, Path: filepath.Join(b.TempDir(), "x.log"), Filter: f, BufferEntries: 1 << 16})
	}
	s.Configure(dests)
	defer s.Close()
	e := ParseAccessLine(benchLine(1), ParseOptions{})
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		s.Dispatch(e)
	}
}

func benchBatch(n int) []Entry {
	out := make([]Entry, n)
	for i := range out {
		out[i] = ParseAccessLine(benchLine(i), ParseOptions{})
		out[i].F.Status = []int{200, 404, 500, 301}[i%4]
	}
	return out
}

func BenchmarkLokiBuild(b *testing.B) {
	s := &lokiSink{labels: Labels{Job: "nginx", HostSource: "$host", StatusSource: "$status_class", Static: map[string]string{"env": "p"}}}
	batch := benchBatch(500)
	for i := 0; i < b.N; i++ {
		_ = s.buildPayload(batch)
	}
}

func BenchmarkFileSink(b *testing.B) {
	d := &Destination{Type: DestFile, Path: filepath.Join(b.TempDir(), "a.log")}
	s, _ := newSink(d)
	defer s.Close()
	batch := benchBatch(500)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = s.Send(context.Background(), batch, "x")
	}
}

func BenchmarkWriterSink(b *testing.B) {
	s := &writerSink{w: io.Discard}
	batch := benchBatch(500)
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = s.Send(context.Background(), batch, "x")
	}
}

func BenchmarkRing(b *testing.B) {
	r := newRing(8192, 16<<20)
	e := ParseAccessLine(benchLine(1), ParseOptions{})
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		r.push(e)
		if i%500 == 499 {
			r.popBatch(500)
		}
	}
}

var _ = time.Second
