import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { AppModule } from './app.module';
import { UserService } from './user/user.service';

// Creates the first user from SEED_USER_* so there is an account to log in with.
// Safe to run again: an existing email is left untouched.
async function seed() {
  const email = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_USER_PASSWORD;
  const name = process.env.SEED_USER_NAME?.trim() || 'Admin';

  if (!email || !password) {
    throw new Error('Set SEED_USER_EMAIL and SEED_USER_PASSWORD');
  }
  if (password.length < 8 || password.length > 72) {
    throw new Error('SEED_USER_PASSWORD must have 8 to 72 characters');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const users = app.get(UserService);

    if (await users.findOne(email)) {
      console.log(`Seed: ${email} already exists, nothing to do`);
      return;
    }

    await users.createNewUser({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
    });
    console.log(`Seed: created ${email}`);
  } finally {
    await app.close();
  }
}

seed().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
