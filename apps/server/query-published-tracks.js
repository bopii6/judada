#!/usr/bin/env node

// 快速查询已上架歌曲的数据库信息

require('dotenv').config({ path: '../../.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error'],
});

async function queryTracks() {
  try {
    await prisma.$connect();
    
    // 获取数据库信息
    const dbInfo = await prisma.$queryRaw`SELECT current_database() as db_name, current_user as db_user, version() as db_version`;
    
    console.log('='.repeat(60));
    console.log('📊 数据库连接信息:');
    console.log('='.repeat(60));
    console.log(`数据库名: ${dbInfo[0].db_name}`);
    console.log(`数据库用户: ${dbInfo[0].db_user}`);
    console.log(`数据库版本: ${dbInfo[0].db_version.split(' ')[0]} ${dbInfo[0].db_version.split(' ')[1]}`);
    
    // 查询已上架歌曲
    const tracks = await prisma.musicTrack.findMany({
      where: { status: 'published' },
      select: {
        title: true,
        titleCn: true,
        slug: true,
        artist: true,
      },
      orderBy: { publishedAt: 'desc' }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log(`📀 已上架歌曲数量: ${tracks.length}`);
    console.log('='.repeat(60));
    
    if (tracks.length > 0) {
      tracks.forEach((t, i) => {
        console.log(`${i + 1}. ${t.title}${t.titleCn ? ` (${t.titleCn})` : ''} - ${t.slug}`);
      });
    }
    
    // 显示 DATABASE_URL 信息
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      const match = dbUrl.match(/@([^:]+):(\d+)\//);
      if (match) {
        console.log('\n' + '='.repeat(60));
        console.log('🔗 当前连接:');
        console.log('='.repeat(60));
        console.log(`主机: ${match[1]}`);
        console.log(`端口: ${match[2]}`);
        console.log(`连接类型: ${match[2] === '6543' ? 'Supabase Pooler' : match[2] === '5432' ? 'Direct Connection' : 'Unknown'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

queryTracks();





