// src/controllers/userController.js

const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// @desc    Get user profile
// @route   GET /api/v1/users/profile
// @access  Private
exports.getProfile = async (req, res, next) => {
  try {
    const user = await prisma.staff.findUnique({
      where: { id: req.user.id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            companyCode: true,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        staffCode: true,
        isOnboarded: true,
        createdAt: true,
        company: true,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/v1/users/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;

    const updatedUser = await prisma.staff.update({
      where: { id: req.user.id },
      data: {
        name,
        phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        staffCode: true,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get health profile
// @route   GET /api/v1/users/health-profile
// @access  Private
exports.getHealthProfile = async (req, res, next) => {
  try {
    const healthProfile = await prisma.staff.findUnique({
      where: { id: req.user.id },
      select: {
        age: true,
        weight: true,
        height: true,
        gender: true,
        bloodType: true,
        allergies: true,
        medicalConditions: true,
        dietaryRestrictions: true,
        activityLevel: true,
        healthGoal: true,
        dislikedFoods: true,
        preferredCuisines: true,
        isOnboarded: true,
      },
    });

    // Calculate BMI if height and weight exist
    let bmi = null;
    if (healthProfile.height && healthProfile.weight) {
      const heightInMeters = healthProfile.height / 100;
      bmi = (healthProfile.weight / (heightInMeters * heightInMeters)).toFixed(1);
    }

    res.status(200).json({
      status: 'success',
      data: {
        healthProfile: {
          ...healthProfile,
          bmi,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update/Complete health profile (onboarding)
// @route   PUT /api/v1/users/health-profile
// @access  Private
exports.updateHealthProfile = async (req, res, next) => {
  try {
    const {
      age,
      weight,
      height,
      gender,
      bloodType,
      allergies,
      medicalConditions,
      dietaryRestrictions,
      activityLevel,
      healthGoal,
      dislikedFoods,
      preferredCuisines,
    } = req.body;

    const updatedProfile = await prisma.staff.update({
      where: { id: req.user.id },
      data: {
        age,
        weight,
        height,
        gender,
        bloodType,
        allergies,
        medicalConditions,
        dietaryRestrictions,
        activityLevel,
        healthGoal,
        dislikedFoods,
        preferredCuisines,
        isOnboarded: true, // Mark as onboarded once health profile is complete
      },
      select: {
        age: true,
        weight: true,
        height: true,
        gender: true,
        bloodType: true,
        allergies: true,
        medicalConditions: true,
        dietaryRestrictions: true,
        activityLevel: true,
        healthGoal: true,
        dislikedFoods: true,
        preferredCuisines: true,
        isOnboarded: true,
      },
    });

    // Clear recommendation cache when health profile is updated
    await prisma.recommendationCache.deleteMany({
      where: { staffId: req.user.id },
    });

    logger.info(`Health profile updated for user: ${req.user.email}`);

    res.status(200).json({
      status: 'success',
      message: 'Health profile updated successfully',
      data: { healthProfile: updatedProfile },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get monthly spending summary
// @route   GET /api/v1/users/spending
// @access  Private
exports.getSpendingSummary = async (req, res, next) => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get all orders for current month
    const orders = await prisma.order.findMany({
      where: {
        staffId: req.user.id,
        createdAt: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth,
        },
        status: {
          not: 'CANCELLED',
        },
      },
      include: {
        meal: {
          select: {
            name: true,
            imageUrl: true,
          },
        },
      },
    });

    // Calculate total spending
    const totalSpent = orders.reduce((sum, order) => sum + order.price, 0);
    const totalOrders = orders.length;

    // Group by status
    const ordersByStatus = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      status: 'success',
      data: {
        month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
        totalSpent: totalSpent / 100, // Convert from kobo to naira
        totalOrders,
        ordersByStatus,
        recentOrders: orders.slice(0, 5).map(order => ({
          id: order.id,
          mealName: order.meal.name,
          price: order.price / 100,
          status: order.status,
          date: order.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get order history
// @route   GET /api/v1/users/orders
// @access  Private
exports.getOrderHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      staffId: req.user.id,
      ...(status && { status }),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          meal: {
            select: {
              name: true,
              imageUrl: true,
              category: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: parseInt(skip),
        take: parseInt(limit),
      }),
      prisma.order.count({ where }),
    ]);

    res.status(200).json({
      status: 'success',
      results: orders.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: {
        orders: orders.map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          meal: order.meal,
          quantity: order.quantity,
          price: order.price / 100, // Convert to naira
          status: order.status,
          deliveryDate: order.deliveryDate,
          deliveredAt: order.deliveredAt,
          createdAt: order.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};