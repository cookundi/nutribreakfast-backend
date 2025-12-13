// src/routes/user.routes.js

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, requireOnboarding } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// All routes require authentication
router.use(protect);

// Profile routes
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);

// Health profile routes
router.get('/health-profile', userController.getHealthProfile);
router.put('/health-profile', validate(schemas.healthProfile), userController.updateHealthProfile);

// Spending and order history
router.get('/spending', requireOnboarding, userController.getSpendingSummary);
router.get('/orders', requireOnboarding, userController.getOrderHistory);

module.exports = router;