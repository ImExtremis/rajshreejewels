import prisma from './services/db';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🔍 Checking for existing admin users...');
  
  const existingAdmin = await prisma.user.findFirst({
    where: { isAdmin: true }
  });

  if (existingAdmin) {
    console.log(`✅ Admin account already exists!`);
    console.log(`📧 Email: ${existingAdmin.email}`);
    return;
  }

  console.log('🆕 No admin found. Creating default admin account...');
  
  const email = 'admin@rajshreejewels.com';
  const password = 'adminpassword123';
  const name = 'Rajshree Admin';

  const passwordHash = await bcrypt.hash(password, 12);

  const newAdmin = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      isAdmin: true,
      isVerified: true
    }
  });

  console.log('🎉 Admin account successfully created!');
  console.log(`📧 Email: ${email}`);
  console.log(`🔒 Password: ${password}`);
  console.log(`👤 Name: ${name}`);
}

main()
  .catch(err => {
    console.error('❌ Failed to verify/create admin account:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
