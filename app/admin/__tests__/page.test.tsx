import { render, screen } from '@testing-library/react';
import AdminDashboard from '../page';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: { user: { name: 'Test Admin' } },
  })),
}));

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({
      totalGuests: 100,
      rsvpResponses: 50,
      attending: 40,
      notAttending: 10,
    }),
  })
) as jest.Mock;

describe('AdminDashboard', () => {
  it('renders the main heading and stats', async () => {
    render(<AdminDashboard />);
    
    expect(screen.getByRole('heading', { name: /Welcome to your Wedding Dashboard/i })).toBeInTheDocument();

    expect(await screen.findByText('100')).toBeInTheDocument();
    expect(await screen.findByText('50')).toBeInTheDocument();
    expect(await screen.findByText('40')).toBeInTheDocument();
    expect(await screen.findByText('10')).toBeInTheDocument();
  });
});
