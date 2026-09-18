package backend

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWorkspaceInfoMarksDefaultWorkspace(t *testing.T) {
	defaultPath, err := defaultWorkspacePath()
	if err != nil {
		t.Fatal(err)
	}
	info := workspaceInfo(defaultPath)
	if !info.Default || info.Name != "My Workspace" {
		t.Fatalf("info = %#v", info)
	}

	custom := workspaceInfo(filepath.Join(t.TempDir(), "project"))
	if custom.Default || custom.Name != "project" {
		t.Fatalf("custom info = %#v", custom)
	}
}

func TestEnvironmentFileRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "global-environments.yaml")
	want := map[string]map[string]string{"localhost": {"BASE_URL": "http://localhost:7001", "TOKEN": "secret"}}
	if err := writeEnvironmentsFile(path, want); err != nil {
		t.Fatal(err)
	}
	got := readEnvironmentsFile(path)
	if got["localhost"]["BASE_URL"] != want["localhost"]["BASE_URL"] || got["localhost"]["TOKEN"] != want["localhost"]["TOKEN"] {
		t.Fatalf("got = %#v", got)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("global environment permissions = %o", info.Mode().Perm())
	}
}

func TestDeleteWorkspaceProtectsDefaultAndCurrentWorkspace(t *testing.T) {
	service := &WorkspaceService{root: filepath.Join(t.TempDir(), "current")}
	if err := os.MkdirAll(service.root, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := service.DeleteWorkspace(service.root); err == nil {
		t.Fatal("expected current workspace deletion to fail")
	}
	defaultPath, err := defaultWorkspacePath()
	if err != nil {
		t.Fatal(err)
	}
	if err := service.DeleteWorkspace(defaultPath); err == nil {
		t.Fatal("expected default workspace deletion to fail")
	}
}

func TestDeleteWorkspaceRemovesCustomWorkspace(t *testing.T) {
	root := t.TempDir()
	service := &WorkspaceService{root: filepath.Join(root, "current")}
	target := filepath.Join(root, "remove-me")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := service.DeleteWorkspace(target); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(target); !os.IsNotExist(err) {
		t.Fatalf("workspace still exists, err = %v", err)
	}
}
