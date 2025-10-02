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

  beforeAll(() => {
    require('../auth');
    authorize = (CredentialsProvider as jest.Mock).mock.calls[0][0].authorize;
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
});
