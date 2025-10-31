# JudeDa Monorepo

一个包含前端（React + Vite）和后端（Express + Prisma）的英语课程练习平台，支持官方题库后台维护、课程挑战学习以及定位测评。

## 技术栈

- **Monorepo**：pnpm + Turbo
- **前端**（`apps/web`）：Vite、React 18、TypeScript、TailwindCSS、TanStack Query
- **后端**（`apps/server`）：Node.js、Express、TypeScript、Prisma（SQLite Dev / Postgres Ready）
- **公共包**（`packages/shared`）：题目类型定义、校验逻辑、CSV/JSON 解析、定位测评分工具
- **数据库**：Prisma schema 定义 QuestionBank / Question / Device / PracticeSession / PracticeRecord

## 目录结构

```
.
├─ apps/
│  ├─ web/            # Vite + React 前端
│  └─ server/         # Express + Prisma 后端
├─ packages/
│  └─ shared/         # 共享类型与工具
├─ prisma/            # schema.prisma 等数据库配置
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.json
├─ .env.example       # 后端环境变量模板
└─ README.md
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

# 本地开发可执行 migrate dev
pnpm db:migrate
```

Prisma schema 位于 `prisma/schema.prisma`，包含以下模型：QuestionBank、Question、Device、PracticeSession、PracticeRecord；以及枚举 `QuestionType`、`SessionMode`。

### 4. 本地开发

```bash
pnpm dev
```

Turbo 会并行启动：
- `apps/server` → http://localhost:4000
- `apps/web` → http://localhost:5173 （自动代理 `/api` 请求到后端）

也可分别启动：

```bash
pnpm --filter server dev
pnpm --filter web dev
```

### 5. 环境变量

请复制 `.env.example` 至 `.env.local` 并根据部署环境修改：

```
ADMIN_KEY=change-me
PORT=4000
DATABASE_URL=file:./dev.db
```

- `ADMIN_KEY`：后台管理接口所需的 x-admin-key。
- `DATABASE_URL`：Prisma 数据源，开发默认 SQLite。

前端无需额外环境变量（通过代理访问后端）。

## 后端 API 概览

> 所有管理端接口需在 Header 中携带 `x-admin-key: <ADMIN_KEY>`。

### 管理端

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| POST | `/admin/banks` | 创建题库 |
| PUT | `/admin/banks/:id` | 更新题库基础信息 |
| GET | `/admin/banks` | 列出题库及题量统计 |
| DELETE | `/admin/banks/:id` | 删除题库（级联题目） |
| POST | `/admin/banks/:id/import-json` | 导入题库题目（JSON 数组） |
| POST | `/admin/banks/:id/import-pdf` | 上传 PDF，提取句子生成题目 |

### 公共端

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| POST | `/device` | 创建匿名设备 ID |
| GET | `/banks` | 获取可用课程题库 |
| GET | `/banks/:id/questions` | 按条件随机抽题 |
| POST | `/sessions` | 创建练习 / 定位测 session |
| POST | `/records` | 批量写入普通练习结果 |
| GET | `/placement/banks` | 获取定位测题库 |
| POST | `/placement/start` | 启动定位测，返回题目与 sessionId |
| POST | `/placement/submit` | 提交定位测作答，返还分数 / 推荐 tier 与课程 |

定位测评分逻辑（在 `packages/shared/placement.ts` 中）：
- 正确得 1 分，附加反应时加权（≤3s +0.3，3-6s +0.1，>6s +0）。
- 推荐等级映射表可通过 `tierMappings` 进行调整（代码内有注释）。

## 前端页面

- **Dashboard**：展示课程概况、定位测入口、结果提示。
- **Courses**：列出题库，启动课程练习（TTS + 震动反馈）。
- **Settings**：主题与语音偏好设置。
- **Admin**：输入 ADMIN_KEY 后进行课程管理、创建题库、导入 JSON/PDF。

练习环节采用键盘驱动流程，`Enter` 提交、`Ctrl + Space` 重播语音，使用 `speechSynthesis` 和 `navigator.vibrate` 提供多感官反馈。

## 常用脚本

| 脚本 | 说明 |
| ---- | ---- |
| `pnpm dev` | 启动前后端开发服务器 |
| `pnpm build` | 通过 Turbo 构建所有包 |
| `pnpm lint` | 运行各包 lint（需按需配置） |
| `pnpm format` | 执行 Prettier |
| `pnpm db:generate` | 生成 Prisma Client |
| `pnpm db:migrate` | 运行开发环境迁移 |

## 注意事项

- 前端默认代理 `/api` 到 `http://localhost:4000`，如需更改请修改 `apps/web/vite.config.ts`。
- Prisma 默认 SQLite，如切换到 Postgres，更新 `.env` 中的 `DATABASE_URL` 并重新 `pnpm db:migrate`。
- PDF 导入依赖简单的句子拆分规则，建议人工复核生成题目。

欢迎继续扩展，例如：用户统计、更多题型交互、题目审核流等。
