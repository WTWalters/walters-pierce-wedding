# Walters-Pierce Wedding Website
## Complete Feature Plan & Technical Architecture

---

## 📋 **Project Overview**

**Wedding Date:** September 2026  
**Domain:** https://walters-pierce-wedding.com  
**Hosting:** Railway  
**Automation:** n8n (existing Railway instance)

---

## 🏗️ **Technical Stack Recommendation**

### **Frontend**
- **Framework:** Next.js 14 (React-based, great for SEO and performance)
- **Styling:** Tailwind CSS (maintains our elegant design system)
- **UI Components:** Shadcn/ui (beautiful, accessible components)
- **Animation:** Framer Motion (smooth transitions)

### **Backend**
- **Database:** PostgreSQL (on Railway)
- **ORM:** Prisma (type-safe database access)
- **Authentication:** NextAuth.js (for admin and guest login)
- **File Storage:** Cloudinary or AWS S3 (for photos)
- **Payment Processing:** Stripe (secure, reliable)
- **Email Service:** SendGrid or Resend (for invitations/notifications)

### **Automation**
- **n8n Workflows:** Integration with your existing instance
- **Webhooks:** For real-time updates

---

## 🎯 **Feature Specifications**

### **1. Photo Carousel (Main Page)**

**Implementation:**
- Use Embla Carousel or Swiper.js
- Lazy loading for performance
- Touch/swipe support for mobile
- Auto-play with pause on hover

**Data Structure:**
```javascript
{
  id: string,
  url: string,
  caption: string,
  order: number,
  isActive: boolean
}
```

---

### **2. Venue Information**

**Features:**
- Venue name, address, photos
- Embedded Google Maps
- Directions from major airports
- Parking information
- Hotel recommendations nearby

**Implementation:**
- Google Maps JavaScript API
- Static venue info in database
- "Get Directions" button opening in Google Maps app

---

### **3. Save the Date / Add to Calendar**

**Features:**
- Generate .ics files for:
  - Google Calendar
  - Apple Calendar
  - Outlook
- Include ceremony and reception times
- Add venue location to calendar event

**Implementation:**
```javascript
// Using ics.js library
const event = {
  start: [2026, 9, 15, 14, 0], // September 15, 2026, 2:00 PM
  duration: { hours: 6 },
  title: 'Emme & Connor Wedding',
  description: 'Celebration of love',
  location: 'Venue Name, Address',
  url: 'https://walters-pierce-wedding.com',
  categories: ['Wedding'],
  organizer: { name: 'Emme & Connor', email: 'contact@email.com' }
}
```

---

### **4. RSVP System**

#### **4a. Guest Registration & Contact Management**

**Database Schema:**
```sql
Guests {
  id: UUID
  email: string (unique)
  firstName: string
  lastName: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  dietaryRestrictions: text
  specialRequests: text
  invitationSentAt: timestamp
  rsvpReceivedAt: timestamp
  attending: boolean
  lastUpdated: timestamp
}

PlusOnes {
  id: UUID
  guestId: UUID (FK)
  firstName: string
  lastName: string
  dietaryRestrictions: text
  isChild: boolean
}
```

#### **4b. RSVP Flow**
1. Guest receives unique link via email
2. Pre-filled form with their info
3. Can add plus-ones/family members
4. Confirmation email sent upon submission

#### **4c. Data Export**
- Export to CSV/Excel format
- Include all guest info, plus-ones, dietary restrictions
- Filter by: attending, not responded, declined

#### **4d. Virtual Invitations**
- Beautiful HTML email template
- Unique RSVP link per guest
- Track email opens and clicks
- Resend capability

#### **4e. n8n Reminder Workflow**

**Week 1 Reminder:**
```
Subject: Save the Date - Emme & Connor's Wedding
"We're so excited to celebrate with you! Please RSVP at your earliest convenience."
```

**Week 2 Reminder:**
```
Subject: Reminder: RSVP for Emme & Connor's Wedding
"Just a friendly reminder to let us know if you can join us!"
```

**Week 3 Reminder:**
```
Subject: Final Reminder: Wedding RSVP
"We need to finalize our guest count. Please RSVP by [date]."
```

**Non-Response Message:**
```
Subject: We'll Miss You!
"We understand you won't be able to join us. We'll be sure to share photos!"
```

---

### **5. Registry (Honeymoon Fund)**

#### **5a. Honeymoon Experience Items**

**Database Schema:**
```sql
RegistryItems {
  id: UUID
  title: string // "Romantic Dinner for Two"
  description: text
  targetAmount: decimal
  amountRaised: decimal
  imageUrl: string
  category: enum ['flights', 'accommodation', 'dining', 'activities', 'other']
  isActive: boolean
}

Contributions {
  id: UUID
  registryItemId: UUID (FK)
  contributorName: string
  contributorEmail: string
  amount: decimal
  message: text
  paymentIntentId: string (Stripe)
  createdAt: timestamp
  thankYouSent: boolean
}
```

#### **5b. Payment Processing**
- Stripe Checkout for secure payments
- Support for credit/debit cards
- Option for Apple Pay/Google Pay
- Receipt emails automatically sent

#### **5c. Thank You Automation**
- Automatic email upon successful payment
- Personalized with contributor name and gift amount
- Option for Emme & Connor to add personal notes

---

### **6. Photo Galleries**

#### **Photo Categories:**
1. **Professional Wedding Photos** (admin upload only)
2. **Guest Photos** (moderated uploads)
3. **Planning Journey** (admin upload)
4. **Bachelorette Party** (moderated with comments)
5. **Bachelor Party** (moderated with comments)
6. **Honeymoon** (admin upload)

#### **Database Schema:**
```sql
Photos {
  id: UUID
  category: enum ['wedding', 'guest', 'planning', 'bachelorette', 'bachelor', 'honeymoon']
  uploadedBy: string
  uploadedByEmail: string
  caption: text
  fileUrl: string
  thumbnailUrl: string
  isApproved: boolean
  approvedBy: UUID
  approvedAt: timestamp
  createdAt: timestamp
}

PhotoComments {
  id: UUID
  photoId: UUID (FK)
  authorName: string
  authorEmail: string
  comment: text
  isApproved: boolean
  createdAt: timestamp
}
```

#### **Moderation System:**
- Admin dashboard for photo/comment approval
- Email notifications for new uploads
- Bulk approve/reject functionality
- Automatic image optimization on upload

---

## 📊 **Admin Dashboard Features**

### **Dashboard Overview:**
- Total RSVPs (attending/declined/pending)
- Registry contribution totals
- Recent photo uploads pending approval
- Quick stats and charts

### **Guest Management:**
- View/edit all guest information
- Send individual or bulk emails
- Export guest lists
- Track RSVP status

### **Content Management:**
- Upload/manage carousel photos
- Update venue information
- Manage registry items
- Moderate photo uploads and comments

### **Analytics:**
- RSVP response rate
- Registry contribution tracking
- Website traffic stats
- Email open/click rates

---

## 🚀 **Implementation Phases**

### **Phase 1: Foundation (Week 1-2)**
- Set up Next.js project structure
- Configure database (PostgreSQL on Railway)
- Implement basic authentication
- Create responsive layout with navigation

### **Phase 2: Core Features (Week 3-4)**
- Homepage with photo carousel
- Venue information page
- Save the date functionality
- Basic RSVP form

### **Phase 3: RSVP System (Week 5-6)**
- Guest database management
- Email invitation system
- RSVP tracking and updates
- n8n integration for reminders

### **Phase 4: Registry (Week 7-8)**
- Honeymoon fund items
- Stripe payment integration
- Contribution tracking
- Thank you automation

### **Phase 5: Photo Galleries (Week 9-10)**
- Photo upload system
- Moderation dashboard
- Gallery pages for each category
- Comment system

### **Phase 6: Polish & Testing (Week 11-12)**
- Performance optimization
- Mobile responsiveness testing
- Security audit
- User acceptance testing

---

## 🔒 **Security Considerations**

1. **Authentication:**
   - Secure admin login with 2FA option
   - Guest access via unique tokens

2. **Data Protection:**
   - Encrypted database connections
   - HTTPS everywhere
   - GDPR compliance for guest data

3. **File Uploads:**
   - File type validation
   - Size limits (max 10MB per photo)
   - Virus scanning for uploads

4. **Payment Security:**
   - PCI compliance via Stripe
   - No card details stored locally
   - SSL certificate required

---

## 📱 **Mobile Optimization**

- Progressive Web App (PWA) capabilities
- Touch-optimized interfaces
- Offline viewing of saved information
- Mobile-first responsive design
- App-like navigation

---

## 🎨 **Design System Consistency**

**Colors:**
- Primary: #00330a (Connor's green)
- Accent: #D4AF37 (Gold)
- Background: #fdfcfb (Cream)
- Text: #333333 (Dark gray)

**Typography:**
- Headers: Playfair Display
- Body: Montserrat
- Accent: Cormorant Garamond

**Components:**
- Consistent button styles
- Unified form inputs
- Standardized card layouts
- Coherent navigation patterns

---

## 📧 **Email Templates Needed**

1. Save the Date
2. Official Invitation
3. RSVP Confirmation
4. RSVP Reminders (3 versions)
5. Registry Thank You
6. Photo Upload Approval
7. Photo Upload Rejection
8. Wedding Day Reminder
9. Post-Wedding Thank You
10. Photo Gallery Available

---

## 💡 **Confirmed Additional Features**

### **Priority Features (Implementing)**
1. ✅ **Wedding Countdown Timer** on homepage
2. ✅ **Love Story Timeline** page
3. ✅ **Wedding Party Introductions** with photos and bios
   - Individual pages for each member
   - Bride's Parents page
   - Groom's Parents page
   - Officiant/Pastor page
4. ✅ **FAQ Section** for common questions
5. ✅ **Digital Guestbook** for messages
6. ✅ **Spotify Playlist** for reception song requests
7. ✅ **Social Media Hashtag Aggregator** 
   - Instagram integration with #EmmeLovesConnor2026
   - Snapchat custom geofilter
   - Moderated social wall
   - Live updates at reception

### **Future Considerations**
- **Live Stream Link** (if plans change)

### **Not Needed** (Indoor Colorado venue)
- ~~Weather Widget~~
- ~~Transportation Coordinator~~

---

## 📝 **Next Steps**

1. **Confirm Technical Stack** - Agree on technologies
2. **Set Up Development Environment** - Railway, GitHub
3. **Create Database Schema** - PostgreSQL setup
4. **Design Email Templates** - Brand consistency
5. **Configure n8n Workflows** - Automation setup
6. **Begin Phase 1 Development** - Foundation building

---

## 🎯 **Success Metrics**

- 90%+ RSVP response rate
- Zero payment processing issues
- <2 second page load times
- 100% mobile compatibility
- 95%+ email delivery rate
- <24 hour photo moderation time