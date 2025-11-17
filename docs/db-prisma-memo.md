# DB & Prisma Migrate 备忘录

本项目数据库与迁移使用的“固定策略”与“处理步骤”。照此执行，避免开发/上线来回踩坑。

## 端口与场景（大白话）

- 一句话：线上跑程序用 6543，本地跑程序也用 6543；只有“做迁移”才用 5432。

- 线上生产（腾讯云）：
  - 运行时：用 PgBouncer 6543（更稳、能扛并发）
  - 迁移：用直连 5432（Prisma migrate 不能走 pooler）
- 本地开发：
  - 运行时：用 PgBouncer 6543（和线上一致）
  - 迁移：用直连 5432

原因：
- 迁移需要“会话粘性”，PgBouncer 的事务池做不到，所以迁移必须 5432。
- 程序运行连接多、并发高，用 6543 的池更稳；本地也用 6543，和线上保持一致更省心。

---

## 配置文件

- 根 `.env`（被后端运行时读取）
  - 线上（生产）用 6543：
    ```
    DATABASE_URL=postgresql://postgres:<密码>@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1&pool_timeout=30&connect_timeout=20
    ```
  - 本地（开发）用 6543（与线上一致）：
    ```
    DATABASE_URL=postgresql://postgres:<密码>@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
    ```

- `prisma/.env`（仅供迁移使用；避免冲突，这里只放一行）
  ```
  SHADOW_DATABASE_URL=postgresql://postgres:<密码>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
  ```

- schema 指定 shadow：`prisma/schema.prisma`
  ```
  datasource db {
    provider          = "postgresql"
    url               = env("DATABASE_URL")
    shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
  }
  ```

---

## 常用命令（Windows PowerShell）

- 迁移（dev，生成 SQL 并应用；仅直连 5432）
  ```powershell
  $env:DATABASE_URL = (Select-String -Path .\prisma\.env -Pattern '^SHADOW_DATABASE_URL=' | % { $_.Line.Split('=',2)[1] })
  pnpm exec prisma migrate dev --schema ".\prisma\schema.prisma" --name <描述>
  ```

- 部署/CI（deploy，只应用已有迁移）
  ```powershell
  pnpm --filter server prisma:deploy
  ```

- 清除临时注入的环境变量（避免运行时还连 5432）
  ```powershell
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  ```

- 本地构建/启动
  ```powershell
  pnpm --filter server build
  pnpm --filter server dev
  # 健康检查 http://localhost:4000/health
  ```

（Linux/macOS 等价：可用 `npx cross-env DATABASE_URL="..." prisma migrate dev` 方式注入）

---

## 典型报错与处理

- “Can't reach database server at …:6543/5432”
  - 检查网络连通：
    - Windows：`Test-NetConnection db.<ref>.supabase.co -Port 5432`
    - Linux：`nc -vz db.<ref>.supabase.co 5432`
  - 运行时用哪个端口，根 `.env` 写死即可；迁移必须 5432。
  - 如果是开发时误用临时变量导致运行时连 5432/6543，执行：
    ```powershell
    Remove-Item Env:DATABASE_URL
    ```

- “There is a conflict between env vars in .env and prisma\.env”
  - 原因：两个文件都有相同变量名。
  - 解决：`prisma/.env` 只保留 `SHADOW_DATABASE_URL` 一行，其余全部放到根 `.env`。

- “P3019 provider mismatch (sqlite vs postgresql)”
  - 原因：迁移目录是旧的 sqlite 历史。
  - 解决（开发库安全可清空）：
    ```powershell
    Remove-Item .\prisma\migrations -Recurse -Force
    Remove-Item .\prisma\migration_lock.toml -Force
    Get-ChildItem .\prisma -Filter 'dev.db*' | Remove-Item -Force
    $env:DATABASE_URL = (Select-String -Path .\prisma\.env -Pattern '^SHADOW_DATABASE_URL=' | % { $_.Line.Split('=',2)[1] })
    pnpm exec prisma migrate dev --schema ".\prisma\schema.prisma" --name init
    ```

- “migrate dev 卡住/失败（PgBouncer）”
  - 一律用 5432 直连执行 migrate（见命令区）。

- “课程列表为空”
  - `/api/courses` 仅返回“published 且当前版本 ≥15 lessons”的课程包。
  - 解决：后台创建课程包 → 生成关卡 → 发布；或开发期临时把阈值从 15 降为 1（在 `apps/server/src/routes/courses.ts` 内）。

---

## 验证我现在到底连了谁

- 打印当前会话里的临时变量：
  ```powershell
  $env:DATABASE_URL
  ```
  空则表示运行时会读根 `.env`；不空则它会覆盖 `.env`。

- 看后端日志中的主机/端口：
  - 报错里会带 `db.<ref>:5432` 或 `pooler.supabase.com:6543`。

---

## 线上部署（当前选择）

- 运行时端口：6543（PgBouncer）
- 迁移端口：5432（shadow）

服务器 `/var/www/judada/.env`：
```
DATABASE_URL=postgresql://postgres:<密码>@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1&pool_timeout=30&connect_timeout=20
```

服务器 `/var/www/judada/prisma/.env`：
```
SHADOW_DATABASE_URL=postgresql://postgres:<密码>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
```

部署脚本：
```
sudo judada-deploy
# 脚本会尝试用 5432 做迁移（失败不阻塞），然后构建并重启
```

---

## 补充

- pgcrypto 扩展（使用 `gen_random_uuid()` 时必需）：
  在 Supabase SQL Editor 执行：
  ```sql
  create extension if not exists pgcrypto schema public;
  ```

- Worker 已修复“(packageId, sequence) 唯一约束冲突(P2002)”：
  - 生成任务会从数据库读取最大 `sequence` 起步；若并发触发唯一冲突，会顺延 `sequence` 并自动重试当前 lesson。

---

## 快速排障清单

- 迁移时报错/卡住：是否确实用 5432？是否 `prisma/.env` 仅有 `SHADOW_DATABASE_URL`？
- 运行时报错连不上：根 `.env` 的 `DATABASE_URL` 是否与你的目标端口一致？（生产 6543、本地 5432）
- 变量冲突：出现 `.env` vs `prisma\.env` 冲突提示，精简 `prisma\.env` 只留一行。
- provider 不匹配（P3019）：清迁移历史后用 `migrate dev` 初始化 PostgreSQL。
- 课程为空：是否已发布且 ≥15 lessons？（或临时降低阈值）

---

## ʲôʱ�����ĸ����

�� `migrate dev`���ᡰ�����µ�Ǩ�ơ�������ִ�У�������Щ������
- ����� `prisma/schema.prisma`������/�޸ı����ֶΡ���������
- ��һ�θ������Ŀ����Ǩ�ƣ���ʼ������
- ��Ҫ�ڱ����ؽ�/���ÿ����Ⲣ�����µ�Ǩ����ʷ��

����裺
```powershell
$env:DATABASE_URL = (Select-String -Path .\prisma\.env -Pattern '^SHADOW_DATABASE_URL=' | % { $_.Line.Split('=',2)[1] })
pnpm exec prisma migrate dev --schema ".\prisma\schema.prisma" --name <���α������>
```

�� `migrate deploy`��ֻ��Ӧ������Ǩ�ơ�������������Ǩ�ƣ�������Щ������
- ����ȡ�˱��˵�Ǩ�ƣ������Ӧ�õ�����ǰ�⡱������/����/��������
- CI/CD������������ʱ�������ݿ�ṹ�������һ��������
- ��ϣ�������κ��µ�Ǩ�ƣ�ֻ��� `prisma/migrations` Ŀ¼�����ʷ��˳��ִ�е����¡�

����裺
```powershell
# ���أ�ֱ��ִ�У����ȡ prisma\.env �� .env�������ӵ� 5432��
pnpm --filter server prisma:deploy

# �����������ǵ� judada-deploy �ű�����ִ�� deploy ǰ����ʱ�� DATABASE_URL �е� 5432 ��Ӧ��Ǩ��
sudo judada-deploy
```

С�᣺
- ���� schema �� ������ʷ�� �� `migrate dev`��ֻ�ڿ����׶�������
- ���û���������ʷ������ �� `migrate deploy`������ͬ�������ԡ����߶���������
- ���߶�**ֻ��ִ��ʱ**�� 5432����������ʱ������/���ϣ����� 6543��
