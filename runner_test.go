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

func TestParseCurlOutput(t *testing.T) {
	output := "HTTP/2 200\r\ncontent-type: application/json\r\n\r\n{\"ok\":true}\n__CURLDESK_META__200|0.125|84|11"
	body, headers, status, durationMs, requestSize, responseSize := parseCurlOutput(output)
	if body != "{\"ok\":true}" {
		t.Errorf("body = %q", body)
	}
	if headers != "HTTP/2 200\r\ncontent-type: application/json" {
		t.Errorf("headers = %q", headers)
	}
	if status != 200 || durationMs != 125 || requestSize != 84 || responseSize != 11 {
		t.Errorf("metadata = %d, %d, %d, %d", status, durationMs, requestSize, responseSize)
	}
}
