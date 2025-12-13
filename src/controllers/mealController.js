// src/controllers/mealController.js

const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

// @desc    Get all meals
// @route   GET /api/v1/meals
// @access  Public
exports.getAllMeals = async (req, res, next) => {
  try {
    const { category, isAvailable, search } = req.query;

    const where = {
      ...(category && { category }),
      ...(isAvailable !== undefined && { isAvailable: isAvailable === 'true' }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const meals = await prisma.meal.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    res.status(200).json({
      status: 'success',
      results: meals.length,
      data: {
        meals: meals.map(meal => ({
          ...meal,
          basePrice: meal.basePrice / 100, // Convert to naira
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single meal
// @route   GET /api/v1/meals/:id
// @access  Public
exports.getMeal = async (req, res, next) => {
  try {
    const meal = await prisma.meal.findUnique({
      where: { id: req.params.id },
    });

    if (!meal) {
      return next(new AppError('Meal not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        meal: {
          ...meal,
          basePrice: meal.basePrice / 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get personalized meal recommendations
// @route   GET /api/v1/meals/recommendations
// @access  Private
exports.getRecommendations = async (req, res, next) => {
  try {
    // Check if user is onboarded
    if (!req.user.isOnboarded) {
      return next(new AppError('Please complete your health profile to get recommendations', 400));
    }

    // Get recommendations from AI service
    const recommendations = await aiService.getRecommendations(req.user.id);

    // Get full meal details
    const mealIds = recommendations.map(r => r.mealId);
    const meals = await prisma.meal.findMany({
      where: {
        id: { in: mealIds },
      },
    });

    // Combine recommendations with meal details
    const recommendedMeals = recommendations.map(rec => {
      const meal = meals.find(m => m.id === rec.mealId);
      return {
        ...meal,
        basePrice: meal.basePrice / 100,
        recommendationScore: rec.score,
        rank: rec.rank,
      };
    });

    res.status(200).json({
      status: 'success',
      results: recommendedMeals.length,
      data: {
        recommendations: recommendedMeals,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new meal (Admin only)
// @route   POST /api/v1/meals
// @access  Private/Admin
exports.createMeal = async (req, res, next) => {
  try {
    const {
      name,
      description,
      category,
      cuisine,
      calories,
      protein,
      carbs,
      fats,
      fiber,
      sugar,
      sodium,
      ingredients,
      allergens,
      basePrice,
      isAvailable,
      availableDays,
      maxDailyCapacity,
      imageUrl,
      tags,
      suitableFor,
    } = req.body;

    // Convert price to kobo
    const priceInKobo = basePrice * 100;

    const meal = await prisma.meal.create({
      data: {
        name,
        description,
        category,
        cuisine,
        calories,
        protein,
        carbs,
        fats,
        fiber,
        sugar,
        sodium,
        ingredients,
        allergens,
        basePrice: priceInKobo,
        isAvailable,
        availableDays,
        maxDailyCapacity,
        imageUrl,
        tags,
        suitableFor,
      },
    });

    logger.info(`New meal created: ${meal.name}`);

    res.status(201).json({
      status: 'success',
      data: {
        meal: {
          ...meal,
          basePrice: meal.basePrice / 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update meal
// @route   PUT /api/v1/meals/:id
// @access  Private/Admin
exports.updateMeal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Convert price to kobo if provided
    if (updateData.basePrice) {
      updateData.basePrice = updateData.basePrice * 100;
    }

    const meal = await prisma.meal.update({
      where: { id },
      data: updateData,
    });

    logger.info(`Meal updated: ${meal.name}`);

    res.status(200).json({
      status: 'success',
      data: {
        meal: {
          ...meal,
          basePrice: meal.basePrice / 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete meal
// @route   DELETE /api/v1/meals/:id
// @access  Private/Admin
exports.deleteMeal = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.meal.delete({
      where: { id },
    });

    logger.info(`Meal deleted: ${id}`);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check meal availability for a date
// @route   GET /api/v1/meals/:id/availability
// @access  Public
exports.checkAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    const meal = await prisma.meal.findUnique({
      where: { id },
    });

    if (!meal) {
      return next(new AppError('Meal not found', 404));
    }

    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay();

    // Check if meal is available on this day
    const isAvailableOnDay = meal.availableDays.includes(dayOfWeek);

    // Check current orders for this meal on this date
    const startOfDay = new Date(requestedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(requestedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const ordersCount = await prisma.order.count({
      where: {
        mealId: id,
        deliveryDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          not: 'CANCELLED',
        },
      },
    });

    const capacityReached = meal.maxDailyCapacity ? ordersCount >= meal.maxDailyCapacity : false;

    res.status(200).json({
      status: 'success',
      data: {
        isAvailable: meal.isAvailable && isAvailableOnDay && !capacityReached,
        isAvailableOnDay,
        capacityReached,
        currentOrders: ordersCount,
        maxCapacity: meal.maxDailyCapacity,
      },
    });
  } catch (error) {
    next(error);
  }
};