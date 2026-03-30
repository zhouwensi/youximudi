#!/usr/bin/env bash
# 在 Linux 服务器上：将本站 + API 装到本机（不碰你机器上其它站点配置，只新增 youximudi 的 systemd 与 nginx 站点文件）。
# 用法（在克隆下来的仓库根目录）：
#   sudo bash deploy/install-server.sh --yes
# 可选：
#   sudo WEB_ROOT=/var/www/youximudi DOMAIN=youximudi.com bash deploy/install-server.sh --yes
#   sudo API_USER=www-data API_PORT=8788 bash deploy/install-server.sh --yes
set -euo pipefail

ASSUME_YES=0
for a in "$@"; do [[ "$a" == "--yes" ]] && ASSUME_YES=1; done

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 sudo 运行本脚本。"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_ROOT="${WEB_ROOT:-/var/www/youximudi}"
DOMAIN="${DOMAIN:-youximudi.com}"
WWW_DOMAIN="${WWW_DOMAIN:-www.youximudi.com}"
API_PORT="${API_PORT:-8788}"
API_USER="${API_USER:-www-data}"

SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "未找到 node。请先安装 Node.js 18+（例如 https://github.com/nodesource/distributions ）。"
  exit 1
fi

if [[ "$ASSUME_YES" -ne 1 ]]; then
  echo "即将："
  echo "  1) 同步站点文件到 $WEB_ROOT（排除 .git、server/data）"
  echo "  2) 安装 systemd 服务 youximudi-api（端口 $API_PORT，用户 $API_USER）"
  echo "  3) 写入 nginx 站点 /etc/nginx/sites-available/youximudi 并启用"
  echo "域名: $DOMAIN / $WWW_DOMAIN"
  read -r -p "确认继续？[y/N] " x
  [[ "$x" == "y" || "$x" == "Y" ]] || exit 0
fi

echo "==> 同步文件到 $WEB_ROOT"
mkdir -p "$WEB_ROOT"
rsync -a --delete \
  --exclude=.git \
  --exclude=server/data \
  --exclude=node_modules \
  "$REPO_ROOT/" "$WEB_ROOT/"

mkdir -p "$WEB_ROOT/server/data"
chown -R "$API_USER:$API_USER" "$WEB_ROOT/server/data"
chown -R root:root "$WEB_ROOT"
chown -R "$API_USER:$API_USER" "$WEB_ROOT/server/data"

echo "==> systemd: youximudi-api"
UNIT=/etc/systemd/system/youximudi-api.service
sed -e "s|__WEB_ROOT__|$WEB_ROOT|g" \
    -e "s|__API_USER__|$API_USER|g" \
    -e "s|__API_PORT__|$API_PORT|g" \
    -e "s|__NODE_BIN__|$NODE_BIN|g" \
    "$SCRIPT_DIR/youximudi-api.service.template" >"$UNIT"

systemctl daemon-reload
systemctl enable youximudi-api
systemctl restart youximudi-api

echo "==> nginx 站点"
if [[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]]; then
  NGX_SITE=/etc/nginx/sites-available/youximudi
  NGX_EN=/etc/nginx/sites-enabled/youximudi
  NGX_SYMLINK=1
elif [[ -d /etc/nginx/conf.d ]]; then
  NGX_SITE=/etc/nginx/conf.d/youximudi.conf
  NGX_SYMLINK=0
else
  echo "未找到 /etc/nginx/sites-available 或 /etc/nginx/conf.d，请手动配置 Nginx。"
  exit 1
fi

SSL_EXTRA=""
if [[ -f /etc/letsencrypt/options-ssl-nginx.conf ]]; then
  SSL_EXTRA="
    include /etc/letsencrypt/options-ssl-nginx.conf;"
  if [[ -f /etc/letsencrypt/ssl-dhparams.pem ]]; then
    SSL_EXTRA+="
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"
  fi
fi

if [[ -f "$SSL_CERT" && -f "$SSL_KEY" ]]; then
  cat >"$NGX_SITE" <<EOF
server {
    listen 443 ssl http2;
    server_name $DOMAIN $WWW_DOMAIN;
    ssl_certificate     $SSL_CERT;
    ssl_certificate_key $SSL_KEY;$SSL_EXTRA

    root $WEB_ROOT;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 80;
    server_name $DOMAIN $WWW_DOMAIN;
    return 301 https://\$host\$request_uri;
}
EOF
else
  echo "未检测到 Let's Encrypt 证书 ($SSL_CERT)，先生成仅 HTTP 的配置（方便你立刻联调；上线前请 certbot 申请证书后重新运行本脚本）。"
  cat >"$NGX_SITE" <<EOF
server {
    listen 80;
    server_name $DOMAIN $WWW_DOMAIN;

    root $WEB_ROOT;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
fi

if [[ "${NGX_SYMLINK:-0}" -eq 1 ]]; then
  ln -sf "$NGX_SITE" "$NGX_EN"
fi
nginx -t
systemctl reload nginx

echo ""
echo "完成。API: systemctl status youximudi-api"
echo "健康检查: curl -s http://127.0.0.1:$API_PORT/api/health"
echo ""
echo "【请你确认 / 执行】"
echo "1) DNS：$DOMAIN 的 A 记录指向本机公网 IP。"
echo "2) Cloudflare：删除 Worker 路由 youximudi.com/api/*（否则会绕过本机 API）。"
echo "3) 可选：在本机运行 server/migrate-from-cloudflare.mjs 导出 KV，把 kv.json 放到服务器 $WEB_ROOT/server/data/ 后执行 systemctl restart youximudi-api"
