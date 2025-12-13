// src/services/aiService.js

const axios = require('axios');
const prisma = require('../config/database');
const logger = require('../utils/logger');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Generate personalized meal recommendations using AI
exports.generateMealRecommendations = async (staffId) => {
  try {
    // 1. Get staff health profile
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        age: true,
        weight: true,
        height: true,
        gender: true,
        allergies: true,
        medicalConditions: true,
        dietaryRestrictions: true,
        activityLevel: true,
        healthGoal: true,
        dislikedFoods: true,
        preferredCuisines: true,
      },
    });

    if (!staff) {
      throw new Error('Staff member not found');
    }

    // 2. Get all available meals
    const meals = await prisma.meal.findMany({
      where: {
        isAvailable: true,
        category: 'BREAKFAST',
      },
    });

    if (meals.length === 0) {
      logger.warn('No meals available in database');
      return [];
    }

    // 3. Calculate BMI and daily caloric needs
    let bmi = null;
    let tdee = null;
    
    if (staff.height && staff.weight) {
      const heightInMeters = staff.height / 100;
      bmi = staff.weight / (heightInMeters * heightInMeters);
      
      // Calculate TDEE (Total Daily Energy Expenditure)
      const bmr = staff.gender === 'MALE'
        ? 10 * staff.weight + 6.25 * staff.height - 5 * staff.age + 5
        : 10 * staff.weight + 6.25 * staff.height - 5 * staff.age - 161;
      
      const activityMultipliers = {
        SEDENTARY: 1.2,
        MODERATE: 1.55,
        ACTIVE: 1.725,
        VERY_ACTIVE: 1.9,
      };
      
      tdee = bmr * (activityMultipliers[staff.activityLevel] || 1.55);
    }

    // 4. Build AI prompt
    const prompt = this.buildNutritionPrompt(staff, meals, bmi, tdee);

    // 5. Call Groq API
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: 'llama-3.1-70b-versatile', // Fast and accurate
        messages: [
          {
            role: 'system',
            content: 'You are a professional Nigerian nutritionist. Always respond with only valid JSON arrays, no explanations.'
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // 6. Parse AI response
    const aiResponse = response.data.choices[0].message.content;
    const recommendations = this.parseAIRecommendations(aiResponse, meals);

    // 7. Cache recommendations
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await prisma.recommendationCache.upsert({
      where: { staffId },
      update: {
        recommendations: recommendations,
        generatedAt: new Date(),
        expiresAt,
      },
      create: {
        staffId,
        recommendations: recommendations,
        expiresAt,
      },
    });

    logger.info(`AI recommendations generated for staff: ${staffId}`);

    return recommendations;
  } catch (error) {
    logger.error('Error generating AI recommendations:', error.response?.data || error.message);
    
    // Fallback to rule-based recommendations
    return this.generateRuleBasedRecommendations(staffId);
  }
};

// Build the prompt for AI
exports.buildNutritionPrompt = (staff, meals, bmi, tdee) => {
  const mealsList = meals.map(meal => ({
    id: meal.id,
    name: meal.name,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fats: meal.fats,
    allergens: meal.allergens,
    tags: meal.tags,
    suitableFor: meal.suitableFor,
  }));

  return `You are a professional nutritionist specializing in Nigerian breakfast recommendations. Analyze this person's health profile and recommend the BEST 10 breakfast meals from the available options.

HEALTH PROFILE:
- Age: ${staff.age || 'Not provided'}
- Weight: ${staff.weight || 'Not provided'}kg
- Height: ${staff.height || 'Not provided'}cm
- BMI: ${bmi ? bmi.toFixed(1) : 'Not calculated'}
- Gender: ${staff.gender || 'Not provided'}
- Daily Caloric Needs (TDEE): ${tdee ? Math.round(tdee) : 'Not calculated'} calories
- Activity Level: ${staff.activityLevel || 'Not provided'}
- Health Goal: ${staff.healthGoal || 'General wellness'}
- Allergies: ${staff.allergies?.length > 0 ? staff.allergies.join(', ') : 'None'}
- Medical Conditions: ${staff.medicalConditions?.length > 0 ? staff.medicalConditions.join(', ') : 'None'}
- Dietary Restrictions: ${staff.dietaryRestrictions?.length > 0 ? staff.dietaryRestrictions.join(', ') : 'None'}
- Disliked Foods: ${staff.dislikedFoods?.length > 0 ? staff.dislikedFoods.join(', ') : 'None'}

AVAILABLE MEALS:
${JSON.stringify(mealsList, null, 2)}

REQUIREMENTS:
1. Breakfast should be 25-30% of daily calories (around ${tdee ? Math.round(tdee * 0.27) : '400-500'} calories)
2. MUST avoid any allergens completely
3. Consider medical conditions (e.g., low sodium for hypertension, low sugar for diabetes)
4. Respect dietary restrictions
5. Prioritize meals that align with health goals
6. Consider Nigerian food culture and preferences
7. Exclude any disliked foods

Respond ONLY with a JSON array of exactly 10 meal IDs in order of recommendation (best first). Format:
["meal-id-1", "meal-id-2", "meal-id-3", ...]

Do not include any explanation, just the JSON array.`;
};

// Parse AI response
exports.parseAIRecommendations = (aiResponse, meals) => {
  try {
    // Clean response and extract JSON
    let cleanedResponse = aiResponse.trim();
    
    // Remove markdown code blocks if present
    cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Extract JSON array
    const jsonMatch = cleanedResponse.match(/\[.*\]/s);
    if (!jsonMatch) {
      throw new Error('No JSON array found in AI response');
    }

    const mealIds = JSON.parse(jsonMatch[0]);
    
    // Map meal IDs to full meal objects with scores
    const recommendations = mealIds.slice(0, 10).map((mealId, index) => {
      const meal = meals.find(m => m.id === mealId);
      return meal ? {
        mealId: meal.id,
        score: 100 - (index * 10),
        rank: index + 1,
      } : null;
    }).filter(Boolean);

    return recommendations;
  } catch (error) {
    logger.error('Error parsing AI recommendations:', error);
    throw error;
  }
};

// Fallback: Rule-based recommendations (if AI fails)
exports.generateRuleBasedRecommendations = async (staffId) => {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
    });

    const meals = await prisma.meal.findMany({
      where: {
        isAvailable: true,
        category: 'BREAKFAST',
      },
    });

    // Filter meals based on allergies
    let filteredMeals = meals.filter(meal => {
      if (!staff.allergies || staff.allergies.length === 0) return true;
      return !meal.allergens.some(allergen => staff.allergies.includes(allergen));
    });

    // Filter based on medical conditions
    if (staff.medicalConditions?.includes('Diabetes')) {
      filteredMeals = filteredMeals.filter(meal => 
        meal.sugar < 10 && meal.calories < 450
      );
    }

    if (staff.medicalConditions?.includes('Hypertension')) {
      filteredMeals = filteredMeals.filter(meal => 
        meal.sodium < 400
      );
    }

    // Sort by health goal
    if (staff.healthGoal === 'WEIGHT_LOSS') {
      filteredMeals.sort((a, b) => a.calories - b.calories);
    } else if (staff.healthGoal === 'MUSCLE_GAIN') {
      filteredMeals.sort((a, b) => b.protein - a.protein);
    }

    // Take top 10
    const recommendations = filteredMeals.slice(0, 10).map((meal, index) => ({
      mealId: meal.id,
      score: 100 - (index * 10),
      rank: index + 1,
    }));

    logger.info(`Rule-based recommendations generated for staff: ${staffId}`);

    return recommendations;
  } catch (error) {
    logger.error('Error generating rule-based recommendations:', error);
    return [];
  }
};

// Get cached recommendations or generate new ones
exports.getRecommendations = async (staffId) => {
  try {
    // Check cache first
    const cache = await prisma.recommendationCache.findUnique({
      where: { staffId },
    });

    const now = new Date();
    
    // Return cached recommendations if still valid
    if (cache && cache.expiresAt > now) {
      logger.info(`Returning cached recommendations for staff: ${staffId}`);
      return cache.recommendations;
    }

    // Generate new recommendations
    return await this.generateMealRecommendations(staffId);
  } catch (error) {
    logger.error('Error getting recommendations:', error);
    throw error;
  }
};