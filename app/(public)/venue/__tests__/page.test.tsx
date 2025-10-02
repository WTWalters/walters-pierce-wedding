import { render, screen } from '@testing-library/react';
import VenuePage from '../page';

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ venue: null, events: [], hotels: [] }),
  })
) as jest.Mock;

describe('VenuePage', () => {
  it('renders the loading state and then the main heading', async () => {
    render(<VenuePage />);
    
    expect(screen.getByText(/Loading venue information.../i)).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: /Venue & Travel/i, level: 1 })).toBeInTheDocument();
  });
});
