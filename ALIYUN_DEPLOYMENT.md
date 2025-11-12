# 🇨🇳 阿里云部署指南

## 🛒 购买阿里云服务器

### 1. 注册阿里云账号
- 网址：https://www.aliyun.com/
- 使用支付宝/淘宝账号快速登录
- 完成实名认证（需要身份证）

### 2. 购买轻量应用服务器
推荐配置：
- **产品**：轻量应用服务器
- **地域**：选择离你最近的（北京、上海、杭州、深圳等）
- **配置**：2核2G，5Mbps带宽
- **系统镜像**：Ubuntu 20.04
- **存储**：60GB SSD
- **流量包**：1000GB/月
- **套餐**：月付 ¥24 或年付 ¥288（年付更便宜）

### 3. 配置安全组
购买后，在阿里云控制台：
1. 进入轻量应用服务器控制台
2. 点击你的服务器
3. 点击"防火墙"或"安全组"
4. 添加规则：
   - 端口：22，协议：TCP，来源：0.0.0.0/0（SSH）
   - 端口：80，协议：TCP，来源：0.0.0.0/0（HTTP）
   - 端口：443，协议：TCP，来源：0.0.0.0/0（HTTPS）

## 🚀 部署步骤

### 第一步：连接服务器
```bash
# 使用 SSH 连接（在本地电脑的终端运行）
ssh root@你的服务器公网IP

# 例如：
ssh root@123.456.789.012
```

### 第二步：运行初始化脚本
```bash
# 下载并运行配置脚本
curl -o deploy-aliyun.sh https://raw.githubusercontent.com/bopii6/judada/main/deploy-aliyun.sh
chmod +x deploy-aliyun.sh
./deploy-aliyun.sh
```

### 第三步：克隆并部署代码
```bash
# 进入应用目录
cd /var/www/judada

# 克隆你的代码
git clone https://github.com/bopii6/judada.git judada

# 进入项目目录
cd judada

# 创建环境变量文件
cp .env.example .env

# 编辑环境变量（重要！）
nano .env
```

### 第四步：配置环境变量
编辑 `.env` 文件，填入真实值：

```env
# 数据库（使用你的 Supabase）
DATABASE_URL=postgresql://postgres.iijosxgofjfuujdetolp:Op5HojUp6uqC8txG@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connect_timeout=20&pool_timeout=30

# OpenAI（需要去 openai.com 申请）
OPENAI_API_KEY=sk-your-actual-openai-key

# 腾讯云 OCR（需要申请）
TENCENT_SECRET_ID=your-tencent-secret-id
TENCENT_SECRET_KEY=your-tencent-secret-key

# 基础配置
PORT=4000
NODE_ENV=production
ADMIN_KEY=change-this-to-a-very-secure-key
```

### 第五步：首次部署
```bash
# 回到上级目录
cd /var/www/judada

# 运行部署脚本
./deploy.sh
```

## 🌐 访问你的网站

部署完成后，通过浏览器访问：
- **主站**：`http://你的服务器IP`
- **管理后台**：`http://你的服务器IP/admin`
- **API健康检查**：`http://你的服务器IP/api/health`

## 🔧 常用命令

### 查看服务状态
```bash
# 查看后端服务
pm2 status

# 查看后端日志
pm2 logs judada-server

# 查看部署日志
tail -f /var/log/judada/deploy.log

# 查看 Nginx 状态
sudo systemctl status nginx

# 查看 Nginx 访问日志
sudo tail -f /var/log/nginx/judada.access.log
```

### 重新部署
```bash
# 拉取最新代码并重新部署
cd /var/www/judada
./deploy.sh
```

### 重启服务
```bash
# 重启后端
pm2 restart judada-server

# 重启 Nginx
sudo systemctl restart nginx

# 重启所有服务
sudo systemctl restart nginx && pm2 restart all
```

### 备份和恢复
```bash
# 备份数据库
mysqldump -u 用户名 -p 数据库名 > backup.sql

# 备份代码
tar -czf backup-$(date +%Y%m%d).tar.gz /var/www/judada/current
```

## 🔐 配置 HTTPS（推荐）

### 方案1：使用 Let's Encrypt（免费）
```bash
# 使用自动化脚本（推荐）
chmod +x setup-https.sh
./setup-https.sh your-domain.com

# 或者手动配置
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com --non-interactive --agree-tos --email admin@your-domain.com --redirect
```

### 方案2：使用阿里云免费SSL
1. 在阿里云控制台申请免费SSL证书
2. 下载证书文件到服务器
3. 使用提供的 HTTPS 配置文件

## 💰 费用说明

- **服务器**：¥24/月（轻量应用服务器）
- **域名**：¥29-99/年（阿里云万网域名）
- **SSL证书**：免费（Let's Encrypt）或 ¥299/年（阿里云）
- **总计**：约 ¥300-400/年

## 🆘 常见问题解决

### Q: SSH 连接失败
```bash
# 检查 SSH 服务状态
sudo systemctl status ssh

# 重启 SSH 服务
sudo systemctl restart ssh

# 检查防火墙
sudo ufw status
```

### Q: 网站访问不了
```bash
# 检查 Nginx 状态
sudo systemctl status nginx

# 检查 Nginx 配置
sudo nginx -t

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 检查安全组配置（在阿里云控制台）
```

### Q: 后端 API 无响应
```bash
# 检查后端服务
pm2 status

# 查看后端日志
pm2 logs judada-server

# 重启后端服务
pm2 restart judada-server

# 检查端口是否被占用
sudo netstat -tlnp | grep :4000
```

### Q: 部署失败
```bash
# 查看部署日志
cat /var/log/judada/deploy.log

# 手动安装依赖
cd /var/www/judada/current
pnpm install

# 手动构建
pnpm build
```

### Q: 内存不足
```bash
# 查看内存使用
free -h

# 查看进程内存使用
ps aux --sort=-%mem | head

# 清理缓存
sudo sync && sudo sysctl vm.drop_caches=3
```

## 🚀 性能优化

### 启用 Gzip 压缩
编辑 Nginx 配置：
```bash
sudo nano /etc/nginx/sites-available/judada
```

添加到 server 块内：
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
```

### 启用浏览器缓存
在 location ~* 块中添加：
```nginx
expires 1y;
add_header Cache-Control "public, immutable";
```

## 📊 监控

### 系统监控
```bash
# 安装 htop
sudo apt install htop

# 查看系统资源
htop

# 查看磁盘使用
df -h

# 查看网络连接
netstat -tulnp
```

### 应用监控
```bash
# 设置 PM2 监控
pm2 install pm2-server-monit

# 查看实时监控
pm2 monit
```

## 🔄 自动化

### 设置 Git 自动部署
```bash
# 创建 Git hook
cd /var/www/judada/current/.git/hooks
cat > post-receive << 'EOF'
#!/bin/bash
cd /var/www/judada
./deploy.sh
EOF

chmod +x post-receive
```

### 定时备份
```bash
# 编辑 crontab
sudo crontab -e

# 添加备份任务（每天凌晨2点）
0 2 * * * tar -czf /backup/judada-$(date +\%Y\%m\%d).tar.gz /var/www/judada/current
```

---

## 📁 部署文件说明

本项目包含以下部署相关文件：

### 主要文件
- **[deploy-aliyun.sh](deploy-aliyun.sh)** - 服务器自动配置脚本
- **[ALIYUN_DEPLOYMENT.md](ALIYUN_DEPLOYMENT.md)** - 完整部署文档
- **[setup-https.sh](setup-https.sh)** - HTTPS 自动配置脚本
- **[nginx-https.conf](nginx-https.conf)** - HTTPS Nginx 配置模板

### 配置优化
- ✅ Gzip 压缩优化
- ✅ 静态资源缓存
- ✅ 生产环境日志配置
- ✅ HTTPS 安全配置
- ✅ 自动部署脚本

## 🎉 完成！

现在你的 Jude English Lab 已经成功部署到阿里云！

📞 **获取帮助**：
- 阿里云工单：提供7x24技术支持
- 阿里云文档：https://help.aliyun.com/
- 项目Issues：在 GitHub 提问题

🚀 **下一步**：
1. 绑定域名（可选）
2. 配置HTTPS（推荐）
3. 设置监控和备份
4. 开始推广你的英语学习平台！