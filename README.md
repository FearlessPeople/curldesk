# CurlDesk

[English](README.md) | [简体中文](README.zh-CN.md)

CurlDesk is a local-first desktop workbench for writing, organizing, and running `curl` requests. It combines a compact request editor, local collections, environment variables, streaming responses, and response metadata in one desktop application.

## Features

- Edit and run one or more `.curl` files in tabs.
- Organize requests with folders in a local workspace.
- Run a single curl command or request block from the editor.
- Stream response content while a request is running.
- View formatted responses and response headers.
- Display HTTP status, duration, request size, and response size.
- Copy or download response output.
- Use Shell-style `#` comments in curl files.
- Use `Cmd/Ctrl + Enter` to run the current request.
- Use `Cmd/Ctrl + /` to toggle comments.
- Switch between `Dev`, `Test`, or other local environments.
- Reference environment variables with `{{variable_name}}`.
- Choose light, dark, or system appearance and an accent color.
- Check for new GitHub releases from the version label in the status bar.

## Requirements

- Go 1.25 or newer
- Node.js and pnpm
- Wails 3
- `curl` available on the system PATH

## Quick start

Install frontend dependencies and start Wails development mode:

```bash
make install
make dev
```

The development window uses the Vite development server on `127.0.0.1:9245`.

You can also run the frontend separately:

```bash
cd frontend
pnpm install
pnpm dev --host 127.0.0.1
```

## Common commands

```bash
make install    # Install frontend dependencies
make dev        # Start Wails development mode
make build      # Build the frontend and desktop application
make package-macos             # macOS .app + .zip
make package-macos-arm64      # macOS Apple Silicon
make package-macos-intel      # macOS Intel amd64
make package-macos-universal   # macOS arm64/amd64 universal .app + .zip
make package-windows           # Windows .exe.zip
make package-linux             # Linux .tar.gz
make package PLATFORM=darwin GOARCH=arm64  # Generic platform/architecture entrypoint
make test       # Run Go tests
make clean      # Remove generated build output
```

Release artifacts include the app version in their filenames and are written to `dist/`. Desktop packaging uses native CGO
toolchains, so macOS, Windows, and Linux should normally be built in separate
native CI jobs. Override `PLATFORM`, `GOARCH`, or `DIST_DIR` when needed.

For frontend-only validation:

```bash
cd frontend
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
```

## Workspace and configuration

CurlDesk creates a local workspace at:

```text
~/CurlDeskWorkspace/
```

The workspace contains curl files and local configuration files:

```text
CurlDeskWorkspace/
├── environments.yaml
└── settings.yaml
```

Environment variables use a simple YAML structure:

```yaml
Dev:
  base_url: "https://api.example.com"
  token: "development-token"
Test:
  base_url: "https://test.example.com"
  token: "test-token"
```

Use variables in a curl file like this:

```bash
# List users
curl "{{base_url}}/users" \
  -H "Authorization: Bearer {{token}}"
```

Do not commit personal tokens or sensitive environment files.

## Curl file format

CurlDesk stores plain Shell-style curl commands with the `.curl` extension. Multiple request blocks can be placed in one file:

```bash
# Get service status
curl "https://example.com/health"

# Submit a payload
curl -X POST "https://example.com/items" \
  -H "Content-Type: application/json" \
  -d '{"name":"CurlDesk"}'
```

The application runs the selected request block and ignores Shell comments during command parsing while preserving them in the editor.

## Versioning and releases

The frontend version is read from `frontend/package.json` and injected into the application during the Vite build. Keep the Wails version in `build/config.yml` synchronized with it.

Use semantic version tags for releases:

```text
frontend/package.json: 0.1.0
build/config.yml:      0.1.0
git tag:               v0.1.0
```

The status-bar version label checks the latest GitHub Release when clicked.

## Project structure

```text
.
├── main.go                         # Wails application entry point
├── runner.go                       # curl execution, streaming, and parsing
├── workspace.go                    # local workspace and YAML persistence
├── runner_test.go                  # Go runner tests
├── build/config.yml                # Wails build configuration
├── frontend/src/App.tsx            # application shell and workspace state
├── frontend/src/components/        # shadcn/ui-based UI components
└── AGENTS.md                       # Codex and contributor development rules
```

## Development conventions

- Use existing shadcn/ui components for visible UI and interactions.
- Keep UI text in English until i18n is introduced.
- Keep light, dark, and system themes working for new UI.
- Add tooltips and accessible labels to icon-only actions.
- Preserve local-first behavior; do not add telemetry without approval.
- Run Go tests, TypeScript checks, and a Vite production build before committing.
- Read [AGENTS.md](AGENTS.md) before making repository changes.

## Known limitations

- Request history is intentionally not included yet.
- Update checking opens the GitHub release page; it does not install updates automatically.
- Environment files currently support flat string variables per environment.

## License

CurlDesk is distributed under the [PolyForm Noncommercial License 1.0.0](LICENSE).

This is a source-available, non-commercial license rather than an OSI-approved open-source license. It permits people to inspect, use, modify, and redistribute the project for permitted non-commercial purposes. Commercial use, including commercial use of modified versions, is not permitted under the default license.

For commercial licensing, contact the copyright holder.
