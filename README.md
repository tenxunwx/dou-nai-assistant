# 万米画布 / 豆奶助手

GitHub 仓库：`dou-nai-assistant`。全栈项目：`backend/`（Node + Express + MySQL）、`frontend/`（前端）。

**后端首次部署**：见 [backend/README.md](backend/README.md) 中的 `./scripts/install.sh` 一键安装说明。

## 国内推送 GitHub

公开「镜像站」多数只加速 `clone`，**不能代替账号密码 / Token 去 `push`**。可行做法是：**本机开代理（如 Clash 系统代理）**，再推送。

在项目根目录执行（Windows PowerShell）：

```powershell
.\scripts\git-push-cn.ps1
```

脚本会先直连，再自动尝试 `127.0.0.1:7890`、`7897`、`10809` 等常见端口。若你代理端口不同：

```powershell
.\scripts\git-push-cn.ps1 -Proxy "http://127.0.0.1:你的端口"
```

Linux / macOS：

```bash
chmod +x scripts/git-push-cn.sh
HTTPS_PROXY=http://127.0.0.1:7890 bash scripts/git-push-cn.sh
```

也可长期只对 GitHub 走代理（示例端口 7890）：

```text
git config --global http.https://github.com.proxy http://127.0.0.1:7890
git config --global https.https://github.com.proxy http://127.0.0.1:7890
```
