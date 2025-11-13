# 🇨🇳 腾讯云部署指南

## 🛒 购买腾讯云服务器

### 1. 访问腾讯云
- 网址：https://cloud.tencent.com/
- 注册并实名认证（需要身份证）

### 2. 购买轻量应用服务器
- 产品：轻量应用服务器 Lighthouse
- 地域：选择离你最近的（如北京、上海、广州）
- 配置：2核2G 4Mbps（推荐）
- 系统镜像：Ubuntu 20.04
- 套餐：月付（¥24/月）或年付更便宜
- 流量包：500GB/月（够用）

### 3. 配置安全组
在腾讯云控制台：
1. 找到"轻量应用服务器"
2. 点击你的服务器
3. 点击"防火墙"标签
4. 添加规则：
   - 端口：22，协议：TCP，来源：0.0.0.0/0（SSH连接）
   - 端口：80，协议：TCP，来源：0.0.0.0/0（HTTP访问）
   - 端口：443，协议：TCP，来源：0.0.0.0/0（HTTPS访问）

## 🚀 部署步骤

### 第一步：连接服务器
```bash
# 使用 SSH 连接（在本地电脑的终端运行）
ssh root@你的服务器公网IP

# 例如：
ssh root:123.456.789.012
```

### 第二步：运行初始化脚本
```bash
# 下载并运行配置脚本
curl -o deploy-tencent.sh https://raw.githubusercontent.com/bopii6/judada/main/deploy-tencent.sh
chmod +x deploy-tencent.sh
./deploy-tencent.sh
```

### 第三步：克隆并部署代码
```bash
# 进入应用目录
cd /var/www/judada

# 克隆你的代码
git clone https://github.com/bopii6/judada.git .

# 安装依赖
pnpm install

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

# OpenAI（需要去 OpenAI 官网申请）
OPENAI_API_KEY=sk-your-actual-openai-key

# 腾讯云 OCR（需要申请）
TENCENT_SECRET_ID=your-tencent-secret-id
TENCENT_SECRET_KEY=your-tencent-secret-key

# 基础配置
PORT=4000
NODE_ENV=production
ADMIN_KEY=change-this-to-a-secure-key
```

### 第五步：构建和启动
```bash
# 构建项目
pnpm build

# 部署到生产环境
/var/www/judada/deploy.sh

# 启动后端服务
cd apps/server
pm2 start dist/index.js --name "judada-server"
pm2 save
pm2 startup
```

## 🌐 访问你的网站

部署完成后，通过浏览器访问：
- **主站**：`http://你的服务器IP`
- **管理后台**：`http://你的服务器IP/admin`
- **API**：`http://你的服务器IP/api/health`

## 🔧 常用命令

### 查看服务状态
```bash
# 查看后端服务
pm2 status

# 查看后端日志
pm2 logs judada-server

# 查看 Nginx 状态
sudo systemctl status nginx

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 重新部署
```bash
# 拉取最新代码并重新部署
cd /var/www/judada
git pull origin main
/var/www/judada/deploy.sh
```

### 重启服务
```bash
# 重启后端
pm2 restart judada-server

# 重启 Nginx
sudo systemctl restart nginx
```

## 🔐 配置 HTTPS（可选但推荐）

### 使用 Let's Encrypt 免费证书
```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加这一行：
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 💰 费用说明

- **服务器**：¥24/月（轻量应用服务器）
- **域名**：¥50-100/年（可选，也可以直接用IP访问）
- **SSL证书**：免费（Let's Encrypt）
- **总计**：约 ¥300/年

## 🆘 常见问题

**Q: 忘记服务器密码怎么办？**
A: 在腾讯云控制台重置密码

**Q: 网站访问不了？**
A: 检查安全组配置是否开放了80端口

**Q: 部署失败？**
A: 查看日志：`pm2 logs judada-server`

**Q: 如何更新网站？**
A: 在服务器运行：`cd /var/www/judada && git pull && ./deploy.sh`

## 📞 获取帮助

- 腾讯云工单：提供7x24技术支持
- 腾讯云文档：https://cloud.tencent.com/document
- 项目 Issues：在 GitHub 提问题

---

🎉 **恭喜！你的英语学习平台即将在中国上线！**