// src/services/paymentService.js

const axios = require('axios');
const crypto = require('crypto');
const prisma = require('../config/database');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Paystack API headers
const paystackHeaders = {
  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
};

// Initialize payment
exports.initializePayment = async (invoiceId, email, amount, metadata = {}) => {
  try {
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email,
        amount: amount * 100, // Convert to kobo
        currency: 'NGN',
        reference: `INV-${invoiceId}-${Date.now()}`,
        callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
        metadata: {
          invoice_id: invoiceId,
          ...metadata,
        },
      },
      { headers: paystackHeaders }
    );

    logger.info(`Payment initialized for invoice: ${invoiceId}`);

    return {
      authorizationUrl: response.data.data.authorization_url,
      accessCode: response.data.data.access_code,
      reference: response.data.data.reference,
    };
  } catch (error) {
    logger.error('Paystack initialization error:', error.response?.data || error.message);
    throw new Error('Failed to initialize payment');
  }
};

// Verify payment
exports.verifyPayment = async (reference) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      { headers: paystackHeaders }
    );

    const data = response.data.data;

    logger.info(`Payment verified: ${reference} - Status: ${data.status}`);

    return {
      status: data.status,
      amount: data.amount / 100, // Convert from kobo
      reference: data.reference,
      paidAt: data.paid_at,
      metadata: data.metadata,
    };
  } catch (error) {
    logger.error('Paystack verification error:', error.response?.data || error.message);
    throw new Error('Failed to verify payment');
  }
};

// Verify webhook signature
exports.verifyWebhookSignature = (payload, signature) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  return hash === signature;
};

// Handle successful payment webhook
exports.handleSuccessfulPayment = async (paymentData) => {
  try {
    const { reference, amount, metadata } = paymentData;
    const invoiceId = metadata.invoice_id;

    // Update invoice
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paystackReference: reference,
      },
      include: {
        company: true,
        orders: true,
      },
    });

    // Update all orders in the invoice as paid
    await prisma.order.updateMany({
      where: { invoiceId },
      data: { isPaid: true, paidAt: new Date() },
    });

    logger.info(`Invoice ${invoice.invoiceNumber} marked as paid`);

    // Send confirmation email
    await notificationService.sendPaymentConfirmation(invoice);

    return invoice;
  } catch (error) {
    logger.error('Error handling successful payment:', error);
    throw error;
  }
};

// Generate monthly invoice for a company
exports.generateMonthlyInvoice = async (companyId, month, year) => {
  try {
    // Get all unpaid orders for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const orders = await prisma.order.findMany({
      where: {
        companyId,
        deliveryDate: {
          gte: startDate,
          lte: endDate,
        },
        status: 'DELIVERED',
        isPaid: false,
      },
    });

    if (orders.length === 0) {
      logger.info(`No orders to invoice for company ${companyId} for ${month}/${year}`);
      return null;
    }

    // Calculate totals
    const subtotal = orders.reduce((sum, order) => sum + order.price, 0);
    const tax = Math.round(subtotal * 0.075); // 7.5% VAT in Nigeria
    const total = subtotal + tax;

    // Get company details
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    // Generate invoice number
    const invoiceNumber = `INV-${company.companyCode}-${year}${month.toString().padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

    // Set due date (e.g., 14 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        companyId,
        billingMonth: month,
        billingYear: year,
        subtotal,
        tax,
        total,
        status: 'PENDING',
        dueDate,
      },
      include: {
        company: true,
      },
    });

    // Link orders to invoice
    await prisma.order.updateMany({
      where: {
        id: { in: orders.map(o => o.id) },
      },
      data: {
        invoiceId: invoice.id,
      },
    });

    logger.info(`Invoice generated: ${invoiceNumber} for ${orders.length} orders`);

    // Send invoice email
    await notificationService.sendMonthlyInvoice(invoice, company);

    return invoice;
  } catch (error) {
    logger.error('Error generating invoice:', error);
    throw error;
  }
};

// Generate invoices for all active companies
exports.generateAllMonthlyInvoices = async () => {
  try {
    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    const companies = await prisma.company.findMany({
      where: { isActive: true },
    });

    const invoices = [];

    for (const company of companies) {
      try {
        const invoice = await this.generateMonthlyInvoice(company.id, lastMonth, year);
        if (invoice) {
          invoices.push(invoice);
        }
      } catch (error) {
        logger.error(`Error generating invoice for company ${company.id}:`, error);
      }
    }

    logger.info(`Generated ${invoices.length} invoices for ${companies.length} companies`);

    return invoices;
  } catch (error) {
    logger.error('Error generating all invoices:', error);
    throw error;
  }
};

// Get company spending summary
exports.getCompanySpendingSummary = async (companyId, startDate, endDate) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        companyId,
        deliveryDate: {
          gte: startDate,
          lte: endDate,
        },
        status: { not: 'CANCELLED' },
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            staffCode: true,
          },
        },
        meal: {
          select: {
            name: true,
            category: true,
          },
        },
      },
    });

    // Calculate totals
    const totalSpent = orders.reduce((sum, order) => sum + order.price, 0);
    const totalOrders = orders.length;

    // Group by staff
    const staffSpending = orders.reduce((acc, order) => {
      const staffId = order.staffId;
      if (!acc[staffId]) {
        acc[staffId] = {
          staff: order.staff,
          totalSpent: 0,
          orderCount: 0,
          orders: [],
        };
      }
      acc[staffId].totalSpent += order.price;
      acc[staffId].orderCount += 1;
      acc[staffId].orders.push(order);
      return acc;
    }, {});

    // Group by month
    const monthlySpending = orders.reduce((acc, order) => {
      const month = new Date(order.deliveryDate).toLocaleString('default', { 
        month: 'short', 
        year: 'numeric' 
      });
      if (!acc[month]) {
        acc[month] = 0;
      }
      acc[month] += order.price;
      return acc;
    }, {});

    return {
      totalSpent: totalSpent / 100, // Convert to naira
      totalOrders,
      averageOrderValue: totalOrders > 0 ? (totalSpent / totalOrders) / 100 : 0,
      staffSpending: Object.values(staffSpending).map(s => ({
        ...s,
        totalSpent: s.totalSpent / 100,
      })),
      monthlySpending: Object.entries(monthlySpending).map(([month, amount]) => ({
        month,
        amount: amount / 100,
      })),
    };
  } catch (error) {
    logger.error('Error getting company spending summary:', error);
    throw error;
  }
};

// Process refund
exports.processRefund = async (orderId, reason) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        invoice: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (!order.isPaid || !order.invoice?.paystackReference) {
      throw new Error('Cannot refund unpaid order');
    }

    // Initiate refund via Paystack
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/refund`,
      {
        transaction: order.invoice.paystackReference,
        amount: order.price, // Amount in kobo
      },
      { headers: paystackHeaders }
    );

    logger.info(`Refund initiated for order ${order.orderNumber}: ${response.data.data.id}`);

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        notes: order.notes ? `${order.notes}\n\nRefund: ${reason}` : `Refund: ${reason}`,
      },
    });

    return {
      refundId: response.data.data.id,
      status: response.data.data.status,
      amount: response.data.data.amount / 100,
    };
  } catch (error) {
    logger.error('Error processing refund:', error.response?.data || error.message);
    throw new Error('Failed to process refund');
  }
};