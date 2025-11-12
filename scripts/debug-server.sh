#!/bin/bash
# Jude English Lab 调试脚本
# 用于快速查看系统状态和日志

echo "🔍 Jude English Lab 系统状态检查..."
echo "=================================="

# 1. PM2应用状态
echo "📊 PM2应用状态："
pm2 status
echo ""

# 2. 系统资源
echo "💾 系统资源使用："
echo "内存使用："
free -h
echo ""
echo "磁盘使用："
df -h
echo ""

# 3. 服务状态
echo "🔧 服务状态："
echo "Nginx状态："
systemctl is-active nginx
echo "Redis状态："
systemctl is-active redis-server
echo ""

# 4. 端口占用
echo "🌐 端口占用情况："
netstat -tlnp | grep -E ':(80|443|4000|6379)'
echo ""

# 5. 最近的错误日志
echo "🚨 最近的错误日志（最后10行）："
if [ -f "/var/log/judada/server-error.log" ]; then
    echo "--- PM2错误日志 ---"
    tail -10 /var/log/judada/server-error.log
else
    echo "PM2错误日志文件不存在"
fi
echo ""

if [ -f "/var/log/nginx/error.log" ]; then
    echo "--- Nginx错误日志 ---"
    tail -10 /var/log/nginx/error.log
else
    echo "Nginx错误日志文件不存在"
fi
echo ""

# 6. 最近的访问日志
echo "📝 最近的API访问日志（最后5行）："
if [ -f "/var/log/nginx/access.log" ]; then
    tail -5 /var/log/nginx/access.log | grep -E "(POST|PUT) /api"
else
    echo "Nginx访问日志文件不存在"
fi
echo ""

echo "✅ 系统检查完成！"
echo ""
echo "🔧 实时监控命令："
echo "1. 查看PM2实时日志: pm2 logs judada-server"
echo "2. 查看Nginx实时访问日志: tail -f /var/log/nginx/access.log"
echo "3. 查看系统资源: htop"
echo "4. 查看Redis状态: redis-cli monitor"