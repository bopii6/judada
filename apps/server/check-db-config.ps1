# 数据库配置检查脚本
# 用于检查哪个 DATABASE_URL 在生效

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "数据库配置诊断工具" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 .env 文件
$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    Write-Host "📄 检查 .env 文件..." -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------" -ForegroundColor Gray
    
    $content = Get-Content $envPath
    $databaseUrlCount = 0
    $directUrlFound = $false
    
    for ($i = 0; $i -lt $content.Length; $i++) {
        $line = $content[$i].Trim()
        if ($line -and -not $line.StartsWith('#')) {
            if ($line -match '^DATABASE_URL=(.+)$') {
                $databaseUrlCount++
                $value = $matches[1]
                Write-Host ""
                Write-Host "🔍 发现第 $databaseUrlCount 个 DATABASE_URL (行 $($i + 1)):" -ForegroundColor Yellow
                Write-Host "   $($value.Substring(0, [Math]::Min(80, $value.Length)))..." -ForegroundColor Gray
            }
            elseif ($line -match '^DIRECT_URL=(.+)$') {
                $directUrlFound = $true
                $value = $matches[1]
                Write-Host ""
                Write-Host "🔍 发现 DIRECT_URL (行 $($i + 1)):" -ForegroundColor Yellow
                Write-Host "   $($value.Substring(0, [Math]::Min(80, $value.Length)))..." -ForegroundColor Gray
            }
        }
    }
    
    Write-Host ""
    Write-Host "------------------------------------------------------------" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📊 统计:" -ForegroundColor Cyan
    Write-Host "   - DATABASE_URL 出现次数: $databaseUrlCount" -ForegroundColor White
    Write-Host "   - DIRECT_URL 出现次数: $(if ($directUrlFound) { 1 } else { 0 })" -ForegroundColor White
    
    if ($databaseUrlCount -gt 1) {
        Write-Host ""
        Write-Host "⚠️  警告: .env 文件中存在 $databaseUrlCount 个 DATABASE_URL 定义！" -ForegroundColor Red
        Write-Host "   通常只有最后一个会生效（取决于环境变量加载顺序）" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ 未找到 .env 文件: $envPath" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🔧 当前进程环境变量:" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 2. 检查进程环境变量
if ($env:DATABASE_URL) {
    Write-Host "✅ DATABASE_URL (进程环境变量):" -ForegroundColor Green
    $dbUrl = $env:DATABASE_URL
    if ($dbUrl.Length -gt 80) {
        Write-Host "   $($dbUrl.Substring(0, 80))..." -ForegroundColor Gray
    } else {
        Write-Host "   $dbUrl" -ForegroundColor Gray
    }
    Write-Host "   完整值: $dbUrl" -ForegroundColor DarkGray
} else {
    Write-Host "❌ DATABASE_URL: 未设置" -ForegroundColor Red
}

if ($env:DIRECT_URL) {
    Write-Host ""
    Write-Host "✅ DIRECT_URL (进程环境变量):" -ForegroundColor Green
    $directUrl = $env:DIRECT_URL
    if ($directUrl.Length -gt 80) {
        Write-Host "   $($directUrl.Substring(0, 80))..." -ForegroundColor Gray
    } else {
        Write-Host "   $directUrl" -ForegroundColor Gray
    }
    Write-Host "   完整值: $directUrl" -ForegroundColor DarkGray
} else {
    Write-Host ""
    Write-Host "❌ DIRECT_URL: 未设置" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "💡 代码使用情况:" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 3. 检查代码中的使用
$prismaPath = Join-Path $PSScriptRoot "src\lib\prisma.ts"
if (Test-Path $prismaPath) {
    $prismaContent = Get-Content $prismaPath -Raw
    Write-Host "📝 apps/server/src/lib/prisma.ts:" -ForegroundColor Yellow
    if ($prismaContent -match 'process\.env\.DATABASE_URL') {
        Write-Host "   ✓ 使用 process.env.DATABASE_URL" -ForegroundColor Green
        Write-Host "   ⚠️  这是 Prisma 实际使用的数据库连接！" -ForegroundColor Yellow
    }
    if ($prismaContent -match 'process\.env\.DIRECT_URL') {
        Write-Host "   ✓ 使用 process.env.DIRECT_URL" -ForegroundColor Green
    } else {
        Write-Host "   ✗ 未使用 DIRECT_URL" -ForegroundColor Gray
    }
}

$envConfigPath = Join-Path $PSScriptRoot "src\config\env.ts"
if (Test-Path $envConfigPath) {
    $envConfigContent = Get-Content $envConfigPath -Raw
    Write-Host ""
    Write-Host "📝 apps/server/src/config/env.ts:" -ForegroundColor Yellow
    if ($envConfigContent -match 'DATABASE_URL') {
        Write-Host "   ✓ 验证 DATABASE_URL（必需）" -ForegroundColor Green
    }
    if ($envConfigContent -match 'DIRECT_URL') {
        Write-Host "   ✓ 验证 DIRECT_URL" -ForegroundColor Green
    } else {
        Write-Host "   ✗ 未验证 DIRECT_URL（代码中未使用）" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "🎯 结论:" -ForegroundColor Cyan
Write-Host "   应用程序实际使用的是: DATABASE_URL" -ForegroundColor White
Write-Host "   DIRECT_URL 在代码中未被使用" -ForegroundColor Gray

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "📋 建议:" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. 如果 .env 文件中有多个 DATABASE_URL，建议只保留一个" -ForegroundColor White
Write-Host "2. 检查应用程序实际使用的是哪个变量（查看代码）" -ForegroundColor White
Write-Host "3. 在服务器上运行此脚本查看实际生效的配置" -ForegroundColor White
Write-Host "4. 检查启动脚本如何加载环境变量" -ForegroundColor White
Write-Host ""

