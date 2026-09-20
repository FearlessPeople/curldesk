package backend

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const maxUpdateSize = 512 * 1024 * 1024
const latestReleaseAPI = "https://api.github.com/repos/FearlessPeople/curldesk/releases/latest"

// UpdateService handles installing release assets from the trusted CurlDesk
// GitHub release hosts. Platform-specific installation lives in build-tagged
// files so the desktop app keeps the same public API on every platform.
type UpdateService struct{}

type UpdateAsset struct {
	Name string `json:"name"`
	URL  string `json:"browser_download_url"`
}

type UpdateInfo struct {
	Version string        `json:"version"`
	URL     string        `json:"url"`
	Assets  []UpdateAsset `json:"assets"`
}

func (s *UpdateService) CheckForUpdates() (UpdateInfo, error) {
	client := &http.Client{Timeout: 20 * time.Second}
	request, err := http.NewRequest(http.MethodGet, latestReleaseAPI, nil)
	if err != nil {
		return UpdateInfo{}, fmt.Errorf("create update request: %w", err)
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("User-Agent", "CurlDesk-Updater")
	response, err := client.Do(request)
	if err != nil {
		return UpdateInfo{}, fmt.Errorf("check for updates: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return UpdateInfo{}, fmt.Errorf("check for updates: server returned %s", response.Status)
	}

	var release struct {
		TagName string        `json:"tag_name"`
		HTMLURL string        `json:"html_url"`
		Assets  []UpdateAsset `json:"assets"`
	}
	if err := json.NewDecoder(response.Body).Decode(&release); err != nil {
		return UpdateInfo{}, fmt.Errorf("decode release information: %w", err)
	}
	if strings.TrimSpace(release.TagName) == "" {
		return UpdateInfo{}, fmt.Errorf("release version is missing")
	}
	return UpdateInfo{Version: strings.TrimSpace(release.TagName), URL: strings.TrimSpace(release.HTMLURL), Assets: release.Assets}, nil
}

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
