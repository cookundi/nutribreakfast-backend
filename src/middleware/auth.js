// src/middleware/auth.js

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const prisma = require('../config/database');

// Verify JWT Token
const protect = async (req, res, next) => {
  try {
    // 1. Get token from header
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in. Please log in to access this route.', 401));
    }

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Check if user still exists
    const currentUser = await prisma.staff.findUnique({
      where: { id: decoded.id },
      include: {
        company: true
      }
    });

    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    if (!currentUser.isActive) {
      return next(new AppError('Your account has been deactivated. Please contact support.', 401));
    }

    // 4. Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    return next(new AppError('Invalid token. Please log in again.', 401));
  }
};

// Restrict to specific roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    // For now, we'll implement a simple role check
    // You can extend this based on your needs
    if (!req.user) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    
    next();
  };
};

// Check if user is onboarded
const requireOnboarding = (req, res, next) => {
  if (!req.user.isOnboarded) {
    return next(new AppError('Please complete your health profile onboarding first.', 403));
  }
  next();
};

// src/middleware/auth.js

const checkOrderCutoff = (req, res, next) => {
  const now = new Date();

  // ROBUST LAGOS TIME CALCULATION (UTC + 1)
  // 1. Get UTC hours and add 1
  let lagosHour = now.getUTCHours() + 1;
  
  // 2. Handle Day Rollover (If UTC is 23 (11pm), Lagos is 24 (00:00am))
  if (lagosHour >= 24) {
    lagosHour = lagosHour - 24;
  }
  
  const lagosMinute = now.getUTCMinutes();

  // Get Env variables (Default to 11 PM if not set)
  const cutoffHour = parseInt(process.env.ORDER_CUTOFF_HOUR) || 23; 
  const cutoffMinute = parseInt(process.env.ORDER_CUTOFF_MINUTE) || 0;

  console.log(`Server UTC: ${now.getUTCHours()}:${now.getUTCMinutes()}`);
  console.log(`Lagos Time: ${lagosHour}:${lagosMinute}`);

  // 3. LOGIC CHECK
  // Case A: It's currently later than the cutoff hour (e.g., Current 24 > Cutoff 23)
  // Note: 0 (Midnight) is NOT greater than 23, so midnight passes fine.
  if (lagosHour > cutoffHour) {
     return next(new AppError(`Order cutoff time has passed. Orders close at ${cutoffHour > 12 ? cutoffHour - 12 : cutoffHour}:00 PM.`, 400));
  }

  // Case B: It's the same hour, but minutes have passed
  if (lagosHour === cutoffHour && lagosMinute >= cutoffMinute) {
     return next(new AppError(`Order cutoff time has passed. Orders close at ${cutoffHour > 12 ? cutoffHour - 12 : cutoffHour}:00 PM.`, 400));
  }
  
  next();
};


module.exports = {
  protect,
  restrictTo,
  requireOnboarding,
  checkOrderCutoff
};