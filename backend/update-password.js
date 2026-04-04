const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = '$2a$10$.FNI6amRRjiGJtpt2gGJp.OgKywZbTMq0ltJ.k5D/L0f4erZ2m72C';
  
  const user = await prisma.user.update({
    where: { username: 'admin' },
    data: { password: hash }
  });
  
  console.log('✅ Password updated successfully!');
  console.log('Username:', user.username);
  console.log('You can now login with password: admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());