# 后端（万米画布 / 豆奶助手）

## 一键安装（Linux / macOS / WSL）

在服务器上克隆仓库后进入本目录，执行：

```bash
chmod +x scripts/install.sh
./scripts/install.sh
```

脚本会：`npm install --omit=dev`，再启动交互向导：填写 MySQL 主机/端口、**数据库名**、**数据库用户名**、**数据库密码**（会先 `SELECT 1` 测连）；接着**自动扫描本机 3001–3005 五个 HTTP 端口**并推荐首个空闲端口，你可回车采用或改选其他空闲端口；然后写入 `.env` 并建表，最后设置**管理员用户名与密码**。

若已安装依赖，也可直接：

```bash
npm run install:backend
# 或
node scripts/install.js
```

## 前置条件

- Node.js **16+**（推荐 LTS；Node 16 无内置 `fetch`，启动时已通过 `undici` 自动垫片）
- 已创建好的 **MySQL 数据库** 及对该库有权限的 **用户**（向导不负责 `CREATE DATABASE`）

## 生产环境提示

- `.env` 含密钥与数据库密码，**勿提交到 Git**（本目录已 `.gitignore` 忽略 `.env`）。
- 易支付异步通知依赖公网可访问的 API 根地址，向导里可填 `PUBLIC_APP_URL`（如 `https://api.example.com`）；前端 SPA 根地址填 `FRONTEND_URL`。
- 安装完成后用 `npm start` 或下文 PM2 / systemd 常驻运行。

## 检查是否启动成功

1. 看日志：终端应出现 `[production] Backend running at http://localhost:<PORT>`（`<PORT>` 与 `.env` 中 `PORT` 一致）。
2. 本机探测（把 `3001` 换成你的 `PORT`）：

```bash
curl -sf "http://127.0.0.1:3001/" && echo " OK"
```

若返回 JSON 且含 `欢迎使用万米画布后端 API`，说明 HTTP 服务已起来；若 `curl` 报错，检查端口、防火墙或进程是否崩溃。

## 开机自启动与常驻（Linux）

### 方式一：systemd（推荐）

1. 确认 Node 路径：`which node`（下面用 `/usr/bin/node` 举例，请改成你的路径）。
2. 创建服务文件（路径、用户、目录按你服务器修改）：

```bash
sudo tee /etc/systemd/system/wanmi-backend.service >/dev/null <<'EOF'
[Unit]
Description=Wanmi canvas backend API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/dou-nai-assistant/backend
EnvironmentFile=/opt/dou-nai-assistant/backend/.env
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

3. 启用并开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wanmi-backend.service
sudo systemctl status wanmi-backend.service
```

4. 查看日志：`journalctl -u wanmi-backend.service -f`

修改代码或 `.env` 后：`sudo systemctl restart wanmi-backend.service`。

### 方式二：PM2

```bash
npm install -g pm2
cd /path/to/backend
pm2 start src/server.js --name wanmi-backend
pm2 save
pm2 startup systemd
```

按 `pm2 startup` 最后打印的一条 `sudo env PATH=...` 命令执行一次，才能把当前 PM2 列表接到开机自启。常用：`pm2 logs wanmi-backend`、`pm2 restart wanmi-backend`。

## 环境变量示例

参见仓库内 `.env.example`。