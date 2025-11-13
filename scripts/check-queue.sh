#!/bin/bash
# Redis队列状态检查脚本

echo "🔍 Redis队列状态检查..."
echo "=================================="

# 检查Redis连接
echo "📡 Redis连接测试："
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis连接正常"
else
    echo "❌ Redis连接失败，请检查Redis服务"
    exit 1
fi

# 获取队列前缀
QUEUE_PREFIX=$(grep QUEUE_PREFIX .env 2>/dev/null | cut -d'=' -f2)
if [ -z "$QUEUE_PREFIX" ]; then
    QUEUE_PREFIX="course-gen"
fi

echo "📋 队列前缀: $QUEUE_PREFIX"
echo ""

# 检查队列状态
echo "📊 队列状态："
echo "--- 等待队列 ---"
WAITING_COUNT=$(redis-cli llen "${QUEUE_PREFIX}:waiting" 2>/dev/null || echo "0")
echo "等待中的任务: $WAITING_COUNT"

echo "--- 活跃队列 ---"
ACTIVE_COUNT=$(redis-cli llen "${QUEUE_PREFIX}:active" 2>/dev/null || echo "0")
echo "正在处理的任务: $ACTIVE_COUNT"

echo "--- 失败队列 ---"
FAILED_COUNT=$(redis-cli llen "${QUEUE_PREFIX}:failed" 2>/dev/null || echo "0")
echo "失败的任务: $FAILED_COUNT"

echo "--- 完成队列 ---"
COMPLETED_COUNT=$(redis-cli get "${QUEUE_PREFIX}:completed" 2>/dev/null || echo "0")
echo "已完成的任务: $COMPLETED_COUNT"
echo ""

# 显示最近失败的任务（如果有）
if [ "$FAILED_COUNT" -gt 0 ]; then
    echo "🚨 最近的失败任务："
    redis-cli lrange "${QUEUE_PREFIX}:failed" -2 -1 2>/dev/null | head -5
    echo ""
fi

# 显示等待中的任务（如果有）
if [ "$WAITING_COUNT" -gt 0 ]; then
    echo "⏳ 等待中的任务（前3个）："
    redis-cli lrange "${QUEUE_PREFIX}:waiting" 0 2 2>/dev/null
    echo ""
fi

echo "🔧 常用命令："
echo "1. 清空失败队列: redis-cli del ${QUEUE_PREFIX}:failed"
echo "2. 清空等待队列: redis-cli del ${QUEUE_PREFIX}:waiting"
echo "3. 清空活跃队列: redis-cli del ${QUEUE_PREFIX}:active"
echo "4. 重置计数器: redis-cli set ${QUEUE_PREFIX}:completed 0"
echo ""
echo "💡 如果任务一直卡在等待队列中，可能需要重启Worker进程"