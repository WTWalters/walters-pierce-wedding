-- Walters-Pierce Wedding Database Schema
-- PostgreSQL Database for Railway Deployment
-- Created: 2025

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50) DEFAULT 'guest', -- admin, guest
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- GUEST MANAGEMENT
-- =====================================================

CREATE TABLE guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    dietary_restrictions TEXT,
    special_requests TEXT,
    invitation_code VARCHAR(50) UNIQUE,
    invitation_sent_at TIMESTAMP,
    invitation_opened_at TIMESTAMP,
    rsvp_received_at TIMESTAMP,
    attending BOOLEAN,
    table_number INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_guests_invitation_code ON guests(invitation_code);

CREATE TABLE plus_ones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    dietary_restrictions TEXT,
    is_child BOOLEAN DEFAULT false,
    age INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- REGISTRY / HONEYMOON FUND
-- =====================================================

CREATE TYPE registry_category AS ENUM ('flights', 'accommodation', 'dining', 'activities', 'other');

CREATE TABLE registry_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_amount DECIMAL(10, 2) NOT NULL,
    amount_raised DECIMAL(10, 2) DEFAULT 0,
    image_url VARCHAR(500),
    category registry_category NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registry_item_id UUID REFERENCES registry_items(id),
    contributor_name VARCHAR(255) NOT NULL,
    contributor_email VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    message TEXT,
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_charge_id VARCHAR(255),
    payment_status VARCHAR(50), -- pending, completed, failed
    thank_you_sent BOOLEAN DEFAULT false,
    thank_you_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contributions_email ON contributions(contributor_email);
CREATE INDEX idx_contributions_payment ON contributions(stripe_payment_intent_id);

-- =====================================================
-- PHOTO GALLERIES
-- =====================================================

CREATE TYPE photo_category AS ENUM ('engagement', 'wedding', 'guest', 'planning', 'bachelorette', 'bachelor', 'honeymoon');

CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category photo_category NOT NULL,
    uploaded_by_name VARCHAR(255),
    uploaded_by_email VARCHAR(255),
    caption TEXT,
    file_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    cloudinary_public_id VARCHAR(255),
    is_approved BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    is_featured BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_photos_category ON photos(category);
CREATE INDEX idx_photos_approved ON photos(is_approved);

CREATE TABLE photo_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
    author_name VARCHAR(255) NOT NULL,
    author_email VARCHAR(255) NOT NULL,
    comment TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- VENUE INFORMATION
-- =====================================================

CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    venue_type VARCHAR(50), -- ceremony, reception, both
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    phone VARCHAR(20),
    website VARCHAR(255),
    google_maps_url VARCHAR(500),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    parking_info TEXT,
    directions TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hotels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500),
    phone VARCHAR(20),
    website VARCHAR(255),
    booking_url VARCHAR(500),
    discount_code VARCHAR(50),
    distance_from_venue VARCHAR(50),
    price_range VARCHAR(50),
    notes TEXT,
    is_recommended BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- EVENTS & TIMELINE
-- =====================================================

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    venue_id UUID REFERENCES venues(id),
    dress_code VARCHAR(100),
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- EMAIL TRACKING
-- =====================================================

CREATE TABLE email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_id UUID REFERENCES guests(id),
    email_type VARCHAR(50), -- invitation, reminder, thank_you, etc.
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    status VARCHAR(50), -- sent, delivered, opened, clicked, bounced
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    sendgrid_message_id VARCHAR(255)
);

CREATE INDEX idx_email_logs_guest ON email_logs(guest_id);
CREATE INDEX idx_email_logs_type ON email_logs(email_type);

-- =====================================================
-- NOTIFICATION QUEUE (for n8n integration)
-- =====================================================

CREATE TABLE notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_type VARCHAR(50), -- rsvp_reminder, thank_you, etc.
    recipient_id UUID,
    recipient_email VARCHAR(255),
    payload JSONB,
    scheduled_for TIMESTAMP,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_queue_scheduled ON notification_queue(scheduled_for);
CREATE INDEX idx_notification_queue_processed ON notification_queue(processed);

-- =====================================================
-- AUDIT LOG
-- =====================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100),
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- =====================================================
-- WEBSITE SETTINGS
-- =====================================================

CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    value_type VARCHAR(50), -- string, number, boolean, json
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO settings (key, value, value_type, description) VALUES
('wedding_date', '2026-09-15 14:00:00', 'string', 'Wedding ceremony date and time'),
('rsvp_deadline', '2026-08-01', 'string', 'RSVP deadline date'),
('primary_color', '#00330a', 'string', 'Primary website color'),
('accent_color', '#D4AF37', 'string', 'Accent color'),
('couple_email', 'emme.ceejay@example.com', 'string', 'Couple contact email'),
('enable_registry', 'true', 'boolean', 'Enable registry/honeymoon fund'),
('enable_photo_uploads', 'true', 'boolean', 'Enable guest photo uploads'),
('max_plus_ones', '2', 'number', 'Maximum plus ones per guest');

-- =====================================================
-- VIEWS FOR REPORTING
-- =====================================================

CREATE VIEW rsvp_summary AS
SELECT 
    COUNT(*) as total_invited,
    COUNT(CASE WHEN attending = true THEN 1 END) as attending,
    COUNT(CASE WHEN attending = false THEN 1 END) as not_attending,
    COUNT(CASE WHEN attending IS NULL THEN 1 END) as no_response,
    COUNT(CASE WHEN rsvp_received_at IS NOT NULL THEN 1 END) as responded
FROM guests;

CREATE VIEW registry_summary AS
SELECT 
    ri.id,
    ri.title,
    ri.category,
    ri.target_amount,
    ri.amount_raised,
    COUNT(c.id) as contribution_count,
    ROUND((ri.amount_raised / ri.target_amount * 100), 2) as percent_funded
FROM registry_items ri
LEFT JOIN contributions c ON ri.id = c.registry_item_id AND c.payment_status = 'completed'
GROUP BY ri.id;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON guests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_registry_items_updated_at BEFORE UPDATE ON registry_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update registry amount raised
CREATE OR REPLACE FUNCTION update_registry_amount_raised()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE registry_items
    SET amount_raised = (
        SELECT COALESCE(SUM(amount), 0)
        FROM contributions
        WHERE registry_item_id = NEW.registry_item_id
        AND payment_status = 'completed'
    )
    WHERE id = NEW.registry_item_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_registry_amount
    AFTER INSERT OR UPDATE ON contributions
    FOR EACH ROW EXECUTE FUNCTION update_registry_amount_raised();

-- =====================================================
-- INITIAL ADMIN USER
-- =====================================================

-- Password should be hashed before insertion in production
-- This is just a placeholder
INSERT INTO users (email, role) VALUES
('admin@walters-pierce-wedding.com', 'admin');