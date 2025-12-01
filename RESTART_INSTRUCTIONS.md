# 重启服务器和 Worker 的说明

## 修改内容
已修改 `apps/server/src/routes/admin.ts` 文件，修复了翻译字段和摘要字段的混淆问题。

## 重启步骤

### 开发环境

1. **重启服务器**：
   ```bash
   # 如果使用 tsx watch，通常会自动重载
   # 如果没有自动重载，手动停止（Ctrl+C）后重启：
   cd apps/server
   pnpm dev
   ```

2. **重启 Worker**（必须重启）：
   ```bash
   # 停止当前的 worker 进程（Ctrl+C）
   cd apps/server
   pnpm worker:dev
   ```

### 生产环境

#### 方式 1：使用 PM2（推荐）

```bash
# 1. 重新构建代码
cd apps/server
pnpm build

# 2. 重启服务器
pm2 restart judada-server

# 3. 重启 Worker（如果有单独的 worker 进程）
pm2 restart judada-worker

# 或者如果 worker 在同一个 PM2 配置中：
pm2 restart all
```

#### 方式 2：使用 systemd 或其他进程管理器

```bash
# 1. 重新构建代码
cd apps/server
pnpm build

# 2. 重启服务器进程
sudo systemctl restart judada-server

# 3. 重启 Worker 进程
sudo systemctl restart judada-worker
```

#### 方式 3：手动运行

```bash
# 1. 停止当前运行的进程（Ctrl+C 或 kill 命令）
# 2. 重新构建代码
cd apps/server
pnpm build

# 3. 重新启动服务器
pnpm start

# 4. 在另一个终端重新启动 Worker
pnpm worker:start
```

## 验证重启是否成功

1. **检查服务器**：
   ```bash
   curl http://localhost:4000/api/health
   ```

2. **检查 Worker**：
   查看日志确认 worker 已启动并监听队列：
   ```bash
   # 如果使用 PM2
   pm2 logs judada-worker
   
   # 或查看控制台输出是否有：
   # [worker] package-generation ready, listening on queue ...
   ```

3. **测试修复**：
   - 打开管理后台
   - 编辑一个句子
   - 确认"中文翻译"字段显示的是真正的翻译，而不是摘要内容

## 注意事项

- ⚠️ Worker 是独立进程，**必须单独重启**才能应用代码更改
- ⚠️ 如果使用 `tsx watch`，虽然会自动重载，但最好手动确认一次
- ⚠️ 生产环境需要先**重新构建**代码（`pnpm build`）再重启
