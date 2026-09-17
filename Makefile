SHELL := /bin/zsh

APP_NAME ?= CurlDesk
APP_BIN ?= build/$(APP_NAME)
VITE_PORT ?= 9245
WAILS ?= wails3
PKG ?= pnpm

.PHONY: help install deps dev frontend-dev frontend-build build run test vet fmt clean

help:
	@printf '%s\n' \
	  'make install        安装前端和 Go 依赖' \
	  'make dev            启动 Wails 开发模式' \
	  'make frontend-dev   仅启动前端 Vite' \
	  'make build          构建桌面程序' \
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
	rm -rf frontend/dist $(APP_BIN)
