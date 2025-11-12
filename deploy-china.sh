#!/bin/bash

# 🚀 Jude English Lab 中国服务器部署脚本
# 适用于：阿里云、腾讯云等国内云服务器

echo "🇨🇳 开始配置中国服务器..."
echo "=================================="

# 更新系统
echo "📦 更新系统软件包..."
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18
echo "📦 安装 Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 pnpm
echo "📦 安装 pnpm..."
sudo npm install -g pnpm

# 安装 Nginx
echo "🌐 安装 Nginx..."
sudo apt install -y nginx

# 安装 PM2 (进程管理)
echo "🔧 安装 PM2..."
sudo npm install -g pm2

# 创建应用目录
echo "📁 创建应用目录..."
sudo mkdir -p /var/www/judada
sudo chown -R $USER:$USER /var/www/judada

# 创建 Nginx 配置文件
echo "🌐 配置 Nginx..."
sudo tee /etc/nginx/sites-available/judada << EOF
server {
    listen 80;
    server_name your-domain.com; # 替换成你的域名或服务器IP

    # 前端静态文件
    location / {
        root /var/www/judada/web;
        try_files \$uri \$uri/ /index.html;
    }

    # 管理后台
    location /admin {
        alias /var/www/judada/admin;
        try_files \$uri \$uri/ /index.html;
    }

    # API 接口
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# 启用网站配置
sudo ln -s /etc/nginx/sites-available/judada /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# 测试 Nginx 配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

# 配置防火墙
echo "🔥 配置防火墙..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "✅ 服务器基础配置完成！"
echo ""
echo "📋 接下来需要做的："
echo "1. 上传你的代码到服务器"
echo "2. 安装项目依赖"
echo "3. 配置环境变量"
echo "4. 构建和启动应用"
echo ""
echo "🎯 运行以下命令继续部署："
echo "cd /var/www/judada"
echo "git clone 你的代码仓库地址"