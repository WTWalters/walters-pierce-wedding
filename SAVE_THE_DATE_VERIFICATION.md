## Save-the-Date Form Data Storage Verification

✅ **Database Schema is Ready**
- The `Guest` table has all necessary fields including:
  - `firstName`, `lastName`, `email` (unique)
  - `phone` field for US phone numbers
  - Address fields: `addressLine1`, `city`, `state`, `zipCode`
  - `dietaryRestrictions` for food preferences
  - `createdAt` and `updatedAt` timestamps
  - `invitationCode` for future RSVP matching

✅ **API Endpoint Created**
- `/api/save-the-date` POST endpoint handles form submissions
- Validates email format using regex
- Validates US phone numbers and normalizes to +1XXXXXXXXXX format
- Checks for existing guests and updates their info
- Creates audit logs for tracking
- Sends confirmation emails

✅ **Form Validation Added**
- **Email Validation**: 
  - Required field
  - Validates format on blur and submit
  - Uses regex: `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/`
  - Shows inline error messages

- **Phone Number Validation**:
  - Optional field
  - Auto-formats as user types: (XXX) XXX-XXXX
  - Validates 10-digit US numbers
  - Stores in database as normalized format: +1XXXXXXXXXX
  - Shows inline error messages

- **Zip Code Validation**:
  - Accepts formats: 12345 or 12345-6789
  - Shows inline error if invalid

✅ **Email Confirmation System**
- Sends confirmation email after successful signup
- Custom email template with wedding theme
- Fallback logging if email service is not configured

## Key Features:

1. **Data Persistence**: All form data is stored in PostgreSQL database
2. **Email Deduplication**: Uses email as unique identifier to prevent duplicates
3. **Update Capability**: If a guest signs up again, their info is updated
4. **Audit Trail**: All submissions are logged in the audit_log table
5. **Email Tracking**: Email sends are logged in email_logs table

## Testing the Form:

1. Navigate to `/save-the-date`
2. Fill in the form with:
   - Valid email (e.g., john.doe@example.com)
   - US phone number (will auto-format)
   - Optional address fields
3. Submit and check:
   - Success message appears
   - Data is saved in database
   - Confirmation email is sent (if configured)

## Email Matching for Campaigns:

The email field is the primary key for matching between:
- Save-the-date signups
- Formal invitation sends
- RSVP responses

This ensures consistent guest tracking throughout the wedding planning process.
