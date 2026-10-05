// Command fake-servers runs the fake platform and fake JMAP server for local
// development and the smoke test. Not for production: no TLS, fake data.
//
//	go run ./test/fake-servers -platform :9101 -jmap :9102
//
// then run webmail with WEBMAIL_PLATFORM_URL=http://127.0.0.1:9101,
// WEBMAIL_JMAP_URL=http://127.0.0.1:9102, WEBMAIL_PLATFORM_TOKEN=svc-token.
// Seeded mailbox: ann@example.test / correct-horse.
package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/kalevski/toolcase/webmail/internal/fakes"
)

func main() {
	pl := flag.String("platform", "127.0.0.1:9101", "fake platform listen address")
	jm := flag.String("jmap", "127.0.0.1:9102", "fake JMAP listen address")
	stateful := flag.Bool("stateful", false, "remember keywords, folders, drafts and sent mail")
	flag.Parse()
	w := fakes.NewWorld()
	w.Stateful = *stateful
	w.JMAPPublic = "https://mail.public.invalid"
	go func() { log.Fatal(http.ListenAndServe(*pl, w.PlatformHandler())) }()
	log.Printf("fake platform on %s (token %s), fake JMAP on %s; mailbox ann@example.test / correct-horse", *pl, w.PlatformToken, *jm)
	log.Fatal(http.ListenAndServe(*jm, w.JMAPHandler()))
}
