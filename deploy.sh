#!/bin/bash

echo "🚀 Jude English Lab 部署脚本"
echo "=============================="

# 检查是否已登录 Render CLI
if ! command -v render &> /dev/null; then
    echo "❌ Render CLI 未安装"
    echo "请先安装: npm install -g @render/cli"
    exit 1
fi

echo "✅ Render CLI 已安装"

# 提交代码到 Git
echo "📝 提交代码变更..."
git add .
git commit -m "🚀 准备生产环境部署 - $(date)"
git push origin main

echo "✅ 代码已提交到 GitHub"

echo "🎯 接下来的步骤："
echo "1. 访问 https://render.com"
echo "2. 用 GitHub 账号登录"
echo "3. 点击 'New' -> 'Web Service'"
echo "4. 连接你的 GitHub 仓库"
echo "5. 选择分支 'main'"
echo "6. 配置环境变量（参考 .env.example）"
echo "7. 点击 'Deploy'"

echo ""
echo "📋 需要配置的环境变量："
echo "- DATABASE_URL (你的 Supabase 数据库URL)"
echo "- OPENAI_API_KEY (OpenAI API Key)"
echo "- TENCENT_SECRET_ID (腾讯云 OCR)"
echo "- TENCENT_SECRET_KEY (腾讯云 OCR)"

echo ""
echo "🎉 部署完成后，你的网站将可以通过以下地址访问："
echo "- 主站: https://judada-web.onrender.com"
echo "- 管理后台: https://judada-admin.onrender.com"
echo "- API: https://judada-api.onrender.com"