package nginxctl

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
)

// test validates the staged config in isolation: it writes a minimal synthetic
// nginx.conf that includes the staged http (and, when present, stream) files,
// then runs `nginx -t -c <synthetic>`. This validates syntax, directive
// context, upstream references and duplicate listeners without touching the live
// config — the basis for per-resource quarantine.
func (e *Engine) test(ctx context.Context, httpDir, streamDir string) (string, error) {
	prefix, err := os.MkdirTemp("", "nginxpilot-test-")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(prefix)

	conf := e.syntheticConf(prefix, httpDir, streamDir)
	confPath := filepath.Join(prefix, "nginx.conf")
	if err := os.WriteFile(confPath, []byte(conf), 0o600); err != nil {
		return "", err
	}
	return e.run(ctx, e.nginxBin, "-t", "-p", prefix, "-c", confPath)
}

// syntheticConf builds the minimal nginx.conf used for the isolated test. The
// stream{} block is only emitted when stream files are staged, so a host whose
// nginx lacks the stream module is unaffected unless streams are configured.
func (e *Engine) syntheticConf(prefix, httpDir, streamDir string) string {
	conf := fmt.Sprintf(`pid %[1]s/nginx.pid;
error_log %[1]s/error.log;
events { worker_connections 64; }
http {
    include %[2]s/*.conf;
}
`, prefix, httpDir)
	if dirHasConf(streamDir) {
		conf += fmt.Sprintf("stream {\n    include %s/*.conf;\n}\n", streamDir)
	}
	return conf
}

// dirHasConf reports whether dir contains at least one *.conf file.
func dirHasConf(dir string) bool {
	matches, _ := filepath.Glob(filepath.Join(dir, "*.conf"))
	return len(matches) > 0
}
