# WorkTools Web Docker

该目录保存 Web 镜像运行所需的 Nginx 配置。镜像通过项目根目录的 `Dockerfile` 构建，默认监听容器的 80 端口。

## 构建与运行

```powershell
docker compose up --build -d
```

默认访问地址为 `http://localhost:8080`。如需修改宿主机端口：

```powershell
$env:WORKTOOLS_PORT = "9080"
docker compose up --build -d
```

## 挂载目录

`compose.yaml` 默认将宿主机的 `data/docker/nginx-logs` 挂载到容器 `/var/log/nginx`，便于保留和排查访问日志。

如需用本地已构建的静态资源临时覆盖镜像内容，可在 `volumes` 中额外加入：

```yaml
- ./dist:/usr/share/nginx/html:ro
```

这会覆盖镜像内置页面，仅适合本地验证。正式部署建议直接使用镜像中由 `npm run build` 生成的静态资源。
