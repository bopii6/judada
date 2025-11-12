#!/bin/bash

# 🔐 HTTPS 配置脚本
# 在部署完成并绑定域名后运行此脚本

echo "🔐 开始配置 HTTPS..."
echo "===================="

# 检查是否提供了域名
if [ -z "$1" ]; then
    echo "❌ 请提供域名作为参数"
    echo "用法: ./setup-https.sh your-domain.com"
    exit 1
fi

DOMAIN=$1

echo "🌐 配置域名: $DOMAIN"

# 安装 Certbot
echo "📦 安装 Certbot..."
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# 获取 SSL 证书
echo "🔑 获取 SSL 证书..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect

if [ $? -ne 0 ]; then
    echo "❌ SSL 证书获取失败，尝试手动配置..."
    exit 1
fi

# 设置自动续期
echo "🔄 设置证书自动续期..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

# 测试 Nginx 配置
echo "🧪 测试 Nginx 配置..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx 配置测试通过"
    sudo systemctl reload nginx
else
    echo "❌ Nginx 配置有误，请检查"
    exit 1
fi

# 验证 HTTPS
echo "🔍 验证 HTTPS 配置..."
if curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" | grep -q "200"; then
    echo "✅ HTTPS 配置成功！"
    echo ""
    echo "🎉 网站已启用 HTTPS："
    echo "🌐 https://$DOMAIN"
    echo "🔧 https://$DOMAIN/admin"
    echo ""
    echo "📋 证书信息："
    sudo certbot certificates
else
    echo "❌ HTTPS 配置可能有问题，请检查"
    exit 1
fi

echo ""
echo "📋 后续维护："
echo "- 证书会自动续期"
echo "- 查看证书状态: sudo certbot certificates"
echo "- 手动续期: sudo certbot renew"
echo "- 测试续期: sudo certbot renew --dry-run"