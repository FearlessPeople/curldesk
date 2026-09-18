package backend

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
)

type WorkspaceInfo struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Default bool   `json:"default"`
}

type WorkspaceEntry struct {
	Path   string `json:"path"`
	Name   string `json:"name"`
	Folder string `json:"folder"`
	IsDir  bool   `json:"isDir"`
	Size   int64  `json:"size"`
}

type WorkspaceService struct {
	root string
}

func (w *WorkspaceService) CurrentWorkspace() WorkspaceInfo {
	w.initialize()
	_ = os.MkdirAll(w.root, 0o755)
	info := workspaceInfo(w.root)
	_ = w.rememberWorkspace(info)
	return info
}

func (w *WorkspaceService) ListRecentWorkspaces() ([]WorkspaceInfo, error) {
	path, err := recentWorkspacesPath()
	if err != nil {
		return []WorkspaceInfo{}, nil
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return []WorkspaceInfo{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read recent workspaces: %w", err)
	}
	var workspaces []WorkspaceInfo
	if err := json.Unmarshal(data, &workspaces); err != nil {
		return []WorkspaceInfo{}, nil
	}
	return existingWorkspaces(workspaces), nil
}

func (w *WorkspaceService) CreateWorkspace(path string) (WorkspaceInfo, error) {
	resolved, err := normalizeWorkspacePath(path)
	if err != nil {
		return WorkspaceInfo{}, err
	}
	if err := os.MkdirAll(resolved, 0o755); err != nil {
		return WorkspaceInfo{}, fmt.Errorf("create workspace: %w", err)
	}
	w.root = resolved
	info := w.CurrentWorkspace()
	return info, w.rememberWorkspace(info)
}

// CreateWorkspaceByName creates a new workspace in CurlDesk's managed workspace directory.
func (w *WorkspaceService) CreateWorkspaceByName(name string) (WorkspaceInfo, error) {
	name = strings.TrimSpace(name)
	if !validWorkspaceName(name) {
		return WorkspaceInfo{}, errors.New("workspace name must be a single folder name")
	}
	root, err := managedWorkspacesPath()
	if err != nil {
		return WorkspaceInfo{}, err
	}
	path := filepath.Join(root, name)
	if _, err := os.Stat(path); err == nil {
		return WorkspaceInfo{}, errors.New("a workspace with this name already exists")
	} else if !os.IsNotExist(err) {
		return WorkspaceInfo{}, fmt.Errorf("check workspace: %w", err)
	}
	if err := os.MkdirAll(path, 0o755); err != nil {
		return WorkspaceInfo{}, fmt.Errorf("create workspace: %w", err)
	}
	w.root = path
	info := workspaceInfo(path)
	return info, w.rememberWorkspace(info)
}

func (w *WorkspaceService) OpenWorkspace(path string) (WorkspaceInfo, error) {
	resolved, err := normalizeWorkspacePath(path)
	if err != nil {
		return WorkspaceInfo{}, err
	}
	stat, err := os.Stat(resolved)
	if err != nil {
		return WorkspaceInfo{}, fmt.Errorf("open workspace: %w", err)
	}
	if !stat.IsDir() {
		return WorkspaceInfo{}, errors.New("workspace path must be a directory")
	}
	w.root = resolved
	info := w.CurrentWorkspace()
	return info, w.rememberWorkspace(info)
}

// OpenWorkspaceInFileManager opens a workspace directory in the native file manager.
func (w *WorkspaceService) OpenWorkspaceInFileManager(path string) error {
	resolved, err := normalizeWorkspacePath(path)
	if err != nil {
		return err
	}
	info, err := os.Stat(resolved)
	if err != nil {
		return fmt.Errorf("open workspace directory: %w", err)
	}
	if !info.IsDir() {
		return errors.New("workspace path must be a directory")
	}

	var command *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		command = exec.Command("open", resolved)
	case "windows":
		command = exec.Command("explorer", resolved)
	default:
		command = exec.Command("xdg-open", resolved)
	}
	if err := command.Start(); err != nil {
		return fmt.Errorf("open workspace directory: %w", err)
	}
	return nil
}

// DeleteWorkspace removes a custom workspace from disk.
func (w *WorkspaceService) DeleteWorkspace(path string) error {
	resolved, err := normalizeWorkspacePath(path)
	if err != nil {
		return err
	}
	if isDefaultWorkspacePath(resolved) {
		return errors.New("the default workspace cannot be deleted")
	}
	w.initialize()
	if filepath.Clean(w.root) == filepath.Clean(resolved) {
		return errors.New("switch to another workspace before deleting the current workspace")
	}
	info, err := os.Stat(resolved)
	if err != nil {
		return fmt.Errorf("delete workspace: %w", err)
	}
	if !info.IsDir() {
		return errors.New("workspace path must be a directory")
	}
	if err := os.RemoveAll(resolved); err != nil {
		return fmt.Errorf("delete workspace: %w", err)
	}
	return nil
}

func (w *WorkspaceService) ImportWorkspace(source string) error {
	resolved, err := normalizeWorkspacePath(source)
	if err != nil {
		return err
	}
	stat, err := os.Stat(resolved)
	if err != nil || !stat.IsDir() {
		return errors.New("import source must be a directory")
	}
	entries, err := os.ReadDir(resolved)
	if err != nil {
		return fmt.Errorf("read import source: %w", err)
	}
	if err := w.ensureRoot(); err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() || strings.ToLower(filepath.Ext(entry.Name())) != ".curl" {
			continue
		}
		content, readErr := os.ReadFile(filepath.Join(resolved, entry.Name()))
		if readErr != nil {
			return fmt.Errorf("read imported file: %w", readErr)
		}
		target := filepath.Join(w.root, entry.Name())
		if _, statErr := os.Stat(target); statErr == nil {
			target = filepath.Join(w.root, strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name()))+"-imported"+filepath.Ext(entry.Name()))
		}
		if writeErr := os.WriteFile(target, content, 0o644); writeErr != nil {
			return fmt.Errorf("write imported file: %w", writeErr)
		}
	}
	return nil
}

func (w *WorkspaceService) rememberWorkspace(info WorkspaceInfo) error {
	workspaces, _ := w.ListRecentWorkspaces()
	next := []WorkspaceInfo{info}
	for _, workspace := range workspaces {
		if workspace.Path != info.Path && len(next) < 10 {
			next = append(next, workspace)
		}
	}
	path, err := recentWorkspacesPath()
	if err != nil {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(next, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

func recentWorkspacesPath() (string, error) {
	config, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(config, "CurlDesk", "recent-workspaces.json"), nil
}

func managedWorkspacesPath() (string, error) {
	config, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(config, "CurlDesk", "workspaces"), nil
}

func normalizeWorkspacePath(path string) (string, error) {
	path = strings.TrimSpace(path)
	if strings.HasPrefix(path, "~"+string(filepath.Separator)) {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		path = filepath.Join(home, strings.TrimPrefix(path, "~"+string(filepath.Separator)))
	}
	if path == "" {
		return "", errors.New("workspace path is required")
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", fmt.Errorf("invalid workspace path: %w", err)
	}
	return filepath.Clean(absolute), nil
}

func existingWorkspaces(workspaces []WorkspaceInfo) []WorkspaceInfo {
	result := make([]WorkspaceInfo, 0, len(workspaces))
	seen := make(map[string]struct{})
	for _, workspace := range workspaces {
		if workspace.Path == "" {
			continue
		}
		if _, ok := seen[workspace.Path]; ok {
			continue
		}
		if info, err := os.Stat(workspace.Path); err == nil && info.IsDir() {
			workspace.Default = isDefaultWorkspacePath(workspace.Path)
			if workspace.Default {
				workspace.Name = "My Workspace"
			} else if workspace.Name == "" {
				workspace.Name = filepath.Base(workspace.Path)
			}
			result = append(result, workspace)
			seen[workspace.Path] = struct{}{}
		}
	}
	return result
}

func (w *WorkspaceService) ListEnvironments() (map[string]map[string]string, error) {
	if err := w.ensureRoot(); err != nil {
		return nil, err
	}
	path := filepath.Join(w.root, "environments.yaml")
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return map[string]map[string]string{"Dev": {}}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read environments: %w", err)
	}
	return parseEnvironmentsYAML(string(data)), nil
}

func (w *WorkspaceService) SaveEnvironments(environments map[string]map[string]string) error {
	if err := w.ensureRoot(); err != nil {
		return err
	}
	var builder strings.Builder
	for name, variables := range environments {
		if !validName(name) {
			continue
		}
		builder.WriteString(fmt.Sprintf("%s:\n", name))
		for key, value := range variables {
			if validEnvironmentKey(key) {
				builder.WriteString(fmt.Sprintf("  %s: %s\n", key, strconv.Quote(value)))
			}
		}
	}
	path := filepath.Join(w.root, "environments.yaml")
	if err := os.WriteFile(path, []byte(builder.String()), 0o600); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

func (w *WorkspaceService) LoadSettings() (map[string]string, error) {
	if err := w.ensureRoot(); err != nil {
		return nil, err
	}
	data, err := os.ReadFile(filepath.Join(w.root, "settings.yaml"))
	if os.IsNotExist(err) {
		return map[string]string{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read settings: %w", err)
	}
	return parseFlatYAML(string(data)), nil
}

func (w *WorkspaceService) SaveSettings(settings map[string]string) error {
	if err := w.ensureRoot(); err != nil {
		return err
	}
	var builder strings.Builder
	for key, value := range settings {
		if validEnvironmentKey(key) {
			builder.WriteString(fmt.Sprintf("%s: %s\n", key, strconv.Quote(value)))
		}
	}
	return os.WriteFile(filepath.Join(w.root, "settings.yaml"), []byte(builder.String()), 0o644)
}

func validEnvironmentKey(key string) bool {
	if key == "" {
		return false
	}
	for _, char := range key {
		if !(char == '_' || char == '-' || char >= 'A' && char <= 'Z' || char >= 'a' && char <= 'z' || char >= '0' && char <= '9') {
			return false
		}
	}
	return true
}

func parseEnvironmentsYAML(content string) map[string]map[string]string {
	result := make(map[string]map[string]string)
	current := ""
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		if !strings.HasPrefix(line, " ") && strings.HasSuffix(trimmed, ":") {
			current = strings.TrimSuffix(trimmed, ":")
			result[current] = map[string]string{}
			continue
		}
		if current == "" || !strings.Contains(trimmed, ":") {
			continue
		}
		parts := strings.SplitN(trimmed, ":", 2)
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		if strings.HasPrefix(value, "\"") && strings.HasSuffix(value, "\"") {
			if decoded, err := strconv.Unquote(value); err == nil {
				value = decoded
			}
		}
		if validEnvironmentKey(key) {
			result[current][key] = value
		}
	}
	if len(result) == 0 {
		result["Dev"] = map[string]string{}
	}
	return result
}

func parseFlatYAML(content string) map[string]string {
	result := make(map[string]string)
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") || !strings.Contains(trimmed, ":") {
			continue
		}
		parts := strings.SplitN(trimmed, ":", 2)
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		if strings.HasPrefix(value, "\"") && strings.HasSuffix(value, "\"") {
			if decoded, err := strconv.Unquote(value); err == nil {
				value = decoded
			}
		}
		if validEnvironmentKey(key) {
			result[key] = value
		}
	}
	return result
}

func (w *WorkspaceService) initialize() {
	if w.root != "" {
		return
	}
	path, err := defaultWorkspacePath()
	if err != nil {
		home, homeErr := os.UserHomeDir()
		if homeErr != nil {
			home = "."
		}
		path = filepath.Join(home, "CurlDeskWorkspace")
	}
	w.root = path
}

func defaultWorkspacePath() (string, error) {
	config, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(config, "CurlDesk", "default-workspace"), nil
}

func isDefaultWorkspacePath(path string) bool {
	defaultPath, err := defaultWorkspacePath()
	return err == nil && filepath.Clean(path) == filepath.Clean(defaultPath)
}

func workspaceInfo(path string) WorkspaceInfo {
	info := WorkspaceInfo{Path: path, Name: filepath.Base(path), Default: isDefaultWorkspacePath(path)}
	if info.Default {
		info.Name = "My Workspace"
	}
	return info
}

func (w *WorkspaceService) ensureRoot() error {
	w.initialize()
	return os.MkdirAll(w.root, 0o755)
}

func (w *WorkspaceService) resolve(relative string) (string, error) {
	w.initialize()
	if relative == "" || relative == "." {
		return w.root, nil
	}
	clean := filepath.Clean(filepath.FromSlash(relative))
	if filepath.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return "", errors.New("invalid workspace path")
	}
	return filepath.Join(w.root, clean), nil
}

func validName(name string) bool {
	return name != "" && name != "." && name != ".." && filepath.Base(name) == name && !strings.ContainsAny(name, `/\\`)
}

func validWorkspaceName(name string) bool {
	return name != "" && name != "." && name != ".." && filepath.Base(name) == name && !strings.ContainsAny(name, `/\\:`)
}

func (w *WorkspaceService) ListWorkspace() ([]WorkspaceEntry, error) {
	if err := w.ensureRoot(); err != nil {
		return nil, err
	}
	var entries []WorkspaceEntry
	err := filepath.WalkDir(w.root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if path == w.root {
			return nil
		}
		if entry.Name()[0] == '.' {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		relative, err := filepath.Rel(w.root, path)
		if err != nil {
			return err
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if !entry.IsDir() && strings.ToLower(filepath.Ext(entry.Name())) != ".curl" {
			return nil
		}
		entries = append(entries, WorkspaceEntry{
			Path: filepath.ToSlash(relative), Name: entry.Name(),
			Folder: filepath.ToSlash(filepath.Dir(relative)), IsDir: entry.IsDir(), Size: info.Size(),
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Folder == entries[j].Folder && entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir
		}
		return entries[i].Path < entries[j].Path
	})
	return entries, nil
}

func (w *WorkspaceService) CreateFolder(parent, name string) error {
	if !validName(name) {
		return errors.New("invalid folder name")
	}
	parentPath, err := w.resolve(parent)
	if err != nil {
		return err
	}
	return os.Mkdir(filepath.Join(parentPath, name), 0o755)
}

func (w *WorkspaceService) CreateFile(folder, name string) (WorkspaceEntry, error) {
	if !validName(name) {
		return WorkspaceEntry{}, errors.New("invalid file name")
	}
	if filepath.Ext(name) == "" {
		name += ".curl"
	}
	if strings.ToLower(filepath.Ext(name)) != ".curl" {
		return WorkspaceEntry{}, errors.New("curl files must use the .curl extension")
	}
	folderPath, err := w.resolve(folder)
	if err != nil {
		return WorkspaceEntry{}, err
	}
	path := filepath.Join(folderPath, name)
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return WorkspaceEntry{}, err
	}
	defer file.Close()
	if _, err = file.WriteString("curl \"https://example.com\"\n"); err != nil {
		return WorkspaceEntry{}, err
	}
	return WorkspaceEntry{Path: filepath.ToSlash(filepath.Join(folder, name)), Name: name, Folder: filepath.ToSlash(folder)}, nil
}

func (w *WorkspaceService) RenameEntry(relative, name string) error {
	if !validName(name) {
		return errors.New("invalid entry name")
	}
	oldPath, err := w.resolve(relative)
	if err != nil {
		return err
	}
	if oldPath == w.root {
		return errors.New("cannot rename workspace root")
	}
	info, err := os.Stat(oldPath)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		if filepath.Ext(name) == "" {
			name += ".curl"
		} else if strings.ToLower(filepath.Ext(name)) != ".curl" {
			return errors.New("curl files must use the .curl extension")
		}
	}
	return os.Rename(oldPath, filepath.Join(filepath.Dir(oldPath), name))
}

func (w *WorkspaceService) DeleteEntry(relative string) error {
	path, err := w.resolve(relative)
	if err != nil {
		return err
	}
	if path == w.root {
		return errors.New("cannot delete workspace root")
	}
	return os.RemoveAll(path)
}

func (w *WorkspaceService) ReadFile(relative string) (string, error) {
	path, err := w.resolve(relative)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read curl file: %w", err)
	}
	return string(data), nil
}

func (w *WorkspaceService) SaveFile(relative, content string) error {
	path, err := w.resolve(relative)
	if err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0o644)
}
