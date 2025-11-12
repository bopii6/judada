import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config({ path: "../../.env" });

// 强制使用正确的数据库URL，覆盖所有可能的缓存问题
const databaseUrl = "postgresql://postgres.iijosxgofjfuujdetolp:Op5HojUp6uqC8txG@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connect_timeout=20&pool_timeout=30";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
  log: ['warn', 'error'],
  transactionOptions: {
    timeout: 30000, // 30秒事务超时
    isolationLevel: 'ReadCommitted'
  },
  // 优化连接池配置
  __internal: {
    engine: {
      // 连接池配置 - 增加连接数和超时
      connectionLimit: 5, // 减少连接数，避免超过Supabase限制
      poolTimeout: 30000, // 增加到30秒
      // 启用连接重用
      idleTimeout: 60000, // 增加空闲超时
      // 心跳检查
      keepAlive: true
    }
  }
});

export const getPrisma = () => prisma;
