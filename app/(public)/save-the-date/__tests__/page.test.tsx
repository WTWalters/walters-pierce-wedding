import { render, screen } from '@testing-library/react';
import SaveTheDatePage from '../page';

describe('SaveTheDatePage', () => {
  it('renders the main heading and form', () => {
    render(<SaveTheDatePage />);
    
    expect(screen.getByRole('heading', { name: /Save the Date/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('form')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit/i })).toBeInTheDocument();
  });
});
