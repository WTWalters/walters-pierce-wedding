import { render, screen } from '@testing-library/react';
import WeddingPartyPage from '../page';

describe('WeddingPartyPage', () => {
  it('renders the main heading and sections for bride and groom', () => {
    render(<WeddingPartyPage />);
    
    expect(screen.getByRole('heading', { name: /Wedding Party/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Bride's Side/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Groom's Side/i, level: 2 })).toBeInTheDocument();
  });
});
