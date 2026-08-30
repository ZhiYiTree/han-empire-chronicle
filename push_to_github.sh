#!/usr/bin/env bash
# 推送到 GitHub 私有仓库「大风歌」
#
# 用法（在 WorkBuddy 终端或 Git Bash 里）：
#   bash push_to_github.sh
#
# 说明：
#   本机环境变量 HTTP_PROXY/HTTPS_PROXY 指向 127.0.0.1:7892，
#   但该端口虽在监听却不转发流量（连国内站点都超时），
#   因此脚本先清掉代理走直连。若你开了可用的代理，
#   把下面 PROXY= 那一行改成你的代理地址即可（如 http://127.0.0.1:7890）。

set -e
cd "$(dirname "$0")"

PROXY=""   # 需要走代理就填，例如 PROXY="http://127.0.0.1:7890"

if [ -n "$PROXY" ]; then
  export HTTP_PROXY="$PROXY" HTTPS_PROXY="$PROXY" http_proxy="$PROXY" https_proxy="$PROXY"
else
  unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
fi
export NO_PROXY="localhost,127.0.0.1,::1"
export no_proxy="$NO_PROXY"

git config http.proxy ""
git config https.proxy ""

REPO_NAME="大风歌"

echo "==> 创建 GitHub 私有仓库：$REPO_NAME"
if gh repo create "$REPO_NAME" --private --source=. --remote=origin 2>/dev/null; then
  echo "    仓库已创建"
else
  echo "    仓库可能已存在，直接绑定远端"
  REMOTE_URL=$(gh repo view "$REPO_NAME" --json sshUrl,url -q '.sshUrl // .url' 2>/dev/null || echo "")
  if [ -n "$REMOTE_URL" ]; then
    git remote set-url origin "$REMOTE_URL"
  else
    git remote remove origin 2>/dev/null || true
    git remote add origin "https://github.com/ZhiYiTree/${REPO_NAME}.git"
  fi
fi

echo "==> 推送"
git push -u origin main

echo ""
echo "完成：$(gh repo view "$REPO_NAME" --json url -q '.url' 2>/dev/null || echo 'https://github.com/ZhiYiTree/'${REPO_NAME})"
