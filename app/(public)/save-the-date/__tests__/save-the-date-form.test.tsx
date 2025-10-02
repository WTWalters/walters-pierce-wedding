import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaveTheDatePage from '../page';

// Mock the API calls
global.fetch = jest.fn();

describe('Save the Date Form Functionality', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('renders all required form fields', () => {
    render(<SaveTheDatePage />);

    // Check for all form fields
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/street address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/zip code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dietary restrictions/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<SaveTheDatePage />);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    // Should show validation errors for required fields
    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    render(<SaveTheDatePage />);

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'invalid-email');
    await user.tab(); // Trigger blur event

    expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
  });

  it('formats phone number correctly', async () => {
    const user = userEvent.setup();
    render(<SaveTheDatePage />);

    const phoneInput = screen.getByLabelText(/phone number/i);
    await user.type(phoneInput, '5551234567');

    expect(phoneInput).toHaveValue('(555) 123-4567');
  });

  it('validates phone number length', async () => {
    const user = userEvent.setup();
    render(<SaveTheDatePage />);

    const phoneInput = screen.getByLabelText(/phone number/i);
    await user.type(phoneInput, '555123'); // Too short
    await user.tab(); // Trigger blur event

    expect(screen.getByText(/please enter a valid 10-digit us phone number/i)).toBeInTheDocument();
  });

  it('validates zip code format', async () => {
    const user = userEvent.setup();
    render(<SaveTheDatePage />);

    const firstName = screen.getByLabelText(/first name/i);
    const lastName = screen.getByLabelText(/last name/i);
    const email = screen.getByLabelText(/email address/i);
    const zipCode = screen.getByLabelText(/zip code/i);
    const submitButton = screen.getByRole('button', { name: /submit/i });

    // Fill required fields
    await user.type(firstName, 'John');
    await user.type(lastName, 'Doe');
    await user.type(email, 'john@example.com');
    await user.type(zipCode, '123'); // Invalid zip

    await user.click(submitButton);

    expect(screen.getByText(/please enter a valid zip code/i)).toBeInTheDocument();
  });

  it('successfully submits form with all guest data', async () => {
    const user = userEvent.setup();

    // Mock successful API response
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Thank you for signing up!',
        guest: { id: '1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' }
      })
    });

    render(<SaveTheDatePage />);

    // Fill out all form fields
    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/email address/i), 'john@example.com');
    await user.type(screen.getByLabelText(/phone number/i), '5551234567');
    await user.type(screen.getByLabelText(/street address/i), '123 Main Street');
    await user.type(screen.getByLabelText(/city/i), 'Denver');
    await user.type(screen.getByLabelText(/state/i), 'CO');
    await user.type(screen.getByLabelText(/zip code/i), '80202');
    await user.type(screen.getByLabelText(/dietary restrictions/i), 'Vegetarian, no nuts');

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    // Verify API was called with correct data
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/save-the-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '(555) 123-4567',
          address: '123 Main Street',
          city: 'Denver',
          state: 'CO',
          zipCode: '80202',
          dietaryRestrictions: 'Vegetarian, no nuts'
        })
      });
    });

    // Verify success message appears
    expect(screen.getByText(/thank you!/i)).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();

    // Mock API error
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' })
    });

    render(<SaveTheDatePage />);

    // Fill required fields and submit
    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/email address/i), 'john@example.com');

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });
  });

  it('clears field errors when user starts typing', async () => {
    const user = userEvent.setup();
    render(<SaveTheDatePage />);

    // Trigger validation error
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
    });

    // Start typing in first name field
    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.type(firstNameInput, 'J');

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/first name is required/i)).not.toBeInTheDocument();
    });
  });

  it('displays correct helper text for fields', () => {
    render(<SaveTheDatePage />);

    expect(screen.getByText(/we'll use this to match your save-the-date and rsvp/i)).toBeInTheDocument();
    expect(screen.getByText(/us phone number for wedding updates/i)).toBeInTheDocument();
  });

  it('has proper form accessibility', () => {
    render(<SaveTheDatePage />);

    const form = screen.getByRole('form');
    expect(form).toHaveAttribute('aria-label', 'Save the date form');

    // Check that all inputs have proper labels
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach(input => {
      expect(input).toHaveAccessibleName();
    });
  });

  it('disables submit button while submitting', async () => {
    const user = userEvent.setup();

    // Mock slow API response
    (fetch as jest.Mock).mockImplementationOnce(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ success: true })
      }), 1000))
    );

    render(<SaveTheDatePage />);

    // Fill required fields
    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/email address/i), 'john@example.com');

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    // Button should be disabled and show submitting text
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent(/submitting/i);
  });
});