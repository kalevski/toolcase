package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"

	"github.com/kalevski/toolcase/nginxpilot/internal/admintoken"
	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// cmdToken handles `nginxpilot token set`: it replaces the stored admin token
// hash in admin.token_file. The token is prompted for with echo off, or read
// from stdin when stdin is not a terminal — never taken as an argument, which
// would land in `ps` and shell history. The daemon reads the file only at
// startup, so the new token takes effect on the next restart.
func cmdToken(args []string) int {
	if len(args) == 0 || args[0] != "set" {
		fmt.Fprintln(os.Stderr, "usage: nginxpilot token set [--config PATH]")
		return 2
	}
	fs := flag.NewFlagSet("token set", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	_ = fs.Parse(args[1:])

	res, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		return 1
	}
	file := res.Config.Admin.TokenFile
	if file == "" {
		fmt.Fprintln(os.Stderr, "admin.token_file is not configured; set it in the config so the token can be stored")
		return 1
	}

	token, err := readToken()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if len(token) < admintoken.MinLength {
		fmt.Fprintf(os.Stderr, "the token must be at least %d characters\n", admintoken.MinLength)
		return 1
	}
	if err := admintoken.Store(file, token); err != nil {
		fmt.Fprintf(os.Stderr, "could not store the token: %v\n", err)
		return 1
	}
	fmt.Println("stored the new token's hash in", file)
	fmt.Println("restart the daemon (docker restart <container>) to use it, then update the token wherever it is used")
	return 0
}

func readToken() (string, error) {
	info, err := os.Stdin.Stat()
	if err != nil {
		return "", err
	}
	if info.Mode()&os.ModeCharDevice == 0 {
		raw, err := io.ReadAll(io.LimitReader(os.Stdin, 4096))
		if err != nil {
			return "", err
		}
		return strings.TrimSpace(string(raw)), nil
	}

	fmt.Fprint(os.Stderr, "new admin token: ")
	if err := stty("-echo"); err != nil {
		return "", errors.New("cannot turn off echo on this terminal; pipe the token on stdin instead")
	}
	defer func() {
		_ = stty("echo")
		fmt.Fprintln(os.Stderr)
	}()
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", err
	}
	return strings.TrimSpace(line), nil
}

func stty(arg string) error {
	command := exec.Command("stty", arg)
	command.Stdin = os.Stdin
	return command.Run()
}
