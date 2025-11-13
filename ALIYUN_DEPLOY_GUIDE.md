# 阿里云部署详细步骤指南

## 📋 部署概览

本项目（judada-monorepo）是一个包含以下应用的全栈项目：
- **前端应用**: `apps/web` (主站)
- **管理后台**: `apps/admin` (管理界面)
- **后端服务**: `apps/server` (API服务)
- **数据库**: PostgreSQL (通过Supabase)
- **缓存**: Redis (用于队列和缓存)

## 🛒 第一步：购买和配置阿里云服务器

### 1.1 注册阿里云账号
1. 访问 [阿里云官网](https://www.aliyun.com/)
2. 使用支付宝/淘宝账号登录
3. 完成实名认证（上传身份证照片）

### 1.2 购买轻量应用服务器
推荐配置：
- **实例类型**: 轻量应用服务器
- **地域**: 选择距离用户最近的区域
  - 北京: cn-beijing
  - 上海: cn-shanghai
  - 杭州: cn-hangzhou
  - 深圳: cn-shenzhen
- **配置**: 2核2G 5Mbps
- **系统镜像**: Ubuntu 20.04 LTS
- **存储**: 60GB SSD云硬盘
- **流量包**: 1000GB月流量包
- **价格**:
  - 月付: ¥24/月
  - 年付: ¥288/年（推荐，有优惠）

### 1.3 配置安全组规则
在阿里云控制台 → 轻量应用服务器 → 防火墙 → 添加规则：

| 端口 | 协议 | 来源 | 说明 |
|------|------|------|------|
| 22 | TCP | 0.0.0.0/0 | SSH远程连接 |
| 80 | TCP | 0.0.0.0/0 | HTTP访问 |
| 443 | TCP | 0.0.0.0/0 | HTTPS访问 |
| 4000 | TCP | 0.0.0.0/0 | 后端API服务（开发时） |

## 🔧 第二步：服务器基础环境配置

### 2.1 连接服务器
```bash
# 在本地终端执行
ssh root@你的服务器公网IP

# 例如：
ssh root@123.456.789.012
```

### 2.2 基础系统更新
```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y curl wget git vim htop unzip ufw

# 设置时区（可选）
sudo timedatectl set-timezone Asia/Shanghai
```

### 2.3 配置防火墙
```bash
# 启用防火墙
sudo ufw enable

# 允许SSH
sudo ufw allow ssh

# 允许HTTP和HTTPS
sudo ufw allow 80
sudo ufw allow 443

# 查看防火墙状态
sudo ufw status
```

## 🚀 第三步：安装Node.js和PM2

### 3.1 安装Node.js
```bash
# 使用NodeSource仓库安装Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

### 3.2 安装pnpm
```bash
# 安装pnpm
sudo npm install -g pnpm

# 验证安装
pnpm --version
```

### 3.3 安装PM2进程管理器
```bash
# 安装PM2
sudo npm install -g pm2

# 验证安装
pm2 --version
```

## 🗄️ 第四步：安装和配置数据库

### 4.1 使用Supabase云数据库（推荐）

1. 访问 [Supabase](https://supabase.com/)
2. 使用GitHub账号登录
3. 创建新项目
4. 获取数据库连接信息
5. 将连接信息保存到环境变量

### 4.2 安装Redis（本地缓存）
```bash
# 安装Redis
sudo apt install -y redis-server

# 启动Redis服务
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 测试Redis连接
redis-cli ping
```

## 🌐 第五步：安装和配置Nginx

### 5.1 安装Nginx
```bash
# 安装Nginx
sudo apt install -y nginx

# 启动并开机自启
sudo systemctl start nginx
sudo systemctl enable nginx

# 测试Nginx
curl localhost
```

### 5.2 配置Nginx反向代理
```bash
# 创建站点配置文件
vim /etc/nginx/sites-available/judada
```

插入以下配置：
```nginx
server {
    listen 80;
    server_name 你的域名.com;  # 如果有域名，替换为你的域名

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
```

启用站点配置：
```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/judada /etc/nginx/sites-enabled/

# 删除默认配置
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

## 💻 第六步：部署应用代码

### 6.1 创建应用目录
```bash
# 创建主目录
sudo mkdir -p /var/www/judada

# 进入目录
cd /var/www/judada
```

### 6.2 克隆代码
```bash
# 安装Git（如果未安装）
sudo apt install -y git

# 克隆你的代码仓库
git clone https://github.com/bopii6/judada.git current

# 进入项目目录
cd /var/www/judada/current
```

### 6.3 配置环境变量
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量文件
vim .env
```

重要环境变量配置：
```env
# 基础配置
PORT=4000
NODE_ENV=production
ADMIN_KEY=your-secure-admin-key-here

# 数据库（替换为你的Supabase信息）
DATABASE_URL=postgresql://postgres.yourusername:yourpassword@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connect_timeout=20&pool_timeout=30
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=course-assets

# OpenAI API（替换为你的API Key）
OPENAI_API_KEY=sk-your-actual-openai-key
OPENAI_MODEL_NAME=gpt-4.1-mini

# 阿里云OCR（替换为你的AccessKey）
ALIYUN_OCR_ACCESS_KEY_ID=your-access-key-id
ALIYUN_OCR_ACCESS_KEY_SECRET=your-access-key-secret
ALIYUN_OCR_REGION_ID=cn-shanghai
ALIYUN_OCR_ENDPOINT=ocr-api.cn-hangzhou.aliyuncs.com

# Redis（本地安装）
REDIS_URL=redis://localhost:6379
QUEUE_PREFIX=course-gen
```

## 🏗️ 第七步：构建和启动应用

### 7.1 安装依赖和构建
```bash
# 进入项目目录
cd /var/www/judada/current

# 安装依赖
pnpm install

# 生成Prisma客户端
pnpm db:generate

# 构建所有应用
pnpm build
```

### 7.2 配置PM2启动文件
```bash
# 创建PM2配置文件
vim /var/www/judada/current/ecosystem.config.js
```

插入以下配置：
```javascript
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
```

### 7.3 创建日志目录
```bash
# 创建日志目录
sudo mkdir -p /var/log/judada

# 设置权限
sudo chmod 755 /var/log/judada
```

### 7.4 启动应用
```bash
# 启动应用
pm2 start ecosystem.config.js

# 保存PM2配置
pm2 save

# 设置PM2开机自启
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $(whoami) --hp $(eval echo ~$(whoami))
# 按照输出的指令执行（通常需要复制粘贴一行命令）
```

## 📋 第八步：验证部署

### 8.1 检查服务状态
```bash
# 检查PM2进程状态
pm2 status

# 检查PM2日志
pm2 logs judada-server

# 检查Nginx状态
systemctl status nginx

# 检查端口占用
netstat -tlnp | grep -E ':(80|443|4000)'
```

### 8.2 测试访问
```bash
# 测试本地访问
curl http://localhost/
curl http://localhost/api/health

# 在浏览器中访问
http://你的服务器IP
http://你的服务器IP/api/health
```

## 🔒 第九步：配置HTTPS（可选但推荐）

### 9.1 安装Certbot
```bash
# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx
```

### 9.2 申请SSL证书
```bash
# 替换为你的域名
certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 9.3 自动续期
```bash
# 添加自动续期任务
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

## 🔧 第十步：监控和维护

### 10.1 设置监控脚本
```bash
# 创建监控脚本
vim /var/www/judada/monitor.sh
```

```bash
#!/bin/bash
# 简单的服务监控脚本

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

# 检查磁盘空间
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Warning: Disk usage is ${DISK_USAGE}%"
fi

# 记录到日志
echo "$(date): Monitor check completed" >> /var/log/judada/monitor.log
```

```bash
# 设置执行权限
chmod +x /var/www/judada/monitor.sh

# 添加到crontab（每5分钟检查一次）
echo "*/5 * * * * /var/www/judada/monitor.sh" | crontab -
```

### 10.2 备份脚本
```bash
# 创建备份脚本
vim /var/www/judada/backup.sh
```

```bash
#!/bin/bash
# 备份脚本

BACKUP_DIR="/var/backups/judada"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份代码
tar -czf $BACKUP_DIR/code_$DATE.tar.gz -C /var/www/judada current

# 备份数据库（如果使用本地数据库）
# mysqldump -u username -p database > $BACKUP_DIR/db_$DATE.sql

# 清理30天前的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "$(date): Backup completed" >> /var/log/judada/backup.log
```

```bash
# 设置执行权限
chmod +x /var/www/judada/backup.sh

# 添加到crontab（每天凌晨2点备份）
echo "0 2 * * * /var/www/judada/backup.sh" | crontab -
```

## 🔄 第十一步：更新部署

### 11.1 创建更新脚本
```bash
# 创建更新脚本
vim /var/www/judada/update.sh
```

```bash
#!/bin/bash
echo "🚀 开始更新应用..."

# 进入项目目录
cd /var/www/judada/current

# 拉取最新代码
git pull origin main

# 安装新依赖
pnpm install

# 生成Prisma客户端
pnpm db:generate

# 构建应用
pnpm build

# 重启PM2应用
pm2 restart judada-server

echo "✅ 应用更新完成！"
```

```bash
# 设置执行权限
chmod +x /var/www/judada/update.sh
```

### 11.2 使用更新脚本
```bash
# 更新应用
/var/www/judada/update.sh
```

## 🆘 常见问题解决

### 问题1：端口被占用
```bash
# 查看端口占用
netstat -tlnp | grep :4000

# 杀死占用进程
kill -9 <PID>
```

### 问题2：权限问题
```bash
# 设置正确的文件权限
chown -R www-data:www-data /var/www/judada
chmod -R 755 /var/www/judada/current
```

### 问题3：内存不足
```bash
# 查看内存使用
free -h

# 查看进程内存使用
ps aux --sort=-%mem | head

# 重启应用释放内存
pm2 restart all
```

### 问题4：Nginx配置错误
```bash
# 测试Nginx配置
nginx -t

# 查看Nginx错误日志
tail -f /var/log/nginx/error.log

# 重启Nginx
systemctl restart nginx
```

## 📊 性能优化建议

### 1. 启用Gzip压缩
已在Nginx配置中启用

### 2. 静态资源缓存
已在Nginx配置中设置

### 3. PM2集群模式
已在PM2配置中使用cluster模式

### 4. 数据库连接池
确保Prisma配置中使用了连接池

## 💰 成本估算

| 项目 | 费用 | 备注 |
|------|------|------|
| 服务器 | ¥24/月 或 ¥288/年 | 2核2G轻量应用服务器 |
| 域名 | ¥29-99/年 | .com域名 |
| SSL证书 | 免费 | Let's Encrypt |
| **总计** | **¥300-400/年** | 含域名和证书 |

## 🎉 部署完成

恭喜！你的Jude English Lab已经成功部署到阿里云！

**访问地址：**
- 主站: `http://你的服务器IP`
- 管理后台: `http://你的服务器IP/admin`
- API健康检查: `http://你的服务器IP/api/health`

**下一步建议：**
1. 绑定自定义域名
2. 配置HTTPS
3. 设置监控告警
4. 配置CDN加速
5. 设置自动备份

**获取帮助：**
- 阿里云工单：7x24技术支持
- 项目Issues：GitHub提交问题
- 文档参考：本文档和ALIYUN_DEPLOYMENT.md