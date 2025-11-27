#!/usr/bin/env node

/**
 * 检查当前已上架歌曲连接的数据库
 */

require('dotenv').config({ path: '../../.env' });
const { PrismaClient } = require('@prisma/client');

// 解析数据库连接信息
function parseDatabaseUrl(url) {
  if (!url) return null;
  
  try {
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
    if (match) {
      return {
        username: match[1],
        host: match[3],
        port: match[4],
        database: match[5],
        fullUrl: url
      };
    }
  } catch (e) {
    // ignore
  }
  return null;
}

async function checkMusicDatabase() {
  console.log('='.repeat(60));
  console.log('检查已上架歌曲连接的数据库');
  console.log('='.repeat(60));
  console.log('');

  // 1. 显示当前使用的数据库配置
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  console.log('📋 环境变量配置:');
  console.log('-'.repeat(60));
  
  if (databaseUrl) {
    const dbInfo = parseDatabaseUrl(databaseUrl);
    console.log('\n✅ DATABASE_URL (当前使用):');
    if (dbInfo) {
      console.log(`   主机: ${dbInfo.host}`);
      console.log(`   端口: ${dbInfo.port}`);
      console.log(`   数据库: ${dbInfo.database}`);
      console.log(`   用户名: ${dbInfo.username}`);
      console.log(`   连接类型: ${dbInfo.port === '6543' ? 'Pooler (连接池)' : 'Direct (直接连接)'}`);
    } else {
      console.log(`   ${databaseUrl.substring(0, 80)}...`);
    }
  } else {
    console.log('\n❌ DATABASE_URL: 未设置');
  }

  if (directUrl) {
    const dbInfo = parseDatabaseUrl(directUrl);
    console.log('\n📝 DIRECT_URL (备用配置):');
    if (dbInfo) {
      console.log(`   主机: ${dbInfo.host}`);
      console.log(`   端口: ${dbInfo.port}`);
      console.log(`   数据库: ${dbInfo.database}`);
      console.log(`   用户名: ${dbInfo.username}`);
    } else {
      console.log(`   ${directUrl.substring(0, 80)}...`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🔍 测试数据库连接并查询已上架歌曲...');
  console.log('='.repeat(60));
  console.log('');

  // 2. 创建 Prisma 客户端
  const prisma = new PrismaClient({
    log: ['error'],
  });

  try {
    // 测试连接
    await prisma.$connect();
    console.log('✅ 数据库连接成功！');
    console.log('');

    // 查询已上架的歌曲
    const publishedTracks = await prisma.musicTrack.findMany({
      where: {
        status: 'published'
      },
      select: {
        id: true,
        title: true,
        titleCn: true,
        slug: true,
        artist: true,
        status: true,
        publishedAt: true,
        createdAt: true,
      },
      orderBy: {
        publishedAt: 'desc'
      }
    });

    console.log(`📊 已上架歌曲数量: ${publishedTracks.length}`);
    console.log('');

    if (publishedTracks.length > 0) {
      console.log('已上架歌曲列表:');
      console.log('-'.repeat(60));
      publishedTracks.forEach((track, index) => {
        console.log(`${index + 1}. ${track.title}${track.titleCn ? ` (${track.titleCn})` : ''}`);
        console.log(`   Slug: ${track.slug}`);
        console.log(`   演唱者: ${track.artist || '--'}`);
        console.log(`   发布时间: ${track.publishedAt ? new Date(track.publishedAt).toLocaleString('zh-CN') : '--'}`);
        console.log('');
      });
    } else {
      console.log('⚠️  未找到已上架的歌曲');
    }

    // 查询所有状态的歌曲统计
    const allTracks = await prisma.musicTrack.groupBy({
      by: ['status'],
      _count: true
    });

    console.log('='.repeat(60));
    console.log('📈 歌曲状态统计:');
    console.log('-'.repeat(60));
    allTracks.forEach(stat => {
      console.log(`   ${stat.status}: ${stat._count} 首`);
    });

    // 获取数据库信息
    const dbVersion = await prisma.$queryRaw`SELECT version()`;
    console.log('\n' + '='.repeat(60));
    console.log('💾 数据库信息:');
    console.log('-'.repeat(60));
    if (dbVersion && dbVersion[0]) {
      const version = dbVersion[0].version;
      console.log(`   版本: ${version.split(' ')[0]} ${version.split(' ')[1]}`);
    }

    const dbName = await prisma.$queryRaw`SELECT current_database()`;
    if (dbName && dbName[0]) {
      console.log(`   当前数据库: ${dbName[0].current_database}`);
    }

    const dbUser = await prisma.$queryRaw`SELECT current_user`;
    if (dbUser && dbUser[0]) {
      console.log(`   当前用户: ${dbUser[0].current_user}`);
    }

  } catch (error) {
    console.error('❌ 数据库操作失败:', error.message);
    console.error('');
    console.error('错误详情:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 检查完成');
  console.log('='.repeat(60));
}

checkMusicDatabase().catch(console.error);



