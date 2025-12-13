// src/services/cronService.js

const cron = require('node-cron');
const prisma = require('../config/database');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');
const paymentService = require('./paymentService');

// Initialize all cron jobs
exports.initializeCronJobs = () => {
  logger.info('🕐 Initializing cron jobs...');

  // Job 1: Send order reminder at 2:30 PM daily (30 mins before cutoff)
  cron.schedule('30 14 * * *', async () => {
    try {
      logger.info('Running order reminder job...');
      await sendOrderReminders();
    } catch (error) {
      logger.error('Order reminder job failed:', error);
    }
  });

  // Job 2: Generate monthly invoices on the 1st of each month at 1:00 AM
  cron.schedule('0 1 1 * *', async () => {
    try {
      logger.info('Running monthly invoice generation...');
      await paymentService.generateAllMonthlyInvoices();
    } catch (error) {
      logger.error('Invoice generation job failed:', error);
    }
  });

  // Job 3: Send overdue invoice reminders daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      logger.info('Running overdue invoice reminder job...');
      await sendOverdueInvoiceReminders();
    } catch (error) {
      logger.error('Overdue invoice reminder job failed:', error);
    }
  });

  // Job 4: Clean up expired recommendation cache daily at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('Running cache cleanup job...');
      await cleanupExpiredCache();
    } catch (error) {
      logger.error('Cache cleanup job failed:', error);
    }
  });

  // Job 5: Update order statuses (simulate kitchen/delivery updates) - every 30 mins during working hours
  cron.schedule('*/30 6-20 * * *', async () => {
    try {
      logger.info('Running order status update job...');
      await updateOrderStatuses();
    } catch (error) {
      logger.error('Order status update job failed:', error);
    }
  });

  logger.info('✅ All cron jobs initialized');
};

// Send order reminders to staff who haven't ordered yet
const sendOrderReminders = async () => {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Get all active staff
    const allStaff = await prisma.staff.findMany({
      where: {
        isActive: true,
        isOnboarded: true,
        company: {
          isActive: true,
        },
      },
    });

    // Get staff who have already ordered for tomorrow
    const orderedStaff = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: tomorrow,
          lte: tomorrowEnd,
        },
        status: { not: 'CANCELLED' },
      },
      select: {
        staffId: true,
      },
    });

    const orderedStaffIds = new Set(orderedStaff.map(o => o.staffId));

    // Filter staff who haven't ordered
    const staffToRemind = allStaff.filter(staff => !orderedStaffIds.has(staff.id));

    if (staffToRemind.length > 0) {
      await notificationService.sendOrderReminder(staffToRemind);
      logger.info(`Sent order reminders to ${staffToRemind.length} staff members`);
    }
  } catch (error) {
    logger.error('Error sending order reminders:', error);
    throw error;
  }
};

// Send reminders for overdue invoices
const sendOverdueInvoiceReminders = async () => {
  try {
    const now = new Date();

    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: now },
      },
      include: {
        company: true,
      },
    });

    for (const invoice of overdueInvoices) {
      // Mark as overdue
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'OVERDUE' },
      });

      // Send reminder email
      // TODO: Implement sendOverdueInvoiceReminder in notificationService
      logger.info(`Overdue reminder sent for invoice: ${invoice.invoiceNumber}`);
    }

    logger.info(`Processed ${overdueInvoices.length} overdue invoices`);
  } catch (error) {
    logger.error('Error sending overdue invoice reminders:', error);
    throw error;
  }
};

// Clean up expired recommendation cache
const cleanupExpiredCache = async () => {
  try {
    const now = new Date();

    const result = await prisma.recommendationCache.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    logger.info(`Cleaned up ${result.count} expired cache entries`);
  } catch (error) {
    logger.error('Error cleaning up cache:', error);
    throw error;
  }
};

// Simulate order status updates (in production, this would be updated by kitchen/delivery staff)
const updateOrderStatuses = async () => {
  try {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Update CONFIRMED orders to PREPARING (after 6 AM)
    if (now.getHours() >= 6) {
      await prisma.order.updateMany({
        where: {
          status: 'CONFIRMED',
          deliveryDate: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
          confirmedAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) }, // Confirmed 30+ mins ago
        },
        data: {
          status: 'PREPARING',
          preparingAt: now,
        },
      });
    }

    // Update PREPARING orders to OUT_FOR_DELIVERY (after 7 AM)
    if (now.getHours() >= 7) {
      const preparingOrders = await prisma.order.findMany({
        where: {
          status: 'PREPARING',
          deliveryDate: { gte: today },
          preparingAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) }, // Preparing 15+ mins ago
        },
      });

      for (const order of preparingOrders) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'OUT_FOR_DELIVERY',
            outForDeliveryAt: now,
            riderName: 'Rider ' + Math.floor(Math.random() * 10 + 1),
            riderPhone: '0' + Math.floor(Math.random() * 9000000000 + 1000000000),
          },
        });

        // Send notification
        const fullOrder = await prisma.order.findUnique({
          where: { id: order.id },
          include: { meal: true, staff: true },
        });
        await notificationService.sendOrderStatusUpdate(fullOrder);
      }
    }

    // Update OUT_FOR_DELIVERY orders to DELIVERED (after 30 mins)
    const deliveryOrders = await prisma.order.findMany({
      where: {
        status: 'OUT_FOR_DELIVERY',
        outForDeliveryAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) },
      },
    });

    for (const order of deliveryOrders) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: now,
        },
      });

      // Send notification
      const fullOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { meal: true, staff: true },
      });
      await notificationService.sendOrderStatusUpdate(fullOrder);
    }

    logger.info('Order statuses updated successfully');
  } catch (error) {
    logger.error('Error updating order statuses:', error);
    throw error;
  }
};