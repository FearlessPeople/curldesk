package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMaskSensitiveValues(t *testing.T) {
	masked := maskSensitiveValues("Authorization: Bearer super-secret-token", map[string]string{"token": "super-secret-token"})
	if strings.Contains(masked, "super-secret-token") || !strings.Contains(masked, "<redacted:token>") {
		t.Fatalf("masked = %q", masked)
	}
}

func TestHistoryRoundTrip(t *testing.T) {
	service := &WorkspaceService{root: t.TempDir()}
	if err := os.WriteFile(filepath.Join(service.root, "environments.yaml"), []byte("Dev:\n  token: \"secret-value\"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := service.RecordHistory("requests/demo.curl", "Dev", "curl {{token}}", "token=secret-value", "Authorization: secret-value", 0, 200, 12); err != nil {
		t.Fatal(err)
	}
	entries, err := service.ListHistory("demo")
	if err != nil || len(entries) != 1 {
		t.Fatalf("entries = %#v, err = %v", entries, err)
	}
	if strings.Contains(entries[0].Output, "secret-value") || strings.Contains(entries[0].ResponseHeaders, "secret-value") {
		t.Fatalf("history contains a secret: %#v", entries[0])
	}
	if err := service.ClearHistory(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(service.root + "/.curldesk/history.jsonl"); !os.IsNotExist(err) {
		t.Fatalf("history file still exists, err = %v", err)
	}
}
