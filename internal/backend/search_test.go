package backend

import "testing"

func TestSearchWorkspaceFindsCurlContent(t *testing.T) {
	service := &WorkspaceService{root: t.TempDir()}
	entry, err := service.CreateFile("", "searchable")
	if err != nil {
		t.Fatal(err)
	}
	if err := service.SaveFile(entry.Path, "curl https://example.com/users\n"); err != nil {
		t.Fatal(err)
	}
	results, err := service.SearchWorkspace("users")
	if err != nil || len(results) != 1 || results[0].Line != 1 {
		t.Fatalf("results = %#v, err = %v", results, err)
	}
}
