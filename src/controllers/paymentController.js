// src/controllers/paymentController.js

const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const paymentService = require('../services/paymentService');
const logger = require('../utils/logger');

// @desc    Initialize payment for invoice
// @route   POST /api/v1/payments/initialize
// @access  Private (Company Admin)
exports.initializePayment = async (req, res, next) => {
  try {
    const { invoiceId } = req.body;

    // Get invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: true,
      },
    });

    if (!invoice) {
      return next(new AppError('Invoice not found', 404));
    }

    // Check if already paid
    if (invoice.status === 'PAID') {
      return next(new AppError('Invoice already paid', 400));
    }

    // Check if user's company matches invoice company
    if (invoice.companyId !== req.user.companyId) {
      return next(new AppError('You do not have permission to pay this invoice', 403));
    }

    // Initialize payment
    const paymentData = await paymentService.initializePayment(
      invoice.id,
      invoice.company.email,
      invoice.total / 100, // Convert from kobo to naira
      {
        company_name: invoice.company.name,
        invoice_number: invoice.invoiceNumber,
      }
    );

    res.status(200).json({
      status: 'success',
      data: {
        authorizationUrl: paymentData.authorizationUrl,
        accessCode: paymentData.accessCode,
        reference: paymentData.reference,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify payment
// @route   GET /api/v1/payments/verify/:reference
// @access  Public
exports.verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    // Verify with Paystack
    const paymentData = await paymentService.verifyPayment(reference);

    if (paymentData.status === 'success') {
      // Handle successful payment
      await paymentService.handleSuccessfulPayment(paymentData);
    }

    res.status(200).json({
      status: 'success',
      data: {
        paymentStatus: paymentData.status,
        amount: paymentData.amount,
        reference: paymentData.reference,
        paidAt: paymentData.paidAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Paystack webhook handler
// @route   POST /api/v1/payments/webhook
// @access  Public (Paystack only)
exports.handleWebhook = async (req, res, next) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-paystack-signature'];
    
    if (!paymentService.verifyWebhookSignature(req.body, signature)) {
      return next(new AppError('Invalid webhook signature', 401));
    }

    const event = req.body;

    logger.info(`Paystack webhook received: ${event.event}`);

    // Handle different webhook events
    switch (event.event) {
      case 'charge.success':
        await paymentService.handleSuccessfulPayment(event.data);
        break;

      case 'charge.failed':
        logger.warn(`Payment failed: ${event.data.reference}`);
        break;

      case 'refund.processed':
        logger.info(`Refund processed: ${event.data.id}`);
        break;

      default:
        logger.info(`Unhandled webhook event: ${event.event}`);
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    logger.error('Webhook error:', error);
    next(error);
  }
};

// @desc    Get all invoices for company
// @route   GET /api/v1/payments/invoices
// @access  Private (Company)
exports.getCompanyInvoices = async (req, res, next) => {
  try {
    const { status, year, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      companyId: req.user.companyId,
      ...(status && { status }),
      ...(year && { billingYear: parseInt(year) }),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          orders: {
            select: {
              id: true,
              orderNumber: true,
              price: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: parseInt(skip),
        take: parseInt(limit),
      }),
      prisma.invoice.count({ where }),
    ]);

    res.status(200).json({
      status: 'success',
      results: invoices.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: {
        invoices: invoices.map(inv => ({
          ...inv,
          subtotal: inv.subtotal / 100,
          tax: inv.tax / 100,
          total: inv.total / 100,
          orders: inv.orders.map(o => ({
            ...o,
            price: o.price / 100,
          })),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single invoice
// @route   GET /api/v1/payments/invoices/:id
// @access  Private (Company)
exports.getInvoice = async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        company: {
          select: {
            name: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        orders: {
          include: {
            meal: {
              select: {
                name: true,
                category: true,
              },
            },
            staff: {
              select: {
                name: true,
                staffCode: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return next(new AppError('Invoice not found', 404));
    }

    // Check permission
    if (invoice.companyId !== req.user.companyId) {
      return next(new AppError('You do not have permission to view this invoice', 403));
    }

    res.status(200).json({
      status: 'success',
      data: {
        invoice: {
          ...invoice,
          subtotal: invoice.subtotal / 100,
          tax: invoice.tax / 100,
          total: invoice.total / 100,
          orders: invoice.orders.map(o => ({
            ...o,
            price: o.price / 100,
          })),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get company spending summary
// @route   GET /api/v1/payments/spending-summary
// @access  Private (Company)
exports.getSpendingSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to current year if no dates provided
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate) : new Date();

    const summary = await paymentService.getCompanySpendingSummary(
      req.user.companyId,
      start,
      end
    );

    res.status(200).json({
      status: 'success',
      data: {
        summary,
        period: {
          startDate: start,
          endDate: end,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate invoice manually (Admin)
// @route   POST /api/v1/payments/generate-invoice
// @access  Private/Admin
exports.generateInvoice = async (req, res, next) => {
  try {
    const { companyId, month, year } = req.body;

    const invoice = await paymentService.generateMonthlyInvoice(
      companyId,
      month,
      year
    );

    if (!invoice) {
      return next(new AppError('No orders found for the specified period', 404));
    }

    res.status(201).json({
      status: 'success',
      data: {
        invoice: {
          ...invoice,
          subtotal: invoice.subtotal / 100,
          tax: invoice.tax / 100,
          total: invoice.total / 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Process refund (Admin)
// @route   POST /api/v1/payments/refund
// @access  Private/Admin
exports.processRefund = async (req, res, next) => {
  try {
    const { orderId, reason } = req.body;

    const refund = await paymentService.processRefund(orderId, reason);

    res.status(200).json({
      status: 'success',
      message: 'Refund processed successfully',
      data: { refund },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get payment statistics (Admin)
// @route   GET /api/v1/payments/statistics
// @access  Private/Admin
exports.getPaymentStatistics = async (req, res, next) => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get statistics
    const [
      totalRevenue,
      monthlyRevenue,
      pendingInvoices,
      paidInvoices,
      overdueInvoices,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { status: 'PAID' },
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: {
          status: 'PAID',
          paidAt: { gte: firstDayOfMonth },
        },
        _sum: { total: true },
      }),
      prisma.invoice.count({
        where: { status: 'PENDING' },
      }),
      prisma.invoice.count({
        where: { status: 'PAID' },
      }),
      prisma.invoice.count({
        where: {
          status: 'PENDING',
          dueDate: { lt: now },
        },
      }),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        totalRevenue: (totalRevenue._sum.total || 0) / 100,
        monthlyRevenue: (monthlyRevenue._sum.total || 0) / 100,
        pendingInvoices,
        paidInvoices,
        overdueInvoices,
      },
    });
  } catch (error) {
    next(error);
  }
};