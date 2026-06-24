import { auth } from '../config/auth.js';
import { prisma } from '../config/db.js';

const ADMIN_EMAIL = 'admin@rateddocs.com';
const ADMIN_PASSWORD = 'AdminPassword123!';
const ADMIN_NAME = 'System Admin';

async function seedAdmin() {
  console.log('🚀 Starting admin seeding process...');

  try {
    // 1. Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (existing) {
      console.log(`ℹ️ User with email "${ADMIN_EMAIL}" already exists.`);
      // Update their role to SUPER_ADMIN just in case
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: 'SUPER_ADMIN',
          emailVerified: true,
          status: 'ACTIVE',
        },
      });
      console.log(`✅ Role successfully set/updated to SUPER_ADMIN for "${ADMIN_EMAIL}".`);
      return;
    }

    // 2. Create the user using Better-Auth API (so password is encrypted properly)
    console.log('🔑 Registering user via Better-Auth...');
    const result = await auth.api.signUpEmail({
      body: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        name: ADMIN_NAME,
      },
    });

    if (!result || !result.user) {
      throw new Error('Better-Auth sign up failed.');
    }

    // 3. Update their role to SUPER_ADMIN and status to ACTIVE
    console.log('🔄 Upgrading user role to SUPER_ADMIN and activating...');
    await prisma.user.update({
      where: { id: result.user.id },
      data: {
        role: 'SUPER_ADMIN',
        emailVerified: true,
        status: 'ACTIVE',
      },
    });

    console.log('\n🎉 Admin account successfully seeded!');
    console.log(`📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
    console.log(`🛡️ Role: SUPER_ADMIN`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

seedAdmin();
