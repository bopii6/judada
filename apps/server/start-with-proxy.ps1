# 设置 HTTP 代理（根据您的 Clash 配置调整端口）
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"

# 重新启动服务器
cd e:\新建文件夹\judada\apps\server
npm run dev
