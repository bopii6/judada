#!/usr/bin/env node

/**
 * 数据库配置诊断脚本
 * 用于检查哪个 DATABASE_URL 在生效
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('数据库配置诊断工具');
console.log('='.repeat(60));
console.log('');

// 1. 读取 .env 文件中的所有配置
const envPath = path.join(__dirname, '.env');
let envFileContent = '';
let envVars = {};

if (fs.existsSync(envPath)) {
  envFileContent = fs.readFileSync(envPath, 'utf-8');
  console.log('📄 从 .env 文件读取配置:');
  console.log('-'.repeat(60));
  
  // 解析 .env 文件
  const lines = envFileContent.split('\n');
  let databaseUrlCount = 0;
  let directUrlFound = false;
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        
        if (key === 'DATABASE_URL') {
          databaseUrlCount++;
          console.log(`\n🔍 发现第 ${databaseUrlCount} 个 DATABASE_URL (行 ${index + 1}):`);
          console.log(`   ${key}=${value.substring(0, 50)}...`);
          envVars[key] = value;
        } else if (key === 'DIRECT_URL') {
          directUrlFound = true;
          console.log(`\n🔍 发现 DIRECT_URL (行 ${index + 1}):`);
          console.log(`   ${key}=${value.substring(0, 50)}...`);
          envVars[key] = value;
        }
      }
    }
  });
  
  console.log('\n' + '-'.repeat(60));
  console.log(`\n📊 统计:`);
  console.log(`   - DATABASE_URL 出现次数: ${databaseUrlCount}`);
  console.log(`   - DIRECT_URL 出现次数: ${directUrlFound ? 1 : 0}`);
  
  if (databaseUrlCount > 1) {
    console.log(`\n⚠️  警告: .env 文件中存在 ${databaseUrlCount} 个 DATABASE_URL 定义！`);
    console.log(`   通常只有最后一个会生效（取决于环境变量加载顺序）`);
  }
} else {
  console.log('❌ 未找到 .env 文件:', envPath);
}

console.log('\n' + '='.repeat(60));
console.log('🔧 当前进程环境变量:');
console.log('='.repeat(60));

// 2. 检查实际进程环境变量
const processDatabaseUrl = process.env.DATABASE_URL;
const processDirectUrl = process.env.DIRECT_URL;

if (processDatabaseUrl) {
  console.log('\n✅ DATABASE_URL (进程环境变量):');
  console.log(`   ${processDatabaseUrl.substring(0, 80)}...`);
  console.log(`   完整值: ${processDatabaseUrl}`);
} else {
  console.log('\n❌ DATABASE_URL: 未设置');
}

if (processDirectUrl) {
  console.log('\n✅ DIRECT_URL (进程环境变量):');
  console.log(`   ${processDirectUrl.substring(0, 80)}...`);
  console.log(`   完整值: ${processDirectUrl}`);
} else {
  console.log('\n❌ DIRECT_URL: 未设置');
}

console.log('\n' + '='.repeat(60));
console.log('💡 代码使用情况分析:');
console.log('='.repeat(60));

// 3. 检查代码中如何使用
const prismaPath = path.join(__dirname, 'src/lib/prisma.ts');
if (fs.existsSync(prismaPath)) {
  const prismaContent = fs.readFileSync(prismaPath, 'utf-8');
  console.log('\n📝 apps/server/src/lib/prisma.ts 中的使用:');
  
  if (prismaContent.includes('process.env.DATABASE_URL')) {
    console.log('   ✓ 使用 process.env.DATABASE_URL');
    console.log('   ⚠️  这是 Prisma 实际使用的数据库连接！');
  }
  if (prismaContent.includes('process.env.DIRECT_URL')) {
    console.log('   ✓ 使用 process.env.DIRECT_URL');
  } else {
    console.log('   ✗ 未使用 DIRECT_URL');
  }
}

const envConfigPath = path.join(__dirname, 'src/config/env.ts');
if (fs.existsSync(envConfigPath)) {
  const envConfigContent = fs.readFileSync(envConfigPath, 'utf-8');
  console.log('\n📝 apps/server/src/config/env.ts 中的使用:');
  
  if (envConfigContent.includes('DATABASE_URL')) {
    console.log('   ✓ 验证 DATABASE_URL（必需）');
  }
  if (envConfigContent.includes('DIRECT_URL')) {
    console.log('   ✓ 验证 DIRECT_URL');
  } else {
    console.log('   ✗ 未验证 DIRECT_URL（代码中未使用）');
  }
}

console.log('\n🎯 结论:');
console.log('   应用程序实际使用的是: DATABASE_URL');
console.log('   DIRECT_URL 在代码中未被使用');

console.log('\n' + '='.repeat(60));
console.log('🧪 测试数据库连接:');
console.log('='.repeat(60));

// 4. 尝试连接数据库（如果可能）
if (processDatabaseUrl) {
  console.log('\n尝试使用 DATABASE_URL 连接数据库...');
  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: processDatabaseUrl,
      connectionTimeoutMillis: 5000,
    });
    
    client.connect()
      .then(() => {
        console.log('✅ DATABASE_URL 连接成功！');
        return client.query('SELECT current_database(), current_user, version()');
      })
      .then((result) => {
        console.log('   数据库信息:');
        console.log(`   - 数据库名: ${result.rows[0].current_database}`);
        console.log(`   - 用户: ${result.rows[0].current_user}`);
        console.log(`   - 版本: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
        client.end();
      })
      .catch((err) => {
        console.log('❌ DATABASE_URL 连接失败:', err.message);
      });
  } catch (err) {
    console.log('⚠️  无法测试连接 (可能需要安装 pg 包):', err.message);
  }
}

console.log('\n' + '='.repeat(60));
console.log('📋 建议:');
console.log('='.repeat(60));
console.log('');
console.log('1. 如果 .env 文件中有多个 DATABASE_URL，建议只保留一个');
console.log('2. 检查应用程序实际使用的是哪个变量（查看代码）');
console.log('3. 使用此脚本在服务器上运行，查看实际生效的配置');
console.log('4. 检查启动脚本（如 start-dev.ps1）如何加载环境变量');
console.log('');

