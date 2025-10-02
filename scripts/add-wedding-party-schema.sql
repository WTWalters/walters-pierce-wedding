-- Add wedding party table to the database
-- This should be run after the initial schema

CREATE TABLE wedding_party (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- maid_of_honor, bridesmaid, best_man, groomsman, flower_girl, ring_bearer
    side VARCHAR(20) NOT NULL, -- bride, groom
    bio TEXT,
    relationship VARCHAR(255), -- relationship to couple
    photo_url VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false, -- for maid of honor, best man
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for querying by side and role
CREATE INDEX idx_wedding_party_side ON wedding_party(side);
CREATE INDEX idx_wedding_party_role ON wedding_party(role);
CREATE INDEX idx_wedding_party_sort ON wedding_party(sort_order);

-- Add trigger for updated_at
CREATE TRIGGER update_wedding_party_updated_at BEFORE UPDATE ON wedding_party
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();