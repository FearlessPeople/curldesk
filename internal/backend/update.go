package backend

import (
	"fmt"
	"net/url"
	"strings"
)

const maxUpdateSize = 512 * 1024 * 1024

// UpdateService handles installing release assets from the trusted CurlDesk
// GitHub release hosts. Platform-specific installation lives in build-tagged
// files so the desktop app keeps the same public API on every platform.
type UpdateService struct{}

func (s *UpdateService) InstallUpdate(downloadURL string) error {
	if err := validateUpdateURL(downloadURL); err != nil {
		return err
	}
	return installUpdate(downloadURL)
}

func validateUpdateURL(rawURL string) error {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return fmt.Errorf("update URL must use HTTPS")
	}

	host := strings.ToLower(parsed.Hostname())
	if host != "github.com" && host != "objects.githubusercontent.com" && host != "release-assets.githubusercontent.com" {
		return fmt.Errorf("update URL host is not trusted")
	}
	if host == "github.com" && !strings.HasPrefix(strings.TrimSuffix(parsed.Path, "/"), "/FearlessPeople/curldesk/releases/download/") {
		return fmt.Errorf("update URL is not a CurlDesk release asset")
	}
	return nil
}
