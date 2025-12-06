# 排查和修复翻译问题的操作步骤

## 📋 当前发现的问题

1. **Worker 生成关卡时**：`payload.cn` 被错误设置为 `template.summary`（摘要），而不是真正的翻译
2. **历史数据**：可能已经有数据存储了摘要而不是翻译

## 🔧 已完成的修复

1. ✅ 修复了 worker 中 `payload.cn = template.summary` 的问题
2. ✅ 添加了详细的调试日志到服务器端

## 📝 操作步骤

### 第一步：重启服务器和 Worker

#### 开发环境

```bash
# 1. 停止当前的服务器进程（在运行服务器的终端按 Ctrl+C）

# 2. 重新启动服务器（会看到详细的调试日志）
cd apps/server
pnpm dev

# 3. 停止当前的 Worker 进程（在运行 worker 的终端按 Ctrl+C）

# 4. 重新启动 Worker
cd apps/server
pnpm worker:dev
```

#### 生产环境

```bash
# 1. 重新构建代码
cd apps/server
pnpm build

# 2. 重启服务器
pm2 restart judada-server

# 3. 重启 Worker
pm2 restart judada-worker
# 或者如果有单独的 worker 进程名称，替换为实际的名称
```

### 第二步：查看日志诊断问题

重启后，当你在管理后台访问素材树时，服务器终端会输出详细的调试日志：

```
[API] GET /course-packages/{packageId}/materials - 开始获取素材树
[DEBUG MaterialLessonTree] Lesson #1 "核心词汇训练": {
  lessonId: 'xxx',
  summary: '针对主题核心词汇进行理解与记忆',
  payloadCn: '针对主题核心词汇进行理解与记忆',  // ⚠️ 如果这里显示的是摘要内容
  payloadEn: 'Monday What do you have on Fridays?',
  isCnSameAsSummary: '⚠️ 警告：cn 等于 summary!'  // 这会显示警告
}
```

**关键信息**：
- 如果看到 `⚠️ 警告：cn 等于 summary!`，说明该关卡的数据有问题
- 查看 `payloadCn` 的值是否是真正的翻译还是摘要

### 第三步：修复历史数据（如果发现问题）

如果日志显示历史数据有问题，你需要：

#### 方案 A：通过编辑界面手动修复（推荐）

1. 打开管理后台
2. 进入有问题的课程包
3. 对每个有问题的关卡：
   - 点击「编辑」按钮
   - 在「中文翻译」字段输入正确的中文翻译（例如："星期一，你星期五有什么课？"）
   - 点击「保存」

#### 方案 B：创建数据修复脚本（适用于大量数据）

如果你有大量数据需要修复，我可以帮你创建一个自动化修复脚本。

### 第四步：验证修复

1. **新生成的关卡**：上传新素材生成关卡，确认翻译字段显示的是真正的翻译
2. **已修复的关卡**：编辑一个关卡，确认显示正确
3. **查看日志**：确认日志中不再显示警告

## 🔍 日志输出说明

服务器启动后，当你访问管理后台的素材树页面时，终端会显示：

### 正常情况（修复后）
```
[DEBUG MaterialLessonTree] Lesson #1 "...": {
  payloadCn: '星期一，你星期五有什么课？',  // ✓ 真正的翻译
  summary: '针对主题核心词汇进行理解与记忆',  // 摘要（不同）
  isCnSameAsSummary: '✓ 正常'
}
```

### 有问题的情况（历史数据）
```
[DEBUG MaterialLessonTree] Lesson #1 "...": {
  payloadCn: '针对主题核心词汇进行理解与记忆',  // ⚠️ 这是摘要，不是翻译
  summary: '针对主题核心词汇进行理解与记忆',
  isCnSameAsSummary: '⚠️ 警告：cn 等于 summary!'
}
```

## 🎯 下一步行动

1. **立即执行**：重启服务器和 Worker
2. **查看日志**：访问管理后台，观察终端输出的日志
3. **反馈问题**：将日志输出发给我，我可以帮你：
   - 分析具体问题
   - 创建数据修复脚本（如果需要）
   - 进一步优化代码

## 💡 提示

- 日志会显示**每个关卡**的详细信息，便于排查
- 新生成的关卡不会再有这个问题
- 历史数据需要通过编辑手动修复，或者我可以帮你写批量修复脚本












