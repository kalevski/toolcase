package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/bindctl"
	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/state"
	"github.com/kalevski/toolcase/zonewright/internal/zonefile"
)

// cmdValidate parses + validates the merged config, then renders every zone
// into a temp dir and runs the real named-checkzone / named-checkconf over it
// (the same gate the daemon applies). Never writes to the live zone dir and
// never reloads named. CI-friendly exit codes.
func cmdValidate(args []string) int {
	fs := flag.NewFlagSet("validate", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	_ = fs.Parse(args)

	res, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "INVALID: %v\n", err)
		return 1
	}
	cfg := res.Config
	for _, w := range res.Warnings {
		fmt.Printf("warning: %s\n", w)
	}

	failed := false
	if cfg.Admin.TokenEnv != "" || cfg.Admin.TokenFile != "" {
		if err := config.CheckSecretRef(cfg.Admin.TokenEnv, cfg.Admin.TokenFile); err != nil {
			fmt.Fprintf(os.Stderr, "INVALID: admin token: %v\n", err)
			failed = true
		}
	}

	if c := cfg.Cluster; c != nil {
		if c.KeyEnv != "" {
			if v, err := config.ResolveSecret(c.KeyEnv, ""); err != nil || len(v) < 32 {
				fmt.Fprintf(os.Stderr, "INVALID: cluster key_env %s must hold at least 32 bytes\n", c.KeyEnv)
				failed = true
			}
		}
		for _, f := range c.Keys() {
			if v, err := config.ResolveSecret("", f); err != nil {
				fmt.Fprintf(os.Stderr, "INVALID: cluster key: %v\n", err)
				failed = true
			} else if len(v) < 32 {
				fmt.Fprintf(os.Stderr, "INVALID: cluster key %s is %d bytes; need at least 32 (openssl rand -hex 32)\n", f, len(v))
				failed = true
			}
		}
		for _, f := range []string{c.TLS.CertFile, c.TLS.KeyFile, c.CAFile} {
			if f != "" {
				if _, err := os.Stat(f); err != nil {
					fmt.Fprintf(os.Stderr, "INVALID: cluster: %v\n", err)
					failed = true
				}
			}
		}
		fmt.Printf("cluster: %d server URL(s), peer listener %s, tls=%v\n", len(c.URLs), c.Listen, c.TLS.Enabled())
	}

	tmp, err := os.MkdirTemp("", "zonewright-validate-")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	defer os.RemoveAll(tmp)

	dry := *cfg
	dry.Bind.ZoneDir = filepath.Join(tmp, "zones")
	dry.Bind.ConfFile = filepath.Join(tmp, "named.zones.conf")
	dry.Bind.ReloadCmd = []string{}
	dry.Bind.CheckZoneCmd = availableOrSkip("check_zone_cmd", cfg.Bind.CheckZoneCmd)
	dry.Bind.CheckConfCmd = availableOrSkip("check_conf_cmd", cfg.Bind.CheckConfCmd)

	eng := bindctl.New(newLogger("json", "error"))
	out, err := eng.Apply(context.Background(), &dry, state.NewMemoryStore())
	if err != nil {
		fmt.Fprintf(os.Stderr, "INVALID: %v\n", err)
		return 1
	}
	if out.ConfError != "" {
		fmt.Fprintf(os.Stderr, "INVALID: %s\n", out.ConfError)
		failed = true
	}
	for _, zr := range out.Zones {
		if zr.State != bindctl.StateActive {
			fmt.Fprintf(os.Stderr, "INVALID: zone %s: %s\n", zr.Zone, zr.Reason)
			failed = true
		}
	}
	if failed {
		return 1
	}

	fmt.Printf("OK: %d zone(s), zone_dir %s\n", len(cfg.Zones), cfg.Bind.ZoneDir)
	for i := range cfg.Zones {
		z := &cfg.Zones[i]
		fmt.Printf("  %-40s %4d record(s)  %s\n", z.Name, len(z.Records), zonefile.FileName(z.Name))
	}
	return 0
}

// availableOrSkip returns cmd when its binary is on PATH, else an empty
// (disabled) command and a warning — so validate still checks config
// structure on a workstation without BIND installed.
func availableOrSkip(field string, cmd []string) []string {
	if len(cmd) == 0 {
		return cmd
	}
	if _, err := exec.LookPath(cmd[0]); err != nil {
		fmt.Printf("warning: %s: %s not found on PATH; skipping that check\n", field, cmd[0])
		return []string{}
	}
	return cmd
}

// cmdPrintZone prints one rendered zone file, with the serial the daemon last
// published (or the serial it would publish next, for a new zone).
func cmdPrintZone(args []string) int {
	fs := flag.NewFlagSet("print-zone", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	name, ok := parseWithPositional(fs, args, "usage: zonewright print-zone <zone> [--config PATH]")
	if !ok {
		return 2
	}
	res, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		return 1
	}
	cfg := res.Config
	zone, err := config.NormalizeZoneName(name)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	i := cfg.FindZone(zone)
	if i < 0 {
		fmt.Fprintf(os.Stderr, "zone %s is not configured\n", zone)
		return 1
	}
	var serial uint32
	if store, err := state.NewStore(cfg.DataDir); err == nil {
		if st, ok := store.Get(zone); ok {
			serial = st.Serial
		}
	}
	if serial == 0 {
		serial = state.NextSerial(0, time.Now())
	}
	fmt.Print(zonefile.Render(cfg, &cfg.Zones[i], serial))
	return 0
}

// cmdPrintInclude prints the named.conf zone list, plus the include line to
// add to named.conf.
func cmdPrintInclude(args []string) int {
	fs := flag.NewFlagSet("print-include", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	_ = fs.Parse(args)
	res, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		return 1
	}
	cfg := res.Config
	fmt.Printf("// Add to named.conf:\n//   include %q;\n//\n// %s will contain:\n\n", cfg.Bind.ConfFile, cfg.Bind.ConfFile)
	var zones []zonefile.IncludeZone
	for i := range cfg.Zones {
		zones = append(zones, zonefile.IncludeEntry(cfg, &cfg.Zones[i]))
	}
	fmt.Print(zonefile.Include(zones))
	return 0
}
