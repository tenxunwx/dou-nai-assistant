# 万米画布 / 豆奶助手

Node + MySQL 后端，Vite + React 前端。

## Linux 上跑起来

**环境**：Node.js **16+**（后端）、MySQL（已建好库与用户）。前端本地构建若工具链报错，可改用 Node 18+。

```bash
git clone https://github.com/tenxunwx/dou-nai-assistant.git
cd dou-nai-assistant/backend
chmod +x scripts/install.sh
./scripts/install.sh
```

按向导填数据库信息；端口扫描选好后会写 `.env`、建表并创建管理员。完成后：

```bash
npm start
```

**是否启动成功**：终端出现 `Backend running at http://localhost:端口` 后，另开终端（端口以 `.env` 里 `PORT` 为准，默认 `3001`）：

```bash
curl -sf "http://127.0.0.1:3001/" && echo " OK"
```

能返回一段 JSON（含欢迎语）即正常。**常驻运行、开机自启动**（systemd / PM2）见 [backend/README.md](backend/README.md)。

前端在 `frontend/` 目录：`npm install` 后 `npm run build` / `npm run dev`。生产环境若出现「网络异常」，多半是未把 **`/api` 反代到后端**，见 [frontend/README.md](frontend/README.md) 联调说明。

## 服务器上更新（不丢数据库）

**目录说明（不要进错文件夹）：** `update.sh` 在**仓库根目录**下的 `scripts/`，与 `backend/`、`frontend/` **同级**；**不在** `backend/scripts/` 里（那里只有 `install.sh`、`apply-db.js`）。

```
dou-nai-assistant/              ← 在这里执行 update.sh
├── scripts/
│   └── update.sh
├── backend/
│   └── scripts/
│       ├── install.sh
│       └── apply-db.js
└── frontend/
```

在**仓库根**执行：

```bash
cd /path/to/dou-nai-assistant    # 含 backend、frontend、scripts 的那一层
chmod +x scripts/update.sh
./scripts/update.sh
```

若你当前在 `backend` 目录里，要先上一级再执行：

```bash
cd ..
chmod +x scripts/update.sh
./scripts/update.sh
```

会先显示 `backend/.env` 里的数据库连接（密码隐藏），核对后回车；再 `git pull`、后端 `npm install`、**增量迁移数据库**（只补表/列，与启动时 `initDatabase` 相同），可选 PM2 重启与前端构建。详见 [backend/README.md](backend/README.md)。
