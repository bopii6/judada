#!/bin/bash
# 上传功能调试脚本
# 专门用于分析上传相关的日志

echo "🔍 Jude English Lab 上传功能分析..."
echo "=================================="

# 检查最近的API调用
echo "📡 最近的API调用（POST /api）："
echo "--- 最近5分钟内的上传请求 ---"
if [ -f "/var/log/nginx/access.log" ]; then
    # 获取最近5分钟的时间戳
    recent_time=$(date -d '5 minutes ago' '+%d/%b/%Y:%H:%M:%S')
    awk -v recent="$recent_time" '$4 > "["recent' /var/log/nginx/access.log | grep -E "(POST|PUT) /api" | tail -10
else
    echo "Nginx访问日志不存在"
fi
echo ""

# 检查大文件上传
echo "📁 大文件上传检测："
if [ -f "/var/log/nginx/access.log" ]; then
    echo "--- 检查可能的大文件上传（响应状态码 >= 400）---"
    grep -E "(POST|PUT).*(4[0-9][0-9]|5[0-9][0-9])" /var/log/nginx/access.log | tail -5
fi
echo ""

# 检查PM2应用错误
echo "🚨 PM2应用错误分析："
if [ -f "/var/log/judada/server-error.log" ]; then
    echo "--- 最近的应用错误 ---"
    tail -20 /var/log/judada/server-error.log | grep -i -E "(error|exception|fail|timeout|ocr|openai)"
else
    echo "PM2错误日志文件不存在"
fi
echo ""

# 检查OCR相关错误
echo "🔍 OCR相关错误检测："
if [ -f "/var/log/judada/server-error.log" ]; then
    echo "--- OCR和AI服务错误 ---"
    tail -50 /var/log/judada/server-error.log | grep -i -E "(ocr|openai|aliyun|upload|file)"
fi
echo ""

# 检查系统资源限制
echo "💻 系统资源限制检查："
echo "--- 内存使用情况 ---"
free -h
echo ""
echo "--- 磁盘空间 ---"
df -h
echo ""
echo "--- 进程数限制 ---"
ulimit -a | grep -E "(process|file)"
echo ""

# 检查临时文件目录
echo "📂 临时文件目录检查："
echo "--- /tmp目录使用情况 ---"
if [ -d "/tmp" ]; then
    du -sh /tmp
    ls -la /tmp | head -10
else
    echo "/tmp目录不存在"
fi
echo ""

echo "🔧 建议的调试步骤："
echo "1. 运行 pm2 logs judada-server 查看实时日志"
echo "2. 运行 redis-cli monitor 查看Redis队列状态"
echo "3. 检查环境变量配置是否正确"
echo "4. 确认OpenAI和阿里云OCR API密钥有效性"