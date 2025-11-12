import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config({ path: "../../.env" });

// 获取数据库URL
const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres.iijosxgofjfuujdetolp:Op5HojUp6uqC8txG@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connect_timeout=20&pool_timeout=30";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
  transactionOptions: {
    timeout: 30000, // 30秒事务超时
  }
});

export const getPrisma = () => prisma;
