# Protected Wedding Details System

## Overview
The wedding details have been moved to a private, protected page that only confirmed attendees can access. This provides privacy and exclusivity for detailed wedding information.

## How It Works

### 1. Public Home Page
- **General Information Only**: Basic venue, date, and invitation to RSVP
- **No Specific Times**: Timeline details are now private
- **Privacy Notice**: Clear indication that details are available after RSVP

### 2. RSVP Process
- **Session Creation**: When guest RSVPs "Yes", a secure session cookie is set
- **Access Grant**: Cookie provides access to protected wedding details page
- **Immediate Access**: Link to wedding details appears after successful "Yes" RSVP

### 3. Protected Wedding Details Page
- **URL**: `/wedding-details`
- **Access Control**: Checks for valid RSVP session cookie
- **Attendance Requirement**: Only guests who RSVP'd "Yes" can access

## Features

### Authentication System
```typescript
// Session cookie set on "Yes" RSVP
rsvp-session: {
  guestId: "guest-uuid",
  timestamp: "2026-01-01T00:00:00.000Z"
}
```

### Protected Content Includes
- **Detailed Timeline**: Hour-by-hour wedding day schedule
- **Venue Information**: Exact address, parking, accessibility details  
- **Important Instructions**: Weather considerations, dress code specifics
- **Contact Information**: Direct contact details for questions
- **Personal RSVP Details**: Guest's specific information and plus-ones

### Access Control Flow
1. **Guest visits `/wedding-details`**
2. **System checks for RSVP session cookie**
3. **Validates guest exists and attending = true**
4. **If authorized**: Shows detailed wedding information
5. **If not authorized**: Shows access denied with RSVP prompt

## Security Features

- **HTTP-Only Cookies**: Cannot be accessed via JavaScript
- **Secure Flag**: HTTPS-only in production
- **SameSite Protection**: CSRF protection
- **30-Day Expiration**: Automatic session cleanup
- **Guest Validation**: Database lookup to confirm attendance status

## User Experience

### For Confirmed Attendees
1. RSVP "Yes" with invitation code
2. See congratulations message with wedding details link
3. Click to view comprehensive wedding information
4. Session persists for 30 days for easy return visits

### For Non-Attendees or Unverified Users
1. Attempt to access wedding details page
2. See friendly access denied message
3. Directed to RSVP page to confirm attendance
4. Clear instructions on how to gain access

## Administration

### Viewing Access Logs
Admins can monitor who has accessed wedding details through:
- RSVP submission logs
- Email confirmation tracking
- Session creation timestamps

### Managing Access
- Access is automatically granted/revoked based on RSVP status
- Changing RSVP from "Yes" to "No" would invalidate access on next visit
- No manual access management required

## Privacy Benefits

✅ **Venue Security**: Address details only shared with confirmed guests  
✅ **Timeline Privacy**: Specific times not public knowledge  
✅ **Guest Information**: Contact details protected from public view  
✅ **Exclusive Feel**: Makes attendees feel special and trusted  
✅ **RSVP Encouragement**: Clear incentive to respond promptly  

## Technical Implementation

### API Endpoints
- `POST /api/rsvp/submit` - Sets session cookie on "Yes" RSVP
- `GET /api/wedding-details/access-check` - Validates access permissions

### Pages
- `/wedding-details` - Protected wedding information page
- `/rsvp` - Updated to show wedding details link after "Yes" submission
- `/` - Updated to remove specific details and encourage RSVP

The system provides a perfect balance of privacy, security, and user experience for the couple's special day.