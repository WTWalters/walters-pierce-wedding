# Google Sheets Integration Setup Guide

## Overview
The wedding admin panel includes Google Sheets integration that allows you to export guest data directly to a new Google Spreadsheet in your Google Drive.

## Prerequisites
- Google Cloud Platform account
- Google Drive and Google Sheets APIs enabled

## Setup Instructions

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Sheets API
   - Google Drive API

### 2. Create OAuth2 Credentials
1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Configure the OAuth consent screen if prompted
4. Set application type to "Web application"
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/admin/guests/google-sheets/callback` (development)
   - `https://yourdomain.com/api/admin/guests/google-sheets/callback` (production)

### 3. Configure Environment Variables
Add the following to your `.env.local` file:

```env
# Google Sheets Integration
GOOGLE_CLIENT_ID="your-google-client-id-here"
GOOGLE_CLIENT_SECRET="your-google-client-secret-here"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/admin/guests/google-sheets/callback"
```

### 4. Update for Production
For production deployment, update:
- `GOOGLE_REDIRECT_URI` to use your production domain
- Add your production domain to the authorized redirect URIs in Google Cloud Console

## How It Works

### Admin Interface
1. Go to `/admin/guests`
2. Click "Export to Google Sheets"
3. You'll be redirected to Google for authorization
4. After authorization, a new spreadsheet will be created with all guest data
5. The spreadsheet URL will be displayed for easy access

### Features
- Creates a new spreadsheet with current date in the title
- Includes all guest information and RSVP data
- Formats header row with wedding colors (forest green background)
- Auto-resizes columns for better readability
- Includes plus-one information

### Data Exported
- Guest names and contact information
- Address details
- Invitation status and RSVP responses
- Plus-one details
- Dietary restrictions and special requests
- Table assignments and notes

## Security Notes
- OAuth2 flow ensures secure access to user's Google account
- Only creates new spreadsheets, doesn't access existing files
- Uses minimal required scopes (spreadsheets and drive.file)
- Admin authentication required before accessing Google integration