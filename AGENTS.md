# AGENTS.md

本文件适用于仓库根目录及其全部子目录。除非更深层目录存在独立的 `AGENTS.md`，否则所有自动化代理和协作者都应遵循本规范。

## 1. 项目概况

WorkTools 是面向 API 对接工作的本地优先报文工作台，同一套前端同时支持 Web/PWA 和 Windows Tauri 桌面端。

- 前端：React 19、TypeScript、Vite 8
- 编辑器：Monaco Editor
- 本地状态：Zustand
- 本地持久化：Dexie / IndexedDB
- 报文能力：JSON、JSONC、XML 格式化、校验、转换和对比
- 调度能力：Unix、Spring、Quartz Cron 生成、解析和运行时间预览
- 桌面端：Tauri v2、Rust
- 多语言：简体中文和英文，资源位于 `src/i18n/zh-CN.ts` 和 `src/i18n/en-US.ts`
- ???Vitest??????????????? `tests/`??? `src/` ????????
- Web 部署：PWA、Docker、Nginx

关键目录：

- `src/pages/`：各工具页面
- `src/components/`：可复用界面组件，包括 Monaco 编辑器和提示组件
- `src/core/`：格式化、对比、Cron、脱敏、导出和工作包等纯业务逻辑
- `src/hooks/`：跨页面复用的 React Hook
- `src/store/`：标签页、导航和应用级状态
- `src/storage/`：Dexie 数据库、工作区、模板和设置持久化
- `src/platform/`：Web 与 Tauri 的平台差异封装
- `src/i18n/`：中文、英文语言资源和翻译入口
- `tests/`?Vitest ???????? `src/` ??????????
- `src-tauri/src/`：Rust 桌面端入口和平台逻辑
- `src-tauri/capabilities/`：Tauri v2 权限声明
- `docker/`：Nginx 配置和 Docker 使用说明
- `data/`：导入、导出、备份和部署日志的宿主机目录；真实内容不进入 Git

## 2. 开始修改前

1. 阅读本文件，以及与任务相关的 `README.md`、`WORKTOOLS_DESIGN.md` 和现有测试。
2. 执行 `git status --short`，记录修改前已经存在的未提交文件。
3. 不覆盖、不格式化、不暂存、不回滚与当前任务无关的修改；发现无关问题只记录，不顺手修复。
4. 明确需求中的假设、歧义和成功标准。能从代码、配置和测试确认的内容直接确认，不能安全推断时再询问。
5. 非小型改动根据范围建立基线：
   - 前端逻辑：`npm test`
   - 前端构建：`npm run build`
   - Rust/Tauri：`cargo check --manifest-path src-tauri/Cargo.toml`
   - Docker：`docker compose config` 或 `docker build -t worktools-web:local .`
6. 广泛搜索时排除 `node_modules/`、`dist/`、`src-tauri/target/`、`coverage/`、`data/` 中的真实数据和部署日志。
7. 多步骤任务先给出简短计划，每一步都应包含可验证的结果。

## 3. 实现原则

- 采用满足当前需求的最小实现，不增加未要求的抽象、配置、依赖或“以后可能用到”的扩展点。
- 修改保持外科手术式范围；每一处变更都应能追溯到当前需求。
- 优先复用现有组件、类型、CSS 类、工具函数、平台封装和测试模式。
- 不重排无关代码，不统一无关格式，不删除原有死代码；只清理由本次修改产生的无用导入、变量和文件。
- 修复问题时优先定位共享根因，避免在多个页面重复打补丁。
- 新增依赖前，先确认浏览器、Tauri 原生能力或已有依赖不能完成需求。
- 不为了让测试通过而削弱已有安全限制、持久化兼容或用户数据保护。
- 新增或修改的代码注释使用中文；协议字段、标准名称和不可翻译的标识符可以保留原文。

## 4. 架构与文件组织

- 页面级功能放在 `src/pages/`；只有被多个页面复用的界面能力才放入 `src/components/`。
- 格式化、解析、对比、Cron、脱敏、导出等可测试逻辑优先放入 `src/core/`，避免与 React 组件、DOM 或 Tauri API 耦合。
- IndexedDB 表结构、查询和迁移集中在 `src/storage/`；不要在页面组件中直接散落 Dexie 查询。
- Web/Tauri 文件读写差异集中在 `src/platform/`；页面不应直接判断大量平台细节。
- 应用级标签和导航状态集中在 `src/store/`，不要为单个页面建立重复的全局状态源。
- ??????????? `tests/`?? `src/` ??????????????? `*.test.ts` ? `*.test.tsx` ???
- 小范围样式继续遵循现有 `src/App.css` 设计语言；样式显著增长时按功能拆分，不创建只有一层转发的空模块。
- 拆分文件后同步更新导入、导出、测试和懒加载入口，避免重复实现。

## 5. Web、PWA 与 Tauri 双运行时

- 所有功能必须明确区分纯 Web 和 Tauri 桌面运行时，不能假设 Tauri API 在浏览器中存在。
- 调用 Tauri 插件前使用现有 `isTauriRuntime()` 等平台判断，并优先采用动态导入，避免 Web 构建或浏览器运行时报错。
- Web 页面不得显示最小化、最大化、还原、关闭等桌面窗口按钮；自定义窗口控制只在 Tauri 运行时显示。
- Tauri 自定义窗口操作应针对当前窗口，不新增硬编码窗口标签的重复实现。
- 保持 `vite.config.ts` 中 Web PWA 与 Tauri 构建的差异：Web 可注册 PWA，Tauri 构建不得残留会干扰桌面 WebView 的 Service Worker。
- 修改懒加载页面或构建分包时，必须验证页面切换和动态模块加载，防止旧缓存导致 `Failed to fetch dynamically imported module`。
- 修改窗口、权限或文件系统能力时同步检查 `src-tauri/tauri.conf.json` 和 `src-tauri/capabilities/default.json`，只增加需求所需的最小权限。
- 不改变 `decorations: false`、自定义标题栏和 Web/Tauri 显示边界，除非用户明确要求。

## 6. Monaco 编辑器、标签页与输入保护

- JSON、XML 和文本编辑区域优先复用 `src/components/CodeEditor.tsx`，不要创建行为不一致的第二套编辑器封装。
- Monaco 的生命周期由组件实例管理；不要全局释放共享服务，不要复用已经销毁的编辑器或模型。
- 只有当前代码创建并独占的 Monaco 模型、装饰器或监听器才能在卸载时释放。
- 修改编辑器时至少验证：格式化页、左右对比页、多标签页切换、关闭后重新打开和主题切换。
- 标签页切换不得清空尚未保存的输入；不要通过不稳定的 `key` 或无条件重建页面来模拟刷新。
- 单击菜单应切换或激活合适的已有标签；需要支持多实例的菜单应保持双击打开新标签的现有语义。
- 标签标题、保存文件名和工作区记录必须保持对应；未命名实例使用稳定且可区分的名称。
- `Ctrl+S` 只保存当前活动且支持保存的工作区，避免重复注册全局快捷键或触发浏览器默认保存页面。
- 对可能丢失用户输入的关闭、删除和覆盖操作提供明确确认或可恢复路径。

## 7. 本地数据、隐私与迁移

- WorkTools 默认本地处理报文，不得在未明确要求时新增上传、遥测、远程日志或第三方分析。
- 不在控制台、日志、错误上报或测试快照中输出完整业务报文、密钥、Token 或其他敏感内容。
- 工作区、规则模板、脱敏模板、基线、最近文件和设置保存在 `worktools-db` IndexedDB 中。
- 修改 `src/storage/db.ts` 的表结构时必须增加 Dexie 版本迁移，并验证旧数据缺少新字段时仍可读取。
- 删除工作区应保持现有回收站语义；区分移入回收站、恢复和永久删除，不把软删除改成直接物理删除。
- Web 与 Tauri 都必须保持已有本地数据兼容；不能通过修改数据库名、主键或默认清库解决迁移问题。
- `data/imports/`、`data/exports/`、`data/backups/` 和 `data/docker/nginx-logs/` 中的真实内容不得提交到 Git。
- Docker 只提供静态前端，浏览器 IndexedDB 不是容器卷；不要把挂载日志或静态目录描述成工作区数据库持久化。
- 导入工作包或外部文件时验证结构、版本和大小边界；失败不得覆盖已有工作区。

## 8. 格式化、对比、Cron 与导出

- JSON/JSONC 修改必须保留重复 Key 提示、错误定位和格式识别能力。
- XML 修改必须保留 DOCTYPE/ENTITY 防护、嵌套深度限制和现有安全解析策略，不为兼容异常报文放开实体扩展。
- XML 格式化不得引入额外空白文本节点或连续无意义空行。
- 转义功能保持“添加转义、移除转义、反转义”的语义清晰，不用名称相近但行为重叠的实现代替。
- 对比逻辑优先修改 `src/core/diff.ts` 和共享高亮映射；不要让页面显示结果与导出结果使用不同的差异判定。
- 语法高亮与差异高亮需要共存，不能因增加差异背景而破坏 JSON/XML Token 可读性。
- 数组顺序、关键字段匹配、忽略路径、仅比较路径、类型和空值规则修改时必须补充对应回归测试。
- Cron 修改必须区分 Unix、Spring 和 Quartz 方言；生成、反向解析和未来运行时间应使用同一方言设置。
- HTML、Markdown、CSV、JSON 导出必须对用户内容进行正确转义，避免生成可执行脚本或损坏报告结构。
- 对比导出应保留页面可见的差异位置和高亮信息；应用脱敏规则时不得修改编辑器中的原始报文。

## 9. 多语言与界面规范

- 新增或修改可见文本时同时更新 `src/i18n/zh-CN.ts` 和 `src/i18n/en-US.ts`，不要在组件中新增只有单一语言的可翻译字符串。
- 保持两个语言文件的 Key 集合一致，并运行现有 i18n 测试。
- 标签、按钮、Toast、帮助内容和错误提示都属于需要翻译的界面文本。
- 遵循现有中性工具型设计语言和 CSS 变量，不引入营销式渐变、浮夸卡片或与开发工具不一致的视觉风格。
- Toast 必须具有足够的文字/背景对比度，不依赖颜色作为唯一状态提示。
- 明显 UI 改动除自动化测试外，还应在实际 Web 页面中核验；涉及桌面标题栏时再核验 Tauri 应用。
- 动画应简短、可中断并尊重 `prefers-reduced-motion`；GPU 渲染开关关闭时功能仍须可用。
- 布局需覆盖项目支持的最小窗口尺寸，不得只在开发机的单一分辨率下验证。

## 10. 文件规模与代码风格

- 新建的 TS、TSX、JS、JSX、RS、CSS 文件原则上不超过 800 行。
- 活跃代码文件硬上限为 1200 行。修改接近上限的文件时，应提前拆出本次涉及的功能。
- 已有文件超过 800 行不代表必须在无关任务中重构；但不得无理由继续堆叠，接近 1200 行时必须按职责拆分。
- 不要为了满足行数限制创建只有一层转发、没有独立职责的模块。
- 遵循现有 TypeScript 严格模式，不使用无解释的 `any`、非空断言或忽略类型错误来绕过问题。
- 不直接编辑 `dist/`、`src-tauri/target/`、`src-tauri/gen/` 等生成文件。
- 保持 UTF-8 无 BOM，并遵循根目录 `.editorconfig` 和 `.gitattributes` 的换行约定。

## 11. Docker、PWA 与构建配置

- Docker 镜像必须由源码执行 `npm run build` 生成，不把宿主机 `dist/` 当作正式镜像唯一来源。
- 保持 `.dockerignore` 排除 `.git`、`node_modules`、`dist`、`src-tauri/target`、`data`、日志和本地环境文件。
- Nginx 配置必须保留 SPA 路由回退、UTF-8、`index.html`/Service Worker 禁止强缓存和带 Hash 静态资源长期缓存。
- Compose 挂载只用于明确的宿主机目录或配置；不得把敏感报文打入镜像层。
- 修改 Vite 分包、Monaco Worker 或 PWA 缓存策略时，应检查最终 `dist` 文件并实际打开生产构建页面。
- 修改安装包、版本或 Tauri 配置时同步检查 `package.json`、`package-lock.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 中受影响的版本面；版本变更不代表允许发布。

## 12. 验证要求

根据改动范围执行最小但充分的验证。

前端逻辑或 UI：

```powershell
npm test
npm run build
git diff --check
```

Rust 或 Tauri：

```powershell
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

Docker 或 Nginx：

```powershell
docker compose config
docker build -t worktools-web:local .
```

补充要求：

- Bug 修复应先留下最小复现测试，再实现修复并确认测试通过。
- UI 改动应验证真实 DOM 和关键交互，不只依赖编译成功或配置值。
- 标签、Monaco、懒加载、PWA 缓存和本地存储改动必须覆盖相应的多实例或兼容场景。
- 验证失败时区分本次回归与原有问题，不得为了“全绿”修改无关范围。
- 交付前执行 `git status --short`，并核对所有变更文件都能追溯到当前需求。
- 若仓库尚无基线提交，`git diff --check` 无法覆盖未跟踪文件，应额外检查新增文件的 UTF-8、换行和行尾空格。

## 13. Git 规范

- 未经用户明确要求，自动创建提交。
- 提交前再次核对 `git status`，仅暂存当前任务的明确文件；避免使用 `git add .` 吸收无关修改。
- 不得把用户已有未提交修改、业务报文、构建产物、日志、截图或调试文件混入提交。
- 用户要求提交时使用 Conventional Commits，格式为 `<type>: <中文描述>`，例如：
  - `feat: 增加报文批量导入`
  - `fix: 修复标签切换后内容丢失`
  - `docs: 增加项目协作规则`
  - `build: 完善 Docker 构建配置`
- 一项完整任务对应一个聚焦提交，不把无关清理混入同一提交。
- 提交后确认工作区只剩用户原有或明确保留的未提交修改。

## 14. 完成标准

任务仅在以下条件满足后才算完成：

- 用户要求的行为已实现，没有增加额外范围。
- Web/PWA/Tauri 的适用边界已经检查，没有把单平台能力误用到其他运行时。
- 相关类型、默认值、存储迁移、语言资源、权限和导出格式已按影响范围同步。
- 新功能或 Bug 修复已有最小回归测试，并完成与改动范围匹配的验证。
- 没有覆盖、暂存、提交或删除无关修改和用户数据。
- 最终说明包含实现摘要、验证结果、已知限制和 Git 状态。
