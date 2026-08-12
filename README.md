# worktools

面向 API 对接工作的本地优先报文工作台，同一套前端可作为 Web/PWA 使用，也可打包为 Windows 桌面软件。

## 已完成范围

### P0

- JSON / JSONC / XML 自动识别、格式化、压缩、校验与错误定位
- SQL 语句自动识别、语法高亮和格式化后对比，格式异常时回退原文对比
- JSON 重复 Key 提醒，XML DOCTYPE / ENTITY 防护与最大嵌套限制
- 文本、语义、结构三种对比模式
- 数组按顺序、忽略顺序或关键字段匹配
- 忽略路径、仅比较路径、类型与空值策略
- Unix、Spring、Quartz Cron 生成、中文复原与未来运行时间
- HTML、Markdown、CSV、JSON 对比报告和原始报文导出
- 本地工作区、最近文件信息与结构基线

### P1

- 左右目录按相对路径批量配对与对比
- 对比规则模板、脱敏规则及脱敏模板
- 工作区、模板、基线的 .apiwork 工作包导入导出
- 浅色/深色/系统主题、紧凑模式与编辑器偏好
- Ctrl+K 命令面板和 Alt+1–7 工具切换
- Web PWA 离线资源与 Windows MSI/NSIS 安装包

## 本地数据策略

- 报文解析、对比、Cron 和报告生成默认只在当前设备执行。
- 临时任务不会自动保存报文内容。
- 只有用户主动保存的工作区、模板和结构基线会进入本地 IndexedDB。
- 桌面端只对用户通过系统选择器选中的文件、目录或导出位置授权读写。
- 导出时可以应用脱敏规则，编辑器中的原始报文不会被修改。

## 开发与验证

```powershell
npm install
npm run dev
npm test
npm run build
npm run tauri:build
```

## 构建产物

- Web：`dist`
- Windows MSI：`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi`
- Windows 安装程序：`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis`

详细产品与页面设计见 `WORKTOOLS_DESIGN.md`。

## 项目目录约定

- `src/`：Web/Tauri 共用的 React 前端源码。
- `src-tauri/`：Windows 桌面端外壳、权限与安装包配置。
- `public/`：直接复制到 Web 构建产物的静态资源。
- `docker/`：Web 镜像运行使用的 Nginx 配置与说明。
- `data/`：开发、测试和部署时的宿主机文件目录；真实报文、导出和备份默认不进入 Git。
- `dist/`、`src-tauri/target/`：自动生成的构建产物，均由 Git 忽略。

`data/` 的详细分类见 `data/README.md`。应用内已保存的工作区仍使用浏览器或桌面 WebView 的 IndexedDB，避免在本次目录整理中破坏既有数据。

## Git 管理

仓库已提供：

- `.gitignore`：排除依赖、构建产物、运行数据、日志、缓存和本地配置。
- `.gitattributes`：统一源码文本换行并标记常见二进制文件。
- `.editorconfig`：统一 UTF-8、换行和基础编辑器格式。
- `.dockerignore`：缩小 Docker 构建上下文，避免把本地数据和桌面构建产物传入镜像。

仓库只完成本地 Git 初始化，不会自动提交、推送或创建远程仓库。

## Docker Web 部署

使用 `compose.ghcr.yaml` 直接部署 GitHub Container Registry 镜像（默认使用当前可用的 `dev-latest`）：

```powershell
docker compose -f compose.ghcr.yaml pull
docker compose -f compose.ghcr.yaml up -d
```

也可以使用 `compose.yaml` 从当前源码构建并启动：

```powershell
docker compose up --build -d
```

默认访问 `http://localhost:8080`。镜像标签选择、端口修改、日志挂载、更新、停止和故障排查等完整教程见 [`docker/README.md`](docker/README.md)。
