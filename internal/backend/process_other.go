//go:build !windows

package backend

import "os/exec"

func configureCurlProcess(_ *exec.Cmd) {}
