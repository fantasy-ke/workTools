# WorkTools Web Docker 部署

该目录保存 Web 镜像使用的 Nginx 配置。镜像中的静态页面由项目根目录 `Dockerfile` 执行 `npm run build` 生成，容器默认监听 80 端口。

## 部署前准备

- 安装并启动 Docker Desktop，或在服务器上安装 Docker Engine。
- 确认计划使用的宿主机端口未被其他程序占用，以下示例默认使用 `8080`。
- WorkTools 工作区保存在访问浏览器的 IndexedDB 中，不在容器或日志目录中；删除或重建容器不会迁移或清除浏览器工作区。

流水线发布到 GitHub Container Registry 的镜像为 `ghcr.io/fantasy-ke/worktools`：

| 标签 | 用途 |
|---|---|
| `latest` | 最新正式版 |
| 正式 Release 标签，例如 `v0.1.0` | 固定正式版本 |
| `dev-latest` | 最新开发预览版，后续开发构建会覆盖 |
| 开发版本标签 | 固定开发构建，具体标签见对应 GitHub Release |

如果拉取镜像时提示没有权限，请先使用具有 `read:packages` 权限的 GitHub Token 登录 GHCR：

```powershell
$env:GHCR_TOKEN | docker login ghcr.io -u GITHUB_USERNAME --password-stdin
```

## 方式一：使用 docker run 部署发布镜像

### 拉取并启动正式版

```powershell
docker pull ghcr.io/fantasy-ke/worktools:latest
docker run -d --name worktools-web --restart unless-stopped -p 8080:80 ghcr.io/fantasy-ke/worktools:latest
```

浏览器访问 `http://localhost:8080`。如需使用其他宿主机端口，只修改冒号左侧的端口，例如 `-p 9080:80` 对应 `http://localhost:9080`。

需要部署开发预览版时，将镜像标签替换为 `dev-latest`：

```powershell
docker run -d --name worktools-web --restart unless-stopped -p 8080:80 ghcr.io/fantasy-ke/worktools:dev-latest
```

### 可选：持久化 Nginx 日志

```powershell
New-Item -ItemType Directory -Force .\data\docker\nginx-logs | Out-Null
$logPath = (Resolve-Path .\data\docker\nginx-logs).Path
docker run -d --name worktools-web --restart unless-stopped -p 8080:80 --mount "type=bind,source=$logPath,target=/var/log/nginx" ghcr.io/fantasy-ke/worktools:latest
```

同名容器只能创建一次。如果已经启动过容器，请先执行 `docker rm -f worktools-web`，再用带日志挂载的命令重新创建。

### 查看和管理容器

```powershell
# 查看状态
docker ps --filter "name=worktools-web"

# 查看日志
docker logs -f worktools-web

# 停止、启动和删除
docker stop worktools-web
docker start worktools-web
docker rm -f worktools-web
```

### 更新正式镜像

```powershell
docker pull ghcr.io/fantasy-ke/worktools:latest
docker rm -f worktools-web
docker run -d --name worktools-web --restart unless-stopped -p 8080:80 ghcr.io/fantasy-ke/worktools:latest
```

如果使用了日志挂载，更新时应继续使用带 `--mount` 参数的启动命令。

## 方式二：使用 Docker Compose 从源码部署

项目根目录的 `compose.yaml` 会从当前源码构建 `worktools-web:local` 镜像，并将宿主机的 `data/docker/nginx-logs` 挂载到容器 `/var/log/nginx`。

### 构建并后台启动

在项目根目录执行：

```powershell
docker compose up --build -d
```

默认访问 `http://localhost:8080`。

### 修改访问端口

```powershell
$env:WORKTOOLS_PORT = "9080"
docker compose up --build -d
```

此时访问 `http://localhost:9080`。`WORKTOOLS_PORT` 只影响宿主机端口，容器内部仍监听 80 端口。

### 查看和管理服务

```powershell
docker compose ps
docker compose logs -f
docker compose restart
docker compose down
```

`docker compose down` 不会删除 `data/docker/nginx-logs` 中已经挂载到宿主机的日志。

### 更新源码后重新部署

```powershell
git pull
docker compose up --build -d
```

需要完全重新构建镜像时：

```powershell
docker compose build --no-cache
docker compose up -d
```

## 本地单独构建镜像

不使用 Compose 时，也可以从项目根目录构建本地镜像：

```powershell
docker build -t worktools-web:local .
docker run --rm -p 8080:80 worktools-web:local
```

这里使用 `--rm`，停止后会自动删除容器，适合临时验证，不适合作为长期部署命令。

## 验证与常见问题

启动后可检查页面是否正常返回：

```powershell
Invoke-WebRequest http://localhost:8080 -UseBasicParsing | Select-Object StatusCode
```

预期状态码为 `200`。

- **端口被占用**：将 `8080` 改为其他未占用端口，或通过 `WORKTOOLS_PORT` 修改 Compose 端口。
- **容器启动后立即退出**：运行 `docker logs worktools-web`；Compose 部署则运行 `docker compose logs`。
- **GHCR 拉取失败**：确认镜像名称和标签正确；如果包不是公开可读，先登录 GHCR。
- **页面仍显示旧版本**：重新拉取或构建镜像，并在浏览器中强制刷新；PWA 场景还应等待旧 Service Worker 更新。
- **工作区没有随容器迁移**：这是预期行为。工作区位于浏览器 IndexedDB，而不是日志目录或 Docker Volume。

如需临时使用宿主机已经构建的 `dist` 覆盖镜像页面，可在 `compose.yaml` 的 `volumes` 中额外加入：

```yaml
- ./dist:/usr/share/nginx/html:ro
```

该方式只适合本地验证。正式部署应使用镜像内由 `npm run build` 生成的静态资源。
