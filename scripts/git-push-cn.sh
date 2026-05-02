#!/usr/bin/env bash
# 国内推送 GitHub：直连失败时尝试本机常见 HTTP 代理端口
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
cd "$ROOT"
BRANCH="${1:-main}"
REMOTE="${2:-origin}"

try_push() {
  local p="$1"
  if [[ -n "$p" ]]; then
    echo "==> 使用代理: $p"
    export HTTP_PROXY="$p" HTTPS_PROXY="$p" ALL_PROXY="$p"
    git -c "http.proxy=$p" -c "https.proxy=$p" push -u "$REMOTE" "$BRANCH"
  else
    echo "==> 直连推送…"
    unset HTTP_PROXY HTTPS_PROXY ALL_PROXY || true
    git push -u "$REMOTE" "$BRANCH"
  fi
}

if [[ -n "${HTTPS_PROXY:-}" ]]; then
  try_push "$HTTPS_PROXY"
  echo "推送成功。"
  exit 0
fi

if try_push ""; then echo "推送成功（直连）。"; exit 0; fi
echo "直连失败，尝试本机代理端口…"

for p in "http://127.0.0.1:7890" "http://127.0.0.1:7897" "http://127.0.0.1:10809"; do
  if try_push "$p"; then echo "推送成功（$p）。"; exit 0; fi
done

echo "仍未成功。请开启 Clash/V2 系统代理后执行:"
echo "  HTTPS_PROXY=http://127.0.0.1:7890 bash scripts/git-push-cn.sh"
exit 1
