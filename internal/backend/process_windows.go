//go:build windows

package backend

import (
	"os/exec"
	"syscall"
)

const createNoWindow = 0x08000000

// configureCurlProcess prevents curl.exe from opening a console window while
// keeping stdout and stderr available to CurlDesk's response panels.
func configureCurlProcess(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: createNoWindow,
		HideWindow:    true,
	}
}
