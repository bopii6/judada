#!/bin/bash

echo "🚀 腾讯云服务器部署脚本 - Jude English Lab"
echo "========================================"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_NAME="judada"
DEPLOY_PATH="/var/www/judada"
SERVICE_NAME="judada-server"
REPO_URL="https://github.com/bopii6/judada.git"

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
   echo -e "${RED}请使用 sudo 权限运行此脚本${NC}"
   echo "使用: sudo ./deploy-tencent-cloud.sh"
   exit 1
fi

echo -e "${GREEN}✅ 开始部署 Jude English Lab 到腾讯云服务器${NC}"

# 1. 更新系统
echo "📦 更新系统包..."
apt update && apt upgrade -y

# 2. 安装基础依赖
echo "🔧 安装基础依赖..."
apt install -y curl wget git vim htop unzip ufw nginx redis-server

# 3. 安装Node.js 18
echo "📥 安装Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# 4. 安装pnpm
echo "📦 安装pnpm..."
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
fi

# 5. 安装PM2
echo "⚡ 安装PM2进程管理器..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# 6. 配置防火墙
echo "🔥 配置防火墙..."
ufw --force enable
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow 4000

# 7. 创建项目目录
echo "📁 创建项目目录..."
mkdir -p $DEPLOY_PATH
cd $DEPLOY_PATH

# 8. 克隆代码（如果不存在）
if [ ! -d "$DEPLOY_PATH/current" ]; then
    echo "📥 克隆项目代码..."
    git clone $REPO_URL current
else
    echo "📥 更新项目代码..."
    cd $DEPLOY_PATH/current
    git pull origin main
fi

cd $DEPLOY_PATH/current

# 9. 检查环境变量文件
echo "⚙️  检查环境变量配置..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  请编辑 .env 文件并填入真实的配置信息${NC}"
        echo "文件位置: $DEPLOY_PATH/current/.env"
        echo "必须配置的变量："
        echo "- DATABASE_URL (数据库连接)"
        echo "- OPENAI_API_KEY (OpenAI API密钥)"
        echo "- ALIYUN_OCR_ACCESS_KEY_ID (阿里云OCR密钥)"
        echo "- ALIYUN_OCR_ACCESS_KEY_SECRET (阿里云OCR密钥)"
        echo "- ADMIN_KEY (管理员密钥)"
    else
        echo -e "${RED}❌ .env.example 文件不存在${NC}"
        exit 1
    fi
fi

# 10. 安装依赖
echo "📦 安装项目依赖..."
pnpm install

# 11. 生成Prisma客户端
echo "🗄️ 生成数据库客户端..."
pnpm db:generate

# 12. 构建项目
echo "🏗️ 构建项目..."
pnpm build

# 13. 数据库迁移（谨慎使用）
echo "🔄 数据库迁移..."
read -p "是否执行数据库迁移？(生产环境请谨慎) [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    pnpm db:deploy
else
    echo "跳过数据库迁移"
fi

# 14. 创建日志目录
echo "📝 创建日志目录..."
mkdir -p /var/log/judada
chown www-data:www-data /var/log/judada

# 15. 配置Nginx
echo "🌐 配置Nginx反向代理..."
cat > /etc/nginx/sites-available/judada << 'EOF'
server {
    listen 80;
    server_name _;  # 替换为你的域名

    # 前端静态文件
    location / {
        root /var/www/judada/current/apps/web/dist;
        try_files $uri $uri/ /index.html;

        # 静态资源缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # 管理后台
    location /admin {
        alias /var/www/judada/current/apps/admin/dist;
        try_files $uri $uri/ /admin/index.html;
    }

    # API代理到后端
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/judada /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试Nginx配置
nginx -t
if [ $? -eq 0 ]; then
    echo "✅ Nginx配置成功"
    systemctl restart nginx
else
    echo -e "${RED}❌ Nginx配置失败${NC}"
    exit 1
fi

# 16. 创建PM2配置文件
echo "⚙️  创建PM2配置..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'judada-server',
    script: './apps/server/dist/index.js',
    cwd: '/var/www/judada/current',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: '/var/log/judada/server-error.log',
    out_file: '/var/log/judada/server-out.log',
    log_file: '/var/log/judada/server-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# 17. 启动应用
echo "🚀 启动应用服务..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 18. 设置权限
echo "🔐 设置文件权限..."
chown -R www-data:www-data $DEPLOY_PATH/current
chmod -R 755 $DEPLOY_PATH/current

# 19. 配置Redis（如果需要）
echo "🔴 配置Redis..."
systemctl start redis-server
systemctl enable redis-server

# 20. 创建监控脚本
echo "📊 创建监控脚本..."
cat > /var/www/judada/monitor.sh << 'EOF'
#!/bin/bash
# 服务监控脚本

# 检查Nginx
if ! systemctl is-active --quiet nginx; then
    echo "Nginx is down, restarting..."
    systemctl restart nginx
fi

# 检查PM2应用
if ! pm2 describe judada-server > /dev/null 2>&1; then
    echo "App is down, restarting..."
    pm2 restart ecosystem.config.js
fi

# 检查Redis
if ! systemctl is-active --quiet redis-server; then
    echo "Redis is down, restarting..."
    systemctl restart redis-server
fi

# 记录到日志
echo "$(date): Monitor check completed" >> /var/log/judada/monitor.log
EOF

chmod +x /var/www/judada/monitor.sh

# 添加监控到crontab（每5分钟检查一次）
echo "🕐 设置定时监控..."
(crontab -l 2>/dev/null; echo "*/5 * * * * /var/www/judada/monitor.sh") | crontab -

# 21. 获取服务器IP
SERVER_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip || curl -s icanhazip.com)

echo ""
echo "🎉 部署完成！"
echo "============"
echo -e "${GREEN}✅ Jude English Lab 已成功部署到腾讯云服务器${NC}"
echo ""
echo "📍 访问地址："
echo "- 主站: http://$SERVER_IP"
echo "- 管理后台: http://$SERVER_IP/admin"
echo "- API健康检查: http://$SERVER_IP/api/health"
echo ""
echo "🔧 常用命令："
echo "- 查看服务状态: pm2 status"
echo "- 查看日志: pm2 logs judada-server"
echo "- 重启服务: pm2 restart judada-server"
echo "- 重新部署: cd $DEPLOY_PATH/current && git pull && pnpm install && pnpm build && pm2 restart judada-server"
echo ""
echo "📝 重要提醒："
echo "1. 请编辑 $DEPLOY_PATH/current/.env 文件，填入真实的配置信息"
echo "2. 确保数据库连接正确"
echo "3. 如需域名访问，请配置域名解析和SSL证书"
echo "4. 建议定期备份重要数据"
echo ""
echo -e "${GREEN}🚀 部署成功！享受你的英语学习平台吧！${NC}"