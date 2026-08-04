# WorkTools 本地数据目录

该目录用于整理开发、测试和部署时产生的宿主机文件，不用于保存源码。

- `imports/`：待导入或用于测试的 JSON、XML、文本报文。
- `exports/`：手动整理的格式化结果、对比报告和报文导出文件。
- `backups/`：工作区导出的备份文件，例如 `.apiwork`。
- `docker/nginx-logs/`：Docker Web 服务挂载的 Nginx 日志目录。

除说明文件和 `.gitkeep` 占位文件外，目录内的真实数据均被 Git 忽略，避免把业务报文、敏感内容或大文件提交到仓库。

> WorkTools 的 Web/Tauri 工作区、规则模板、设置等运行数据仍保存在浏览器或桌面 WebView 的 IndexedDB 中。Docker 容器只提供前端静态页面，无法直接接管访问者浏览器里的 IndexedDB。需要迁移数据时，请在应用内导出备份，再将备份文件归档到 `backups/`。
