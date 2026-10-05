package ulid

import (
	"sort"
	"testing"
	"time"
)

func TestMonotonicAndValid(t *testing.T) {
	var g Generator
	now := time.Now()
	ids := make([]string, 0, 5000)
	for i := 0; i < 5000; i++ {
		id := g.NewAt(now) // same millisecond every time
		if !Valid(id) {
			t.Fatalf("invalid id %q", id)
		}
		ids = append(ids, id)
	}
	if !sort.StringsAreSorted(ids) {
		t.Fatal("ids from one generator must sort in creation order")
	}
	seen := map[string]bool{}
	for _, id := range ids {
		if seen[id] {
			t.Fatal("duplicate")
		}
		seen[id] = true
	}
}

func TestTimeRoundTrip(t *testing.T) {
	at := time.UnixMilli(1790942400123)
	got, err := Time(NewAt(at))
	if err != nil || !got.Equal(at.UTC()) {
		t.Fatalf("got %v err %v want %v", got, err, at)
	}
	if Valid("not-a-ulid") || Valid("") || Valid("ZZZZZZZZZZZZZZZZZZZZZZZZZZ") {
		t.Fatal("bad ids accepted")
	}
}
