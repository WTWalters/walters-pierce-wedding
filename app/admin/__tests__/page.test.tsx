import { render, screen } from '@testing-library/react';
import AdminDashboard from '../page';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: { user: { name: 'Test Admin' } },
  })),
}));

describe('AdminDashboard', () => {
  it('renders the welcome heading and the quick-action cards', () => {
    render(<AdminDashboard />);
    expect(
      screen.getByRole('heading', { name: /Welcome to your Wedding Dashboard/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Guest Management')).toBeInTheDocument();
    expect(screen.getByText('Registry & Gifts')).toBeInTheDocument();
  });

  it('no longer shows the guest-count stat boxes (Nicolle uses Guest Management for counts)', () => {
    render(<AdminDashboard />);
    expect(screen.queryByText('Total Guests')).not.toBeInTheDocument();
    expect(screen.queryByText('Not Attending')).not.toBeInTheDocument();
  });
});
