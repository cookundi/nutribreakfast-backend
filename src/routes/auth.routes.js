// src/routes/auth.routes.js - ENHANCED VERSION

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// Staff routes
router.post('/register', validate(schemas.register), authController.register);
router.post('/login', validate(schemas.login), authController.login);

// Company Admin routes
router.post('/company/login', validate(schemas.login), authController.companyLogin);
router.post('/company/register', authController.createCompanyAccount);

// Super Admin routes
router.post('/admin/login', validate(schemas.login), authController.adminLogin);
router.post('/admin/create', protect, authController.createAdmin); // Only admins can create admins

// Common routes
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.getMe);
router.put('/change-password', protect, authController.changePassword);

module.exports = router;