package main

import "crypto/tls"

// insecureLoopback skips certificate verification for the self-probe: it only
// ever talks to this process on a loopback address.
func insecureLoopback() *tls.Config { return &tls.Config{InsecureSkipVerify: true} } //nolint:gosec
