import { generateRSVPConfirmationEmail, generateSaveTheDateConfirmationEmail, generateSaveTheDateEmail } from '../email';

jest.mock('resend', () => ({
  Resend: jest.fn(() => ({
    emails: {
      send: jest.fn(),
    },
  })),
}));

describe('generateRSVPConfirmationEmail', () => {
  it('should generate a confirmation email for attending guests', () => {
    const data = {
      guestName: 'John Doe',
      attending: true,
      plusOnes: [{ firstName: 'Jane', lastName: 'Doe' }],
      dietaryRestrictions: 'None',
      specialRequests: 'A seat near the window',
    };
    const email = generateRSVPConfirmationEmail(data);

    expect(email.subject).toContain('RSVP Confirmed');
    expect(email.html).toContain('John Doe');
    expect(email.html).toContain('Jane Doe');
    expect(email.html).toContain('None');
    expect(email.html).toContain('A seat near the window');
  });

  it('should generate a confirmation email for non-attending guests', () => {
    const data = {
      guestName: 'John Doe',
      attending: false,
    };
    const email = generateRSVPConfirmationEmail(data);

    expect(email.subject).toContain('RSVP Received');
    expect(email.html).toContain('John Doe');
    expect(email.html).toContain("sad you can't make it");
  });
});

describe('generateSaveTheDateConfirmationEmail', () => {
  it('should generate a save the date confirmation email', () => {
    const data = { guestName: 'John Doe' };
    const email = generateSaveTheDateConfirmationEmail(data);

    expect(email.subject).toContain('Thank you for signing up');
    expect(email.html).toContain('John Doe');
    expect(email.html).toContain('September 2026');
  });
});

describe('generateSaveTheDateEmail', () => {
  it('should generate a save the date email', () => {
    const email = generateSaveTheDateEmail('John Doe', '12345');

    expect(email.subject).toContain('Save the Date');
    expect(email.html).toContain('John Doe');
    expect(email.html).toContain('12345');
  });
});

