package main

import (
	"fmt"
	"os"
	"strings"
)

type WorkspaceSearchResult struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Line    int    `json:"line"`
	Snippet string `json:"snippet"`
}

func (w *WorkspaceService) SearchWorkspace(query string) ([]WorkspaceSearchResult, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return []WorkspaceSearchResult{}, nil
	}
	entries, err := w.ListWorkspace()
	if err != nil {
		return nil, err
	}
	needle := strings.ToLower(query)
	results := make([]WorkspaceSearchResult, 0)
	for _, entry := range entries {
		if entry.IsDir {
			continue
		}
		if strings.Contains(strings.ToLower(entry.Name), needle) || strings.Contains(strings.ToLower(entry.Path), needle) {
			results = append(results, WorkspaceSearchResult{Path: entry.Path, Name: entry.Name, Line: 0, Snippet: "filename match"})
		}
		content, readErr := w.ReadFile(entry.Path)
		if readErr != nil {
			continue
		}
		for lineNumber, line := range strings.Split(content, "\n") {
			if !strings.Contains(strings.ToLower(line), needle) {
				continue
			}
			results = append(results, WorkspaceSearchResult{Path: entry.Path, Name: entry.Name, Line: lineNumber + 1, Snippet: strings.TrimSpace(line)})
			if len(results) >= 200 {
				return results, nil
			}
		}
	}
	return results, nil
}

func (w *WorkspaceService) ReadSearchResult(result WorkspaceSearchResult) (string, error) {
	if result.Path == "" {
		return "", fmt.Errorf("search result path is empty")
	}
	path, err := w.resolve(result.Path)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
