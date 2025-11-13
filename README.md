# JudeDa Monorepo

一个前后端分离、React + Vite 前端、Express + Prisma 后端的英语课程练习平台，支持官方后台维护课程包、在线练习学习以及微练位功能。

## 技术栈

- **Monorepo**：pnpm + Turbo
- **前端**：`apps/web`，Vite + React 18 + TypeScript + TailwindCSS + TanStack Query
- **后端**：`apps/server`，Node.js + Express + TypeScript + Prisma + SQLite Dev / Postgres Ready
- **共享包**：`packages/shared`，公共类型、工具类、校验逻辑、CSV/JSON 解析、微练位等功能
- **数据库**：Prisma schema 包含 QuestionBank / Question / Device / PracticeSession / PracticeRecord

## 目录结构

```
.
├── apps/
│   ├── web/            # Vite + React 前端
│   └── server/         # Express + Prisma 后端
├── packages/
│   └── shared/         # 共享类型工具
├── prisma/             # schema.prisma 数据库定义
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
├── .env.example        # 环境变量模板
└── README.md
```

## 开始使用

### 1. 准备环境

- Node.js 18+
- pnpm `npm install -g pnpm`

### 2. 安装依赖

```bash
pnpm install
```

### 3. 数据库 & Prisma

默认使用 SQLite（`DATABASE_URL=file:./dev.db`），也可替换为 Postgres。

```bash
# 生成 Prisma Client
pnpm db:generate

# 如需本地开发可执行 migrate dev
pnpm db:migrate
```

Prisma schema 位于 `prisma/schema.prisma`，包含主要模型：QuestionBank、Question、Device、PracticeSession、PracticeRecord，以及枚举 `QuestionType`、`SessionMode`。

### 4. 启动开发

```bash
pnpm dev
```

Turbo 会并行启动：
- `apps/server` → http://localhost:4000
- `apps/web` → http://localhost:5173（自动将 `/api` 代理到后端）

也可单独启动：

```bash
pnpm --filter server dev
pnpm --filter web dev
```

### 5. 环境变量

复制 `.env.example` 到 `.env.local` 并根据环境修改：

```
ADMIN_KEY=change-me
PORT=4000
DATABASE_URL=file:./dev.db
```

- `ADMIN_KEY`：后台管理接口密钥，接口 Header 需携带 `x-admin-key`。
- `DATABASE_URL`：Prisma 数据源地址，默认 SQLite。

前端通过环境变量自动连接，无需手动配置。

## 后台 API 接口

> 所有管理接口均需 Header 携带 `x-admin-key: <ADMIN_KEY>`。

### 题库管理

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| POST | `/admin/banks` | 创建题库 |
| PUT | `/admin/banks/:id` | 更新题库及题目信息 |
| GET | `/admin/banks` | 列出题库及题目统计 |
| DELETE | `/admin/banks/:id` | 删除题库（含所有题目） |
| POST | `/admin/banks/:id/import-json` | 导入题目（JSON 数组） |
| POST | `/admin/banks/:id/import-pdf` | 上传 PDF 解析并导入题目 |

### 设备与练习

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| POST | `/device` | 绑定/获取设备 ID |
| GET | `/banks` | 获取所有课程题库 |
| GET | `/banks/:id/questions` | 分页获取题库题目 |
| POST | `/sessions` | 创建练习 / 微练位 session |
| POST | `/records` | 批量提交通关练习记录 |
| GET | `/placement/banks` | 获取微练位题库 |
| POST | `/placement/start` | 开始微练位，返回题目及 sessionId |
| POST | `/placement/submit` | 提交微练位答案，返回得分 / 推荐 tier 课程 |

微练位推荐逻辑详见 `packages/shared/placement.ts`：
- 正确得 1 分，根据反应时间加权：3s 内 +0.3，3-6s +0.1，>6s +0
- 推荐等级映射见代码中的 `tierMappings` 数组，可根据教学需求调整。

## 前端页面

- **Dashboard**：展示课程包概览、微练位入口、练习历史概览。
- **Courses**：列出题库，进入课程练习（TTS + 动画反馈）。
- **Settings**：语速调节、音量偏好、自动纠错等。
- **Admin**：输入 ADMIN_KEY 后可进行课程包管理、题库维护、导入 JSON/PDF。

练习过程采用键盘交互答题，`Enter` 提交，`Ctrl + Space` 返回菜单，使用 `speechSynthesis` 和 `navigator.vibrate` 提供感官反馈。

## 常用脚本

| 脚本 | 说明 |
| ---- | ---- |
| `pnpm dev` | 并行启动前后端开发服务器 |
| `pnpm build` | 通过 Turbo 编译所有包 |
| `pnpm lint` | 对所有包执行 lint 和风格检查 |
| `pnpm format` | 执行 Prettier |
| `pnpm db:generate` | 生成 Prisma Client |
| `pnpm db:migrate` | 执行所有数据库迁移 |

## 注意事项

- 前端默认代理 `/api` 到 `http://localhost:4000`，生产环境需修改 `apps/web/vite.config.ts`。
- Prisma 默认 SQLite，切换到 Postgres 需修改 `.env` 中的 `DATABASE_URL` 并运行 `pnpm db:migrate`。
- PDF 导入基于简单的句式分割或关键词匹配，未来可接入 AI 自动生成题目。

欢迎贡献代码：用户统计、练习进度跟踪、项目集成等。

---
🤖 Test Commit: GitHub贡献图显示测试
Generated with [Claude Code](https://claude.com/claude-code)
测试时间：2025-11-13