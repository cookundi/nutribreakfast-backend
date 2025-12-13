// src/controllers/orderController.js

const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const notificationService = require('../services/notificationService');

// Helper: Generate unique order number
const generateOrderNumber = () => {
  const prefix = 'NB';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}-${random}`;
};

// @desc    Place new order
// @route   POST /api/v1/orders
// @access  Private
exports.createOrder = async (req, res, next) => {
  try {
    const { mealId, quantity = 1, deliveryDate, deliveryAddress, notes } = req.body;

    // 1. Check if user is onboarded
    if (!req.user.isOnboarded) {
      return next(new AppError('Please complete your health profile first', 400));
    }

    // 2. Verify meal exists and is available
    const meal = await prisma.meal.findUnique({
      where: { id: mealId },
    });

    if (!meal) {
      return next(new AppError('Meal not found', 404));
    }

    if (!meal.isAvailable) {
      return next(new AppError('This meal is currently unavailable', 400));
    }

    // 3. Check if delivery date is valid (must be tomorrow or later)
    const deliveryDateTime = new Date(deliveryDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    if (deliveryDateTime < tomorrow) {
      return next(new AppError('Delivery date must be tomorrow or later', 400));
    }

    // 4. Check if meal is available on that day
    const dayOfWeek = deliveryDateTime.getDay();
    if (!meal.availableDays.includes(dayOfWeek)) {
      return next(new AppError('This meal is not available on the selected day', 400));
    }

    // 5. Check capacity
    if (meal.maxDailyCapacity) {
      const startOfDay = new Date(deliveryDateTime);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(deliveryDateTime);
      endOfDay.setHours(23, 59, 59, 999);

      const ordersCount = await prisma.order.count({
        where: {
          mealId,
          deliveryDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: { not: 'CANCELLED' },
        },
      });

      if (ordersCount >= meal.maxDailyCapacity) {
        return next(new AppError('Sorry, this meal has reached its capacity for the selected date', 400));
      }
    }

    // 6. Calculate price
    const totalPrice = meal.basePrice * quantity;

    // 7. Create order
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        staffId: req.user.id,
        companyId: req.user.companyId,
        mealId,
        quantity,
        price: totalPrice,
        deliveryDate: deliveryDateTime,
        deliveryAddress,
        notes,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
      include: {
        meal: {
          select: {
            name: true,
            imageUrl: true,
            category: true,
          },
        },
      },
    });

    logger.info(`Order created: ${order.orderNumber} by ${req.user.email}`);

    // 8. Send notification
    await notificationService.sendOrderConfirmation(order, req.user);

    res.status(201).json({
      status: 'success',
      data: {
        order: {
          ...order,
          price: order.price / 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all orders for logged in user
// @route   GET /api/v1/orders
// @access  Private
exports.getMyOrders = async (req, res, next) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      staffId: req.user.id,
      ...(status && { status }),
      ...(startDate && endDate && {
        deliveryDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
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
          ...order,
          price: order.price / 100,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/v1/orders/:id
// @access  Private
exports.getOrder = async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        meal: true,
        staff: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        company: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check if user owns this order
    if (order.staffId !== req.user.id) {
      return next(new AppError('You do not have permission to view this order', 403));
    }

    res.status(200).json({
      status: 'success',
      data: {
        order: {
          ...order,
          price: order.price / 100,
          meal: {
            ...order.meal,
            basePrice: order.meal.basePrice / 100,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status (Admin/Kitchen)
// @route   PUT /api/v1/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, riderId, riderName, riderPhone } = req.body;

    const updateData = { status };

    // Set timestamps based on status
    switch (status) {
      case 'CONFIRMED':
        updateData.confirmedAt = new Date();
        break;
      case 'PREPARING':
        updateData.preparingAt = new Date();
        break;
      case 'OUT_FOR_DELIVERY':
        updateData.outForDeliveryAt = new Date();
        if (riderId) updateData.riderId = riderId;
        if (riderName) updateData.riderName = riderName;
        if (riderPhone) updateData.riderPhone = riderPhone;
        break;
      case 'DELIVERED':
        updateData.deliveredAt = new Date();
        break;
      case 'CANCELLED':
        updateData.cancelledAt = new Date();
        break;
    }

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        meal: true,
        staff: true,
      },
    });

    logger.info(`Order ${order.orderNumber} status updated to ${status}`);

    // Send notification
    await notificationService.sendOrderStatusUpdate(order);

    res.status(200).json({
      status: 'success',
      data: {
        order: {
          ...order,
          price: order.price / 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel order
// @route   DELETE /api/v1/orders/:id
// @access  Private
exports.cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check ownership
    if (order.staffId !== req.user.id) {
      return next(new AppError('You do not have permission to cancel this order', 403));
    }

    // Check if order can be cancelled (only if not yet preparing)
    if (['PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status)) {
      return next(new AppError('Cannot cancel order at this stage', 400));
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    logger.info(`Order cancelled: ${updatedOrder.orderNumber}`);

    res.status(200).json({
      status: 'success',
      message: 'Order cancelled successfully',
      data: {
        order: {
          ...updatedOrder,
          price: updatedOrder.price / 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get today's orders (for kitchen/admin)
// @route   GET /api/v1/orders/today
// @access  Private/Admin
exports.getTodayOrders = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: today,
          lt: tomorrow,
        },
        status: { not: 'CANCELLED' },
      },
      include: {
        meal: true,
        staff: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by meal for kitchen prep
    const groupedByMeal = orders.reduce((acc, order) => {
      const mealId = order.mealId;
      if (!acc[mealId]) {
        acc[mealId] = {
          meal: order.meal,
          totalQuantity: 0,
          orders: [],
        };
      }
      acc[mealId].totalQuantity += order.quantity;
      acc[mealId].orders.push(order);
      return acc;
    }, {});

    res.status(200).json({
      status: 'success',
      results: orders.length,
      data: {
        orders,
        groupedByMeal: Object.values(groupedByMeal),
      },
    });
  } catch (error) {
    next(error);
  }
};