// src/middleware/validation.js

const { z } = require('zod');
const { AppError } = require('./errorHandler');

// Validation middleware wrapper
const validate = (schema) => {
  return async (req, res, next) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        
        return next(new AppError(JSON.stringify(errorMessages), 400));
      }
      next(error);
    }
  };
};

// Validation Schemas
const schemas = {
  // Auth schemas
  register: z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      name: z.string().min(2, 'Name must be at least 2 characters'),
      phone: z.string().optional(),
      companyCode: z.string().min(1, 'Company code is required'),
      staffCode: z.string().min(1, 'Staff code is required'),
    }),
  }),

  login: z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
      password: z.string().min(1, 'Password is required'),
    }),
  }),

  // Health profile schemas
  healthProfile: z.object({
    body: z.object({
      age: z.number().int().min(18).max(100).optional(),
      weight: z.number().positive().optional(),
      height: z.number().positive().optional(),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
      bloodType: z.string().optional(),
      allergies: z.array(z.string()).optional(),
      medicalConditions: z.array(z.string()).optional(),
      dietaryRestrictions: z.array(z.string()).optional(),
      activityLevel: z.enum(['SEDENTARY', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE']).optional(),
      healthGoal: z.enum([
        'WEIGHT_LOSS',
        'MUSCLE_GAIN',
        'MAINTENANCE',
        'HEART_HEALTH',
        'DIABETES_MANAGEMENT',
        'GENERAL_WELLNESS'
      ]).optional(),
      dislikedFoods: z.array(z.string()).optional(),
      preferredCuisines: z.array(z.string()).optional(),
    }),
  }),

  // Order schemas
  createOrder: z.object({
    body: z.object({
      mealId: z.string().uuid('Invalid meal ID'),
      quantity: z.number().int().min(1).max(5).default(1),
      deliveryDate: z.string().datetime('Invalid delivery date'),
      deliveryAddress: z.string().min(10, 'Delivery address must be at least 10 characters'),
      notes: z.string().optional(),
    }),
  }),

  updateOrderStatus: z.object({
    body: z.object({
      status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
      riderId: z.string().optional(),
      riderName: z.string().optional(),
      riderPhone: z.string().optional(),
    }),
  }),

  // Meal schemas
  createMeal: z.object({
    body: z.object({
      name: z.string().min(3, 'Meal name must be at least 3 characters'),
      description: z.string().min(10),
      category: z.enum(['BREAKFAST', 'LUNCH', 'SNACK', 'BEVERAGE']),
      cuisine: z.string(),
      calories: z.number().int().positive(),
      protein: z.number().positive(),
      carbs: z.number().positive(),
      fats: z.number().positive(),
      fiber: z.number().positive().optional(),
      sugar: z.number().positive().optional(),
      sodium: z.number().positive().optional(),
      ingredients: z.array(z.string()).min(1),
      allergens: z.array(z.string()),
      basePrice: z.number().int().positive(),
      isAvailable: z.boolean().default(true),
      availableDays: z.array(z.number().int().min(0).max(6)),
      maxDailyCapacity: z.number().int().positive().optional(),
      tags: z.array(z.string()),
      suitableFor: z.array(z.string()),
    }),
  }),

  // Company schemas
  createCompany: z.object({
    body: z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string(),
      address: z.string().optional(),
      paymentModel: z.enum(['COMPANY_PAYS_ALL', 'STAFF_PAYS_ALL', 'SHARED_PERCENTAGE']).default('COMPANY_PAYS_ALL'),
      subsidyPercent: z.number().int().min(0).max(100).optional(),
      billingDay: z.number().int().min(1).max(28).default(1),
    }),
  }),
};

module.exports = {
  validate,
  schemas,
};