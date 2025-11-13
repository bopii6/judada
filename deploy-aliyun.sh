#!/bin/bash

# 🚀 Jude English Lab 阿里云部署脚本
# 适用于：阿里云轻量应用服务器

echo "🇨🇳 开始配置阿里云服务器..."
echo "=================================="

# 更新系统
echo "📦 更新系统软件包..."
sudo apt update && sudo apt upgrade -y

# 安装基础工具
echo "🔧 安装基础工具..."
sudo apt install -y curl wget git vim unzip

# 安装 Node.js 18 (使用 NodeSource)
echo "📦 安装 Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证 Node.js 版本
echo "✅ Node.js 版本: $(node --version)"
echo "✅ npm 版本: $(npm --version)"

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

# 配置 Nginx
echo "🌐 配置 Nginx..."
sudo tee /etc/nginx/sites-available/judada << EOF
server {
    listen 80;
    server_name _; # 匹配所有域名和IP

    # 日志配置
    access_log /var/log/nginx/judada.access.log;
    error_log /var/log/nginx/judada.error.log;

    # 前端静态文件
    location / {
        root /var/www/judada/web;
        index index.html;
        try_files \$uri \$uri/ /index.html;

        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # 管理后台
    location /admin {
        alias /var/www/judada/admin;
        index index.html;
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

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:4000/health;
        access_log off;
    }

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
}
EOF

# 启用网站配置
sudo ln -s /etc/nginx/sites-available/judada /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 测试 Nginx 配置
sudo nginx -t

# 配置防火墙
echo "🔥 配置防火墙..."
sudo ufw --force reset
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# 重启并启用 Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

# 创建日志目录
sudo mkdir -p /var/log/judada

# 创建部署脚本
echo "📜 创建自动部署脚本..."
cat > /var/www/judada/deploy.sh << 'DEPLOY_EOF'
#!/bin/bash

set -e  # 遇到错误立即退出

echo "🚀 开始部署 Jude English Lab..."
echo "=================================="

# 记录部署时间
echo "$(date '+%Y-%m-%d %H:%M:%S') - 开始部署" >> /var/log/judada/deploy.log

# 进入项目目录
cd /var/www/judada

# 备份当前版本（如果存在）
if [ -d "current" ]; then
    echo "📦 备份当前版本..."
    sudo rm -rf /var/www/judada/backup
    sudo mv current backup
fi

# 拉取最新代码
echo "📥 拉取最新代码..."
if [ ! -d "judada" ]; then
    git clone https://github.com/bopii6/judada.git current
else
    cd judada
    git pull origin main
    cd ..
    rm -rf current
    cp -r judada current
fi

cd current

# 安装依赖
echo "📦 安装项目依赖..."
pnpm install --frozen-lockfile

# 构建项目
echo "🔨 构建项目..."
pnpm build

# 部署前端文件
echo "📋 部署前端文件..."
sudo mkdir -p /var/www/judada/web
sudo mkdir -p /var/www/judada/admin
sudo rm -rf /var/www/judada/web/*
sudo rm -rf /var/www/judada/admin/*
sudo cp -r apps/web/dist/* /var/www/judada/web/
sudo cp -r apps/admin/dist/* /var/www/judada/admin/

# 设置权限
sudo chown -R www-data:www-data /var/www/judada
sudo chmod -R 755 /var/www/judada/web
sudo chmod -R 755 /var/www/judada/admin

# 重启后端服务
echo "🔄 重启后端服务..."
cd apps/server
pm2 restart judada-server || pm2 start dist/index.js --name "judada-server"

# 重启 Nginx
echo "🔄 重启 Nginx..."
sudo systemctl reload nginx

# 检查服务状态
echo "🔍 检查服务状态..."
pm2 status
sudo systemctl is-active nginx

# 测试 API
echo "🧪 测试 API 连接..."
sleep 3
if curl -f http://localhost:4000/health > /dev/null 2>&1; then
    echo "✅ API 健康检查通过"
else
    echo "❌ API 健康检查失败"
    exit 1
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') - 部署完成" >> /var/log/judada/deploy.log
echo "✅ 部署完成！"
echo "🌐 网站: http://$(curl -s ifconfig.me)"
echo "🔧 管理后台: http://$(curl -s ifconfig.me)/admin"
DEPLOY_EOF

# 设置执行权限
chmod +x /var/www/judada/deploy.sh

# 创建环境变量模板
echo "📝 创建环境变量模板..."
cat > /var/www/judada/.env.example << 'EOF'
# 数据库配置
DATABASE_URL=postgresql://postgres.iijosxgofjfuujdetolp:Op5HojUp6uqC8txG@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connect_timeout=20&pool_timeout=30

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# 腾讯云 OCR 配置
TENCENT_SECRET_ID=your_tencent_secret_id_here
TENCENT_SECRET_KEY=your_tencent_secret_key_here

# 基础配置
PORT=4000
NODE_ENV=production
ADMIN_KEY=change-me-in-production-secure-key

# Redis (如果需要)
REDIS_URL=redis://localhost:6379
EOF

# 显示服务器信息
echo ""
echo "✅ 阿里云服务器配置完成！"
echo "=================================="
echo "🖥️  服务器信息："
echo "- 内网IP: $(hostname -I | awk '{print $1}')"
echo "- 外网IP: $(curl -s ifconfig.me 2>/dev/null || echo '无法获取')"

echo ""
echo "📋 接下来的步骤："
echo "1. 在阿里云控制台配置安全组（开放80、443、22端口）"
echo "2. 克隆你的代码到服务器"
echo "3. 配置环境变量"
echo "4. 运行首次部署命令"
echo ""
echo "🔧 克隆并部署代码："
echo "cd /var/www/judada"
echo "git clone https://github.com/bopii6/judada.git judada"
echo "cd judada"
echo "cp .env.example .env"
echo "# 编辑 .env 文件，填入真实的环境变量"
echo "nano .env"
echo ""
echo "🚀 首次部署："
echo "cd /var/www/judada"
echo "./deploy.sh"
echo ""
echo "🔍 检查服务："
echo "pm2 status"
echo "sudo systemctl status nginx"