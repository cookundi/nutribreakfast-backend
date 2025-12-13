const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Updating company passwords...\n');

  const companies = await prisma.company.findMany();

  for (const company of companies) {
    // Create password from company name
    const password = company.name.split(' ')[0].toLowerCase() + '123';
    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.company.update({
      where: { id: company.id },
      data: { password: hashedPassword },
    });

    console.log(`✅ ${company.name}`);
    console.log(`   Email: ${company.email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Company Code: ${company.companyCode}\n`);
  }

  console.log('✅ All company passwords updated!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });