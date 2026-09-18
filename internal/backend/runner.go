package backend

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"

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

type CurlDiagnostic struct {
	Line     int    `json:"line"`
	Column   int    `json:"column"`
	Message  string `json:"message"`
	Severity string `json:"severity"`
}

type CurlValidation struct {
	Valid       bool             `json:"valid"`
	Diagnostics []CurlDiagnostic `json:"diagnostics"`
}

type CurlRunner struct {
	mu         sync.Mutex
	processes  map[string]*exec.Cmd
	lastRunID  string
	executable string
	timeout    time.Duration
}

func (r *CurlRunner) RunCurl(command string) (RunResult, error) {
	return r.runCurl(command, fmt.Sprintf("run-%d", time.Now().UnixNano()))
}

func (r *CurlRunner) runCurl(command, runID string) (RunResult, error) {
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

	ctx, cancel := r.commandContext()
	defer cancel()
	cmd := r.newCommand(ctx, runID, args)
	defer r.clearProcess(runID, cmd)
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
	ctx, cancel := r.commandContext()
	defer cancel()
	cmd := r.newCommand(ctx, runID, args)
	defer r.clearProcess(runID, cmd)

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

func (r *CurlRunner) commandContext() (context.Context, context.CancelFunc) {
	r.mu.Lock()
	timeout := r.timeout
	r.mu.Unlock()
	if timeout <= 0 {
		return context.Background(), func() {}
	}
	return context.WithTimeout(context.Background(), timeout)
}

func (r *CurlRunner) newCommand(ctx context.Context, runID string, args []string) *exec.Cmd {
	r.mu.Lock()
	executable := r.executable
	if executable == "" {
		executable = "curl"
		if runtime.GOOS == "windows" {
			executable = "curl.exe"
		}
	}
	if r.processes == nil {
		r.processes = make(map[string]*exec.Cmd)
	}
	cmd := exec.CommandContext(ctx, executable, args...)
	configureCurlProcess(cmd)
	r.processes[runID] = cmd
	r.lastRunID = runID
	r.mu.Unlock()
	return cmd
}

func (r *CurlRunner) clearProcess(runID string, cmd *exec.Cmd) {
	r.mu.Lock()
	if current, ok := r.processes[runID]; ok && current == cmd {
		delete(r.processes, runID)
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
	processes := make([]*exec.Cmd, 0, len(r.processes))
	for _, process := range r.processes {
		processes = append(processes, process)
	}
	r.mu.Unlock()
	for _, process := range processes {
		if process != nil && process.Process != nil {
			log.Printf("[curl] stopping request")
			if err := process.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
				return err
			}
		}
	}
	return nil
}

// StopCurlByID stops one running request without affecting other tabs.
func (r *CurlRunner) StopCurlByID(runID string) error {
	r.mu.Lock()
	process := r.processes[runID]
	r.mu.Unlock()
	if process == nil || process.Process == nil {
		return nil
	}
	return process.Process.Kill()
}

// SetCurlPath configures the executable used for future runs. An empty path
// restores the platform default (curl or curl.exe).
func (r *CurlRunner) SetCurlPath(path string) error {
	path = strings.TrimSpace(path)
	if path != "" {
		if _, err := exec.LookPath(path); err != nil {
			return fmt.Errorf("curl executable not found: %w", err)
		}
	}
	r.mu.Lock()
	r.executable = path
	r.mu.Unlock()
	return nil
}

func (r *CurlRunner) SetTimeout(timeoutMs int64) error {
	if timeoutMs < 0 {
		return errors.New("curl timeout cannot be negative")
	}
	r.mu.Lock()
	r.timeout = time.Duration(timeoutMs) * time.Millisecond
	r.mu.Unlock()
	return nil
}

func (r *CurlRunner) ServiceShutdown() error {
	return r.StopCurl()
}

// ValidateCurl performs the checks that are safe to run before starting a
// process. It intentionally accepts curl's broad option set and focuses on
// malformed quoting, shell execution syntax, and missing option values.
func (r *CurlRunner) ValidateCurl(command string) CurlValidation {
	validation := CurlValidation{Valid: true, Diagnostics: []CurlDiagnostic{}}
	args, err := parseCurlCommand(command)
	if err != nil {
		validation.Valid = false
		validation.Diagnostics = append(validation.Diagnostics, CurlDiagnostic{Line: 1, Column: 1, Message: err.Error(), Severity: "error"})
		return validation
	}

	if containsUnsafeShellSyntax(command) {
		validation.Valid = false
		validation.Diagnostics = append(validation.Diagnostics, CurlDiagnostic{Line: 1, Column: 1, Message: "shell operators are not allowed; execute curl arguments only", Severity: "error"})
	}
	for index, arg := range args {
		if !curlOptionNeedsValue(arg) {
			continue
		}
		if index+1 >= len(args) || strings.HasPrefix(args[index+1], "-") {
			validation.Valid = false
			validation.Diagnostics = append(validation.Diagnostics, CurlDiagnostic{Line: 1, Column: 1, Message: fmt.Sprintf("curl option %s requires a value", arg), Severity: "error"})
		}
	}
	return validation
}

func curlOptionNeedsValue(option string) bool {
	switch option {
	case "-X", "--request", "-H", "--header", "-d", "--data", "--data-raw", "--data-binary", "--data-urlencode", "-F", "--form", "--url", "-o", "--output", "--max-time", "--connect-timeout":
		return true
	default:
		return false
	}
}

func containsUnsafeShellSyntax(command string) bool {
	var quote rune
	escaped := false
	for _, char := range command {
		if escaped {
			escaped = false
			continue
		}
		if char == '\\' && quote != '\'' {
			escaped = true
			continue
		}
		if quote != 0 {
			if char == quote {
				quote = 0
			}
			continue
		}
		if char == '\'' || char == '"' {
			quote = char
			continue
		}
		if char == ';' || char == '`' || char == '|' || char == '$' || char == '>' || char == '<' {
			return true
		}
	}
	return false
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
