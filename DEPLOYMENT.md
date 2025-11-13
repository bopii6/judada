# 🚀 Jude English Lab 部署指南

## 📋 部署前准备

### 1. 确保项目可以正常构建
```bash
pnpm build
```

### 2. 准备环境变量
复制 `.env.example` 为 `.env` 并填入真实值：
- `DATABASE_URL`: 你的 Supabase 数据库连接
- `OPENAI_API_KEY`: OpenAI API Key
- `TENCENT_SECRET_ID`: 腾讯云 OCR 密钥
- `TENCENT_SECRET_KEY`: 腾讯云 OCR 密钥

## 🌐 推荐部署方案

### 方案 A: Render.com (推荐新手) ⭐

**优点**:
- 免费额度充足
- 支持数据库和后服务
- 一键部署
- 自动 HTTPS

**部署步骤**:
1. 访问 [Render.com](https://render.com)
2. 用 GitHub 账号注册
3. 创建新的 Web Service
4. 连接你的 GitHub 仓库
5. 配置以下设置：
   - **Build Command**: `pnpm build`
   - **Start Command**: `cd apps/server && pnpm start`
   - **Runtime**: `Node 18`
6. 在 Environment 标签页添加环境变量
7. 点击 Deploy

### 方案 B: Vercel (推荐前端) ⭐⭐

**优点**:
- 全球 CDN
- 自动部署
- 性能优秀
- 完全免费

**部署步骤**:
1. 安装 Vercel CLI:
```bash
npm i -g vercel
```

2. 登录 Vercel:
```bash
vercel login
```

3. 部署:
```bash
vercel --prod
```

4. 配置环境变量到 Vercel 控制台

### 方案 C: Railway (简单) ⭐⭐⭐

**优点**:
- 支持多服务
- 内置 Redis
- 简单易用
- 便宜

**部署步骤**:
1. 访问 [Railway.app](https://railway.app)
2. 连接 GitHub 账号
3. 创建新项目
4. 导入你的仓库
5. 配置环境变量
6. 部署

## 🔧 高级部署方案

### 方案 D: 云服务器 + Docker

如果你想要完全控制：

1. 创建 Dockerfile
2. 购买云服务器 (阿里云/腾讯云)
3. 配置 Nginx 反向代理
4. 配置 SSL 证书
5. 配置监控

## 📊 成本对比

| 方案 | 月成本 | 免费额度 | 适合人群 |
|------|--------|----------|----------|
| Render | $0-7 | 750小时/月 | 新手推荐 |
| Vercel | $0-20 | 100GB带宽 | 前端优化 |
| Railway | $0-20 | $5额度 | 全栈推荐 |
| 云服务器 | ¥24-50 | 无 | 高级用户 |

## 🎯 快速开始建议

**如果你是新手**，使用 Render.com：
1. 点击上面的链接注册
2. 大约 10 分钟就能部署完成
3. 免费额度够个人使用

**如果你有经验**，使用 Railway：
1. 功能更强大
2. 支持 Redis
3. 部署更灵活

## 🛠️ 部署后检查

部署完成后，检查以下内容：

1. **网站能访问**: 确认主站和管理后台都能打开
2. **API 正常**: 测试几个 API 接口
3. **数据库连接**: 确认能保存和读取数据
4. **环境变量**: 确认所有第三方服务都能用

## 🆘 常见问题

**Q: 部署失败怎么办？**
A: 检查构建日志，确保所有依赖都能正常安装

**Q: 如何配置域名？**
A: 大多数平台都支持自定义域名，在设置页面添加即可

**Q: 数据库迁移失败？**
A: 确认 DATABASE_URL 正确，然后手动运行 `pnpm db:deploy`

## 📞 获取帮助

- 查看各平台的官方文档
- 在 GitHub 上提 Issue
- 加入相关的技术社区

---

🎉 **恭喜你的英语学习平台即将上线！**