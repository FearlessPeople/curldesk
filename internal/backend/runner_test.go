package backend

import (
	"strings"
	"testing"
)

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

func TestParseCurlCommandIgnoresShellComments(t *testing.T) {
	command := "# request description\ncurl https://example.com -H \"X-Note: # keep this\" # trailing note"
	args, err := parseCurlCommand(command)
	if err != nil {
		t.Fatalf("parseCurlCommand returned an error: %v", err)
	}
	want := []string{"https://example.com", "-H", "X-Note: # keep this"}
	if strings.Join(args, "\x00") != strings.Join(want, "\x00") {
		t.Fatalf("args = %#v, want %#v", args, want)
	}
}

func TestParseCurlOutput(t *testing.T) {
	output := "HTTP/2 200\r\ncontent-type: application/json\r\n\r\n{\"ok\":true}\n__CURLDESK_META__200|0.125|84|11|0.010|0.020|0.030|0.040|192.0.2.1|2|1"
	body, headers, status, durationMs, requestSize, responseSize, dnsMs, connectMs, tlsMs, ttfbMs, remoteIP, httpVersion, redirects := parseCurlOutput(output)
	if body != "{\"ok\":true}" {
		t.Errorf("body = %q", body)
	}
	if headers != "HTTP/2 200\r\ncontent-type: application/json" {
		t.Errorf("headers = %q", headers)
	}
	if status != 200 || durationMs != 125 || requestSize != 84 || responseSize != 11 {
		t.Errorf("metadata = %d, %d, %d, %d", status, durationMs, requestSize, responseSize)
	}
	if dnsMs != 10 || connectMs != 20 || tlsMs != 30 || ttfbMs != 40 || remoteIP != "192.0.2.1" || httpVersion != "2" || redirects != 1 {
		t.Errorf("timing metadata = %d, %d, %d, %d, %q, %q, %d", dnsMs, connectMs, tlsMs, ttfbMs, remoteIP, httpVersion, redirects)
	}
}

func TestCurlStreamWriterEmitsSmallChunksImmediately(t *testing.T) {
	var output strings.Builder
	writer := &curlStreamWriter{runID: "test", output: &output}
	if _, err := writer.Write([]byte("data: first\n\n")); err != nil {
		t.Fatalf("Write returned an error: %v", err)
	}
	if output.String() != "data: first\n\n" {
		t.Fatalf("output = %q", output.String())
	}
}

func TestParseCurlMetadata(t *testing.T) {
	status, durationMs, requestSize, responseSize, dnsMs, connectMs, tlsMs, ttfbMs, remoteIP, httpVersion, redirects := parseCurlMetadata("__CURLDESK_META__200|0.125|84|11|0.010|0.020|0.030|0.040|192.0.2.1|2|1")
	if status != 200 || durationMs != 125 || requestSize != 84 || responseSize != 11 {
		t.Fatalf("metadata = %d, %d, %d, %d", status, durationMs, requestSize, responseSize)
	}
	if dnsMs != 10 || connectMs != 20 || tlsMs != 30 || ttfbMs != 40 || remoteIP != "192.0.2.1" || httpVersion != "2" || redirects != 1 {
		t.Fatalf("timing metadata = %d, %d, %d, %d, %q, %q, %d", dnsMs, connectMs, tlsMs, ttfbMs, remoteIP, httpVersion, redirects)
	}
}

func TestFormatRequestHeadersMasksSecrets(t *testing.T) {
	got := formatRequestHeaders([]string{"-H", "Accept: application/json", "--header", "Authorization: Bearer secret", "--header=X-Api-Key: abc", "-HCookie: session=secret"})
	want := "Accept: application/json\nAuthorization: <redacted>\nX-Api-Key: <redacted>\nCookie: <redacted>"
	if got != want {
		t.Fatalf("headers = %q, want %q", got, want)
	}
}

func TestValidateCurlReportsMalformedCommand(t *testing.T) {
	runner := &CurlRunner{}
	validation := runner.ValidateCurl(`curl -H "Authorization: Bearer`)
	if validation.Valid || len(validation.Diagnostics) == 0 {
		t.Fatalf("validation = %#v, want an error diagnostic", validation)
	}
	if validation.Diagnostics[0].Line != 1 || validation.Diagnostics[0].Column != 1 {
		t.Fatalf("diagnostic position = %d:%d, want 1:1", validation.Diagnostics[0].Line, validation.Diagnostics[0].Column)
	}
}

func TestValidateCurlRejectsShellOperators(t *testing.T) {
	validation := (&CurlRunner{}).ValidateCurl("curl https://example.com | sh")
	if validation.Valid || len(validation.Diagnostics) == 0 {
		t.Fatalf("validation = %#v, want shell syntax diagnostic", validation)
	}
}

func TestValidateCurlReportsMissingOptionValue(t *testing.T) {
	validation := (&CurlRunner{}).ValidateCurl("curl --header")
	if validation.Valid || len(validation.Diagnostics) == 0 {
		t.Fatalf("validation = %#v, want missing value diagnostic", validation)
	}
}
