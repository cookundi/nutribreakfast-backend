// src/routes/meal.routes.js

const express = require('express');
const router = express.Router();
const mealController = require('../controllers/mealController');
const { protect, requireOnboarding } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

// Public routes
router.get('/', mealController.getAllMeals);

// Protected routes - IMPORTANT: specific routes BEFORE dynamic routes
router.get('/recommendations/me', protect, requireOnboarding, mealController.getRecommendations);

// Dynamic routes (must come AFTER specific routes)
router.get('/:id', mealController.getMeal);
router.get('/:id/availability', mealController.checkAvailability);

// Admin routes (add admin middleware when ready)
router.post('/', protect, validate(schemas.createMeal), mealController.createMeal);
router.put('/:id', protect, mealController.updateMeal);
router.delete('/:id', protect, mealController.deleteMeal);

module.exports = router;