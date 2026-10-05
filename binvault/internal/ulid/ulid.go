// Package ulid generates ULIDs (26-character Crockford base32: 48-bit
// millisecond timestamp + 80 bits of randomness). A Generator is monotonic
// within a process: ids created in the same millisecond still sort in creation
// order. Spec §3.3: binvault uses a ULID as an id only; ordering of versions is
// decided by the commit sequence, never by the ULID.
package ulid

import (
	crand "crypto/rand"
	"errors"
	"sync"
	"time"
)

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// Len is the length of an encoded ULID.
const Len = 26

var dec [256]byte

func init() {
	for i := range dec {
		dec[i] = 0xFF
	}
	for i := 0; i < len(alphabet); i++ {
		dec[alphabet[i]] = byte(i)
		if c := alphabet[i]; c >= 'A' && c <= 'Z' {
			dec[c+32] = byte(i) // lowercase accepted when parsing
		}
	}
}

// Generator issues monotonic ULIDs. The zero value is ready to use.
type Generator struct {
	mu   sync.Mutex
	ms   uint64
	rand [10]byte
}

var std Generator

// New returns a ULID for the current time from the process-wide generator.
func New() string { return std.New() }

// NewAt returns a ULID with the given time from the process-wide generator.
func NewAt(t time.Time) string { return std.NewAt(t) }

// New returns a ULID for the current time.
func (g *Generator) New() string { return g.NewAt(time.Now()) }

// NewAt returns a ULID for t, monotonic with earlier ids from this generator.
func (g *Generator) NewAt(t time.Time) string {
	ms := uint64(t.UnixMilli())
	g.mu.Lock()
	defer g.mu.Unlock()
	if ms <= g.ms && g.ms != 0 {
		// same (or earlier) millisecond: keep the timestamp, increment the entropy
		ms = g.ms
		for i := 9; i >= 0; i-- {
			g.rand[i]++
			if g.rand[i] != 0 {
				break
			}
			if i == 0 { // overflow: bump the millisecond
				ms++
				_, _ = crand.Read(g.rand[:])
			}
		}
	} else {
		_, _ = crand.Read(g.rand[:])
		// leave headroom so a long same-millisecond burst cannot overflow
		g.rand[0] &= 0x7F
	}
	g.ms = ms
	return encode(ms, g.rand)
}

func encode(ms uint64, r [10]byte) string {
	var b [Len]byte
	// 48-bit timestamp -> 10 chars (top char holds 3 bits)
	b[0] = alphabet[(ms>>45)&0x07]
	b[1] = alphabet[(ms>>40)&0x1F]
	b[2] = alphabet[(ms>>35)&0x1F]
	b[3] = alphabet[(ms>>30)&0x1F]
	b[4] = alphabet[(ms>>25)&0x1F]
	b[5] = alphabet[(ms>>20)&0x1F]
	b[6] = alphabet[(ms>>15)&0x1F]
	b[7] = alphabet[(ms>>10)&0x1F]
	b[8] = alphabet[(ms>>5)&0x1F]
	b[9] = alphabet[ms&0x1F]
	// 80-bit entropy -> 16 chars
	b[10] = alphabet[(r[0]&0xF8)>>3]
	b[11] = alphabet[((r[0]&0x07)<<2)|((r[1]&0xC0)>>6)]
	b[12] = alphabet[(r[1]&0x3E)>>1]
	b[13] = alphabet[((r[1]&0x01)<<4)|((r[2]&0xF0)>>4)]
	b[14] = alphabet[((r[2]&0x0F)<<1)|((r[3]&0x80)>>7)]
	b[15] = alphabet[(r[3]&0x7C)>>2]
	b[16] = alphabet[((r[3]&0x03)<<3)|((r[4]&0xE0)>>5)]
	b[17] = alphabet[r[4]&0x1F]
	b[18] = alphabet[(r[5]&0xF8)>>3]
	b[19] = alphabet[((r[5]&0x07)<<2)|((r[6]&0xC0)>>6)]
	b[20] = alphabet[(r[6]&0x3E)>>1]
	b[21] = alphabet[((r[6]&0x01)<<4)|((r[7]&0xF0)>>4)]
	b[22] = alphabet[((r[7]&0x0F)<<1)|((r[8]&0x80)>>7)]
	b[23] = alphabet[(r[8]&0x7C)>>2]
	b[24] = alphabet[((r[8]&0x03)<<3)|((r[9]&0xE0)>>5)]
	b[25] = alphabet[r[9]&0x1F]
	return string(b[:])
}

// Valid reports whether s is a well-formed ULID.
func Valid(s string) bool {
	if len(s) != Len {
		return false
	}
	for i := 0; i < Len; i++ {
		if dec[s[i]] == 0xFF {
			return false
		}
	}
	return s[0] <= '7'
}

// Time returns the timestamp encoded in a ULID.
func Time(s string) (time.Time, error) {
	if !Valid(s) {
		return time.Time{}, errors.New("ulid: invalid")
	}
	var ms uint64
	for i := 0; i < 10; i++ {
		ms = ms<<5 | uint64(dec[s[i]])
	}
	return time.UnixMilli(int64(ms)).UTC(), nil
}
