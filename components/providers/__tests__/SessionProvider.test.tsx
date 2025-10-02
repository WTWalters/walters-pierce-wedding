import { render, screen } from '@testing-library/react';
import SessionProvider from '../SessionProvider';

describe('SessionProvider', () => {
  it('renders its children', () => {
    render(
      <SessionProvider>
        <div>Test Child</div>
      </SessionProvider>
    );
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });
});
