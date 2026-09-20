//go:build windows

package backend

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"syscall"
	"time"
)

func installUpdate(downloadURL string) error {
	client := &http.Client{Timeout: 10 * time.Minute}
	response, err := client.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("download update: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("download update: server returned %s", response.Status)
	}

	installer, err := os.CreateTemp("", "curldesk-update-*.exe")
	if err != nil {
		return fmt.Errorf("create update file: %w", err)
	}
	installerPath := installer.Name()
	defer installer.Close()

	if _, err := io.Copy(installer, io.LimitReader(response.Body, maxUpdateSize+1)); err != nil {
		os.Remove(installerPath)
		return fmt.Errorf("save update: %w", err)
	}
	if info, err := installer.Stat(); err != nil || info.Size() > maxUpdateSize {
		os.Remove(installerPath)
		return fmt.Errorf("update file is too large")
	}
	if err := installer.Close(); err != nil {
		os.Remove(installerPath)
		return fmt.Errorf("close update file: %w", err)
	}

	// The installer replaces CurlDesk.exe, so it must wait until this process
	// has exited. A hidden helper keeps the transition invisible to the user.
	script, err := os.CreateTemp("", "curldesk-update-*.cmd")
	if err != nil {
		os.Remove(installerPath)
		return fmt.Errorf("create update helper: %w", err)
	}
	scriptPath := script.Name()
	pid := strconv.Itoa(os.Getpid())
	content := fmt.Sprintf(`@echo off
:wait_for_app
tasklist /FI "PID eq %s" 2>NUL | findstr /R /C:" %s " >NUL
if not errorlevel 1 (
  timeout /t 1 /nobreak >NUL
  goto wait_for_app
)
start "" /wait "%s"
del "%%~f0"
`, pid, pid, installerPath)
	if _, err := script.WriteString(content); err != nil {
		script.Close()
		os.Remove(scriptPath)
		os.Remove(installerPath)
		return fmt.Errorf("write update helper: %w", err)
	}
	if err := script.Close(); err != nil {
		os.Remove(scriptPath)
		os.Remove(installerPath)
		return fmt.Errorf("close update helper: %w", err)
	}

	command := exec.Command("cmd.exe", "/D", "/S", "/C", scriptPath)
	command.SysProcAttr = &syscall.SysProcAttr{CreationFlags: createNoWindow, HideWindow: true}
	if err := command.Start(); err != nil {
		os.Remove(scriptPath)
		os.Remove(installerPath)
		return fmt.Errorf("start update helper: %w", err)
	}

	// Let the helper observe our process exit and run the installer.
	go func() {
		time.Sleep(100 * time.Millisecond)
		os.Exit(0)
	}()
	return nil
}
