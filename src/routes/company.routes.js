// src/routes/company.routes.js

const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { protect } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// Admin routes
router.post('/', protect, validate(schemas.createCompany), companyController.createCompany);
router.get('/', protect, companyController.getAllCompanies);

// Company-specific routes (require authentication)
router.use(protect);

router.get('/:id', companyController.getCompany);
router.put('/:id', companyController.updateCompany);
router.delete('/:id', companyController.deactivateCompany);

// Company data routes
router.get('/:id/staff', companyController.getCompanyStaff);
router.get('/:id/orders', companyController.getCompanyOrders);
router.get('/:id/statistics', companyController.getCompanyStatistics);

module.exports = router;