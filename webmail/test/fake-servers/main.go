// Command fake-servers runs the fake JMAP server for local development and the
// smoke test. Not for production: no TLS, fake data.
//
//	go run ./test/fake-servers -jmap :9102
//
// then run webmail with WEBMAIL_JMAP_URL=http://127.0.0.1:9102 and a
// WEBMAIL_API_TOKEN, and register the domain the way the platform does:
//
//	curl -H "Authorization: Bearer $WEBMAIL_API_TOKEN" -d '{"domain":"example.test"}' \
//	  http://127.0.0.1:8080/admin/v1/brandings
//
// Seeded mailbox: ann@example.test / correct-horse.
package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/kalevski/toolcase/webmail/internal/fakes"
)

func main() {
	jm := flag.String("jmap", "127.0.0.1:9102", "fake JMAP listen address")
	stateful := flag.Bool("stateful", false, "remember keywords, folders, drafts and sent mail")
	flag.Parse()
	w := fakes.NewWorld()
	w.Stateful = *stateful
	w.JMAPPublic = "https://mail.public.invalid"
	log.Printf("fake JMAP on %s; mailbox ann@example.test / correct-horse", *jm)
	log.Fatal(http.ListenAndServe(*jm, w.JMAPHandler()))
}
