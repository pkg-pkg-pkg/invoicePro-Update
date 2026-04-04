import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetPassword() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.user.update({
    where: { username: 'admin' },
    data: { password: hashedPassword }
  });
  
  console.log('✅ Password reset successfully!');
  console.log('Username: admin');
  console.log('Password: admin123');
}

resetPassword()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });