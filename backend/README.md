# 后端（万米画布 / 豆奶助手）

## 一键安装（Linux / macOS / WSL）

在服务器上克隆仓库后进入本目录，执行：

```bash
chmod +x scripts/install.sh
./scripts/install.sh
```

脚本会：`npm install --omit=dev`，再启动交互向导：填写 MySQL 主机/端口、**数据库名**、**数据库用户名**、**数据库密码**（会先 `SELECT 1` 测连），写入 `.env` 并建表，最后设置**管理员用户名与密码**。

若已安装依赖，也可直接：

```bash
npm run install:backend
# 或
node scripts/install.js
```

## 前置条件

- Node.js **18+**
- 已创建好的 **MySQL 数据库** 及对该库有权限的 **用户**（向导不负责 `CREATE DATABASE`）

## 生产环境提示

- `.env` 含密钥与数据库密码，**勿提交到 Git**（本目录已 `.gitignore` 忽略 `.env`）。
- 易支付异步通知依赖公网可访问的 API 根地址，向导里可填 `PUBLIC_APP_URL`（如 `https://api.example.com`）；前端 SPA 根地址填 `FRONTEND_URL`。
- 安装完成后用 `npm start` 或 PM2 / systemd 常驻运行。

## 环境变量示例

参见仓库内 `.env.example`。