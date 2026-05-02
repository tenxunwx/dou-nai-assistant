#!/usr/bin/env bash
# 服务器一键更新：展示 .env 数据库信息供核对 → git pull → 后端依赖 → 增量迁移（不删数据）→ 可选 PM2 / 前端构建
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
BACKEND="$REPO_ROOT/backend"

echo ""
echo "======== 万米画布 / 豆奶助手 — 更新脚本 ========"
echo "仓库根目录: $REPO_ROOT"
echo ""

if [[ ! -f "$BACKEND/.env" ]]; then
  echo "错误: 未找到 $BACKEND/.env，请先配置后端环境变量。"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "错误: 未找到 node，请先安装 Node.js 16+。"
  exit 1
fi

echo "以下从 $BACKEND/.env 读取（请核对是否为当前要保留的数据库）："
node -e "
const path = require('path');
const root = process.argv[1];
process.chdir(root);
require('dotenv').config({ path: path.join(root, '.env') });
const h = process.env.DB_HOST || '(空，将用 env 默认)';
const p = process.env.DB_PORT || '(空，将用 3306)';
const u = process.env.DB_USER || '(空)';
const n = process.env.DB_NAME || '(空)';
console.log('  DB_HOST   = ' + h);
console.log('  DB_PORT   = ' + p);
console.log('  DB_USER   = ' + u);
console.log('  DB_NAME   = ' + n);
console.log('  DB_PASSWORD = ********（已隐藏）');
" "$BACKEND"
echo ""
echo "说明: 本脚本不会执行 DROP DATABASE / 删表 / 清空数据；"
echo "      仅 git pull、npm install、再运行与启动时相同的数据库增量迁移（缺表补表、缺列补列）。"
echo ""
read -r -p "核对无误请回车继续，输入 n 中止: " confirm
if [[ "${confirm,,}" == "n" || "${confirm,,}" == "no" ]]; then
  echo "已中止。"
  exit 1
fi

if [[ -d "$REPO_ROOT/.git" ]]; then
  echo ""
  echo "==> git pull ..."
  cd "$REPO_ROOT"
  if git remote get-url origin &>/dev/null; then
    git pull --rebase || git pull
  else
    echo "提示: 未配置 git remote origin，已跳过 git pull。"
  fi
else
  echo ""
  echo "提示: $REPO_ROOT 下无 .git，已跳过 git pull（若为手工上传代码可忽略）。"
fi

echo ""
echo "==> npm install（backend，生产依赖）..."
(cd "$BACKEND" && npm install --omit=dev)

echo ""
echo "==> 数据库增量迁移（apply-db）..."
(cd "$BACKEND" && node scripts/apply-db.js)

echo ""
pm2_from_env="$(grep -E '^[[:space:]]*PM2_APP_NAME=' "$BACKEND/.env" 2>/dev/null | tail -n1 | sed -E 's/^[[:space:]]*PM2_APP_NAME=[[:space:]]*//;s/^[\"'\'']//;s/[\"'\'']$//' || true)"
if command -v pm2 >/dev/null 2>&1; then
  default_name="${pm2_from_env:-${PM2_APP_NAME:-wanmi-backend}}"
  read -r -p "是否使用 PM2 重启后端？进程名 [回车=$default_name / 填 skip 跳过]: " pm2_name
  pm2_name="${pm2_name:-$default_name}"
  if [[ "${pm2_name,,}" != "skip" ]]; then
    if pm2 describe "$pm2_name" &>/dev/null; then
      pm2 restart "$pm2_name"
      echo "已执行: pm2 restart $pm2_name"
    else
      echo "未找到 PM2 进程「$pm2_name」，请手动: pm2 list 后 pm2 restart <名称>"
      echo "或在 .env 中设置 PM2_APP_NAME=你的进程名 后重新执行本脚本。"
    fi
  else
    echo "已跳过 PM2。请手动重启 Node，例如: cd $BACKEND && pm2 start src/server.js --name wanmi-backend"
  fi
else
  echo "未检测到 pm2，跳过重启。请手动: cd $BACKEND && npm start 或使用 systemd。"
fi

echo ""
read -r -p "是否构建前端 dist [y/N]: " fe
if [[ "${fe,,}" == "y" || "${fe,,}" == "yes" ]]; then
  if [[ ! -d "$REPO_ROOT/frontend" ]]; then
    echo "未找到 frontend 目录，跳过。"
  else
    echo "==> npm install && npm run build（frontend）..."
    (cd "$REPO_ROOT/frontend" && npm install && npm run build)
    echo "前端产物: $REPO_ROOT/frontend/dist"
  fi
fi

echo ""
echo "======== 更新完成 ========"
