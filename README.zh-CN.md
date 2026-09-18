# CurlDesk

[English](README.md) | [简体中文](README.zh-CN.md)

CurlDesk 是一个本地优先的桌面工作台，用于编写、整理和执行 `curl` 请求。它将紧凑的请求编辑器、本地请求集合、环境变量、流式响应以及响应元数据整合在一个桌面应用中。

完整的功能清单、当前实现状态和分阶段实施计划请参阅[产品 Roadmap](docs/ROADMAP.zh-CN.md)。

## 功能特性

- 在标签页中编辑和运行一个或多个 `.curl` 文件。
- 通过文件夹整理本地工作区中的请求。
- 执行编辑器中的单条 curl 命令或请求块。
- 请求执行过程中实时查看响应内容。
- 查看格式化后的响应和响应头。
- 显示 HTTP 状态码、耗时、请求大小和响应大小。
- 复制或下载响应内容。
- 在 curl 文件中使用 Shell 风格的 `#` 注释。
- 使用 `Cmd/Ctrl + Enter` 执行当前请求。
- 使用 `Cmd/Ctrl + /` 切换注释。
- 在 `Dev`、`Test` 或其他本地环境之间切换。
- 使用 `{{variable_name}}` 引用环境变量。
- 支持浅色、深色和跟随系统的外观模式，以及主题强调色。
- 从状态栏的版本标签检查新的 GitHub Release。

## 环境要求

- Go 1.25 或更高版本
- Node.js 和 pnpm
- Wails 3
- 系统 PATH 中可用的 `curl`

## 快速开始

安装前端依赖并启动 Wails 开发模式：

```bash
make install
make dev
```

开发窗口使用位于 `127.0.0.1:9245` 的 Vite 开发服务器。

也可以单独启动前端：

```bash
cd frontend
pnpm install
pnpm dev --host 127.0.0.1
```

## 常用命令

```bash
make install                              # 安装前端依赖
make dev                                  # 启动 Wails 开发模式
make build                                # 构建前端和桌面程序
make package-macos                       # 打包 macOS .app 和 .zip
make package-macos-arm64                 # 打包 macOS Apple Silicon 版本
make package-macos-intel                 # 打包 macOS Intel amd64 版本
make package-macos-universal             # 打包 macOS arm64/amd64 通用版本
make package-windows                     # 打包 Windows .exe.zip
make package-linux                       # 打包 Linux .tar.gz
make package PLATFORM=darwin GOARCH=arm64 # 通用平台/架构入口
make test                                 # 运行 Go 测试
make clean                                # 清理构建产物
```

发布产物会写入 `dist/`，文件名中会包含应用版本号。桌面程序打包依赖平台原生的 CGO 工具链，因此通常应在 macOS、Windows 和 Linux 各自的原生 CI Runner 上完成对应平台的构建。必要时可以覆盖 `PLATFORM`、`GOARCH` 或 `DIST_DIR`。

前端单独验证：

```bash
cd frontend
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
```

## 工作区和配置

CurlDesk 默认会在以下位置创建本地工作区：

```text
~/CurlDeskWorkspace/
```

工作区包含 curl 文件和本地配置文件：

```text
CurlDeskWorkspace/
├── environments.yaml
└── settings.yaml
```

环境变量使用简单的 YAML 结构：

```yaml
Dev:
  base_url: "https://api.example.com"
  token: "development-token"
Test:
  base_url: "https://test.example.com"
  token: "test-token"
```

在 curl 文件中使用变量：

```bash
# List users
curl "{{base_url}}/users" \
  -H "Authorization: Bearer {{token}}"
```

不要提交个人 token 或包含敏感信息的环境文件。

## Curl 文件格式

CurlDesk 使用 `.curl` 扩展名保存普通的 Shell 风格 curl 命令。一个文件中可以包含多个请求块：

```bash
# Get service status
curl "https://example.com/health"

# Submit a payload
curl -X POST "https://example.com/items" \
  -H "Content-Type: application/json" \
  -d '{"name":"CurlDesk"}'
```

应用会运行当前选中的请求块，并在命令解析时忽略 Shell 注释，同时在编辑器中保留这些注释。

## 版本和发布

前端版本来源于 `frontend/package.json`，并在 Vite 构建时注入应用。修改版本时，请保持 `build/config.yml` 中的 Wails 版本同步。

发布时使用语义化版本 tag：

```text
frontend/package.json: 0.1.0
build/config.yml:      0.1.0
git tag:               v0.1.0
```

点击状态栏中的版本标签，可以检查最新的 GitHub Release。

测试版本可以使用预发布版本号，例如：

```text
frontend/package.json: 0.1.0-beta.1
build/config.yml:      0.1.0-beta.1
git tag:               v0.1.0-beta.1
```

在 GitHub 创建 Release 时勾选 `This is a pre-release`。

## 项目结构

```text
.
├── main.go                         # Wails 应用入口
├── runner.go                       # curl 执行、流式响应和解析
├── workspace.go                    # 本地工作区和 YAML 持久化
├── runner_test.go                  # Go runner 测试
├── build/config.yml                # Wails 构建配置
├── frontend/src/App.tsx            # 应用外壳和工作区状态
├── frontend/src/components/        # 基于 shadcn/ui 的 UI 组件
└── AGENTS.md                       # Codex 和贡献者开发规则
```

## 开发约定

- 可见 UI 和交互优先使用现有的 shadcn/ui 组件。
- 在引入国际化之前，界面文本保持英文。
- 新增 UI 时保持浅色、深色和系统主题可用。
- 图标按钮需要提供 tooltip 和无障碍标签。
- 保持本地优先行为；未经批准不要添加遥测。
- 提交前运行 Go 测试、TypeScript 检查和 Vite 生产构建。
- 修改仓库前请阅读 [AGENTS.md](AGENTS.md)。

## 已知限制

- 当前尚未加入请求历史功能。
- 更新检查会打开 GitHub Release 页面，但不会自动安装更新。
- 当前每个环境只支持扁平的字符串变量。

## 许可证

CurlDesk 使用 [PolyForm Noncommercial License 1.0.0](LICENSE) 发布。

这是一份可查看源代码的非商业许可证，并不是 OSI 批准的开源许可证。它允许用户在许可范围内出于非商业目的查看、使用、修改和再分发项目。默认许可证不允许商业使用，包括对修改版本的商业使用。

如需商业授权，请联系版权所有者。
