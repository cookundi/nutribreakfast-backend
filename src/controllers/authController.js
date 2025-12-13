// src/controllers/authController.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Helper function to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });
};

// Helper function to send token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  // Remove password from output
  const { password, ...userWithoutPassword } = user;

  res.status(statusCode).json({
    status: 'success',
    token,
    refreshToken,
    data: {
      user: userWithoutPassword,
    },
  });
};

// @desc    Register new staff member
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { email, password, name, phone, companyCode, staffCode } = req.body;

    // 1. Check if user already exists
    const existingUser = await prisma.staff.findUnique({
      where: { email },
    });

    if (existingUser) {
      return next(new AppError('Email already registered', 400));
    }

    // 2. Verify company code
    const company = await prisma.company.findUnique({
      where: { companyCode },
    });

    if (!company) {
      return next(new AppError('Invalid company code', 400));
    }

    if (!company.isActive) {
      return next(new AppError('Company account is inactive', 400));
    }

    // 3. Check if staff code is already used in this company
    const existingStaff = await prisma.staff.findFirst({
      where: {
        companyId: company.id,
        staffCode,
      },
    });

    if (existingStaff) {
      return next(new AppError('Staff code already in use for this company', 400));
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // 5. Create user
    const user = await prisma.staff.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        staffCode,
        companyId: company.id,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            companyCode: true,
          },
        },
      },
    });

    logger.info(`New user registered: ${email}`);

    // 6. Send token response
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Login staff member
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Find user by email
    const user = await prisma.staff.findUnique({
      where: { email },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            companyCode: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) {
      return next(new AppError('Invalid email or password', 401));
    }

    // 2. Check if user is active
    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated', 401));
    }

    // 3. Check if company is active
    if (!user.company.isActive) {
      return next(new AppError('Company account is inactive', 401));
    }

    // 4. Check password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return next(new AppError('Invalid email or password', 401));
    }

    // 5. Update last login
    await prisma.staff.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    logger.info(`User logged in: ${email}`);

    // 6. Send token response
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token
// @route   POST /api/v1/auth/refresh-token
// @access  Public
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      logger.error('No refresh token provided');
      return next(new AppError('Refresh token is required', 400));
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      logger.error('JWT verification failed:', err.message);
      return next(new AppError('Invalid refresh token', 401));
    }

    // Get user
    const user = await prisma.staff.findUnique({
      where: { id: decoded.id },
      include: {
        company: true,
      },
    });

    if (!user) {
      logger.error('User not found for decoded id:', decoded.id);
      return next(new AppError('User not found', 401));
    }

    if (!user.isActive) {
      logger.error('User account is inactive:', user.email);
      return next(new AppError('User account is inactive', 401));
    }

    logger.info('Token refreshed successfully for user:', user.email);

    // Generate new tokens
    sendTokenResponse(user, 200, res);
  } catch (error) {
    logger.error('Refresh token error:', error);
    return next(new AppError('Invalid refresh token', 401));
  }
};

// @desc    Logout staff member
// @route   POST /api/v1/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    // In a real application, you might want to:
    // 1. Blacklist the token
    // 2. Clear refresh token from database
    // For now, we'll just send a success response
    
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await prisma.staff.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        staffCode: true,
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
        lastLogin: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
            companyCode: true,
            paymentModel: true,
          },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/v1/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await prisma.staff.findUnique({
      where: { id: req.user.id },
    });

    // Check current password
    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordCorrect) {
      return next(new AppError('Current password is incorrect', 401));
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.staff.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Company Admin Login
// @route   POST /api/v1/auth/company/login
// @access  Public
exports.companyLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const company = await prisma.company.findUnique({
      where: { email },
    });

    if (!company) {
      return next(new AppError('Invalid email or password', 401));
    }

    if (!company.isActive) {
      return next(new AppError('Company account is inactive', 401));
    }

    const isPasswordCorrect = await bcrypt.compare(password, company.password);

    if (!isPasswordCorrect) {
      return next(new AppError('Invalid email or password', 401));
    }

    logger.info(`Company admin logged in: ${email}`);

    // Generate tokens for company
    const token = generateToken(company.id);
    const refreshToken = generateRefreshToken(company.id);

    const { password: pwd, ...companyData } = company;

    res.status(200).json({
      status: 'success',
      token,
      refreshToken,
      data: {
        user: {
          ...companyData,
          role: 'COMPANY_ADMIN',
          userType: 'company',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Super Admin Login
// @route   POST /api/v1/auth/admin/login
// @access  Public
exports.adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      return next(new AppError('Invalid email or password', 401));
    }

    if (!admin.isActive) {
      return next(new AppError('Admin account is inactive', 401));
    }

    const isPasswordCorrect = await bcrypt.compare(password, admin.password);

    if (!isPasswordCorrect) {
      return next(new AppError('Invalid email or password', 401));
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() },
    });

    logger.info(`Admin logged in: ${email}`);

    const token = generateToken(admin.id);
    const refreshToken = generateRefreshToken(admin.id);

    const { password: pwd, ...adminData } = admin;

    res.status(200).json({
      status: 'success',
      token,
      refreshToken,
      data: {
        user: {
          ...adminData,
          userType: 'admin',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Company Account
// @route   POST /api/v1/auth/company/register
// @access  Public (or Admin only in production)
exports.createCompanyAccount = async (req, res, next) => {
  try {
    const { name, email, phone, address, password } = req.body;

    const existingCompany = await prisma.company.findUnique({
      where: { email },
    });

    if (existingCompany) {
      return next(new AppError('Company with this email already exists', 400));
    }

    const companyCode = 'COMP' + Math.floor(100000 + Math.random() * 900000);
    const hashedPassword = await bcrypt.hash(password, 12);

    const company = await prisma.company.create({
      data: {
        name,
        email,
        phone,
        address,
        companyCode,
        password: hashedPassword,
      },
    });

    logger.info(`New company created: ${company.name}`);

    const { password: pwd, ...companyData } = company;

    res.status(201).json({
      status: 'success',
      data: {
        company: companyData,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Admin User
// @route   POST /api/v1/auth/admin/create
// @access  Private/Admin Only
exports.createAdmin = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Check if requester is admin
    if (req.user.role !== 'SUPER_ADMIN') {
      return next(new AppError('Only admins can create admin accounts', 403));
    }

    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      return next(new AppError('Admin with this email already exists', 400));
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    logger.info(`New admin created: ${email}`);

    const { password: pwd, ...adminData } = admin;

    res.status(201).json({
      status: 'success',
      data: {
        admin: adminData,
      },
    });
  } catch (error) {
    next(error);
  }
};