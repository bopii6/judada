# 后台 `/admin` 路由问题排查记录

## 背景
- 本地开发：`http://localhost:5174` 正常。
- 线上访问 `https://hellojoy.top/admin/` 自动跳回主站首页。
- 使用 Cloudflare Tunnel，DNS 记录均走代理，tunnel 转发到本机 80 端口。

## 现象
- 访问 `/admin/` 返回的是主站 HTML（MD5 为 `ff3771…`，长度 1326）。
- 服务器 `/var/www/judada/apps/admin/dist/index.html` MD5 为 `7522f7…`，长度约 1479，未被返回。

## 排查过程
1. 在 `/etc/nginx/nginx.conf` 添加 `/admin` 配置并 reload，但 `curl` 仍返回主站 HTML。
2. 添加探针头 `X-From-Admin` 发现不出现，判断请求未命中期望的 `location /admin`。
3. 查看运行进程：`ps -ef | grep nginx`，发现主进程启动参数 `-c /www/server/nginx/conf/nginx.conf`（宝塔版本）。
4. `nginx -T` 确认生效配置在 `/www/server/nginx/conf`，之前改的 `/etc/nginx` 根本未被加载。

## 根因
修改了错误的 Nginx 配置路径（`/etc/nginx/nginx.conf`），实际生效的配置是宝塔 Nginx 的 `/www/server/nginx/conf/nginx.conf`，导致 `/admin` 的 alias/回退规则一直未生效，Nginx 将 `/admin` 回退到主站前端的 index.html。

## 处理措施
在实际生效的 server 块（`hellojoy.top`）添加并应用以下配置：
```nginx
location = /admin {
    return 301 /admin/;
}

location ^~ /admin/ {
    alias /var/www/judada/apps/admin/dist/;
    index index.html;
    try_files $uri $uri/ /index.html;
}
```
执行：
```bash
sudo /www/server/nginx/sbin/nginx -t
sudo /www/server/nginx/sbin/nginx -s reload
```

## 验证
- `curl -s http://127.0.0.1/admin/ -H "Host: hellojoy.top" | md5sum` 与磁盘文件 MD5 `7522f7…` 一致。
- 浏览器隐身模式访问 `https://hellojoy.top/admin/` 正常进入后台。
- Cloudflare 侧暂时开启 Development Mode/对 `/admin*` Bypass cache，避免旧缓存干扰。

## 经验教训
- 先确定 Nginx 运行的配置路径（`ps -ef | grep nginx` 或启动参数），再修改对应文件。
- 为 SPA 子路径提供独立的 `alias + try_files ... /index.html`，必要时加探针头确认命中。
- Cloudflare 代理下，如遇缓存干扰，使用 Development Mode 或 Cache Rule Bypass 做验证。
