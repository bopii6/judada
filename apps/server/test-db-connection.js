require('dotenv').config({ path: '../../.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
    console.log('Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (hidden)' : 'NOT SET');

    try {
        await prisma.$connect();
        console.log('✅ Database connection successful!');

        const count = await prisma.musicTrack.count();
        console.log(`✅ Found ${count} music tracks`);

        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
}

testConnection();
