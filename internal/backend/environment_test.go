package backend

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseDotEnv(t *testing.T) {
	values := parseDotEnv("TOKEN=plain\nexport QUOTED=\"hello world\"\n# ignored\nINVALID.KEY=nope\n")
	if values["TOKEN"] != "plain" || values["QUOTED"] != "hello world" {
		t.Fatalf("values = %#v", values)
	}
	if _, ok := values["INVALID.KEY"]; ok {
		t.Fatal("invalid dotenv key was accepted")
	}
}

func TestResolveEnvironmentLayersValuesAndReportsMissing(t *testing.T) {
	root := t.TempDir()
	service := &WorkspaceService{root: root}
	if err := os.WriteFile(filepath.Join(root, ".env"), []byte("TOKEN=from-dotenv\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "environments.yaml"), []byte("Dev:\n  TOKEN: \"from-dev\"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	resolved, err := service.ResolveEnvironment("curl https://example.com/{{TOKEN}}", "Dev")
	if err != nil || resolved != "curl https://example.com/from-dev" {
		t.Fatalf("resolved = %q, err = %v", resolved, err)
	}
	missing, err := service.ValidateEnvironment("curl {{MISSING}}", "Dev")
	if err != nil || len(missing) != 1 || missing[0] != "MISSING" {
		t.Fatalf("missing = %#v, err = %v", missing, err)
	}
}
