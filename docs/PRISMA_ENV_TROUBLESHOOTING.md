# Prisma 环境变量问题解决指南

## 问题描述

在 Monorepo 项目中使用 Prisma 时遇到环境变量无法加载的问题：

```
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Environment variable not found: DIRECT_URL.
```

## 根本原因分析

### 1. Prisma 架构要求
Prisma 5.x+ 版本要求同时配置两个数据库连接：

- **`DATABASE_URL`**: 应用运行时使用，通过连接池（如 PgBouncer）连接
- **`DIRECT_URL`**: Prisma 工具使用，直接连接数据库，用于 migration、schema 更改等操作

### 2. Monorepo 结构问题
- `.env` 文件通常位于项目根目录
- Prisma 命令在子目录（如 `apps/server`）下执行
- 环境变量无法自动向上查找 `.env` 文件

## 快速解决方案

### 方案1: 显式传递环境变量（推荐）
```bash
# 进入项目根目录
cd "E:\新建文件夹\judada"

# 同时传递两个环境变量
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/judada?schema=public" \
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/judada?schema=public" \
pnpm --filter server exec prisma migrate dev --schema "../../prisma/schema.prisma"
```

### 方案2: 在 server 目录创建 .env
在 `apps/server/.env` 中添加：
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/judada?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/judada?schema=public"
```

### 方案3: 创建符号链接
```bash
# 在 apps/server 目录下创建指向根目录 .env 的符号链接
cd apps/server
ln -s ../../.env .env
```

## 环境变量配置模板

在 `.env` 文件中确保同时配置两个 URL：

```env
# 应用连接（通过连接池）
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/judada?schema=public"

# Prisma 工具直连
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/judada?schema=public"
```

## 常用 Prisma 命令

### 数据库操作
```bash
# 检查数据库连接状态
pnpm db:status

# 快速同步 schema（开发环境）
pnpm db:push

# 创建正式 migration
pnpm db:migrate

# 部署现有 migrations
pnpm db:deploy
```

### 开发工作流
1. 修改 `prisma/schema.prisma`
2. 运行 `pnpm db:push` 快速应用更改
3. 或运行 `pnpm db:migrate` 创建版本化的 migration

## 调试技巧

### 1. 测试数据库连接
```bash
# 使用 db push 测试基本连接
pnpm db:push

# 检查 migration 状态
pnpm db:status
```

### 2. 环境变量验证
```bash
# 检查当前环境变量
echo $DATABASE_URL
echo $DIRECT_URL
```

### 3. 重新生成 Prisma Client
```bash
pnpm --filter server exec prisma generate --schema "../../prisma/schema.prisma"
```

## 项目初始化建议

### 新项目设置
1. 在根目录配置完整的 `.env` 文件
2. 在 `apps/server` 创建符号链接：
   ```bash
   ln -s ../../.env apps/server/.env
   ```
3. 或修改 `package.json` 脚本使用 dotenv

### package.json 脚本优化
```json
{
  "scripts": {
    "prisma:migrate": "dotenv -e ../../.env -- pnpm exec prisma migrate dev --schema \"../../prisma/schema.prisma\"",
    "prisma:push": "dotenv -e ../../.env -- pnpm exec prisma db push --schema \"../../prisma/schema.prisma\"",
    "prisma:generate": "dotenv -e ../../.env -- pnpm exec prisma generate --schema \"../../prisma/schema.prisma\""
  }
}
```

## 常见错误及解决

### 错误1: Environment variable not found
**问题**: 缺少 `DIRECT_URL` 或 `DATABASE_URL`
**解决**: 在 `.env` 文件中添加两个 URL 配置

### 错误2: Database connection timeout
**问题**: 数据库连接超时
**解决**:
1. 检查数据库服务是否启动
2. 验证连接字符串是否正确
3. 使用 `db:push` 测试连接

### 错误3: Migration lock error
**问题**: Migration 进程被锁定
**解决**:
1. 删除 `prisma/migrations/migration_lock.toml`
2. 重启数据库服务
3. 重新运行 migration

## 长期解决方案

### 1. 项目结构优化
```
judada/
├── .env                    # 根目录环境变量
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── apps/
│   └── server/
│       ├── .env -> ../../.env  # 符号链接
│       └── package.json
└── docs/
    └── PRISMA_ENV_TROUBLESHOOTING.md
```

### 2. 环境变量管理
- 使用 `dotenv` 确保环境变量正确加载
- 在 CI/CD 中正确设置环境变量
- 为不同环境创建不同的 `.env` 文件

### 3. 脚本标准化
创建统一的 Prisma 操作脚本：
```bash
#!/bin/bash
# scripts/prisma.sh
ENV_FILE="../../.env"
SCHEMA="../../prisma/schema.prisma"

dotenv -e $ENV_FILE -- pnpm exec prisma $@ --schema $SCHEMA
```

## 版本兼容性

- **Prisma 5.x+**: 必须配置 `DIRECT_URL`
- **PostgreSQL**: 支持连接池和直连模式
- **Node.js**: 确保使用最新的 Prisma Client

## 参考资料

- [Prisma Environment Variables](https://www.prisma.io/docs/concepts/environment-variables)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma in Monorepos](https://www.prisma.io/docs/support/help-articles/monorepos)

---

**最后更新**: 2025-11-27
**适用版本**: Prisma 5.22.0+
**项目类型**: Monorepo with pnpm workspaces