#!/bin/bash

echo "=== 🚨 紧急故障排查脚本 ==="
echo "开始时间: $(date)"
echo "服务器IP: $(curl -s ifconfig.me 2>/dev/null || echo '获取失败')"
echo ""

echo "=== 1. 系统基础状态 ==="
echo "负载: $(uptime)"
echo "内存使用:"
free -h
echo "磁盘使用:"
df -h /
echo ""

echo "=== 2. 网络端口监听状态 ==="
echo "检查80端口(HTTP):"
sudo netstat -tlnp | grep :80
echo ""
echo "检查443端口(HTTPS):"
sudo netstat -tlnp | grep :443
echo ""
echo "检查4000端口(后端):"
sudo netstat -tlnp | grep :4000
echo ""

echo "=== 3. 服务运行状态 ==="
echo "Nginx状态:"
sudo systemctl is-active nginx
echo "PM2进程状态:"
pm2 list
echo ""

echo "=== 4. 防火墙状态 ==="
echo "UFW防火墙状态:"
sudo ufw status
echo ""

echo "=== 5. 本地连通性测试 ==="
echo "测试本地HTTP:"
curl -s -o /dev/null -w "%{http_code}" http://localhost || echo "连接失败"
echo ""
echo "测试本地健康检查:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health || echo "连接失败"
echo ""

echo "=== 6. Nginx错误日志(最近10条) ==="
sudo tail -10 /var/log/nginx/error.log
echo ""

echo "=== 7. PM2应用错误日志(最近5条) ==="
pm2 logs --lines 5 --err
echo ""

echo "=== 排查完成 ==="
echo "结束时间: $(date)"