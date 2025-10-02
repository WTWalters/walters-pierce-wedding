# 🚀 Claude Code Development Handoff
## Walters-Pierce Wedding Website

---

## 📋 PROJECT OVERVIEW

**Client:** Whitney Thomas Walters (Father of the Bride)  
**Wedding:** Emme (Murielle Aisling Walters) & Connor (Connor Joseph Pierce)  
**Date:** September 2026 (exact date TBD)  
**Domain:** https://walters-pierce-wedding.com  
**Hosting:** Railway  
**Repository:** https://github.com/WTWalters/Walters-Pierce-Wedding  
**Local Path:** `/Users/whitneywalters/AIProgramming/Walters-Pierce-Wedding`

---

## 🎯 IMMEDIATE DEVELOPMENT PRIORITIES

### Phase 1: Foundation Setup (Start Here!)
Build a Next.js application with these initial features:

1. **Convert static HTML to Next.js**
   - Migrate current design from `index.html`
   - Maintain green (#00330a) and gold (#D4AF37) color scheme
   - Keep elegant aesthetic

2. **Set up PostgreSQL Database**
   - Use schema in `docs/database_schema.sql`
   - Deploy on Railway
   - Configure Prisma ORM

3. **Implement Admin Authentication**
   - 5 admin users (see `docs/ADMIN_PLANNING_SYSTEM.md`)
   - Role-based access control
   - Secure login system

4. **Create Basic Admin Dashboard**
   - To-do list management
   - Guest list import (CSV)
   - Basic RSVP tracking

---

## 📁 CURRENT PROJECT STRUCTURE

```
Walters-Pierce-Wedding/
├── index.html                        # Current static placeholder (to be migrated)
├── README.md                         # Project overview
├── CLAUDE.md                         # (Outdated - ignore)
└── docs/
    ├── FEATURE_PLAN.md              # Complete feature specifications ⭐
    ├── database_schema.sql          # PostgreSQL schema (ready to use) ⭐
    ├── QUICK_START.md               # Development setup guide ⭐
    ├── ADMIN_PLANNING_SYSTEM.md     # Admin system specs
    └── SOCIAL_MEDIA_IMPLEMENTATION.md # Social features (Phase 3)
```

---

## 🏗️ RECOMMENDED TECH STACK

```json
{
  "framework": "Next.js 14 (App Router)",
  "styling": "Tailwind CSS",
  "database": "PostgreSQL (Railway)",
  "orm": "Prisma",
  "auth": "NextAuth.js",
  "email": "SendGrid or Resend",
  "payments": "Stripe",
  "fileStorage": "Cloudinary",
  "deployment": "Railway"
}
```

---

## 👨‍💻 DEVELOPMENT STEPS

### Step 1: Initialize Next.js Project
```bash
# In the repository root
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir
```

### Step 2: Install Core Dependencies
```bash
npm install @prisma/client prisma
npm install next-auth @auth/prisma-adapter
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install lucide-react
npm install date-fns
npm install react-hook-form @hookform/resolvers zod
```

### Step 3: Setup Prisma
```bash
npx prisma init
# Then apply the schema from docs/database_schema.sql
```

### Step 4: Environment Variables (.env.local)
```env
# Database
DATABASE_URL=""  # Get from Railway

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""  # Generate with: openssl rand -base64 32

# To be added later:
# STRIPE_SECRET_KEY=""
# SENDGRID_API_KEY=""
# CLOUDINARY_URL=""
```

### Step 5: Create Project Structure
```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   └── layout.tsx
├── (public)/
│   ├── page.tsx          # Homepage
│   ├── venue/
│   ├── wedding-party/
│   └── layout.tsx
├── admin/
│   ├── page.tsx          # Admin dashboard
│   ├── todos/
│   ├── guests/
│   └── layout.tsx
├── api/
│   ├── auth/[...nextauth]/
│   └── admin/
├── globals.css
└── layout.tsx

components/
├── ui/                   # Reusable UI components
├── admin/               # Admin-specific components
└── public/              # Public website components

lib/
├── auth.ts
├── prisma.ts
└── utils.ts
```

---

## 🎨 DESIGN SYSTEM

### Colors
```css
:root {
  --primary: #00330a;        /* Connor's forest green */
  --primary-light: #004d0f;
  --accent: #D4AF37;         /* Gold */
  --accent-dark: #B8860B;
  --background: #fdfcfb;     /* Cream */
  --text: #333333;
  --text-light: #666666;
}
```

### Fonts
```css
/* Already in use - maintain these */
font-family: 'Playfair Display', serif;    /* Headers */
font-family: 'Montserrat', sans-serif;     /* Body */
font-family: 'Cormorant Garamond', serif;  /* Accents */
```

---

## 🔑 KEY FEATURES TO IMPLEMENT

### Phase 1 (Immediate - By End of This Month)
- [x] Current placeholder site (exists)
- [ ] Next.js migration
- [ ] Database setup
- [ ] Admin authentication
- [ ] Basic admin dashboard
- [ ] To-do list system
- [ ] Guest list import

### Phase 2 (Next Month)
- [ ] RSVP system
- [ ] Email integration setup
- [ ] Venue information page
- [ ] Save the date functionality
- [ ] Wedding party pages

### Phase 3 (July-August 2025)
- [ ] Save-the-date email campaign
- [ ] Photo galleries
- [ ] Social media integration
- [ ] Registry/honeymoon fund

### Phase 4 (September 2025 - Launch)
- [ ] Send Save-the-Dates
- [ ] Full RSVP tracking
- [ ] Payment processing
- [ ] Complete testing

---

## ⚠️ IMPORTANT NOTES

### Admin Users to Create
```javascript
const adminUsers = [
  { email: 'whitney@walters-pierce-wedding.com', name: 'Whitney Thomas Walters', role: 'super_admin' },
  { email: 'nicolle@walters-pierce-wedding.com', name: 'Laurie Nicolle Walters', role: 'admin' },
  { email: 'emme@walters-pierce-wedding.com', name: 'Murielle Aisling Walters', role: 'admin' },
  { email: 'ceejay@walters-pierce-wedding.com', name: 'Connor Joseph Pierce', role: 'admin' },
  { email: 'callie@walters-pierce-wedding.com', name: 'Callie [LastName]', role: 'planner' }
];
```

### Known Information
- **Bride's Parents:** Whitney Thomas Walters (father), Laurie Nicolle Walters (mother - goes by Nicolle)
- **Wedding Colors:** Forest Green (#00330a) and Gold (#D4AF37)
- **Venue:** Indoor Colorado location (specific venue TBD)
- **Save-the-Date Target:** September 2025

### Pending Information (Don't Block Development)
- Exact wedding date in September 2026
- Venue name and address
- Guest count (estimate 200-250)
- Connor's parents' names
- Wedding party members
- Callie's last name

---

## 📝 FIRST PULL REQUEST CHECKLIST

Your first PR should include:

- [ ] Next.js project initialized with TypeScript
- [ ] Tailwind CSS configured with wedding color scheme
- [ ] Homepage migrated from current `index.html`
- [ ] Basic routing structure
- [ ] Prisma configured (schema applied)
- [ ] Database connection verified
- [ ] Admin login page created
- [ ] Basic admin dashboard layout
- [ ] README updated with setup instructions

---

## 🚦 SUCCESS CRITERIA

The initial build is successful when:
1. Site deploys on Railway
2. Homepage matches current design
3. Admin users can log in
4. Database connection works
5. Basic CRUD operations functional

---

## 💬 COMMUNICATION

- **Primary Contact:** Whitney Thomas Walters
- **Project Management:** GitHub Issues
- **Deployment:** Railway (auto-deploy from main branch)

---

## 🔗 REFERENCE DOCUMENTS

1. **Feature Specifications:** `/docs/FEATURE_PLAN.md`
2. **Database Schema:** `/docs/database_schema.sql`
3. **Quick Start Guide:** `/docs/QUICK_START.md`
4. **Admin System:** `/docs/ADMIN_PLANNING_SYSTEM.md`
5. **Social Media (Future):** `/docs/SOCIAL_MEDIA_IMPLEMENTATION.md`

---

## ⚡ QUICK START COMMANDS

```bash
# Clone and setup
git clone https://github.com/WTWalters/Walters-Pierce-Wedding.git
cd Walters-Pierce-Wedding

# Initialize Next.js (if not done)
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir

# Install dependencies
npm install

# Setup database
npx prisma init
npx prisma db push

# Run development
npm run dev

# Deploy to Railway
git push origin main
```

---

## ❓ QUESTIONS TO ASK BEFORE STARTING

1. Do you have Railway project access?
2. Do you have the PostgreSQL connection string?
3. Any specific component library preferences?
4. Preferred branch strategy? (main only or feature branches?)

---

## 🎯 FOCUS AREAS

**DO First:**
- Get basic Next.js site running
- Migrate current design
- Setup authentication
- Create admin dashboard structure

**DON'T Worry About Yet:**
- Payment processing
- Email sending
- Social media integration
- Complex animations

**ASK if Unclear:**
- Any architectural decisions
- Third-party service choices
- UI/UX decisions not specified

---

## ✅ READY TO START!

This document provides everything needed to begin development. Start with Phase 1 and create a solid foundation. The wedding is in September 2026, but Save-the-Dates go out in September 2025, so we have good timeline padding.

**First Goal:** Get a working Next.js site deployed to Railway that matches the current design and includes basic admin functionality.

Good luck! 🚀