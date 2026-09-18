package main

import (
	"os/exec"
	"runtime"
	"strings"
)

type DiagnosticInfo struct {
	OS           string `json:"os"`
	Architecture string `json:"architecture"`
	CurlPath     string `json:"curlPath"`
	CurlVersion  string `json:"curlVersion"`
}

func (r *CurlRunner) GetDiagnostics() DiagnosticInfo {
	r.mu.Lock()
	configured := r.executable
	r.mu.Unlock()
	executable := configured
	if executable == "" {
		executable = "curl"
		if runtime.GOOS == "windows" {
			executable = "curl.exe"
		}
	}
	resolved, err := exec.LookPath(executable)
	if err != nil {
		return DiagnosticInfo{OS: runtime.GOOS, Architecture: runtime.GOARCH, CurlPath: executable, CurlVersion: "not found"}
	}
	versionOutput, err := exec.Command(resolved, "--version").Output()
	version := "unknown"
	if err == nil {
		version = strings.SplitN(strings.TrimSpace(string(versionOutput)), "\n", 2)[0]
	}
	return DiagnosticInfo{OS: runtime.GOOS, Architecture: runtime.GOARCH, CurlPath: resolved, CurlVersion: version}
}
