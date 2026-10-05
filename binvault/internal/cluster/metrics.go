package cluster

import (
	"time"

	"github.com/kalevski/toolcase/binvault/internal/obs"
)

// registerMetrics adds the cluster metrics of spec §9.2 that belong to the
// catalog and membership (the forwarding and move metrics belong to the code
// that forwards and moves):
//
//	binvault_cluster_peer_up{peer}, binvault_cluster_replication_lag_ops{peer},
//	binvault_cluster_held_ops, binvault_cluster_conflicts
func (n *Node) registerMetrics(r *obs.Registry) {
	peerLabel := func(p PeerInfo) string { return orStr(p.Name, orStr(p.ID, firstOr(p.URLs, ""))) }
	r.GaugeFunc("binvault_cluster_peer_up", "1 when the peer answers hello, 0 when it does not.", []string{"peer"}, func() []obs.Sample {
		var out []obs.Sample
		for _, p := range n.Peers() {
			if p.Retired {
				continue
			}
			v := 0.0
			if p.Reachable {
				v = 1
			}
			out = append(out, obs.Sample{Labels: []string{peerLabel(p)}, Value: v})
		}
		return out
	})
	r.GaugeFunc("binvault_cluster_replication_lag_ops", "Catalog ops the peer holds that this node has not applied.", []string{"peer"}, func() []obs.Sample {
		var out []obs.Sample
		for _, p := range n.Peers() {
			if p.Retired || p.ID == "" {
				continue
			}
			out = append(out, obs.Sample{Labels: []string{peerLabel(p)}, Value: float64(p.Lag)})
		}
		return out
	})
	r.GaugeFunc("binvault_cluster_held_ops", "Catalog ops held back: not applied here, or not sent to a peer.", nil, func() []obs.Sample {
		return []obs.Sample{{Value: float64(len(n.HeldOps()))}}
	})
	r.GaugeFunc("binvault_cluster_conflicts", "Concurrent catalog writes seen in the last 24 hours (the later one won).", nil, func() []obs.Sample {
		cutoff := n.now().Add(-24 * time.Hour)
		c := 0
		for _, x := range n.Conflicts() {
			if x.At.After(cutoff) {
				c++
			}
		}
		return []obs.Sample{{Value: float64(c)}}
	})
}

func firstOr(s []string, def string) string {
	if len(s) > 0 {
		return s[0]
	}
	return def
}
