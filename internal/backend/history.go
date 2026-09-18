package backend

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type HistoryEntry struct {
	ID              string `json:"id"`
	CreatedAt       string `json:"createdAt"`
	FilePath        string `json:"filePath"`
	Environment     string `json:"environment"`
	Command         string `json:"command"`
	Output          string `json:"output"`
	ResponseHeaders string `json:"responseHeaders"`
	ExitCode        int    `json:"exitCode"`
	Status          int    `json:"status"`
	DurationMs      int64  `json:"durationMs"`
}

func (w *WorkspaceService) RecordHistory(filePath, environment, command, output, responseHeaders string, exitCode, status int, durationMs int64) error {
	if err := w.ensureRoot(); err != nil {
		return err
	}
	values, err := w.historyEnvironmentValues(environment)
	if err != nil {
		return err
	}
	entry := HistoryEntry{
		ID:              fmt.Sprintf("history-%d", time.Now().UnixNano()),
		CreatedAt:       time.Now().UTC().Format(time.RFC3339Nano),
		FilePath:        filePath,
		Environment:     environment,
		Command:         command,
		Output:          maskSensitiveValues(output, values),
		ResponseHeaders: maskSensitiveValues(responseHeaders, values),
		ExitCode:        exitCode,
		Status:          status,
		DurationMs:      durationMs,
	}
	path := filepath.Join(w.root, ".curldesk")
	if err := os.MkdirAll(path, 0o700); err != nil {
		return err
	}
	file, err := os.OpenFile(filepath.Join(path, "history.jsonl"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return fmt.Errorf("open history: %w", err)
	}
	defer file.Close()
	if err := json.NewEncoder(file).Encode(entry); err != nil {
		return fmt.Errorf("write history: %w", err)
	}
	return file.Chmod(0o600)
}

func (w *WorkspaceService) ListHistory(query string) ([]HistoryEntry, error) {
	if err := w.ensureRoot(); err != nil {
		return nil, err
	}
	file, err := os.Open(filepath.Join(w.root, ".curldesk", "history.jsonl"))
	if os.IsNotExist(err) {
		return []HistoryEntry{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("open history: %w", err)
	}
	defer file.Close()
	needle := strings.ToLower(strings.TrimSpace(query))
	entries := make([]HistoryEntry, 0)
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64*1024), 8*1024*1024)
	for scanner.Scan() {
		var entry HistoryEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			continue
		}
		if needle != "" && !strings.Contains(strings.ToLower(entry.Command+" "+entry.FilePath+" "+entry.Environment+" "+entry.Output), needle) {
			continue
		}
		entries = append(entries, entry)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read history: %w", err)
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].CreatedAt > entries[j].CreatedAt })
	if len(entries) > 100 {
		entries = entries[:100]
	}
	return entries, nil
}

func (w *WorkspaceService) ClearHistory() error {
	if err := w.ensureRoot(); err != nil {
		return err
	}
	path := filepath.Join(w.root, ".curldesk", "history.jsonl")
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("clear history: %w", err)
	}
	return nil
}

func (w *WorkspaceService) historyEnvironmentValues(environment string) (map[string]string, error) {
	values := systemEnvironment()
	globalEnvironments, err := w.ListGlobalEnvironments()
	if err != nil {
		return nil, err
	}
	for key, value := range globalEnvironments[environment] {
		values[key] = value
	}
	dotenv, err := w.LoadDotEnv()
	if err != nil {
		return nil, err
	}
	for key, value := range dotenv {
		values[key] = value
	}
	environments, err := w.ListEnvironments()
	if err != nil {
		return nil, err
	}
	for key, value := range environments[environment] {
		values[key] = value
	}
	return values, nil
}

func maskSensitiveValues(content string, values map[string]string) string {
	type secretValue struct {
		value string
		key   string
	}
	secrets := make([]secretValue, 0)
	for key, value := range values {
		if !isSensitiveEnvironmentKey(key) || len(value) < 3 {
			continue
		}
		secrets = append(secrets, secretValue{value: value, key: key})
	}
	sort.Slice(secrets, func(i, j int) bool { return len(secrets[i].value) > len(secrets[j].value) })
	for _, secret := range secrets {
		content = strings.ReplaceAll(content, secret.value, "<redacted:"+secret.key+">")
	}
	return content
}

func isSensitiveEnvironmentKey(key string) bool {
	key = strings.ToLower(key)
	for _, part := range []string{"token", "secret", "password", "passwd", "api_key", "api-key", "private_key", "private-key", "authorization", "credential"} {
		if strings.Contains(key, part) {
			return true
		}
	}
	return false
}
