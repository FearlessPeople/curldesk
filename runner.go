package main

import (
	"errors"
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

type RunResult struct {
	Output   string `json:"output"`
	ExitCode int    `json:"exitCode"`
}

type CurlRunner struct{}

func (r *CurlRunner) RunCurl(command string) (RunResult, error) {
	args, err := parseCurlCommand(command)
	if err != nil {
		return RunResult{}, err
	}

	executable := "curl"
	if runtime.GOOS == "windows" {
		executable = "curl.exe"
	}
	cmd := exec.Command(executable, args...)
	output, err := cmd.CombinedOutput()
	if cmd.ProcessState == nil {
		return RunResult{}, fmt.Errorf("curl executable not found: %w", err)
	}
	result := RunResult{Output: string(output), ExitCode: cmd.ProcessState.ExitCode()}
	return result, nil
}

func parseCurlCommand(command string) ([]string, error) {
	command = strings.ReplaceAll(command, "\\\r\n", "")
	command = strings.ReplaceAll(command, "\\\n", "")
	var args []string
	var current strings.Builder
	var quote rune
	var escaped bool
	started := false

	flush := func() {
		if started {
			args = append(args, current.String())
			current.Reset()
			started = false
		}
	}

	for _, char := range command {
		if escaped {
			current.WriteRune(char)
			started = true
			escaped = false
			continue
		}
		if char == '\\' && quote != '\'' {
			escaped = true
			started = true
			continue
		}
		if quote != 0 {
			if char == quote {
				quote = 0
			} else {
				current.WriteRune(char)
			}
			started = true
			continue
		}
		if char == '\'' || char == '"' {
			quote = char
			started = true
			continue
		}
		if char == ' ' || char == '\t' || char == '\r' || char == '\n' {
			flush()
			continue
		}
		current.WriteRune(char)
		started = true
	}
	if escaped || quote != 0 {
		return nil, errors.New("invalid curl command: unfinished quote or escape")
	}
	flush()
	if len(args) == 0 || args[0] != "curl" {
		return nil, errors.New("command must start with curl")
	}
	return args[1:], nil
}
