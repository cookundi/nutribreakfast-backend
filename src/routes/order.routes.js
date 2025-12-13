// src/routes/order.routes.js

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect, requireOnboarding, checkOrderCutoff } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// All routes require authentication
router.use(protect);

// Specific routes FIRST (before dynamic routes)
router.get('/today/all', orderController.getTodayOrders);

// Standard CRUD routes
router.post('/', requireOnboarding, checkOrderCutoff, validate(schemas.createOrder), orderController.createOrder);
router.get('/', requireOnboarding, orderController.getMyOrders);

// Dynamic routes LAST
router.get('/:id', requireOnboarding, orderController.getOrder);
router.delete('/:id', requireOnboarding, orderController.cancelOrder);
router.put('/:id/status', validate(schemas.updateOrderStatus), orderController.updateOrderStatus);

module.exports = router;