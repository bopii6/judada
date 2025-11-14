# iptables规则持久化方案

由于您的服务器没有安装 `netfilter-persistent`，以下是几种替代方案来保存iptables规则：

## 方案1：使用 iptables-save 和 systemd 服务

### 1. 创建iptables规则文件
```bash
# 保存当前规则到文件
sudo iptables-save > /etc/iptables/rules.v4

# 创建目录（如果不存在）
sudo mkdir -p /etc/iptables
```

### 2. 创建systemd服务
```bash
# 创建服务文件
sudo tee /etc/systemd/system/iptables-restore.service > /dev/null <<EOF
[Unit]
Description=Restore iptables Firewall Rules
Before=network-pre.target
Wants=network-pre.target
DefaultDependencies=no

[Service]
Type=oneshot
ExecStart=/usr/sbin/iptables-restore /etc/iptables/rules.v4
ExecReload=/usr/sbin/iptables-restore /etc/iptables/rules.v4
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

# 启用并启动服务
sudo systemctl enable iptables-restore.service
sudo systemctl start iptables-restore.service
```

## 方案2：使用网络接口启动脚本

### 1. 创建网络接口启动脚本
```bash
# 创建脚本目录
sudo mkdir -p /etc/network/if-pre-up.d

# 创建iptables加载脚本
sudo tee /etc/network/if-pre-up.d/iptables > /dev/null <<'EOF'
#!/bin/sh
iptables-restore < /etc/iptables/rules.v4
EOF

# 设置执行权限
sudo chmod +x /etc/network/if-pre-up.d/iptables
```

### 2. 保存规则
```bash
# 创建规则文件目录
sudo mkdir -p /etc/iptables

# 保存当前规则
sudo iptables-save > /etc/iptables/rules.v4
```

## 方案3：使用rc.local（传统方法）

### 1. 启用rc.local
```bash
# 创建rc.local文件（如果不存在）
sudo tee /etc/rc.local > /dev/null <<'EOF'
#!/bin/bash
# rc.local
#
# This script is executed at the end of each multiuser runlevel.
# Make sure that the script will exit 0 on success.

iptables-restore < /etc/iptables/rules.v4

exit 0
EOF

# 设置执行权限
sudo chmod +x /etc/rc.local

# 如果systemd系统，创建rc.local服务
sudo systemctl enable rc-local
```

## 方案4：创建专用管理脚本

### 1. 创建iptables管理脚本
```bash
sudo tee /usr/local/bin/iptables-manager > /dev/null <<'EOF'
#!/bin/bash

RULES_FILE="/etc/iptables/rules.v4"
BACKUP_DIR="/etc/iptables/backups"

case "$1" in
    save)
        echo "保存iptables规则..."
        sudo mkdir -p $(dirname $RULES_FILE)
        sudo mkdir -p $BACKUP_DIR
        sudo iptables-save > $RULES_FILE
        # 创建备份
        sudo cp $RULES_FILE "$BACKUP_DIR/rules_$(date +%Y%m%d_%H%M%S).v4"
        echo "规则已保存到 $RULES_FILE"
        ;;
    load)
        echo "加载iptables规则..."
        if [ -f $RULES_FILE ]; then
            sudo iptables-restore < $RULES_FILE
            echo "规则已加载"
        else
            echo "规则文件 $RULES_FILE 不存在"
            exit 1
        fi
        ;;
    backup)
        echo "备份当前规则..."
        sudo mkdir -p $BACKUP_DIR
        sudo iptables-save > "$BACKUP_DIR/rules_$(date +%Y%m%d_%H%M%S).v4"
        echo "备份完成"
        ;;
    show)
        echo "当前iptables规则:"
        sudo iptables -L -n -v
        ;;
    clear)
        echo "清除所有iptables规则..."
        sudo iptables -F
        sudo iptables -X
        sudo iptables -t nat -F
        sudo iptables -t nat -X
        sudo iptables -P INPUT ACCEPT
        sudo iptables -P FORWARD ACCEPT
        sudo iptables -P OUTPUT ACCEPT
        echo "规则已清除"
        ;;
    *)
        echo "用法: $0 {save|load|backup|show|clear}"
        echo "  save  - 保存当前规则到文件"
        echo "  load  - 从文件加载规则"
        echo "  backup- 备份当前规则"
        echo "  show  - 显示当前规则"
        echo "  clear - 清除所有规则"
        exit 1
        ;;
esac
EOF

# 设置执行权限
sudo chmod +x /usr/local/bin/iptables-manager
```

### 2. 使用方法
```bash
# 保存当前规则
sudo iptables-manager save

# 加载规则
sudo iptables-manager load

# 备份规则
sudo iptables-manager backup

# 显示规则
sudo iptables-manager show

# 清除规则
sudo iptables-manager clear
```

## 立即修复当前问题的步骤

### 1. 快速修复（立即生效）
```bash
# 运行我们创建的修复脚本
bash /tmp/fix-iptables.sh

# 或者手动执行
sudo iptables -F
sudo iptables -P INPUT ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
```

### 2. 测试网站访问
```bash
# 测试本地访问
curl -I http://localhost

# 测试外部访问
curl -I http://你的服务器IP
```

### 3. 永久保存（选择一种方案）

#### 推荐使用方案1（systemd服务）：
```bash
# 1. 保存当前规则
sudo mkdir -p /etc/iptables
sudo iptables-save > /etc/iptables/rules.v4

# 2. 创建systemd服务
sudo tee /etc/systemd/system/iptables-restore.service > /dev/null <<'EOF'
[Unit]
Description=Restore iptables Firewall Rules
Before=network-pre.target
Wants=network-pre.target
DefaultDependencies=no

[Service]
Type=oneshot
ExecStart=/usr/sbin/iptables-restore /etc/iptables/rules.v4
ExecReload=/usr/sbin/iptables-restore /etc/iptables/rules.v4
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

# 3. 启用服务
sudo systemctl enable iptables-restore.service
sudo systemctl start iptables-restore.service
```

## 验证修复效果

1. **检查iptables规则**：
   ```bash
   sudo iptables -L INPUT -n -v
   ```

2. **测试网站访问**：
   ```bash
   # 本地测试
   curl -I http://localhost

   # 外部测试
   curl -I http://你的域名
   ```

3. **检查服务状态**：
   ```bash
   sudo systemctl status nginx
   sudo systemctl status iptables-restore
   ```

选择适合你系统的方案进行操作。推荐使用方案1（systemd服务），因为它最稳定且易于管理。