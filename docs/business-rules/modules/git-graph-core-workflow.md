# Git Graph 核心工作流业务规则

## 适用范围

- 扩展入口：`src/extension.ts`
- 命令入口：`src/commands.ts`
- Webview 宿主：`src/gitGraphView.ts`
- Git 数据和操作：`src/dataSource.ts`
- 仓库管理：`src/repoManager.ts`
- 状态持久化：`src/extensionState.ts`
- 配置读取：`src/config.ts`
- Diff 文档：`src/diffDocProvider.ts`
- 头像缓存：`src/avatarManager.ts`
- 仓库文件监听：`src/repoFileWatcher.ts`
- 消息和数据类型：`src/types.ts`
- Webview 主界面：`web/main.ts`
- 提交图渲染：`web/graph.ts`
- 仓库设置：`web/settingsWidget.ts`
- 弹窗和表单：`web/dialog.ts`
- 测试：`tests/*.test.ts`

## 业务目标

Git Graph 的核心业务目标是在 VS Code 内识别当前工作区 Git 仓库，展示提交拓扑、分支、标签、stash 和未提交变更，并让用户在图形化界面中安全地查看差异、配置仓库和执行 Git 操作。

## 核心规则

1. 扩展通过 `activationEvents: ["*"]` 激活，`activate` 必须先初始化日志、状态、Git 可执行文件、数据源、仓库管理器、命令管理器和 Diff Provider。
2. 如果无法找到 Git 可执行文件，扩展必须向用户展示错误，并在 Webview 中显示“Unable to load Git Graph”类的无法加载状态。
3. 已知仓库来自工作区状态、工作区扫描、手动添加和子模块发现；手动添加仓库必须位于已打开的 VS Code 工作区内。
4. 被用户移除的仓库会进入 ignored repos，后续自动扫描不应再次自动加入，除非用户显式重新添加。
5. Git Graph Webview 是单例面板；如果面板已经存在，`GitGraphView.createOrShow` 应复用当前面板，并按 `loadViewTo` 切换仓库、恢复代码评审或触发 fetch。
6. Webview 不直接执行 Git 命令；所有 Git 数据读取和写操作必须通过 `RequestMessage` 发送给扩展宿主，由 `GitGraphView.respondToMessage` 分发给 `DataSource`、`RepoManager`、`ExtensionState` 或工具函数。
7. 仓库信息加载分两层：`loadRepoInfo` 读取分支、HEAD、远程、stash；`loadCommits` 读取提交、引用、标签、远程分支并合成可渲染提交节点。
8. 提交列表需要按配置处理 tags、remote branches、stashes、uncommitted changes、reflog、first-parent 和提交排序；未提交变更会以特殊 `UNCOMMITTED` 节点插入。
9. 提交详情、stash 详情和提交比较必须通过 `DataSource` 获取文件变更；打开 VS Code Diff 时由 `DiffDocProvider` 提供指定修订版本内容。
10. Git 写操作必须由扩展宿主执行，返回 `ErrorInfo` 或 `ErrorInfo[]`；`null` 表示成功，字符串表示可展示错误。
11. Git 写操作期间 `RepoFileWatcher` 应静音，操作结束后恢复监听，避免一次 Git 操作触发重复刷新。
12. 代码评审以仓库和 commit 或 commit comparison id 为键保存在 workspace state；当剩余待审文件为空时结束评审，90 天未活动评审自动过期。
13. 仓库设置可以导出到 `.vscode/vscode-git-graph.json`；导入前必须验证字段类型和枚举值，且只在文件 `exportedAt` 更新时提示或应用。
14. 头像抓取仅在配置启用且头像存储可用时参与提交渲染；缓存命中优先，过期后按 GitHub、GitLab、Gravatar 规则重试或回退。
15. 新增配置项或重命名配置项时，应保持历史配置兼容，参考 `Config.getRenamedExtensionSetting` 的读取顺序。

## 业务影响范围

| 影响类型 | 影响对象 | 说明 |
|---|---|---|
| 直接影响 | Git Graph Webview 主流程 | 影响仓库列表、分支筛选、提交图、提交详情、比较视图、设置面板和上下文菜单 |
| 间接影响 | VS Code 命令、状态栏、SCM 入口、Diff 编辑器 | 打开视图、恢复代码评审、打开文件和 Diff 都依赖扩展宿主与 VS Code API |
| 兼容影响 | 历史扩展配置、workspace/global Memento、`.vscode/vscode-git-graph.json` | 字段改名或状态结构变化必须兼容旧数据，避免用户配置和工作区状态丢失 |
| 数据/接口影响 | `RequestMessage`、`ResponseMessage`、Git CLI 输出解析、`GitRepoState` | 前后端消息协议和 Git 输出解析变化会影响 Webview 与宿主通信 |
| 权限/状态影响 | 用户本地 Git 仓库、Git 远程、系统凭据、VS Code 工作区 | Git 写操作会改变仓库状态；远程操作依赖用户 Git 凭据和网络环境 |
| 无影响边界 | VS Code 外部的服务端业务系统 | 项目本身是本地 VS Code 扩展，不维护独立后端服务或数据库 |

## 状态流转

| 当前状态 | 允许操作 | 下一状态 | 说明 |
|---|---|---|---|
| 扩展未激活 | VS Code 激活扩展 | 初始化中 | 由 `activationEvents` 触发 |
| 初始化中 | 查找 Git 和初始化管理器 | 可用或不可用 | 找不到 Git 时进入不可用提示 |
| 可用 | 扫描工作区仓库 | 仓库列表已知 | 包括已持久化仓库、工作区扫描和子模块 |
| 仓库列表已知 | 打开 Git Graph | Webview 已加载 | 创建或复用 Webview panel |
| Webview 已加载 | 请求仓库信息 | 仓库信息已加载 | 获取 branches、HEAD、remotes、stashes |
| 仓库信息已加载 | 请求提交列表 | 提交图已渲染 | 获取 commits、refs、tags 并渲染图形 |
| 提交图已渲染 | 查看详情或比较 | 详情视图打开 | 可继续打开文件或 Diff |
| 提交图已渲染 | 执行 Git 操作 | 操作运行中 | Webview 显示运行中弹窗，宿主执行 Git |
| 操作运行中 | 操作成功或失败 | 提交图刷新或错误提示 | 成功后刷新；失败展示 `ErrorInfo` |
| 详情视图打开 | 开始或更新代码评审 | 代码评审持久化 | 评审状态写入 workspace state |

## 权限规则

| 身份/条件 | 可执行操作 | 限制条件 | 说明 |
|---|---|---|---|
| VS Code 当前用户 | 打开 Git Graph、查看仓库、查看 Diff | 工作区内存在可访问仓库，且能找到 Git | 本地扩展没有独立登录系统 |
| VS Code 当前用户 | 手动添加仓库 | 目标目录必须位于当前工作区内 | `CommandManager.addGitRepository` 会校验工作区范围 |
| VS Code 当前用户 | Git 写操作 | 依赖本地文件权限、Git 状态、远程认证和 Git 命令结果 | 操作失败时返回错误信息，不应伪造成功状态 |
| VS Code 当前用户 | 远程操作和头像抓取 | 依赖网络、远程权限、API 限流和配置开关 | 头像功能涉及外部服务和提交邮箱，应保持可配置 |

## 接口约定

### Webview 消息协议

- 入参：`src/types.ts` 中的 `RequestMessage` 联合类型。
- 出参：`src/types.ts` 中的 `ResponseMessage` 联合类型。
- 错误处理：多数响应继承 `ResponseWithErrorInfo` 或 `ResponseWithMultiErrorInfo`，`null` 表示无错误。
- 兼容性：新增消息时必须同步更新类型、`GitGraphView.respondToMessage`、Webview 发送逻辑和响应处理逻辑。

### DataSource Git 操作

- 入参：仓库路径、Git 对象标识、配置开关和操作参数。
- 出参：业务数据、`ErrorInfo` 或 `ErrorInfo[]`。
- 错误处理：Git 非零退出码转换为可展示字符串；无法找到 Git 时返回统一错误。
- 兼容性：解析 Git 输出时必须考虑空输出、不同换行符、Windows 路径、Git 版本差异和二进制文件差异。

### RepoManager 仓库配置文件

- 文件路径：仓库根目录下 `.vscode/vscode-git-graph.json`。
- 入参字段：仓库显示名、初始分支、隐藏远程、Issue Linking、Pull Request 配置、提交排序、显示选项等。
- 校验规则：导入前校验字段类型和枚举值；无效字段应提示用户具体字段名。
- 兼容性：导出文件可提交到项目仓库供团队共享，导入时不应破坏用户未选择覆盖的本地配置。

## 前端行为

- 仓库下拉用于选择当前仓库；分支下拉用于选择展示全部分支、具体分支或自定义 glob。
- 刷新、fetch、设置、终端、搜索等控件位于 Webview 顶部控制栏。
- 点击提交可打开提交详情；按住 CTRL 或 CMD 点击另一个提交可进入提交比较。
- Git 操作通过上下文菜单触发，涉及用户输入或风险操作时必须展示弹窗表单或确认框。
- 设置面板负责仓库名称、初始分支、stash/tag 显示、远程管理、Issue Linking、Pull Request 创建配置和导出仓库配置。
- 代码评审中未审文件以 pending 状态展示，查看 diff 或打开文件后更新剩余文件列表。

## 后端校验

- 手动添加仓库前校验路径在工作区内，并通过 `git rev-parse --show-toplevel` 类逻辑确认仓库根目录。
- 外部仓库配置导入前必须验证字段类型、布尔值、数组元素、PR provider 和 Pull Request 配置必填字段。
- Git 引用名称输入由 Webview 弹窗进行前端校验；最终 Git 操作仍以 Git 命令结果为准。
- `DataSource` 对所有 Git 命令结果统一处理退出码、stdout、stderr 和错误消息。
- 找不到 Git 可执行文件时禁止继续执行 Git 数据读取或写操作。

## 测试建议

- 自动化测试：覆盖 `DataSource` Git 输出解析、`RepoManager` 仓库发现和配置导入导出、`ExtensionState` 状态持久化、`GitGraphView` 消息处理、`DiffDocProvider` URI 编解码。
- 手工验证：在 Extension Development Host 中打开单仓库、多仓库、空仓库和包含远程/tag/stash/未提交变更的仓库，验证加载、筛选、详情、比较和刷新。
- 回归测试：确认旧配置项仍被读取，已有 workspace state 不丢失，`.vscode/vscode-git-graph.json` 导入导出仍兼容。
- 边界/异常场景：未安装 Git、Git 版本过低、远程认证失败、Git 命令非零退出、仓库被删除、空提交历史、二进制文件、重命名文件、Windows 路径、头像 API 限流。
- 当前环境限制：本次仅整理文档，没有启动 VS Code Extension Development Host 进行人工 UI 验证。

## 已知兼容风险

- `package.json` 中配置项数量多且包含已废弃名称；配置重命名需要继续兼容旧键。
- Webview 通过字符串拼接 HTML，新增用户可控内容展示时必须继续使用转义工具。
- Git 命令输出解析对格式有强依赖，变更 Git 参数或格式字符串可能影响提交图和详情视图。
- 远程操作受 Git 凭据和网络影响，自动化测试通常需要 mock，而不是直接访问真实远程。

## 待确认

- 无。本记录按 2026-06-18 当前源码和项目 README/CONTRIBUTING 整理。

## 最近验证

- 验证时间：2026-06-18
- 验证来源：
  - `README.md`
  - `CONTRIBUTING.md`
  - `package.json`
  - `src/extension.ts`
  - `src/commands.ts`
  - `src/gitGraphView.ts`
  - `src/dataSource.ts`
  - `src/repoManager.ts`
  - `src/extensionState.ts`
  - `src/config.ts`
  - `src/diffDocProvider.ts`
  - `src/avatarManager.ts`
  - `src/repoFileWatcher.ts`
  - `src/types.ts`
  - `web/main.ts`
  - `web/graph.ts`
  - `web/settingsWidget.ts`
  - `web/dialog.ts`
- 相关项目文档：
  - `docs/项目文档.md`
