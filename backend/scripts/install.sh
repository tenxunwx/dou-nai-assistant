#!/usr/bin/env bash
# 万米画布 / 豆奶助手 — 后端一键安装（依赖安装 + 交互向导）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "错误：未找到 Node.js，请先安装 Node.js 18 或更高版本。"
  exit 1
fi

NODE_MAJOR="$(node -p "parseInt(process.versions.node.split('.')[0],10)")"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "错误：需要 Node.js 18+，当前为 $(node -v)"
  exit 1
fi

echo "==> 安装 npm 依赖（生产模式，省略 devDependencies）…"
npm install --omit=dev

echo "==> 启动安装向导…"
exec node scripts/install.js
