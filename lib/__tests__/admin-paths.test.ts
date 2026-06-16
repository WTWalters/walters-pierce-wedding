import { requiresAdmin } from '../admin-paths';

describe('requiresAdmin', () => {
  it('requires admin for admin pages', () => {
    expect(requiresAdmin('/admin')).toBe(true);
    expect(requiresAdmin('/admin/guests')).toBe(true);
  });

  it('requires admin for admin API routes (the previously uncovered gap)', () => {
    expect(requiresAdmin('/api/admin/users')).toBe(true);
    expect(requiresAdmin('/api/admin/guests/export')).toBe(true);
  });

  it('does not gate public pages or public/auth APIs', () => {
    expect(requiresAdmin('/')).toBe(false);
    expect(requiresAdmin('/rsvp')).toBe(false);
    expect(requiresAdmin('/api/rsvp/lookup')).toBe(false);
    expect(requiresAdmin('/api/save-the-date')).toBe(false);
    expect(requiresAdmin('/api/auth/session')).toBe(false);
    expect(requiresAdmin('/api/venue')).toBe(false);
  });
});
