module github.com/kalevski/toolcase/imagewarden

go 1.24

// TODO: go mod tidy — no network access when this module was bootstrapped;
// versions below are hand-picked pins, not verified against the module
// proxy. Run `go mod tidy` to confirm/update and to generate go.sum.
require (
	github.com/yalue/onnxruntime_go v1.12.0
	golang.org/x/image v0.24.0
	gopkg.in/yaml.v3 v3.0.1
)
