package main

import "testing"

func TestGetDiagnosticsUsesPlatformCurl(t *testing.T) {
	info := (&CurlRunner{}).GetDiagnostics()
	if info.OS == "" || info.Architecture == "" || info.CurlPath == "" {
		t.Fatalf("diagnostics = %#v", info)
	}
}
