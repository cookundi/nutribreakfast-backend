// src/routes/payment.routes.js

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// Webhook (public - no auth required, verified by signature)
router.post('/webhook', paymentController.handleWebhook);

// Public verification
router.get('/verify/:reference', paymentController.verifyPayment);

// Protected routes (require authentication)
router.use(protect);

// Company payment routes
router.post('/initialize', paymentController.initializePayment);
router.get('/invoices', paymentController.getCompanyInvoices);
router.get('/invoices/:id', paymentController.getInvoice);
router.get('/spending-summary', paymentController.getSpendingSummary);

// Admin routes (add admin middleware later)
router.post('/generate-invoice', paymentController.generateInvoice);
router.post('/refund', paymentController.processRefund);
router.get('/statistics', paymentController.getPaymentStatistics);

module.exports = router;