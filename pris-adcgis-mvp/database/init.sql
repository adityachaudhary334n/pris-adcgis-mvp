-- ============================================================
-- PRIS + adcGIS  |  Core Database Schema
-- Pilot Districts: Ayodhya, Kaushambi, Agra (Uttar Pradesh)
-- Provenance is mandatory on every spatial record
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 1. Administrative Boundaries
-- ------------------------------------------------------------
CREATE TABLE admin_boundaries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level           VARCHAR(20) NOT NULL CHECK (level IN ('district', 'block', 'village')),
    name            VARCHAR(150) NOT NULL,
    name_hi         VARCHAR(150),
    parent_id       UUID REFERENCES admin_boundaries(id),
    district_code   VARCHAR(10),
    state_code      VARCHAR(5) DEFAULT 'UP',
    geom            GEOMETRY(MultiPolygon, 4326),
    properties      JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_level ON admin_boundaries(level);
CREATE INDEX idx_admin_parent ON admin_boundaries(parent_id);
CREATE INDEX idx_admin_geom ON admin_boundaries USING GIST(geom);
CREATE INDEX idx_admin_name ON admin_boundaries(name);

-- ------------------------------------------------------------
-- 2. Opportunities (Livelihood / Enterprise points)
-- ------------------------------------------------------------
CREATE TABLE opportunities (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title               VARCHAR(200) NOT NULL,
    title_hi            VARCHAR(200),
    category            VARCHAR(80) NOT NULL,          -- e.g. floriculture, dairy, solar, crafts
    description         TEXT,
    description_hi      TEXT,
    score               NUMERIC(5,2) CHECK (score >= 0 AND score <= 100),
    score_factors       JSONB DEFAULT '{}',            -- transparent breakdown
    image_url           TEXT,
    village_id          UUID REFERENCES admin_boundaries(id),
    district_name       VARCHAR(100),
    geom                GEOMETRY(Point, 4326),
    -- Provenance (mandatory)
    source              VARCHAR(150) NOT NULL,
    collection_method   VARCHAR(100),
    collected_at        DATE,
    valid_until         DATE,
    confidence          NUMERIC(3,2) DEFAULT 0.80 CHECK (confidence >= 0 AND confidence <= 1),
    review_status       VARCHAR(20) DEFAULT 'verified' CHECK (review_status IN ('draft', 'verified', 'rejected')),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opp_geom ON opportunities USING GIST(geom);
CREATE INDEX idx_opp_district ON opportunities(district_name);
CREATE INDEX idx_opp_category ON opportunities(category);
CREATE INDEX idx_opp_score ON opportunities(score DESC);

-- ------------------------------------------------------------
-- 3. Opportunity Setup Steps (structured knowledge)
-- ------------------------------------------------------------
CREATE TABLE opportunity_setup_steps (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id  UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    step_number     INTEGER NOT NULL,
    title           VARCHAR(200) NOT NULL,
    title_hi        VARCHAR(200),
    description     TEXT NOT NULL,
    description_hi  TEXT,
    estimated_days  INTEGER,
    estimated_cost  VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_steps_opp ON opportunity_setup_steps(opportunity_id);

-- ------------------------------------------------------------
-- 4. Flora & Fauna Observations
-- ------------------------------------------------------------
CREATE TABLE flora_fauna (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    species_name        VARCHAR(150) NOT NULL,
    species_name_hi     VARCHAR(150),
    common_name         VARCHAR(150),
    common_name_hi      VARCHAR(150),
    type                VARCHAR(30) CHECK (type IN ('flora', 'fauna', 'both')),
    description         TEXT,
    habitat_notes       TEXT,
    village_id          UUID REFERENCES admin_boundaries(id),
    district_name       VARCHAR(100),
    geom                GEOMETRY(Point, 4326),
    -- Provenance
    source              VARCHAR(150) NOT NULL,
    collection_method   VARCHAR(100),
    collected_at        DATE,
    valid_until         DATE,
    confidence          NUMERIC(3,2) DEFAULT 0.75,
    review_status       VARCHAR(20) DEFAULT 'verified',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ff_geom ON flora_fauna USING GIST(geom);
CREATE INDEX idx_ff_species ON flora_fauna(species_name);
CREATE INDEX idx_ff_district ON flora_fauna(district_name);

-- ------------------------------------------------------------
-- 5. Water & Soil Indicators
-- ------------------------------------------------------------
CREATE TABLE water_soil (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    indicator_type      VARCHAR(50) NOT NULL,          -- soil_ph, soil_moisture, water_quality, groundwater_depth
    value               NUMERIC(10,3),
    unit                VARCHAR(30),
    quality_label       VARCHAR(50),                   -- good / moderate / poor
    notes               TEXT,
    village_id          UUID REFERENCES admin_boundaries(id),
    district_name       VARCHAR(100),
    geom                GEOMETRY(Point, 4326),
    -- Provenance
    source              VARCHAR(150) NOT NULL,
    collection_method   VARCHAR(100),
    collected_at        DATE,
    valid_until         DATE,
    confidence          NUMERIC(3,2) DEFAULT 0.70,
    review_status       VARCHAR(20) DEFAULT 'verified',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ws_geom ON water_soil USING GIST(geom);
CREATE INDEX idx_ws_type ON water_soil(indicator_type);
CREATE INDEX idx_ws_district ON water_soil(district_name);

-- ------------------------------------------------------------
-- 6. Conservation / Research Zones
-- ------------------------------------------------------------
CREATE TABLE conservation_zones (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(200) NOT NULL,
    name_hi             VARCHAR(200),
    zone_type           VARCHAR(80),                   -- wetland, forest, biodiversity_corridor, research_plot
    description         TEXT,
    district_name       VARCHAR(100),
    geom                GEOMETRY(MultiPolygon, 4326),
    -- Provenance
    source              VARCHAR(150) NOT NULL,
    collection_method   VARCHAR(100),
    collected_at        DATE,
    valid_until         DATE,
    confidence          NUMERIC(3,2) DEFAULT 0.80,
    review_status       VARCHAR(20) DEFAULT 'verified',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cz_geom ON conservation_zones USING GIST(geom);
CREATE INDEX idx_cz_district ON conservation_zones(district_name);

-- ------------------------------------------------------------
-- 7. Plant Species Knowledge Base (for image matching + cultivation)
-- ------------------------------------------------------------
CREATE TABLE plant_species (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scientific_name     VARCHAR(150),
    common_name         VARCHAR(150) NOT NULL,
    common_name_hi      VARCHAR(150),
    local_names         TEXT[],
    family              VARCHAR(100),
    description         TEXT,
    cultivation_notes   TEXT NOT NULL,                 -- backyard / small-plot guidance
    cultivation_notes_hi TEXT,
    suitable_soil_ph_min NUMERIC(4,2),
    suitable_soil_ph_max NUMERIC(4,2),
    water_requirement   VARCHAR(50),
    sunlight            VARCHAR(50),
    best_season         VARCHAR(80),
    image_urls          TEXT[],
    tags                TEXT[],
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plant_common ON plant_species(common_name);
CREATE INDEX idx_plant_scientific ON plant_species(scientific_name);

-- ------------------------------------------------------------
-- Helpful views for Martin / FastAPI
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_opportunities_geojson AS
SELECT
    id,
    title,
    category,
    score,
    district_name,
    ST_AsGeoJSON(geom)::json AS geometry,
    source,
    confidence,
    review_status
FROM opportunities
WHERE review_status = 'verified';

CREATE OR REPLACE VIEW v_flora_fauna_geojson AS
SELECT
    id,
    species_name,
    common_name,
    type,
    district_name,
    ST_AsGeoJSON(geom)::json AS geometry,
    source,
    confidence
FROM flora_fauna
WHERE review_status = 'verified';

-- Grant usage
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pris;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pris;
