// src/config/database.js

const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

// Test database connection
async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

process.on('beforeExit', async () => {
  await disconnectDatabase();
});

connectDatabase();

module.exports = prisma;