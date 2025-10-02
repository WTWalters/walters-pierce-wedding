# Wedding Planning & Administration System
## Complete Feature Specification

---

## 👥 **User Management & Authentication**

### **Admin Users**
```sql
-- Enhanced Users Table
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'super_admin', 'admin', 'planner'
    permissions JSONB DEFAULT '{}',
    avatar_url VARCHAR(500),
    phone VARCHAR(20),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initial Admin Users
INSERT INTO admin_users (email, full_name, role) VALUES
('whitney@walters-pierce-wedding.com', 'Whitney Thomas Walters', 'super_admin'),
('nicolle@walters-pierce-wedding.com', 'Laurie Nicolle Walters', 'admin'),
('emme@walters-pierce-wedding.com', 'Murielle Aisling Walters', 'admin'),
('ceejay@walters-pierce-wedding.com', 'Connor Joseph Pierce', 'admin'),
('callie@walters-pierce-wedding.com', 'Callie [Last Name]', 'planner');
```

### **Permission Structure**
```javascript
const permissions = {
  super_admin: {
    // Whitney - Full access
    all: true
  },
  admin: {
    // Emme, Connor, Nicolle
    guests: ['view', 'edit', 'delete'],
    registry: ['view', 'edit'],
    photos: ['view', 'edit', 'approve'],
    todos: ['view', 'edit', 'create', 'delete'],
    invitations: ['view', 'send'],
    analytics: ['view']
  },
  planner: {
    // Callie
    guests: ['view', 'edit'],
    todos: ['view', 'edit', 'create'],
    invitations: ['view'],
    vendor: ['view', 'edit']
  }
};
```

---

## ✅ **Wedding Planning To-Do System**

### **Key Features**
- Multiple lists for different categories (venue, catering, flowers, etc.)
- Task assignment to specific team members
- Due date tracking with reminders
- Priority levels (urgent, high, normal, low)
- Progress tracking (pending, in progress, completed)
- Vendor association and tracking
- Cost tracking (estimated vs actual)
- File attachments for contracts, inspiration photos, etc.
- Comments and collaboration

### **Pre-Built Wedding Timeline Templates**
- **12 Months Before**: Venue booking, photographer, initial planning
- **9 Months Before**: Save the dates, catering, entertainment
- **6 Months Before**: Dress shopping, invitations, honeymoon planning
- **3 Months Before**: Final details, fittings, seating charts
- **1 Month Before**: Final counts, payments, confirmations
- **1 Week Before**: Rehearsal, final preparations

---

## 📧 **Email Invitation System - September 2025 Launch**

### **Campaign Timeline**
1. **July 2025**: Design Save the Date in Canva
2. **August 2025**: Import and verify guest list
3. **September 2025**: Send Save the Dates
4. **October 2025**: Track opens and begin RSVP collection

### **Features**
- **Canva Template Integration**: Direct import of beautiful designs
- **Guest List Management**: CSV import, Google Sheets sync, manual entry
- **Email Tracking**: 
  - Delivery confirmation
  - Open tracking with pixel
  - Click tracking for RSVP links
  - Bounce handling
- **Automated Follow-ups**: via n8n workflows
- **Real-time Analytics Dashboard**

### **Email Analytics Dashboard**
- Total sent/delivered/opened/clicked
- Individual guest tracking
- Geographic open rates
- Device/client statistics
- Best performing subject lines

---

## 📊 **Admin Dashboard Overview**

### **Dashboard Sections**

#### **For Whitney (Super Admin)**
- Complete system overview
- All user activity logs
- Financial overview
- Vendor management
- Guest list master control
- Email campaign management

#### **For Emme & Connor (Admins)**
- RSVP tracking
- Registry management
- Photo approvals
- Guest communications
- Wedding day timeline
- Social media monitoring

#### **For Nicolle (Admin)**
- Guest list management
- Seating arrangements
- Family communications
- Event coordination
- Photo galleries

#### **For Callie (Wedding Planner)**
- To-do list management
- Vendor coordination
- Timeline management
- Budget tracking
- Day-of coordination tools

---

## 🔔 **Notification System**

### **Automated Notifications**
1. **Task Reminders**: 1 week, 3 days, 1 day before due
2. **RSVP Alerts**: Real-time notifications for new responses
3. **Vendor Reminders**: Payment due dates, meeting reminders
4. **Guest Updates**: New messages, photo uploads
5. **System Alerts**: Low RSVP rate, approaching deadlines

### **Communication Channels**
- Email (primary)
- SMS (optional, for urgent items)
- In-app notifications
- Push notifications (PWA)

---

## 🔐 **Security & Access Control**

### **Security Features**
1. **Two-Factor Authentication** for all admin accounts
2. **Session Management** with timeout
3. **Audit Logging** of all actions
4. **Encrypted Password** storage (bcrypt)
5. **Role-Based Access Control** (RBAC)
6. **API Rate Limiting** to prevent abuse
7. **GDPR Compliance** for guest data

### **Access Levels**
- **Super Admin** (Whitney): Full system access
- **Admin** (Emme, Connor, Nicolle): Core features
- **Planner** (Callie): Planning tools
- **Guest**: Public website only

---

## 📱 **Mobile Features**

### **Progressive Web App (PWA)**
- Install to home screen
- Offline access to key data
- Push notifications
- Camera access for photo uploads
- Native app-like experience

### **Mobile-Optimized Features**
- Quick task check-off
- Photo upload from phone
- Voice notes for tasks
- Location-based check-ins
- QR code scanning

---

## 🚀 **Quick Implementation Plan**

### **Immediate Priorities (This Month)**
1. Set up admin authentication system
2. Create to-do list structure
3. Import initial guest list
4. Design Canva Save the Date template

### **August 2025**
1. Finalize guest list with addresses
2. Test email system
3. Complete to-do templates
4. Train all admins on system

### **September 2025**
1. **Send Save the Dates!** 📧
2. Monitor email analytics
3. Begin RSVP tracking
4. Start vendor coordination

---

## 📈 **Success Metrics**

### **Email Campaign Success**
- 95%+ delivery rate
- 75%+ open rate
- 60%+ RSVP click rate
- <2% bounce rate

### **Planning Efficiency**
- All tasks tracked digitally
- 100% vendor contracts uploaded
- Real-time budget tracking
- Automated reminder system

### **Team Collaboration**
- All 5 admins actively using system
- Daily task updates
- Shared calendar sync
- Centralized communication