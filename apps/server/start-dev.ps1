# 从 .env 文件读取 DATABASE_URL
$envFile = "..\..\\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^DATABASE_URL=(.+)$') {
            $env:DATABASE_URL = $matches[1]
            Write-Host "DATABASE_URL loaded from .env"
        }
    }
}

# 设置代理
$env:GLOBAL_AGENT_HTTP_PROXY = "http://127.0.0.1:7890"
$env:HTTP_PROXY = "http://127.0.0.1:7890"
$env:HTTPS_PROXY = "http://127.0.0.1:7890"

Write-Host "Starting server with proxy: http://127.0.0.1:7890"
if ($env:DATABASE_URL) {
    Write-Host "DATABASE_URL: Set"
} else {
    Write-Host "DATABASE_URL: NOT SET"
}

# 启动服务器
npm run dev
