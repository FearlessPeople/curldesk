package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

var environmentVariablePattern = regexp.MustCompile(`\{\{\s*([A-Za-z_][A-Za-z0-9_-]*)\s*\}\}`)

// ResolveEnvironment expands CurlDesk variables without invoking a shell.
// Values are layered from system environment, workspace .env, then the
// selected CurlDesk environment, so explicit workspace settings win.
func (w *WorkspaceService) ResolveEnvironment(command, environment string) (string, error) {
	if err := w.ensureRoot(); err != nil {
		return "", err
	}
	values := systemEnvironment()
	if dotenv, err := w.LoadDotEnv(); err == nil {
		for key, value := range dotenv {
			values[key] = value
		}
	}
	environments, err := w.ListEnvironments()
	if err != nil {
		return "", err
	}
	for key, value := range environments[environment] {
		values[key] = value
	}

	missing := make([]string, 0)
	resolved := environmentVariablePattern.ReplaceAllStringFunc(command, func(match string) string {
		key := environmentVariablePattern.FindStringSubmatch(match)[1]
		value, ok := values[key]
		if !ok {
			missing = append(missing, key)
			return match
		}
		return value
	})
	if len(missing) > 0 {
		return "", fmt.Errorf("missing environment variables: %s", strings.Join(uniqueStrings(missing), ", "))
	}
	return resolved, nil
}

func (w *WorkspaceService) ValidateEnvironment(command, environment string) ([]string, error) {
	_, err := w.ResolveEnvironment(command, environment)
	if err == nil {
		return []string{}, nil
	}
	if strings.HasPrefix(err.Error(), "missing environment variables: ") {
		return strings.Split(strings.TrimPrefix(err.Error(), "missing environment variables: "), ", "), nil
	}
	return nil, err
}

func (w *WorkspaceService) LoadDotEnv() (map[string]string, error) {
	if err := w.ensureRoot(); err != nil {
		return nil, err
	}
	data, err := os.ReadFile(filepath.Join(w.root, ".env"))
	if os.IsNotExist(err) {
		return map[string]string{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read .env: %w", err)
	}
	return parseDotEnv(string(data)), nil
}

func (w *WorkspaceService) SaveDotEnv(values map[string]string) error {
	if err := w.ensureRoot(); err != nil {
		return err
	}
	var builder strings.Builder
	keys := sortedEnvironmentKeys(values)
	for _, key := range keys {
		if validEnvironmentKey(key) {
			builder.WriteString(key)
			builder.WriteString("=")
			builder.WriteString(strconv.Quote(values[key]))
			builder.WriteString("\n")
		}
	}
	return os.WriteFile(filepath.Join(w.root, ".env"), []byte(builder.String()), 0o600)
}

func parseDotEnv(content string) map[string]string {
	values := make(map[string]string)
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		if !validEnvironmentKey(key) {
			continue
		}
		if len(value) >= 2 && ((value[0] == '"' && value[len(value)-1] == '"') || (value[0] == '\'' && value[len(value)-1] == '\'')) {
			if value[0] == '"' {
				if decoded, err := strconv.Unquote(value); err == nil {
					value = decoded
				}
			} else {
				value = value[1 : len(value)-1]
			}
		}
		values[key] = value
	}
	return values
}

func systemEnvironment() map[string]string {
	values := make(map[string]string)
	for _, entry := range os.Environ() {
		parts := strings.SplitN(entry, "=", 2)
		if len(parts) == 2 && validEnvironmentKey(parts[0]) {
			values[parts[0]] = parts[1]
		}
	}
	return values
}

func sortedEnvironmentKeys(values map[string]string) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
