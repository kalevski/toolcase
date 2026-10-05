package engine

import "io"

// pipeFrom streams a Body's whole plaintext through an io.Pipe so it can feed
// Receive without buffering. Close the reader to stop the producer.
func pipeFrom(b Body) (*io.PipeReader, *io.PipeWriter) {
	pr, pw := io.Pipe()
	go func() {
		_, err := b.WriteRange(pw, 0, b.Size())
		pw.CloseWithError(err)
	}()
	return pr, pw
}
