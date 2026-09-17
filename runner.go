package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const curlStreamEvent = "curldesk:curl:chunk"

type curlStreamChunk struct {
	RunID string `json:"runId"`
	Chunk string `json:"chunk"`
}

type RunResult struct {
	Output          string `json:"output"`
	ExitCode        int    `json:"exitCode"`
	Status          int    `json:"status"`
	DurationMs      int64  `json:"durationMs"`
	RequestSize     int64  `json:"requestSize"`
	ResponseSize    int64  `json:"responseSize"`
	ResponseHeaders string `json:"responseHeaders"`
}

type CurlRunner struct {
	mu      sync.Mutex
	process *exec.Cmd
}

func (r *CurlRunner) RunCurl(command string) (RunResult, error) {
	log.Printf("[curl] starting request (%d bytes)", len(command))
	args, err := parseCurlCommand(command)
	if err != nil {
		log.Printf("[curl] rejected request: %v", err)
		return RunResult{}, err
	}
	// The progress meter is written to stderr and is noisy when rendered in
	// the Output panel. Keep curl errors visible while hiding that meter.
	args = append(args,
		"--silent", "--show-error",
		"--dump-header", "-",
		"--write-out", "\n__CURLDESK_META__%{http_code}|%{time_total}|%{size_request}|%{size_download}",
	)

	executable := "curl"
	if runtime.GOOS == "windows" {
		executable = "curl.exe"
	}
	cmd := exec.Command(executable, args...)
	r.mu.Lock()
	r.process = cmd
	r.mu.Unlock()
	defer func() {
		r.mu.Lock()
		if r.process == cmd {
			r.process = nil
		}
		r.mu.Unlock()
	}()
	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err = cmd.Run()
	if cmd.ProcessState == nil {
		log.Printf("[curl] failed to start: %v", err)
		return RunResult{}, fmt.Errorf("curl executable not found: %w", err)
	}
	result := RunResult{ExitCode: cmd.ProcessState.ExitCode()}
	result.Output, result.ResponseHeaders, result.Status, result.DurationMs, result.RequestSize, result.ResponseSize = parseCurlOutput(stdout.String())
	if result.ExitCode != 0 && stderr.Len() > 0 {
		result.Output = strings.TrimSpace(result.Output + "\n" + stderr.String())
	}
	log.Printf("[curl] finished with exit code %d (%d bytes)", result.ExitCode, len(result.Output))
	return result, nil
}

func (r *CurlRunner) RunCurlStream(command, runID string) (RunResult, error) {
	log.Printf("[curl] starting stream request (%d bytes)", len(command))
	args, err := parseCurlCommand(command)
	if err != nil {
		return RunResult{}, err
	}
	headerFile, err := os.CreateTemp("", "curldesk-response-*.headers")
	if err != nil {
		return RunResult{}, fmt.Errorf("create response header file: %w", err)
	}
	headerPath := headerFile.Name()
	if err := headerFile.Close(); err != nil {
		os.Remove(headerPath)
		return RunResult{}, fmt.Errorf("close response header file: %w", err)
	}
	defer os.Remove(headerPath)

	args = append(args,
		"--no-buffer", "--silent", "--show-error",
		"--dump-header", headerPath,
		// Keep curl's bookkeeping off stdout. SSE data must be forwarded byte-for-byte
		// as soon as curl receives it; a write-out marker on stdout would otherwise
		// force the stream writer to hold a suffix while looking for that marker.
		"--write-out", "%{stderr}__CURLDESK_META__%{http_code}|%{time_total}|%{size_request}|%{size_download}",
	)
	executable := "curl"
	if runtime.GOOS == "windows" {
		executable = "curl.exe"
	}
	cmd := exec.Command(executable, args...)
	r.setProcess(cmd)
	defer r.clearProcess(cmd)

	var stdout, stderr strings.Builder
	streamOutput := &curlStreamWriter{runID: runID, output: &stdout}
	cmd.Stdout = streamOutput
	cmd.Stderr = &stderr
	if err := cmd.Run(); cmd.ProcessState == nil {
		return RunResult{}, fmt.Errorf("curl executable not found: %w", err)
	} else if err != nil {
		log.Printf("[curl] stream exited with error: %v", err)
	}

	result := RunResult{ExitCode: cmd.ProcessState.ExitCode()}
	result.Output = stdout.String()
	result.Status, result.DurationMs, result.RequestSize, result.ResponseSize = parseCurlMetadata(stderr.String())
	if headers, readErr := os.ReadFile(headerPath); readErr == nil {
		result.ResponseHeaders = string(headers)
	}
	if result.ExitCode != 0 && stderr.Len() > 0 {
		result.Output = strings.TrimSpace(result.Output + "\n" + stripCurlMetadata(stderr.String()))
	}
	log.Printf("[curl] stream finished with exit code %d (%d bytes)", result.ExitCode, len(result.Output))
	return result, nil
}

type curlStreamWriter struct {
	runID  string
	output *strings.Builder
}

func (w *curlStreamWriter) Write(data []byte) (int, error) {
	text := string(data)
	w.output.WriteString(text)
	w.emit(text)
	return len(data), nil
}

func (w *curlStreamWriter) emit(chunk string) {
	if chunk == "" || application.Get() == nil {
		return
	}
	application.Get().Event.Emit(curlStreamEvent, curlStreamChunk{RunID: w.runID, Chunk: chunk})
}

func parseCurlMetadata(output string) (status int, durationMs, requestSize, responseSize int64) {
	const marker = "__CURLDESK_META__"
	markerIndex := strings.LastIndex(output, marker)
	if markerIndex == -1 {
		return 0, 0, 0, 0
	}
	metadata := strings.Split(strings.TrimSpace(output[markerIndex+len(marker):]), "|")
	if len(metadata) != 4 {
		return 0, 0, 0, 0
	}
	fmt.Sscanf(metadata[0], "%d", &status)
	var seconds float64
	fmt.Sscanf(metadata[1], "%f", &seconds)
	durationMs = int64(seconds*1000 + 0.5)
	fmt.Sscanf(metadata[2], "%d", &requestSize)
	fmt.Sscanf(metadata[3], "%d", &responseSize)
	return status, durationMs, requestSize, responseSize
}

func stripCurlMetadata(output string) string {
	const marker = "__CURLDESK_META__"
	if markerIndex := strings.LastIndex(output, marker); markerIndex >= 0 {
		return strings.TrimSpace(output[:markerIndex])
	}
	return output
}

func (r *CurlRunner) setProcess(cmd *exec.Cmd) {
	r.mu.Lock()
	r.process = cmd
	r.mu.Unlock()
}

func (r *CurlRunner) clearProcess(cmd *exec.Cmd) {
	r.mu.Lock()
	if r.process == cmd {
		r.process = nil
	}
	r.mu.Unlock()
}

func parseCurlOutput(output string) (body, headers string, status int, durationMs, requestSize, responseSize int64) {
	const marker = "__CURLDESK_META__"
	markerIndex := strings.LastIndex(output, marker)
	if markerIndex == -1 {
		return output, "", 0, 0, 0, 0
	}

	payload := strings.TrimSuffix(output[:markerIndex], "\n")
	metadata := strings.Split(strings.TrimSpace(output[markerIndex+len(marker):]), "|")
	if len(metadata) == 4 {
		fmt.Sscanf(metadata[0], "%d", &status)
		var seconds float64
		fmt.Sscanf(metadata[1], "%f", &seconds)
		durationMs = int64(seconds*1000 + 0.5)
		fmt.Sscanf(metadata[2], "%d", &requestSize)
		fmt.Sscanf(metadata[3], "%d", &responseSize)
	}

	headers, body = splitResponseHeaders(payload)
	return body, headers, status, durationMs, requestSize, responseSize
}

func splitResponseHeaders(output string) (headers, body string) {
	remaining := output
	var blocks []string
	for strings.HasPrefix(remaining, "HTTP/") {
		separator := strings.Index(remaining, "\r\n\r\n")
		separatorSize := 4
		if separator == -1 {
			separator = strings.Index(remaining, "\n\n")
			separatorSize = 2
		}
		if separator == -1 {
			return "", output
		}
		block := remaining[:separator]
		blocks = append(blocks, block)
		remaining = remaining[separator+separatorSize:]
		if !strings.HasPrefix(remaining, "HTTP/") {
			break
		}
	}
	if len(blocks) == 0 {
		return "", output
	}
	return strings.Join(blocks, "\n\n"), remaining
}

func (r *CurlRunner) StopCurl() error {
	r.mu.Lock()
	process := r.process
	r.mu.Unlock()
	if process == nil || process.Process == nil {
		return nil
	}
	log.Printf("[curl] stopping request")
	return process.Process.Kill()
}

func parseCurlCommand(command string) ([]string, error) {
	command = stripShellComments(command)
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

// stripShellComments removes shell comments while preserving # inside quoted
// URLs, headers, and request bodies.
func stripShellComments(command string) string {
	var result strings.Builder
	var quote rune
	escaped := false
	inComment := false
	for _, char := range command {
		if inComment {
			if char == '\n' {
				inComment = false
				result.WriteRune(char)
			}
			continue
		}
		if escaped {
			result.WriteRune(char)
			escaped = false
			continue
		}
		if char == '\\' && quote != '\'' {
			result.WriteRune(char)
			escaped = true
			continue
		}
		if quote != 0 {
			result.WriteRune(char)
			if char == quote {
				quote = 0
			}
			continue
		}
		if char == '\'' || char == '"' {
			quote = char
			result.WriteRune(char)
			continue
		}
		if char == '#' {
			inComment = true
			continue
		}
		result.WriteRune(char)
	}
	return result.String()
}
