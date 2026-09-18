SHELL := /bin/zsh

APP_NAME ?= CurlDesk
APP_BIN ?= build/$(APP_NAME)
VITE_PORT ?= 9245
WAILS ?= wails3
PKG ?= pnpm

.PHONY: help install deps dev frontend-dev frontend-build build run \
	test vet fmt clean package package-all package-macos package-macos-arm64 \
	package-macos-intel package-macos-universal package-windows package-windows-installer package-linux

PLATFORM ?= $(shell go env GOOS)
GOOS ?= $(PLATFORM)
GOARCH ?= $(shell go env GOARCH)
APP_VERSION ?= $(shell sed -n 's/.*"version":"\([^"]*\)".*/\1/p' frontend/package.json)
DIST_DIR ?= dist
PACKAGE_DIR ?= $(DIST_DIR)/$(APP_NAME)-$(GOOS)-$(GOARCH)
PACKAGE_BIN ?= $(PACKAGE_DIR)/$(APP_NAME)$(if $(filter windows,$(GOOS)),.exe,)
PACKAGE_CGO ?= $(if $(filter linux darwin,$(GOOS)),1,0)
PACKAGE_LDFLAGS ?= -s -w
ifeq ($(GOOS),windows)
PACKAGE_LDFLAGS += -H=windowsgui
endif

help:
	@printf '%s\n' \
	  'make install        安装前端和 Go 依赖' \
	  'make dev            启动 Wails 开发模式' \
	  'make frontend-dev   仅启动前端 Vite' \
	  'make build          构建桌面程序' \
	  'make package        打包当前平台（可用 PLATFORM/GOARCH 覆盖）' \
	  'make package-macos  打包 macOS .app 和 .zip' \
	  'make package-macos-arm64  打包 macOS Apple Silicon 版本' \
	  'make package-macos-intel  打包 macOS Intel amd64 版本' \
	  'make package-macos-universal  打包 macOS Universal .app 和 .zip' \
	  'make package-windows  打包 Windows .exe.zip' \
	  'make package-windows-installer  生成 Windows 安装程序' \
	  'make package-linux  打包 Linux .tar.gz' \
	  'make package-all    依次打包 macOS、Windows、Linux' \
	  'make run            构建并运行桌面程序' \
	  'make test           运行 Go 测试' \
	  'make vet            运行 go vet' \
	  'make fmt            格式化 Go 代码' \
	  'make clean          清理构建产物'

install: deps

deps:
	cd frontend && $(PKG) install
	go mod download

dev:
	$(WAILS) dev -config ./build/config.yml -port $(VITE_PORT)

frontend-dev:
	cd frontend && $(PKG) run dev -- --host 127.0.0.1 --port $(VITE_PORT)

frontend-build:
	cd frontend && $(PKG) run build

build: frontend-build
	go build -o $(APP_BIN) .

run: build
	./$(APP_BIN)

test:
	go test ./...

vet:
	go vet ./...

fmt:
	gofmt -w *.go

clean:
	rm -rf frontend/dist $(APP_BIN) $(DIST_DIR)

# Cross-platform release packaging.
#
# Wails desktop builds still need the target platform's native toolchain for
# CGO (especially Linux GTK/WebKit and macOS Cocoa). Use these targets from a
# native runner or from a CI matrix with one job per operating system.
package: frontend-build
	@case "$(GOOS)" in \
		darwin|windows|linux) ;; \
		*) echo "Unsupported GOOS: $(GOOS) (expected darwin, windows, or linux)" >&2; exit 1 ;; \
	esac
	@mkdir -p "$(PACKAGE_DIR)"
	@echo "Building $(APP_NAME) for $(GOOS)/$(GOARCH) (CGO_ENABLED=$(PACKAGE_CGO))"
	CGO_ENABLED=$(PACKAGE_CGO) GOOS=$(GOOS) GOARCH=$(GOARCH) go build \
		-trimpath -buildvcs=false -ldflags='$(PACKAGE_LDFLAGS)' -o "$(PACKAGE_BIN)" .
	@case "$(GOOS)" in \
		darwin) \
			app_dir="$(PACKAGE_DIR)/$(APP_NAME).app"; \
			mkdir -p "$$app_dir/Contents/MacOS" "$$app_dir/Contents/Resources"; \
			cp "$(PACKAGE_BIN)" "$$app_dir/Contents/MacOS/$(APP_NAME)"; \
			cp build/darwin/Info.plist "$$app_dir/Contents/Info.plist"; \
			cp build/darwin/icon.icns "$$app_dir/Contents/Resources/$(APP_NAME).icns"; \
			(cd "$(PACKAGE_DIR)" && zip -qry "../$(APP_NAME)-$(APP_VERSION)-$(GOOS)-$(GOARCH).zip" "$(APP_NAME).app"); \
			;; \
		windows) \
			(cd "$(PACKAGE_DIR)" && zip -qry "../$(APP_NAME)-$(APP_VERSION)-$(GOOS)-$(GOARCH).zip" "$(APP_NAME).exe"); \
			;; \
		linux) \
			(cd "$(PACKAGE_DIR)" && tar -czf "../$(APP_NAME)-$(APP_VERSION)-$(GOOS)-$(GOARCH).tar.gz" "$(APP_NAME)"); \
			;; \
	esac
	@echo "Artifacts written to $(DIST_DIR)/"

package-macos:
	$(MAKE) package GOOS=darwin GOARCH=$(or $(MACOS_ARCH),$(GOARCH))

package-macos-arm64:
	$(MAKE) package GOOS=darwin GOARCH=arm64

package-macos-intel:
	$(MAKE) package GOOS=darwin GOARCH=amd64

package-macos-universal: frontend-build
	@mkdir -p "$(DIST_DIR)/$(APP_NAME)-darwin-universal"
	@echo "Building $(APP_NAME) for darwin/amd64 and darwin/arm64"
	CGO_ENABLED=1 GOOS=darwin GOARCH=amd64 go build -trimpath -buildvcs=false -ldflags='-s -w' \
		-o "$(DIST_DIR)/$(APP_NAME)-darwin-universal/$(APP_NAME)-amd64" .
	CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 go build -trimpath -buildvcs=false -ldflags='-s -w' \
		-o "$(DIST_DIR)/$(APP_NAME)-darwin-universal/$(APP_NAME)-arm64" .
	lipo -create \
		"$(DIST_DIR)/$(APP_NAME)-darwin-universal/$(APP_NAME)-amd64" \
		"$(DIST_DIR)/$(APP_NAME)-darwin-universal/$(APP_NAME)-arm64" \
		-output "$(DIST_DIR)/$(APP_NAME)-darwin-universal/$(APP_NAME)"
	@rm "$(DIST_DIR)/$(APP_NAME)-darwin-universal/$(APP_NAME)-amd64" \
		"$(DIST_DIR)/$(APP_NAME)-darwin-universal/$(APP_NAME)-arm64"
	@mkdir -p "$(DIST_DIR)/$(APP_NAME)-darwin-universal/$(APP_NAME).app/Contents/MacOS" \
		"$(DIST_DIR)/$(APP_NAME)-darwin-universal/$(APP_NAME).app/Contents/Resources"
	@cp "$(DIST_DIR)/$(APP_NAME)-darwin-universal/$(APP_NAME)" \
		"$(DIST_DIR)/$(APP_NAME)-darwin-universal/$(APP_NAME).app/Contents/MacOS/$(APP_NAME)"
	@cp build/darwin/Info.plist "$(DIST_DIR)/$(APP_NAME)-darwin-universal/$(APP_NAME).app/Contents/Info.plist"
	@cp build/darwin/icon.icns "$(DIST_DIR)/$(APP_NAME)-darwin-universal/$(APP_NAME).app/Contents/Resources/$(APP_NAME).icns"
	@(cd "$(DIST_DIR)/$(APP_NAME)-darwin-universal" && zip -qry "../$(APP_NAME)-$(APP_VERSION)-darwin-universal.zip" "$(APP_NAME).app")

package-windows:
	$(MAKE) package GOOS=windows GOARCH=$(or $(WINDOWS_ARCH),amd64)

package-windows-installer: package-windows
	@command -v makensis >/dev/null || (echo "makensis is required to build the Windows installer" >&2; exit 1)
	@makensis \
		-DAPP_VERSION=$(APP_VERSION) \
		-DEXE_PATH="$(abspath $(DIST_DIR)/$(APP_NAME)-windows-$(or $(WINDOWS_ARCH),amd64)/$(APP_NAME).exe)" \
		-DOUTPUT_PATH="$(abspath $(DIST_DIR)/$(APP_NAME)-$(APP_VERSION)-windows-$(or $(WINDOWS_ARCH),amd64)-setup.exe)" \
		build/windows/installer.nsi

package-linux:
	$(MAKE) package GOOS=linux GOARCH=$(or $(LINUX_ARCH),amd64)

package-all:
	$(MAKE) package-macos
	$(MAKE) package-windows
	$(MAKE) package-linux
