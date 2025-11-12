# 🚀 Jude English Lab - 部署指南

## 📋 项目概述

Jude English Lab 是一个基于 AI 的智能英语学习平台，支持分级测试、课程练习、题目库管理和后台管理功能。

### 技术栈
- **前端**: React 18 + TypeScript + Vite + TailwindCSS
- **后端**: Express.js + TypeScript + Prisma ORM
- **数据库**: PostgreSQL (Supabase)
- **部署**: 阿里云轻量应用服务器

## 🚀 快速部署

### 推荐配置
- **服务器**: 阿里云轻量应用服务器 2核2G 5Mbps（¥24/月）
- **系统**: Ubuntu 20.04
- **域名**: 可选（¥50-100/年）

### 一键部署步骤

#### 1. 购买阿里云服务器
访问 [阿里云官网](https://www.aliyun.com/)，购买轻量应用服务器

#### 2. 连接服务器
```bash
ssh root@你的服务器IP
```

#### 3. 运行自动配置脚本
```bash
curl -o deploy-aliyun.sh https://raw.githubusercontent.com/bopii6/judada/main/deploy-aliyun.sh
chmod +x deploy-aliyun.sh
./deploy-aliyun.sh
```

#### 4. 部署应用
```bash
cd /var/www/judada
git clone https://github.com/bopii6/judada.git judada
cd judada
cp .env.example .env
nano .env  # 编辑环境变量
cd /var/www/judada
./deploy.sh
```

#### 5. 配置 HTTPS（可选）
```bash
chmod +x setup-https.sh
./setup-https.sh your-domain.com
```

## 📁 部署文件

| 文件 | 说明 |
|------|------|
| [deploy-aliyun.sh](deploy-aliyun.sh) | 服务器自动配置脚本 |
| [ALIYUN_DEPLOYMENT.md](ALIYUN_DEPLOYMENT.md) | 完整部署文档 |
| [setup-https.sh](setup-https.sh) | HTTPS 自动配置脚本 |
| [nginx-https.conf](nginx-https.conf) | HTTPS Nginx 配置模板 |

## 🔧 环境变量配置

创建 `.env` 文件并配置以下变量：

```env
# 数据库
DATABASE_URL=postgresql://username:password@host:5432/database

# AI 服务
OPENAI_API_KEY=your_openai_api_key
TENCENT_SECRET_ID=your_tencent_secret_id
TENCENT_SECRET_KEY=your_tencent_secret_key

# 基础配置
PORT=4000
NODE_ENV=production
ADMIN_KEY=your_secure_admin_key
```

## 🌐 访问地址

部署完成后：
- **主站**: `http://你的服务器IP`
- **管理后台**: `http://你的服务器IP/admin`
- **API健康检查**: `http://你的服务器IP/api/health`

## 💰 成本估算

- **服务器**: ¥24/月
- **域名**: ¥50-100/年（可选）
- **SSL证书**: 免费
- **总计**: 约 ¥300-400/年

## 🆘 常见问题

查看 [ALIYUN_DEPLOYMENT.md](ALIYUN_DEPLOYMENT.md) 获取详细的问题解决方案。

## 🎯 下一步

部署完成后，你可以：
1. 绑定自定义域名
2. 配置 HTTPS 证书
3. 设置监控和备份
4. 开始推广你的英语学习平台！

---

🎉 **恭喜！你的英语学习平台即将上线！**