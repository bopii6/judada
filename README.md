# JudeDa Monorepo

һ������ǰ�ˣ�React + Vite���ͺ�ˣ�Express + Prisma����Ӣ��γ���ϰƽ̨��֧�ֹٷ�����̨ά�����γ���սѧϰ�Լ���λ������

## ����ջ

- **Monorepo**��pnpm + Turbo
- **ǰ��**��`apps/web`����Vite��React 18��TypeScript��TailwindCSS��TanStack Query
- **���**��`apps/server`����Node.js��Express��TypeScript��Prisma��SQLite Dev / Postgres Ready��
- **������**��`packages/shared`������Ŀ���Ͷ��塢У���߼���CSV/JSON ��������λ�����ֹ���
- **���ݿ�**��Prisma schema ���� QuestionBank / Question / Device / PracticeSession / PracticeRecord

## Ŀ¼�ṹ

```
.
���� apps/
��  ���� web/            # Vite + React ǰ��
��  ���� server/         # Express + Prisma ���
���� packages/
��  ���� shared/         # ���������빤��
���� prisma/            # schema.prisma �����ݿ�����
���� pnpm-workspace.yaml
���� turbo.json
���� tsconfig.json
���� .env.example       # ��˻�������ģ��
���� README.md
```

## ��ʼʹ��

### 1. ׼������

- Node.js 18+
- pnpm `npm install -g pnpm`

### 2. ��װ����

```bash
pnpm install
```

### 3. ���ݿ� & Prisma

Ĭ��ʹ�� SQLite��`DATABASE_URL=file:./dev.db`����Ҳ���滻Ϊ Postgres��

```bash
# ���� Prisma Client
pnpm db:generate

# ���ؿ�����ִ�� migrate dev
pnpm db:migrate
```

Prisma schema λ�� `prisma/schema.prisma`����������ģ�ͣ�QuestionBank��Question��Device��PracticeSession��PracticeRecord���Լ�ö�� `QuestionType`��`SessionMode`��

### 4. ���ؿ���

```bash
pnpm dev
```

Turbo �Ტ��������
- `apps/server` �� http://localhost:4000
- `apps/web` �� http://localhost:5173 ���Զ����� `/api` ���󵽺�ˣ�

Ҳ�ɷֱ�������

```bash
pnpm --filter server dev
pnpm --filter web dev
```

### 5. ��������

�븴�� `.env.example` �� `.env.local` �����ݲ��𻷾��޸ģ�

```
ADMIN_KEY=change-me
PORT=4000
DATABASE_URL=file:./dev.db
```

- `ADMIN_KEY`����̨����ӿ������ x-admin-key��
- `DATABASE_URL`��Prisma ����Դ������Ĭ�� SQLite��

ǰ��������⻷��������ͨ��������ʺ�ˣ���

## ��� API ����

> ���й���˽ӿ����� Header ��Я�� `x-admin-key: <ADMIN_KEY>`��

### �����

| ���� | ·�� | ˵�� |
| ---- | ---- | ---- |
| POST | `/admin/banks` | ������� |
| PUT | `/admin/banks/:id` | ������������Ϣ |
| GET | `/admin/banks` | �г���⼰����ͳ�� |
| DELETE | `/admin/banks/:id` | ɾ����⣨������Ŀ�� |
| POST | `/admin/banks/:id/import-json` | ���������Ŀ��JSON ���飩 |
| POST | `/admin/banks/:id/import-pdf` | �ϴ� PDF����ȡ����������Ŀ |

### ������

| ���� | ·�� | ˵�� |
| ---- | ---- | ---- |
| POST | `/device` | ���������豸 ID |
| GET | `/banks` | ��ȡ���ÿγ���� |
| GET | `/banks/:id/questions` | ������������� |
| POST | `/sessions` | ������ϰ / ��λ�� session |
| POST | `/records` | ����д����ͨ��ϰ��� |
| GET | `/placement/banks` | ��ȡ��λ����� |
| POST | `/placement/start` | ������λ�⣬������Ŀ�� sessionId |
| POST | `/placement/submit` | �ύ��λ�����𣬷������� / �Ƽ� tier ��γ� |

��λ�������߼����� `packages/shared/placement.ts` �У���
- ��ȷ�� 1 �֣����ӷ�Ӧʱ��Ȩ����3s +0.3��3-6s +0.1��>6s +0����
- �Ƽ��ȼ�ӳ����ͨ�� `tierMappings` ���е�������������ע�ͣ���

## ǰ��ҳ��

- **Dashboard**��չʾ�γ̸ſ�����λ����ڡ������ʾ��
- **Courses**���г���⣬�����γ���ϰ��TTS + �𶯷�������
- **Settings**������������ƫ�����á�
- **Admin**������ ADMIN_KEY ����пγ̹���������⡢���� JSON/PDF��

��ϰ���ڲ��ü����������̣�`Enter` �ύ��`Ctrl + Space` �ز�������ʹ�� `speechSynthesis` �� `navigator.vibrate` �ṩ��йٷ�����

## ���ýű�

| �ű� | ˵�� |
| ---- | ---- |
| `pnpm dev` | ����ǰ��˿��������� |
| `pnpm build` | ͨ�� Turbo �������а� |
| `pnpm lint` | ���и��� lint���谴�����ã� |
| `pnpm format` | ִ�� Prettier |
| `pnpm db:generate` | ���� Prisma Client |
| `pnpm db:migrate` | ���п�������Ǩ�� |

## ע������

- ǰ��Ĭ�ϴ��� `/api` �� `http://localhost:4000`������������޸� `apps/web/vite.config.ts`��
- Prisma Ĭ�� SQLite�����л��� Postgres������ `.env` �е� `DATABASE_URL` ������ `pnpm db:migrate`��
- PDF ���������򵥵ľ��Ӳ�ֹ��򣬽����˹�����������Ŀ��

��ӭ������չ�����磺�û�ͳ�ơ��������ͽ�������Ŀ������ȡ�
