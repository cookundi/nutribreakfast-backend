// src/controllers/companyController.js

const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Helper: Generate unique company code
const generateCompanyCode = () => {
  const prefix = 'COMP';
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}${random}`;
};

// @desc    Create new company
// @route   POST /api/v1/companies
// @access  Private/Admin
exports.createCompany = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      paymentModel,
      subsidyPercent,
      billingDay,
    } = req.body;

    // Check if company email already exists
    const existingCompany = await prisma.company.findUnique({
      where: { email },
    });

    if (existingCompany) {
      return next(new AppError('Company with this email already exists', 400));
    }

    // Generate unique company code
    let companyCode;
    let codeExists = true;
    
    while (codeExists) {
      companyCode = generateCompanyCode();
      const existing = await prisma.company.findUnique({
        where: { companyCode },
      });
      codeExists = !!existing;
    }

    // Create company
    const company = await prisma.company.create({
      data: {
        name,
        email,
        phone,
        address,
        companyCode,
        paymentModel: paymentModel || 'COMPANY_PAYS_ALL',
        subsidyPercent,
        billingDay: billingDay || 1,
      },
    });

    logger.info(`New company created: ${company.name} (${company.companyCode})`);

    res.status(201).json({
      status: 'success',
      data: { company },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get company details
// @route   GET /api/v1/companies/:id
// @access  Private
exports.getCompany = async (req, res, next) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            staff: true,
            orders: true,
            invoices: true,
          },
        },
      },
    });

    if (!company) {
      return next(new AppError('Company not found', 404));
    }

    // Check permission
    if (req.user.companyId !== company.id) {
      return next(new AppError('You do not have permission to view this company', 403));
    }

    res.status(200).json({
      status: 'success',
      data: { company },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all companies (Admin)
// @route   GET /api/v1/companies
// @access  Private/Admin
exports.getAllCompanies = async (req, res, next) => {
  try {
    const { isActive, search, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const where = {
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { companyCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        include: {
          _count: {
            select: {
              staff: true,
              orders: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: parseInt(skip),
        take: parseInt(limit),
      }),
      prisma.company.count({ where }),
    ]);

    res.status(200).json({
      status: 'success',
      results: companies.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: { companies },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update company
// @route   PUT /api/v1/companies/:id
// @access  Private/Admin
exports.updateCompany = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Prevent updating companyCode
    delete updateData.companyCode;

    const company = await prisma.company.update({
      where: { id },
      data: updateData,
    });

    logger.info(`Company updated: ${company.name}`);

    res.status(200).json({
      status: 'success',
      data: { company },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Deactivate company
// @route   DELETE /api/v1/companies/:id
// @access  Private/Admin
exports.deactivateCompany = async (req, res, next) => {
  try {
    const { id } = req.params;

    const company = await prisma.company.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info(`Company deactivated: ${company.name}`);

    res.status(200).json({
      status: 'success',
      message: 'Company deactivated successfully',
      data: { company },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get company staff members
// @route   GET /api/v1/companies/:id/staff
// @access  Private
exports.getCompanyStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, search, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Check permission
    if (req.user.companyId !== id) {
      return next(new AppError('You do not have permission to view this data', 403));
    }

    const where = {
      companyId: id,
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { staffCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [staff, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          staffCode: true,
          isActive: true,
          isOnboarded: true,
          lastLogin: true,
          createdAt: true,
        },
        orderBy: {
          name: 'asc',
        },
        skip: parseInt(skip),
        take: parseInt(limit),
      }),
      prisma.staff.count({ where }),
    ]);

    res.status(200).json({
      status: 'success',
      results: staff.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: { staff },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get company orders
// @route   GET /api/v1/companies/:id/orders
// @access  Private
exports.getCompanyOrders = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Check permission
    if (req.user.companyId !== id) {
      return next(new AppError('You do not have permission to view this data', 403));
    }

    const where = {
      companyId: id,
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

// @desc    Get company dashboard statistics
// @route   GET /api/v1/companies/:id/statistics
// @access  Private
exports.getCompanyStatistics = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check permission
    if (req.user.companyId !== id) {
      return next(new AppError('You do not have permission to view this data', 403));
    }

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalStaff,
      activeStaff,
      onboardedStaff,
      monthlyOrders,
      monthlySpending,
      yearlySpending,
      pendingOrders,
    ] = await Promise.all([
      prisma.staff.count({
        where: { companyId: id },
      }),
      prisma.staff.count({
        where: { companyId: id, isActive: true },
      }),
      prisma.staff.count({
        where: { companyId: id, isOnboarded: true },
      }),
      prisma.order.count({
        where: {
          companyId: id,
          createdAt: { gte: firstDayOfMonth },
          status: { not: 'CANCELLED' },
        },
      }),
      prisma.order.aggregate({
        where: {
          companyId: id,
          createdAt: { gte: firstDayOfMonth },
          status: { not: 'CANCELLED' },
        },
        _sum: { price: true },
      }),
      prisma.order.aggregate({
        where: {
          companyId: id,
          createdAt: { gte: firstDayOfYear },
          status: { not: 'CANCELLED' },
        },
        _sum: { price: true },
      }),
      prisma.order.count({
        where: {
          companyId: id,
          status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'] },
        },
      }),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        staff: {
          total: totalStaff,
          active: activeStaff,
          onboarded: onboardedStaff,
        },
        orders: {
          thisMonth: monthlyOrders,
          pending: pendingOrders,
        },
        spending: {
          thisMonth: (monthlySpending._sum.price || 0) / 100,
          thisYear: (yearlySpending._sum.price || 0) / 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};