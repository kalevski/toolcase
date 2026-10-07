package pipeline

import "sync"

// inflightGroup counts calls in flight. Unlike sync.WaitGroup it allows Add
// to run concurrently with Wait while the count is zero, which the scheduler
// does during shutdown.
type inflightGroup struct {
	mu   sync.Mutex
	n    int
	idle chan struct{} // closed while n == 0; nil while n > 0
}

func (g *inflightGroup) Add(d int) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.n += d
	if g.n > 0 {
		g.idle = nil
	}
}

func (g *inflightGroup) Done() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.n--
	if g.n == 0 && g.idle != nil {
		close(g.idle)
		g.idle = nil
	}
}

// Wait blocks until the count reaches zero.
func (g *inflightGroup) Wait() {
	g.mu.Lock()
	if g.n == 0 {
		g.mu.Unlock()
		return
	}
	if g.idle == nil {
		g.idle = make(chan struct{})
	}
	ch := g.idle
	g.mu.Unlock()
	<-ch
}
