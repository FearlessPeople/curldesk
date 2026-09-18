# CurlDesk 产品 Roadmap

> 定位：开源、轻量、Local-First、专注原生 `curl` 的桌面工作台。
>
> 这是一份长期规划，不代表第一版需要一次性实现全部功能。清单中的状态以代码和测试为准，完成一项后再勾选。

## 状态说明

- `[x]` 已有可用实现，但仍可能需要补齐测试或跨平台验证
- `[~]` 已有部分实现，功能边界或体验还不完整
- `[ ]` 尚未实现
- `[?]` 需要在实现前确定方案或产品取舍

## 当前基线

CurlDesk 当前已经具备以下基础：

- `[x]` 本地 workspace 与 `.curl` 文件/文件夹管理
- `[x]` `.curl` 文件编辑、基础语法高亮、行号和多 Tab
- `[x]` 基于 shell 风格命令的 curl 参数解析
- `[x]` curl 执行、停止、流式 stdout、错误输出和运行元数据
- `[x]` Dev/Test 等环境变量与 `{{variable}}` 替换
- `[x]` 响应内容、响应头、状态码、耗时、请求/响应大小
- `[x]` Light/Dark/System 外观、基础设置、复制和下载输出
- `[x]` Go 单元测试、TypeScript 检查、Vite 构建脚本

当前最重要的技术缺口是：Parser 仍是轻量实现，Runner 的运行模型还不适合并发任务，workspace 路径/配置模型仍需扩展，响应展示和设置也需要拆分成更可维护的模块。

## 推荐实施顺序

### Phase 0：工程基线与产品边界

目标：先建立可以持续迭代的边界，避免后续功能互相耦合。

- [ ] 建立 feature checklist、验收标准和版本里程碑
- [ ] 定义稳定的 Go 服务接口：Workspace、Parser、Runner、Environment、Settings
- [ ] 定义稳定的前端领域模型：WorkspaceEntry、CurlDocument、Run、Environment、Response
- [ ] 将错误统一为可展示的错误类型，并保留底层错误用于日志
- [ ] 补齐 Go、Parser、Runner、Workspace 的测试夹具
- [ ] 建立 macOS、Windows、Linux 的 CI 构建与基础测试矩阵
- [ ] 明确 `curl` 最低支持版本和跨平台行为差异

### Phase 1：核心可用闭环（建议作为下一个版本）

目标：让“打开 workspace → 编辑 curl → 安全执行 → 查看结果 → 保存”稳定可靠。

- [~] 完善打开/新建/切换/最近 workspace（已完成路径输入、最近 workspace 和切换，原生文件夹选择器待补）
- [ ] 完善文件树刷新、搜索、重命名、删除和外部文件变化同步
- [ ] 引入真正的 workspace 配置文件，并保持 `settings.yaml` 向后兼容
- [ ] 重构 curl Parser，输出带位置的 AST/诊断信息
- [~] 统一变量解析、缺失变量诊断和 Secret 脱敏（已完成分层解析、缺失变量诊断和编辑器遮罩）
- [x] Runner 改为 Run ID + context cancel + 独立进程状态
- [x] 支持自定义 curl executable、curl 路径检测和版本检测（版本展示待补）
- [x] 确保应用退出时清理所有子进程
- [ ] 补齐保存、自动保存、Undo/Redo、查找/替换和快捷键执行
- [ ] 为当前实现补充回归测试和用户可见的错误提示

### Phase 2：响应与调试体验

目标：保持“原生 curl 工作台”定位，同时提供足够强的 HTTP 调试反馈。

- [~] 将响应模型拆成 Raw、Pretty、JSON、XML、HTML、Text、SSE、Headers（当前完成 Raw/Pretty/Headers）
- [~] 支持 JSON 折叠、搜索、格式化、压缩和大响应处理（当前完成折叠、搜索、格式化）
- [~] 增加响应类型识别与 binary response 提示（当前完成 Content-Type 识别）
- [ ] 增加响应文件下载和输出保存
- [ ] 支持 stdout、stderr、chunk、ANSI color、timestamp、自动滚动/暂停滚动
- [ ] 展示 HTTP status、Content-Type、Response Size、Duration、Exit Code
- [ ] 采集并展示 DNS、Connect、TLS、TTFB、Total Time、Remote IP、HTTP Version
- [ ] 支持 redirect 信息、TLS 信息和 curl verbose 模式
- [ ] 明确 headers/body 在重定向、多响应和流式响应下的展示规则

### Phase 3：Environment 与安全

目标：让本地配置足够强，但不把 Secret 意外写入日志、历史或剪贴板。

- [ ] Dev/Test/Prod 多环境切换
- [x] `.env` 导入与 workspace/global/system 环境变量分层
- [ ] Environment Editor、Duplicate、Import/Export
- [ ] 变量自动补全、变量搜索和缺失变量检查
- [ ] Secret 隐藏/显示、敏感 Header 脱敏、History 脱敏
- [ ] `.env` Git Ignore 提示和 workspace 路径校验
- [ ] 禁止任意 shell 执行，仅允许执行 `curl`/`curl.exe`
- [ ] 增加 shell injection、危险语法和非法参数检测
- [ ] 增加剪贴板 Secret 提醒和进程清理保护

### Phase 4：编辑器与生产力

目标：提高键盘操作效率，但不演变成通用 API Builder。

- [ ] 多行 curl 稳定解析、自动缩进和格式化
- [ ] curl 参数提示与自动补全
- [ ] 大 JSON body 编辑、JSON 格式化和压缩
- [ ] Curl 命令校验、Parser 错误定位和编辑器诊断标记
- [ ] 文件名、curl 内容、Environment、History、Response 全局搜索
- [x] Command Palette
- [ ] 完善 Run、Stop、Save、New Curl、New Folder、Search、Format 等快捷键
- [~] 完善 Tab：关闭、关闭其他、关闭全部、Pin、未保存状态、最近 Tab 恢复（核心能力已完成，Tab 状态持久化增强待补）
- [ ] 确保每个 Tab 拥有独立的运行状态、输出和错误

### Phase 5：模板、导入导出与生态兼容

目标：降低从其他工具迁移和从浏览器开始工作的成本。

- [ ] GET 模板
- [ ] POST JSON 模板
- [ ] PUT 模板
- [ ] PATCH 模板
- [ ] DELETE 模板
- [ ] File Upload 模板
- [ ] Form 模板
- [ ] SSE 模板
- [ ] OpenAI Chat Completion 模板
- [ ] OpenAI Responses 模板
- [ ] 自定义模板与 Template Library
- [ ] 从剪贴板粘贴 curl 创建文件
- [ ] `.curl` Import/Export
- [~] Workspace Import/Export（当前完成 `.curl` 文件导入，完整 workspace 导出待补）
- [ ] Environment Import/Export
- [ ] 浏览器 DevTools “Copy as cURL” 直接粘贴
- [ ] `[?]` Postman → CurlDesk
- [ ] `[?]` Bruno → CurlDesk
- [ ] `[?]` OpenAPI → curl

### Phase 6：跨平台、发布与诊断

目标：让核心能力在目标平台上可预测、可诊断、可发布。

- [ ] macOS Intel
- [ ] macOS Apple Silicon
- [ ] Windows x64
- [ ] Windows ARM64
- [ ] Linux x64
- [ ] Linux ARM64
- [ ] 处理 macOS/Windows/Linux 的 curl 路径差异
- [ ] 处理 LF/CRLF 和 Windows 路径参数
- [ ] curl 版本检测和兼容性提示
- [ ] HiDPI 验证
- [ ] Application Log、Runner Log、Parser Log、Error Log
- [ ] Debug Mode
- [ ] Export Diagnostic Info
- [ ] Open Log Folder
- [ ] 诊断信息包含 curl path、curl version、OS、App Version 和 workspace 信息（不包含 Secret）

## 功能全集清单

以下清单保留产品规划中的完整范围，作为实施时的总索引。

### 1. Workspace 工作区

- [x] 打开本地工作区
- [x] 最近工作区
- [x] 切换工作区
- [x] 新建工作区
- [x] 文件夹管理
- [x] `.curl` 文件管理
- [x] 新建 / 删除 / 重命名
- [ ] 文件搜索
- [x] 文件刷新
- [x] 文件树
- [x] Git 友好的纯文本存储
- [~] Workspace 配置文件

### 2. Curl 编辑器

- [x] 原始 curl 编辑
- [x] 多行 curl
- [x] 语法高亮
- [x] 行号
- [~] 自动缩进
- [x] 自动保存
- [x] 手动保存
- [x] Undo / Redo
- [ ] 查找 / 替换
- [ ] 格式化
- [~] Curl 命令校验
- [ ] Curl 参数提示
- [ ] Curl 参数自动补全
- [x] 大 JSON Body 编辑
- [x] JSON 格式化
- [ ] JSON 压缩
- [x] 快捷键执行

### 3. Curl Parser

- [x] 单引号解析
- [x] 双引号解析
- [x] 转义字符
- [x] 多行命令
- [x] `\\` 换行
- [~] JSON Body
- [~] Form Data
- [ ] URL Encode
- [ ] 文件参数
- [x] Header
- [ ] Cookie
- [ ] Query 参数
- [~] curl 参数识别
- [x] Windows CRLF
- [x] Shell 危险语法检测
- [~] Parser 错误定位（当前返回基础位置，精确行列待补）

### 4. Curl Runner

- [x] Run
- [x] Stop
- [ ] Restart
- [x] 并发运行多个 curl
- [x] Run ID
- [x] Process 生命周期管理
- [x] Context Cancel
- [x] Exit Code
- [x] 执行耗时
- [x] Timeout
- [~] curl 路径检测
- [x] 自定义 curl executable
- [x] macOS `curl`
- [x] Windows `curl.exe`
- [x] Linux `curl`
- [x] 应用退出自动终止子进程

### 5. 实时输出

- [x] stdout
- [x] stderr
- [x] Chunk 实时输出
- [x] SSE 流式输出
- [x] 普通 HTTP 输出
- [x] 自动滚动
- [ ] 暂停滚动
- [x] Clear
- [x] Copy
- [ ] Select All
- [x] 输出搜索（基础能力）
- [x] 输出保存/下载（基础能力）
- [ ] ANSI Color
- [ ] Timestamp
- [x] Exit Code 展示
- [x] Duration 展示

### 6. Environment 环境变量

- [x] Dev / Test / Prod（Dev/Test 基础能力）
- [x] 多 Environment
- [x] Environment 切换
- [ ] `.env` 文件
- [x] `{{VARIABLE}}`
- [ ] 变量自动补全
- [x] 缺失变量检查
- [x] Secret 隐藏
- [x] Secret 显示
- [~] Environment Editor
- [ ] Duplicate Environment
- [ ] Environment Import / Export
- [x] 系统环境变量引用
- [x] Workspace 环境变量
- [ ] 全局环境变量

### 7. HTTP 调试辅助

- [x] HTTP Status 显示
- [x] Response Headers
- [ ] Request Headers 展示
- [x] Content-Type 展示
- [x] Response Size
- [ ] DNS 耗时
- [ ] Connect 耗时
- [ ] TLS 耗时
- [ ] TTFB
- [x] Total Time
- [ ] Redirect 信息
- [ ] Remote IP
- [ ] HTTP Version
- [ ] TLS 信息
- [ ] curl verbose 模式

### 8. Response Viewer

- [x] Raw
- [x] Pretty
- [x] JSON
- [ ] XML
- [ ] HTML
- [x] Text
- [x] SSE
- [x] Headers
- [x] JSON Syntax Highlight（基础展示）
- [x] JSON Collapse
- [x] JSON Search
- [ ] 大响应处理
- [ ] Binary Response 提示
- [x] 下载响应文件

### 13. Curl Snippets

- [ ] GET 模板
- [ ] POST JSON 模板
- [ ] PUT 模板
- [ ] PATCH 模板
- [ ] DELETE 模板
- [ ] File Upload 模板
- [ ] Form 模板
- [ ] SSE 模板
- [ ] OpenAI Chat Completion 模板
- [ ] OpenAI Responses 模板
- [ ] 自定义模板
- [ ] Template Library

### 15. 快捷键

- [x] Run
- [x] Stop
- [x] Save
- [x] New Curl
- [x] New Folder
- [ ] Search
- [x] Command Palette
- [x] Switch Environment
- [x] Switch File
- [x] Clear Terminal
- [ ] Format
- [x] Close Tab
- [ ] Next / Previous Tab

### 16. Tab 系统

- [x] 多 Curl Tab
- [x] Tab 切换
- [x] Close
- [x] Close Others
- [x] Close All
- [x] Pin
- [x] 未保存状态
- [x] 最近 Tab 恢复
- [x] 每个 Tab 独立 Run 状态
- [x] 每个 Tab 独立输出

### 17. 搜索

- [x] 文件名搜索
- [x] Curl 内容搜索
- [ ] Environment 变量搜索
- [~] Workspace 全局搜索（当前完成 `.curl` 内容搜索）
- [x] History 搜索
- [ ] Response 搜索
- [x] Command Palette

### 19. Import / Export

- [x] 粘贴 Curl
- [x] 从剪贴板创建 Curl（基础能力）
- [x] `.curl` Import
- [x] `.curl` Export
- [~] Workspace Import / Export（当前完成 `.curl` 文件导入）
- [~] Environment Import / Export（当前完成 `.env` 加载和保存）
- [ ] `[?]` Postman → CurlDesk（后期）
- [ ] `[?]` Bruno → CurlDesk（后期）
- [ ] `[?]` OpenAPI → curl（后期）
- [x] 浏览器 DevTools Copy as cURL 直接粘贴

### 20. 跨平台

- [x] macOS Intel（构建配置）
- [x] macOS Apple Silicon（构建配置）
- [ ] Windows x64 验证
- [ ] Windows ARM64 验证
- [ ] Linux x64 验证
- [ ] Linux ARM64 验证
- [~] macOS 路径
- [ ] Windows 路径
- [~] LF / CRLF
- [ ] curl 版本检测
- [ ] OS 差异处理
- [ ] HiDPI

### 21. UI / UX

- [x] Light
- [x] Dark
- [x] Follow System
- [x] 紧凑布局
- [~] 可调整 Sidebar
- [~] 可调整 Terminal 高度
- [x] Sidebar Collapse
- [x] Status Bar
- [x] Command Palette
- [x] Toast/提示反馈（基础能力）
- [ ] Context Menu
- [x] Keyboard-first（基础快捷键）
- [ ] 字体设置
- [x] Terminal 字体设置（基础配置能力）
- [x] Editor 字号设置
- [ ] UI 缩放

### 22. Settings

- [x] Theme
- [ ] Language
- [~] Default Workspace（当前支持启动默认 workspace，默认路径设置待补）
- [ ] Default Environment
- [x] Auto Save
- [x] Auto Scroll（当前为默认行为）
- [x] Curl Path
- [x] Request Timeout
- [x] Editor Font Size
- [ ] Terminal Font
- [ ] Terminal Font Size
- [~] History Limit（当前固定保留最近 100 条，设置项待补）
- [ ] Update Channel

### 23. 安全

- [ ] 禁止任意 Shell 执行
- [x] Shell Injection 检测
- [x] 仅执行 curl / curl.exe
- [~] Secret Mask（编辑器和执行前日志路径已避免主动展示，完整历史/响应脱敏待补）
- [ ] `.env` Git Ignore
- [ ] 敏感 Header Mask
- [ ] History Secret Mask
- [ ] Clipboard Secret 提醒
- [x] Workspace 路径校验（基础能力）
- [ ] Process 清理

### 24. 日志与诊断

- [ ] Application Log
- [~] Runner Log（已有运行日志输出，尚未提供日志文件查看器）
- [ ] Parser Log
- [ ] Error Log
- [ ] Debug Mode
- [x] Curl Version
- [x] Curl Path
- [x] OS 信息
- [x] App Version
- [x] Export Diagnostic Info
- [ ] Open Log Folder

## 第一个可执行迭代（已完成）

本轮已经完成下面这组垂直切片：

1. Runner 按 Run ID 管理进程，支持 context timeout、单任务停止和应用退出清理。
2. Parser 增加未闭合引号、危险 shell 语法和缺失参数诊断。
3. 前端执行前进行 curl 校验，并把诊断显示给用户。
4. 增加 curl executable 路径和请求 timeout 设置，并持久化到 `settings.yaml`。
5. 补充 Go 单测，并通过 TypeScript 检查和 Vite production build。

下一轮建议进入 Environment 与安全：先实现 Secret 脱敏、缺失变量诊断和 `.env`/系统环境变量分层。

## 实施原则

- 继续使用纯文本 `.curl` 文件和 YAML 配置，保持 Git 友好和 Local-First。
- Parser、Runner、Workspace 的领域逻辑优先放在 Go 层，前端负责交互状态和展示。
- 不引入 Postman 风格的请求构建器；所有辅助功能都围绕原生 curl 命令。
- 不把 Secret 写入日志、诊断包、历史、响应导出或剪贴板提示之外的内容。
- 新增 UI 继续使用现有 shadcn/ui 组件，并保持 Light、Dark、System 三种模式。
- 每个阶段都要求有可运行的垂直切片、测试和可回滚的小提交。
