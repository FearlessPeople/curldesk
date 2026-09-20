package backend

import "testing"

func TestValidateUpdateURL(t *testing.T) {
	valid := []string{
		"https://github.com/FearlessPeople/curldesk/releases/download/v0.1.2/CurlDesk-setup.exe",
		"https://objects.githubusercontent.com/github-production-release-asset-2e65be/123/456",
		"https://release-assets.githubusercontent.com/github-production-release-asset-2e65be/123/456",
	}
	for _, rawURL := range valid {
		if err := validateUpdateURL(rawURL); err != nil {
			t.Errorf("validateUpdateURL(%q) returned error: %v", rawURL, err)
		}
	}

	invalid := []string{
		"http://github.com/FearlessPeople/curldesk/releases/download/v0.1.2/CurlDesk-setup.exe",
		"https://example.com/CurlDesk-setup.exe",
		"not-a-url",
	}
	for _, rawURL := range invalid {
		if err := validateUpdateURL(rawURL); err == nil {
			t.Errorf("validateUpdateURL(%q) accepted an untrusted URL", rawURL)
		}
	}
}
