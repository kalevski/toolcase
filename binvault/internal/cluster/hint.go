package cluster

import "time"

// NoteUnreachable is the forwarder's hint that a request to a peer failed in a way
// that says the peer itself is gone — a connection that could not be made, was
// reset, or was closed without a byte of answer (spec §8.4). A timeout or a stuck
// transfer is not such a sign and is not reported: one slow request must not make a
// healthy peer's buckets fail for everyone else. The peer's URLs are treated as down
// until the next hello answers, which is asked for at once, so that the requests
// that follow for that peer's buckets fail fast with a 503 instead of each dialling
// on its own. A peer that is in fact fine is back after one discovery round (about a
// second). It is only a hint: a node never marks itself, and an unknown or retired
// id is ignored.
func (n *Node) NoteUnreachable(id string, cause error) {
	if id == n.id || n.single {
		return
	}
	marked := false
	n.mu.Lock()
	for _, u := range n.urls {
		s := n.us[u]
		if s.id != id || !s.up || s.class != classPeer {
			continue
		}
		s.up = false
		if cause != nil {
			s.err = cause.Error()
		}
		s.fails++
		s.next = time.Now().Add(n.backoff(s.fails))
		marked = true
	}
	n.mu.Unlock()
	if marked {
		n.log.Warn("a forwarded request to a peer failed: treating it as down until it answers hello", "peer", id, "error", cause)
		n.kickDiscovery()
	}
}
