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

前端在 `frontend/` 目录：`npm install` 后 `npm run build` / `npm run dev`，详见 [frontend/README.md](frontend/README.md)。

更多后端说明见 [backend/README.md](backend/README.md)。
