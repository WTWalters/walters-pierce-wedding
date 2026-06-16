import { authOptions } from '../auth';
import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';
import CredentialsProvider from 'next-auth/providers/credentials';

jest.mock('next-auth/providers/credentials', () => jest.fn(options => ({ ...options, name: 'credentials' })));

jest.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: jest.fn(),
}));

jest.mock('../prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('authorize', () => {
  let authorize: any;
  const STRONG_SECRET = 'test-only-strong-secret-0123456789abcdef';

  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = STRONG_SECRET;
    require('../auth');
    authorize = (CredentialsProvider as jest.Mock).mock.calls[0][0].authorize;
  });

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = STRONG_SECRET;
    (prisma.user.findUnique as jest.Mock).mockReset();
    (bcrypt.compare as jest.Mock).mockReset();
  });

  it('should return a user object on successful authentication', async () => {
    const credentials = { email: 'test@example.com', password: 'password123' };
    const user = { id: '1', email: 'test@example.com', passwordHash: 'hashedpassword', role: 'admin' };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await authorize(credentials, {} as any);

    expect(result).toEqual({ id: '1', email: 'test@example.com', role: 'admin' });
  });

  it('should return null if credentials are not provided', async () => {
    const result = await authorize({} as any, {} as any);
    expect(result).toBeNull();
  });

  it('should return null if user is not found', async () => {
    const credentials = { email: 'test@example.com', password: 'password123' };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await authorize(credentials, {} as any);

    expect(result).toBeNull();
  });

  it('should return null if password is not valid', async () => {
    const credentials = { email: 'test@example.com', password: 'password123' };
    const user = { id: '1', email: 'test@example.com', passwordHash: 'hashedpassword', role: 'admin' };

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const result = await authorize(credentials, {} as any);

    expect(result).toBeNull();
  });

  it('rejects the former hardcoded admin credentials (no DB user exists)', async () => {
    // The committed ADMIN_CREDENTIALS must no longer grant access.
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await authorize(
      { email: 'admin@walters-pierce-wedding.com', password: 'Kund@lini12' },
      {} as any
    );

    expect(result).toBeNull();
  });

  it('does not grant a super-admin bypass — login goes through the DB like any user', async () => {
    // whitney.walters@gmail.com must authenticate against a real DB user, not a
    // hardcoded plaintext password. With no DB user, access is denied.
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await authorize(
      { email: 'whitney.walters@gmail.com', password: 'Kund@lini12' },
      {} as any
    );

    expect(result).toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'whitney.walters@gmail.com' },
    });
  });

  it('authenticates whitney.walters@gmail.com when a matching DB admin exists', async () => {
    const user = {
      id: 'uuid-1',
      email: 'whitney.walters@gmail.com',
      passwordHash: 'hashed',
      role: 'admin',
    };
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await authorize(
      { email: 'whitney.walters@gmail.com', password: 'a-real-strong-password' },
      {} as any
    );

    expect(result).toEqual({ id: 'uuid-1', email: 'whitney.walters@gmail.com', role: 'admin' });
  });

  it('throws when NEXTAUTH_SECRET is missing', async () => {
    delete process.env.NEXTAUTH_SECRET;
    await expect(
      authorize({ email: 'test@example.com', password: 'password123' }, {} as any)
    ).rejects.toThrow(/NEXTAUTH_SECRET/);
  });

  it('throws when NEXTAUTH_SECRET is still the committed placeholder', async () => {
    process.env.NEXTAUTH_SECRET = 'your-secret-key-here-change-in-production';
    await expect(
      authorize({ email: 'test@example.com', password: 'password123' }, {} as any)
    ).rejects.toThrow(/NEXTAUTH_SECRET/);
  });
});
