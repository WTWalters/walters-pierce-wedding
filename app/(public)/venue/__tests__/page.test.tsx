import { render, screen } from '@testing-library/react';
import VenuePage from '../page';

describe('VenuePage', () => {
  it('renders the generic mountains heading with no location details', () => {
    render(<VenuePage />);

    expect(
      screen.getByRole('heading', { name: /A Celebration in the Colorado Mountains/i, level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText(/shared directly with invited guests/i)).toBeInTheDocument();
  });

  it('never mentions the venue town, address, or specific elevation', () => {
    const { container } = render(<VenuePage />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/idaho/i);
    expect(text).not.toMatch(/springs/i);
    expect(text).not.toMatch(/7,?540/);
    expect(text).not.toMatch(/address/i);
  });
});
