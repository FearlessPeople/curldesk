package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

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

func (w *WorkspaceService) initialize() {
	if w.root != "" {
		return
	}
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	w.root = filepath.Join(home, "CurlDeskWorkspace")
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
