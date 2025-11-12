#!/bin/bash

# 🚀 Jude English Lab 腾讯云部署脚本
# 适用于：腾讯云轻量应用服务器

echo "🇨🇳 开始配置腾讯云服务器..."
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

# 安装 Git
echo "📦 安装 Git..."
sudo apt install -y git

# 创建应用目录
echo "📁 创建应用目录..."
sudo mkdir -p /var/www/judada
sudo chown -R $USER:$USER /var/www/judada

# 创建 Nginx 配置文件
echo "🌐 配置 Nginx..."
sudo tee /etc/nginx/sites-available/judada << EOF
server {
    listen 80;
    server_name _; # 会自动匹配服务器IP

    # 前端静态文件
    location / {
        root /var/www/judada/web;
        try_files \$uri \$uri/ /index.html;
        index index.html;
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

# 测试并重启 Nginx
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# 配置防火墙（腾讯云有安全组，但本地防火墙也建议开启）
echo "🔥 配置防火墙..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# 创建部署脚本
echo "📜 创建部署脚本..."
cat > /var/www/judada/deploy.sh << 'DEPLOY_EOF'
#!/bin/bash

echo "🚀 开始部署应用..."
cd /var/www/judada

# 拉取最新代码
git pull origin main

# 安装依赖
pnpm install

# 构建项目
pnpm build

# 部署前端文件
sudo mkdir -p /var/www/judada/web
sudo mkdir -p /var/www/judada/admin
sudo rm -rf /var/www/judada/web/*
sudo rm -rf /var/www/judada/admin/*
sudo cp -r apps/web/dist/* /var/www/judada/web/
sudo cp -r apps/admin/dist/* /var/www/judada/admin/

# 设置权限
sudo chown -R www-data:www-data /var/www/judada

# 重启后端服务
cd /var/www/judada/apps/server
pm2 restart judada-server

# 重启 Nginx
sudo systemctl reload nginx

echo "✅ 部署完成！"
DEPLOY_EOF

chmod +x /var/www/judada/deploy.sh

echo "✅ 腾讯云服务器基础配置完成！"
echo ""
echo "🎯 服务器信息："
echo "- 内网IP: $(hostname -I | awk '{print $1}')"
echo "- SSH 端口: 22"
echo "- Web 端口: 80"
echo ""
echo "📋 接下来的步骤："
echo "1. 在腾讯云控制台配置安全组（开放80、443、22端口）"
echo "2. 克隆你的代码到服务器"
echo "3. 配置环境变量"
echo "4. 运行部署命令"
echo ""
echo "🔧 克隆代码命令："
echo "cd /var/www/judada"
echo "git clone https://github.com/bopii6/judada.git ."