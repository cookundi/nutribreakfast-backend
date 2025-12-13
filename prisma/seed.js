// prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create sample companies
  const company1 = await prisma.company.create({
    data: {
      name: 'TechCorp Nigeria',
      email: 'admin@techcorp.ng',
      phone: '+2348012345678',
      address: '123 Victoria Island, Lagos',
      companyCode: 'COMP123456',
      paymentModel: 'COMPANY_PAYS_ALL',
      billingDay: 1,
    },
  });

  const company2 = await prisma.company.create({
    data: {
      name: 'StartupHub Lagos',
      email: 'hello@startuphub.ng',
      phone: '+2348087654321',
      address: '45 Yaba Tech Hub, Lagos',
      companyCode: 'COMP789012',
      paymentModel: 'SHARED_PERCENTAGE',
      subsidyPercent: 50,
      billingDay: 15,
    },
  });

  console.log('✅ Companies created');

  // 2. Create sample staff members
  const hashedPassword = await bcrypt.hash('password123', 12);

  const staff1 = await prisma.staff.create({
    data: {
      email: 'john.doe@techcorp.ng',
      password: hashedPassword,
      name: 'John Doe',
      phone: '+2348011111111',
      staffCode: 'STF001',
      companyId: company1.id,
      age: 32,
      weight: 75,
      height: 175,
      gender: 'MALE',
      allergies: ['Nuts'],
      medicalConditions: [],
      dietaryRestrictions: [],
      activityLevel: 'MODERATE',
      healthGoal: 'MAINTENANCE',
      isOnboarded: true,
    },
  });

  const staff2 = await prisma.staff.create({
    data: {
      email: 'jane.smith@techcorp.ng',
      password: hashedPassword,
      name: 'Jane Smith',
      phone: '+2348022222222',
      staffCode: 'STF002',
      companyId: company1.id,
      age: 28,
      weight: 65,
      height: 165,
      gender: 'FEMALE',
      allergies: [],
      medicalConditions: ['Diabetes'],
      dietaryRestrictions: [],
      activityLevel: 'ACTIVE',
      healthGoal: 'WEIGHT_LOSS',
      isOnboarded: true,
    },
  });

  console.log('✅ Staff members created');

  // 3. Create sample meals
  const meals = [
    {
      name: 'Protein Oat Bowl',
      description: 'Steel-cut oats with boiled eggs, avocado, and banana',
      category: 'BREAKFAST',
      cuisine: 'Continental',
      calories: 420,
      protein: 22,
      carbs: 45,
      fats: 15,
      fiber: 8,
      sugar: 8,
      sodium: 200,
      ingredients: ['Oats', 'Eggs', 'Avocado', 'Banana', 'Honey'],
      allergens: ['Eggs'],
      basePrice: 150000, // ₦1,500 in kobo
      isAvailable: true,
      availableDays: [1, 2, 3, 4, 5], // Monday to Friday
      maxDailyCapacity: 50,
      tags: ['high-protein', 'low-gi', 'heart-healthy'],
      suitableFor: ['weight-loss', 'muscle-gain', 'diabetes-management'],
    },
    {
      name: 'Moi Moi & Pap',
      description: 'Steamed bean pudding with fermented corn pap',
      category: 'BREAKFAST',
      cuisine: 'Nigerian',
      calories: 380,
      protein: 18,
      carbs: 52,
      fats: 8,
      fiber: 10,
      sugar: 5,
      sodium: 180,
      ingredients: ['Beans', 'Corn', 'Palm oil', 'Pepper', 'Onions'],
      allergens: [],
      basePrice: 120000, // ₦1,200
      isAvailable: true,
      availableDays: [1, 2, 3, 4, 5],
      maxDailyCapacity: 60,
      tags: ['plant-protein', 'fiber-rich', 'traditional'],
      suitableFor: ['heart-health', 'diabetes-management', 'weight-loss'],
    },
    {
      name: 'Plantain & Scrambled Eggs',
      description: 'Ripe plantain with herb-infused scrambled eggs',
      category: 'BREAKFAST',
      cuisine: 'Nigerian',
      calories: 450,
      protein: 20,
      carbs: 58,
      fats: 16,
      fiber: 6,
      sugar: 22,
      sodium: 220,
      ingredients: ['Plantain', 'Eggs', 'Tomatoes', 'Onions', 'Herbs'],
      allergens: ['Eggs'],
      basePrice: 140000, // ₦1,400
      isAvailable: true,
      availableDays: [1, 2, 3, 4, 5, 6],
      maxDailyCapacity: 40,
      tags: ['balanced', 'vitamin-a', 'potassium'],
      suitableFor: ['maintenance', 'muscle-gain'],
    },
    {
      name: 'Akara & Custard',
      description: 'Bean cakes with low-sugar custard',
      category: 'BREAKFAST',
      cuisine: 'Nigerian',
      calories: 390,
      protein: 16,
      carbs: 48,
      fats: 14,
      fiber: 8,
      sugar: 12,
      sodium: 150,
      ingredients: ['Beans', 'Custard powder', 'Milk', 'Palm oil'],
      allergens: ['Dairy'],
      basePrice: 110000, // ₦1,100
      isAvailable: true,
      availableDays: [1, 2, 3, 4, 5],
      maxDailyCapacity: 55,
      tags: ['plant-protein', 'filling', 'traditional'],
      suitableFor: ['weight-loss', 'general-wellness'],
    },
    {
      name: 'Yam & Vegetable Sauce',
      description: 'Boiled yam with tomato-veggie sauce and grilled fish',
      category: 'BREAKFAST',
      cuisine: 'Nigerian',
      calories: 410,
      protein: 24,
      carbs: 55,
      fats: 10,
      fiber: 7,
      sugar: 6,
      sodium: 300,
      ingredients: ['Yam', 'Tomatoes', 'Fish', 'Vegetables', 'Spices'],
      allergens: ['Seafood'],
      basePrice: 160000, // ₦1,600
      isAvailable: true,
      availableDays: [1, 2, 3, 4, 5],
      maxDailyCapacity: 35,
      tags: ['omega-3', 'complex-carbs', 'nutrient-dense'],
      suitableFor: ['heart-health', 'muscle-gain'],
    },
    {
      name: 'Smoothie Bowl Deluxe',
      description: 'Mixed berries, spinach, chia seeds, and granola',
      category: 'BREAKFAST',
      cuisine: 'Continental',
      calories: 360,
      protein: 15,
      carbs: 52,
      fats: 12,
      fiber: 12,
      sugar: 18,
      sodium: 100,
      ingredients: ['Berries', 'Spinach', 'Chia seeds', 'Granola', 'Yogurt'],
      allergens: ['Dairy', 'Nuts'],
      basePrice: 180000, // ₦1,800
      isAvailable: true,
      availableDays: [1, 2, 3, 4, 5, 6],
      maxDailyCapacity: 30,
      tags: ['antioxidants', 'vitamins', 'superfood'],
      suitableFor: ['general-wellness', 'weight-loss'],
    },
    {
      name: 'Grilled Fish & Vegetables',
      description: 'Tilapia with sauteed veggies and brown rice',
      category: 'BREAKFAST',
      cuisine: 'Continental',
      calories: 400,
      protein: 28,
      carbs: 42,
      fats: 12,
      fiber: 6,
      sugar: 4,
      sodium: 280,
      ingredients: ['Tilapia', 'Brown rice', 'Mixed vegetables', 'Olive oil'],
      allergens: ['Seafood'],
      basePrice: 200000, // ₦2,000
      isAvailable: true,
      availableDays: [1, 2, 3, 4, 5],
      maxDailyCapacity: 25,
      tags: ['lean-protein', 'heart-healthy', 'omega-3'],
      suitableFor: ['heart-health', 'diabetes-management', 'weight-loss'],
    },
    {
      name: 'Vegetable Omelette',
      description: 'Three-egg omelette with bell peppers and tomatoes',
      category: 'BREAKFAST',
      cuisine: 'Continental',
      calories: 340,
      protein: 24,
      carbs: 12,
      fats: 22,
      fiber: 3,
      sugar: 6,
      sodium: 320,
      ingredients: ['Eggs', 'Bell peppers', 'Tomatoes', 'Onions', 'Cheese'],
      allergens: ['Eggs', 'Dairy'],
      basePrice: 130000, // ₦1,300
      isAvailable: true,
      availableDays: [1, 2, 3, 4, 5, 6, 0],
      maxDailyCapacity: 45,
      tags: ['high-protein', 'low-carb', 'keto-friendly'],
      suitableFor: ['weight-loss', 'muscle-gain', 'diabetes-management'],
    },
    {
      name: 'Quinoa Porridge',
      description: 'Quinoa with almond milk, honey, and fresh fruits',
      category: 'BREAKFAST',
      cuisine: 'Continental',
      calories: 370,
      protein: 14,
      carbs: 58,
      fats: 10,
      fiber: 8,
      sugar: 16,
      sodium: 80,
      ingredients: ['Quinoa', 'Almond milk', 'Honey', 'Fresh fruits', 'Nuts'],
      allergens: ['Nuts'],
      basePrice: 170000, // ₦1,700
      isAvailable: true,
      availableDays: [1, 2, 3, 4, 5],
      maxDailyCapacity: 30,
      tags: ['gluten-free', 'complete-protein', 'superfood'],
      suitableFor: ['general-wellness', 'weight-loss'],
    },
    {
      name: 'Bean Stew & Plantain',
      description: 'Nigerian honey beans with ripe plantain',
      category: 'BREAKFAST',
      cuisine: 'Nigerian',
      calories: 430,
      protein: 19,
      carbs: 68,
      fats: 10,
      fiber: 14,
      sugar: 20,
      sodium: 190,
      ingredients: ['Honey beans', 'Plantain', 'Palm oil', 'Spices'],
      allergens: [],
      basePrice: 125000, // ₦1,250
      isAvailable: true,
      availableDays: [1, 2, 3, 4, 5],
      maxDailyCapacity: 50,
      tags: ['fiber-rich', 'sustained-energy', 'traditional'],
      suitableFor: ['general-wellness', 'heart-health'],
    },
  ];

  await prisma.meal.createMany({
    data: meals,
  });

  console.log('✅ Meals created');

  console.log('\n🎉 Database seeding completed!');
  console.log('\n📝 Test Credentials:');
  console.log('Email: john.doe@techcorp.ng');
  console.log('Password: password123');
  console.log('Company Code: COMP123456');
  console.log('\n---\n');
  console.log('Email: jane.smith@techcorp.ng');
  console.log('Password: password123');
  console.log('Company Code: COMP123456');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });