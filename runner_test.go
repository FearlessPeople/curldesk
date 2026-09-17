package main

import "testing"

func TestParseCurlCommand(t *testing.T) {
	command := `curl -X POST "https://example.com" \
  -H "Content-Type: application/json" \
  -d '{"name":"CurlDesk"}'`
	args, err := parseCurlCommand(command)
	if err != nil {
		t.Fatalf("parseCurlCommand returned an error: %v", err)
	}
	want := []string{"-X", "POST", "https://example.com", "-H", "Content-Type: application/json", "-d", "{\"name\":\"CurlDesk\"}"}
	if len(args) != len(want) {
		t.Fatalf("got %d args, want %d: %#v", len(args), len(want), args)
	}
	for index := range want {
		if args[index] != want[index] {
			t.Errorf("arg %d = %q, want %q", index, args[index], want[index])
		}
	}
}

func TestParseCurlCommandRejectsShellCommands(t *testing.T) {
	if _, err := parseCurlCommand("sh -c 'curl https://example.com'"); err == nil {
		t.Fatal("expected non-curl command to be rejected")
	}
}
