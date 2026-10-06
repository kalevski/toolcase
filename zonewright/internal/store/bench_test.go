package store

import (
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/config"
)

// seedLog fills a store with n rrset ops spread over zones, the way a long
// running node's op log looks.
func seedLog(b *testing.B, n int) *Store {
	s, err := Open(filepath.Join(b.TempDir(), "zw.db"), nil)
	if err != nil {
		b.Fatal(err)
	}
	b.Cleanup(func() { s.Close() })
	const zones = 50
	var drafts []Draft
	for i := 0; i < zones; i++ {
		drafts = append(drafts, Draft{Kind: KindZoneCreate, Zone: fmt.Sprintf("z%d.test", i), Payload: CreatePayload{}})
	}
	ops, err := s.LocalWrite(drafts)
	if err != nil {
		b.Fatal(err)
	}
	gens := map[string]string{}
	for _, op := range ops {
		gens[op.Zone] = op.Generation
	}
	for done := 0; done < n; {
		drafts = drafts[:0]
		for j := 0; j < 200 && done < n; j, done = j+1, done+1 {
			z := fmt.Sprintf("z%d.test", done%zones)
			rec := config.Record{Name: fmt.Sprintf("h%d", done), Type: "A", Value: "192.0.2.1"}
			drafts = append(drafts, Draft{Kind: KindRRset, Zone: z, Generation: gens[z], Name: rec.Name, Type: rec.Type, Payload: RRsetPayload{Records: []config.Record{rec}}})
		}
		if _, err := s.LocalWrite(drafts); err != nil {
			b.Fatal(err)
		}
	}
	return s
}

// A fresh peer catching up on a long log: OpsSince + ApplyRemote, in batches.
func BenchmarkReplay(b *testing.B) {
	src := seedLog(b, 20000)
	for i := 0; i < b.N; i++ {
		dst, err := Open(filepath.Join(b.TempDir(), "peer.db"), nil)
		if err != nil {
			b.Fatal(err)
		}
		since := map[string]int64{}
		for {
			ops, more, err := src.OpsSince(since, 500)
			if err != nil {
				b.Fatal(err)
			}
			if _, err := dst.ApplyRemote(ops, time.Hour, nil); err != nil {
				b.Fatal(err)
			}
			for _, op := range ops {
				since[op.Origin] = op.Seq
			}
			if !more {
				break
			}
		}
		dst.Close()
	}
}

func BenchmarkOpsSince(b *testing.B) {
	src := seedLog(b, 20000)
	vv, _ := src.VV()
	since := map[string]int64{}
	for o, n := range vv {
		since[o] = n - 600
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, _, err := src.OpsSince(since, 500); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkLocalWrite(b *testing.B) {
	s := seedLog(b, 20000)
	z, _, _ := s.Zone("z0.test")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rec := config.Record{Name: fmt.Sprintf("w%d", i), Type: "A", Value: "192.0.2.1"}
		if _, err := s.LocalWrite([]Draft{{Kind: KindRRset, Zone: z.Name, Generation: z.Generation, Name: rec.Name, Type: rec.Type, Payload: RRsetPayload{Records: []config.Record{rec}}}}); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkZoneRead(b *testing.B) {
	s := seedLog(b, 20000)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, _, err := s.Zone("z0.test"); err != nil {
			b.Fatal(err)
		}
	}
}
