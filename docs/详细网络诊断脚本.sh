#!/bin/bash

echo "=== 🔍 详细网络诊断脚本 ==="
echo "开始时间: $(date)"
echo "服务器IP: $(curl -s ifconfig.me 2>/dev/null || echo '获取失败')"
echo ""

echo "=== 1. iptables规则详细分析 ==="
echo "当前iptables INPUT链规则:"
sudo iptables -L INPUT -n -v --line-numbers
echo ""

echo "INPUT链默认策略:"
sudo iptables -L INPUT | head -1
echo ""

echo "FORWARD和OUTPUT链策略:"
sudo iptables -L FORWARD | head -1
sudo iptables -L OUTPUT | head -1
echo ""

echo "=== 2. 检查是否有其他防火墙服务运行 ==="
echo "检查iptables相关服务:"
systemctl status iptables 2>/dev/null || echo "iptables服务未运行"
echo ""

echo "检查netfilter-persistent服务:"
systemctl status netfilter-persistent 2>/dev/null || echo "netfilter-persistent服务未安装"
echo ""

echo "检查ufw状态:"
sudo ufw status verbose
echo ""

echo "=== 3. 测试不同端口的连通性 ==="
echo "测试本地端口连接:"
for port in 80 443 4000 22; do
    result=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port 2>/dev/null || echo "失败")
    echo "  本地端口 $port: $result"
done
echo ""

echo "测试外部端口连接:"
external_ip=$(curl -s ifconfig.me 2>/dev/null)
for port in 80 443 4000 22; do
    timeout 5 bash -c "</dev/tcp/$external_ip/$port" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "  外部端口 $port: 可访问"
    else
        echo "  外部端口 $port: 不可访问"
    fi
done
echo ""

echo "=== 4. 检查Nginx详细配置 ==="
echo "Nginx配置测试:"
sudo nginx -t
echo ""

echo "Nginx运行状态:"
sudo systemctl status nginx --no-pager -l
echo ""

echo "Nginx进程详情:"
ps aux | grep nginx | grep -v grep
echo ""

echo "=== 5. 检查应用进程状态 ==="
echo "PM2进程列表:"
pm2 list
echo ""

echo "Node.js进程:"
ps aux | grep node | grep -v grep
echo ""

echo "=== 6. 端口监听状态 ==="
echo "所有监听端口:"
sudo netstat -tlnp
echo ""

echo "=== 7. 系统日志检查 ==="
echo "最近的系统日志 (网络相关):"
sudo journalctl -u networking --since "1 hour ago" --no-pager | tail -10
echo ""

echo "最近的内核日志:"
sudo dmesg | grep -i "firewall\|iptables\|netfilter" | tail -10
echo ""

echo "=== 8. 尝试修复iptables规则 ==="
echo "检查是否已存在HTTP规则:"
http_rule_exists=$(sudo iptables -L INPUT -n | grep ":80" | grep -c "ACCEPT")
if [ $http_rule_exists -gt 0 ]; then
    echo "  HTTP规则已存在"
else
    echo "  添加HTTP访问规则..."
    sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
    echo "  HTTP规则已添加"
fi

echo "检查是否已存在HTTPS规则:"
https_rule_exists=$(sudo iptables -L INPUT -n | grep ":443" | grep -c "ACCEPT")
if [ $https_rule_exists -gt 0 ]; then
    echo "  HTTPS规则已存在"
else
    echo "  添加HTTPS访问规则..."
    sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
    echo "  HTTPS规则已添加"
fi

echo "添加已建立连接规则:"
sudo iptables -I INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
echo "规则添加完成"
echo ""

echo "=== 9. 查找可用的iptables持久化方法 ==="
echo "检查可用的iptables保存命令:"
if command -v iptables-save &> /dev/null; then
    echo "  iptables-save 可用"
    echo "  保存当前规则到文件:"
    sudo iptables-save > /tmp/iptables-backup.txt
    echo "  规则已备份到 /tmp/iptables-backup.txt"
fi

if command -v iptables-restore &> /dev/null; then
    echo "  iptables-restore 可用"
fi

echo "检查系统启动脚本目录:"
if [ -d /etc/network/if-pre-up.d/ ]; then
    echo "  /etc/network/if-pre-up.d/ 目录存在"
fi

if [ -d /etc/rc.d/ ]; then
    echo "  /etc/rc.d/ 目录存在"
fi

echo "检查systemd服务创建可能性:"
echo "  可以创建systemd服务来加载iptables规则"
echo ""

echo "=== 10. 创建临时修复方案 ==="
cat > /tmp/fix-iptables.sh << 'EOF'
#!/bin/bash
# 临时修复iptables规则的脚本
echo "修复iptables规则..."

# 清空现有规则
sudo iptables -F
sudo iptables -X
sudo iptables -t nat -F
sudo iptables -t nat -X

# 设置默认策略
sudo iptables -P INPUT ACCEPT
sudo iptables -P FORWARD ACCEPT
sudo iptables -P OUTPUT ACCEPT

# 允许本地回环
sudo iptables -A INPUT -i lo -j ACCEPT

# 允许已建立的连接
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# 允许SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# 允许HTTP
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT

# 允许HTTPS
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# 允许应用端口
sudo iptables -A INPUT -p tcp --dport 4000 -j ACCEPT

echo "iptables规则修复完成"
EOF

chmod +x /tmp/fix-iptables.sh
echo "临时修复脚本已创建: /tmp/fix-iptables.sh"
echo ""

echo "=== 11. 测试修复效果 ==="
echo "再次测试本地HTTP访问:"
local_result=$(curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null || echo "失败")
echo "  本地HTTP: $local_result"

echo "测试外部HTTP访问:"
external_result=$(timeout 10 curl -s -o /dev/null -w "%{http_code}" http://$external_ip 2>/dev/null || echo "失败")
echo "  外部HTTP: $external_result"
echo ""

echo "=== 诊断完成 ==="
echo "结束时间: $(date)"
echo ""
echo "建议的下一步操作:"
echo "1. 运行 /tmp/fix-iptables.sh 脚本修复防火墙规则"
echo "2. 测试网站访问: curl -I http://$external_ip"
echo "3. 如果可以访问，设置iptables规则持久化"
echo "4. 检查阿里云安全组规则是否正确配置"