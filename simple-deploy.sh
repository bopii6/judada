#!/bin/bash

# 简化版部署脚本
set -e

echo "🚀 开始简单部署..."

# 更新系统
echo "📦 更新系统..."
apt update && apt upgrade -y

# 安装基础工具
echo "🔧 安装基础工具..."
apt install -y curl wget git vim unzip

# 安装 Node.js 18
echo "📦 安装 Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 安装 pnpm
echo "📦 安装 pnpm..."
npm install -g pnpm

# 安装 Nginx
echo "🌐 安装 Nginx..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx

# 安装 PM2
echo "🔧 安装 PM2..."
npm install -g pm2

# 创建应用目录
echo "📁 创建应用目录..."
mkdir -p /var/www/judada
cd /var/www/judada

# 克隆代码
echo "📥 克隆代码..."
git clone https://github.com/bopii6/judada.git .

# 安装依赖
echo "📦 安装依赖..."
pnpm install

# 构建项目
echo "🔨 构建项目..."
pnpm build

echo "✅ 基础环境配置完成！"
echo "📋 接下来请手动执行："
echo "1. cd /var/www/judada"
echo "2. cp .env.example .env"
echo "3. nano .env  # 编辑环境变量"
echo "4. 部署前端文件"
echo "5. 启动后端服务"
echo "6. 配置 Nginx"