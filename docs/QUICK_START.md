# Walters-Pierce Wedding Website - Quick Start Guide

## 🚀 Getting Started

This guide will help you set up the full-featured wedding website for Emme & Connor's September 2026 wedding.

---

## Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** database (via Railway)
3. **Stripe Account** (for payments)
4. **SendGrid/Resend Account** (for emails)
5. **Cloudinary Account** (for image hosting)
6. **n8n Instance** (already on Railway)

---

## Step 1: Database Setup on Railway

1. **Create PostgreSQL Database:**
   ```bash
   # In your Railway project
   railway add
   # Select PostgreSQL
   ```

2. **Run Database Schema:**
   ```bash
   # Connect to your Railway PostgreSQL
   railway connect postgres
   
   # Run the schema file
   \i docs/database_schema.sql
   ```

3. **Get Database URL:**
   ```bash
   railway variables
   # Copy DATABASE_URL
   ```

---

## Step 2: Project Setup

1. **Initialize Next.js Project:**
   ```bash
   npx create-next-app@latest wedding-app --typescript --tailwind --app
   cd wedding-app
   ```

2. **Install Dependencies:**
   ```bash
   npm install @prisma/client prisma
   npm install next-auth @auth/prisma-adapter
   npm install stripe @stripe/stripe-js
   npm install @sendgrid/mail
   npm install cloudinary multer
   npm install framer-motion
   npm install lucide-react
   npm install @radix-ui/react-dialog
   npm install date-fns
   npm install react-hook-form zod
   npm install embla-carousel-react
   npm install ics
   ```

3. **Setup Prisma:**
   ```bash
   npx prisma init
   ```

   Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

4. **Environment Variables:**
   Create `.env.local`:
   ```env
   # Database
   DATABASE_URL="your-railway-postgresql-url"
   
   # NextAuth
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="generate-a-secret-key"
   
   # Stripe
   STRIPE_SECRET_KEY="sk_test_..."
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
   
   # SendGrid
   SENDGRID_API_KEY="your-sendgrid-key"
   
   # Cloudinary
   CLOUDINARY_CLOUD_NAME="your-cloud-name"
   CLOUDINARY_API_KEY="your-api-key"
   CLOUDINARY_API_SECRET="your-api-secret"
   
   # n8n Webhook URLs
   N8N_WEBHOOK_URL="https://your-n8n-instance.railway.app/webhook"
   ```

---

## Step 3: n8n Workflow Setup

### RSVP Reminder Workflow

1. **Create HTTP Webhook Trigger**
   - URL: `/webhook/rsvp-reminder`
   - Method: POST

2. **Add Schedule Trigger**
   - Run daily at 9:00 AM
   - Check for guests needing reminders

3. **PostgreSQL Node**
   - Query guests without RSVP
   - Filter by invitation sent date

4. **SendGrid Node**
   - Send reminder emails
   - Use templates for each reminder stage

5. **Update Database Node**
   - Mark reminder as sent
   - Update notification queue

### Thank You Automation Workflow

1. **Stripe Webhook Trigger**
   - Listen for `payment_intent.succeeded`

2. **PostgreSQL Query**
   - Get contribution details
   - Get contributor information

3. **SendGrid Email**
   - Send personalized thank you
   - Include contribution details

4. **Update Database**
   - Mark thank_you_sent = true

---

## Step 4: Project Structure

```
wedding-app/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── admin/
│   ├── (public)/
│   │   ├── page.tsx (Homepage)
│   │   ├── venue/
│   │   ├── rsvp/
│   │   ├── registry/
│   │   └── photos/
│   ├── api/
│   │   ├── auth/
│   │   ├── rsvp/
│   │   ├── registry/
│   │   ├── photos/
│   │   └── webhooks/
│   └── layout.tsx
├── components/
│   ├── ui/
│   ├── forms/
│   ├── gallery/
│   └── admin/
├── lib/
│   ├── prisma.ts
│   ├── stripe.ts
│   ├── sendgrid.ts
│   └── cloudinary.ts
├── prisma/
│   └── schema.prisma
└── public/
```

---

## Step 5: Key Components to Build

### 1. Homepage with Carousel
```tsx
// components/EngagementCarousel.tsx
import { EmblaCarousel } from 'embla-carousel-react'

export function EngagementCarousel({ photos }) {
  // Implement carousel logic
}
```

### 2. RSVP Form
```tsx
// components/forms/RSVPForm.tsx
export function RSVPForm({ guestId, invitationCode }) {
  // Guest info form
  // Plus ones management
  // Dietary restrictions
}
```

### 3. Registry/Honeymoon Fund
```tsx
// components/registry/HoneymoonFund.tsx
export function HoneymoonFund({ items }) {
  // Display fund items
  // Stripe checkout integration
}
```

### 4. Photo Upload
```tsx
// components/gallery/PhotoUpload.tsx
export function PhotoUpload({ category }) {
  // Cloudinary upload widget
  // Moderation queue
}
```

---

## Step 6: Deployment to Railway

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial wedding website setup"
   git push origin main
   ```

2. **Connect Railway to GitHub:**
   - Go to Railway dashboard
   - Create new project
   - Connect GitHub repo
   - Add environment variables

3. **Configure Build:**
   ```json
   // railway.json
   {
     "build": {
       "builder": "NIXPACKS",
       "buildCommand": "npm run build"
     },
     "deploy": {
       "startCommand": "npm start",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

---

## Step 7: Testing Checklist

- [ ] Homepage loads with carousel
- [ ] Venue page shows Google Maps
- [ ] Save the date generates calendar file
- [ ] RSVP form accepts submissions
- [ ] Guest receives confirmation email
- [ ] Registry displays items
- [ ] Stripe payment processes
- [ ] Photo upload works
- [ ] Admin can moderate photos
- [ ] n8n workflows trigger
- [ ] Mobile responsive
- [ ] Performance under 2s load

---

## Step 8: Security Checklist

- [ ] HTTPS enabled
- [ ] Environment variables secured
- [ ] Database credentials protected
- [ ] File upload validation
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF tokens
- [ ] Rate limiting
- [ ] Admin authentication
- [ ] Guest token validation

---

## Support & Resources

- **Next.js Documentation:** https://nextjs.org/docs
- **Prisma Documentation:** https://www.prisma.io/docs
- **Stripe Documentation:** https://stripe.com/docs
- **Railway Documentation:** https://docs.railway.app
- **n8n Documentation:** https://docs.n8n.io

---

## Questions?

Feel free to reach out if you need help with any aspect of the setup!