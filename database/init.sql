-- ============================================================
-- PRIS + adcGIS  |  Statewide Uttar Pradesh Schema (v2)
-- Entire state · Multi-profile · Air volume as asset
-- Provenance mandatory on every observation & derived profile
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ------------------------------------------------------------
-- 1. Administrative Hierarchy (State → District → Block → Village / Suburb)
-- ------------------------------------------------------------
CREATE TABLE admin_boundaries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level           VARCHAR(20) NOT NULL CHECK (level IN ('state','district','block','village','suburb')),
    name            VARCHAR(200) NOT NULL,
    name_hi         VARCHAR(200),
    name_local      VARCHAR(200),
    parent_id       UUID REFERENCES admin_boundaries(id),
    district_code   VARCHAR(32),
    block_code      VARCHAR(32),
    village_code    VARCHAR(32),
    state_code      VARCHAR(5) DEFAULT 'UP',
    population      INTEGER,
    area_sqkm       NUMERIC(12,4),
    geom            GEOMETRY(MultiPolygon, 4326),            -- exact geometry
    geom_simple     GEOMETRY(MultiPolygon, 4326),            -- simplified copy for fast state/district/block display
    centroid        GEOMETRY(Point, 4326),
    properties      JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_level ON admin_boundaries(level);
CREATE INDEX idx_admin_parent ON admin_boundaries(parent_id);
CREATE INDEX idx_admin_geom ON admin_boundaries USING GIST(geom);
CREATE INDEX idx_admin_centroid ON admin_boundaries USING GIST(centroid);
CREATE INDEX idx_admin_name_trgm ON admin_boundaries USING GIN (name gin_trgm_ops);
CREATE INDEX idx_admin_name_hi_trgm ON admin_boundaries USING GIN (name_hi gin_trgm_ops);
CREATE INDEX idx_admin_district_code ON admin_boundaries(district_code);
CREATE INDEX idx_admin_block_code ON admin_boundaries(block_code);
CREATE INDEX idx_admin_soi_trgm ON admin_boundaries USING GIN ((properties->>'name_soi') gin_trgm_ops);
CREATE INDEX idx_admin_level_parent ON admin_boundaries(level, parent_id);

-- ------------------------------------------------------------
-- 2. Unit Profiles (multi-profile core for every admin unit)
-- ------------------------------------------------------------
CREATE TABLE unit_profiles (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id             UUID NOT NULL REFERENCES admin_boundaries(id) ON DELETE CASCADE,
    soil_profile        JSONB DEFAULT '{}',
    flora_fauna_profile JSONB DEFAULT '{}',
    human_capital       JSONB DEFAULT '{}',
    infrastructure      JSONB DEFAULT '{}',
    water_profile       JSONB DEFAULT '{}',
    climate_air         JSONB DEFAULT '{}',
    land_livelihood     JSONB DEFAULT '{}',
    industrial          JSONB DEFAULT '{}',
    sustainable         JSONB DEFAULT '{}',
    conservation_risk   JSONB DEFAULT '{}',
    entrepreneurship_index  NUMERIC(5,2),
    industrial_suitability  NUMERIC(5,2),
    sustainability_index    NUMERIC(5,2),
    conservation_value      NUMERIC(5,2),
    overall_opportunity      NUMERIC(5,2),
    profile_source      VARCHAR(200),
    profile_version     VARCHAR(40) DEFAULT 'v2',
    computed_at         TIMESTAMPTZ DEFAULT NOW(),
    confidence          NUMERIC(3,2) DEFAULT 0.70,
    review_status       VARCHAR(20) DEFAULT 'draft' CHECK (review_status IN ('draft','verified','rejected')),
    UNIQUE(unit_id)
);

CREATE INDEX idx_profiles_unit ON unit_profiles(unit_id);
CREATE INDEX idx_profiles_entrep ON unit_profiles(entrepreneurship_index DESC NULLS LAST);
CREATE INDEX idx_profiles_industry ON unit_profiles(industrial_suitability DESC NULLS LAST);
CREATE INDEX idx_profiles_sustain ON unit_profiles(sustainability_index DESC NULLS LAST);

-- ------------------------------------------------------------
-- 3. Air Volume / Air Resource Asset
-- ------------------------------------------------------------
CREATE TABLE air_resource (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id                 UUID REFERENCES admin_boundaries(id) ON DELETE CASCADE,
    airspace_class          VARCHAR(40),
    max_usable_height_m     NUMERIC(8,1),
    drone_corridor_score    NUMERIC(5,2),
    solar_irradiance_avg    NUMERIC(6,3),
    wind_class              VARCHAR(20),
    wind_speed_avg_ms       NUMERIC(5,2),
    pollution_load_index    NUMERIC(5,2),
    carbon_potential        NUMERIC(8,2),
    heritage_sensitivity    VARCHAR(30),
    agrivoltaic_suitability NUMERIC(5,2),
    monitoring_priority     NUMERIC(5,2),
    notes                   TEXT,
    geom                    GEOMETRY(MultiPolygon, 4326),
    source                  VARCHAR(150) NOT NULL,
    collection_method       VARCHAR(100),
    collected_at            DATE,
    valid_until             DATE,
    confidence              NUMERIC(3,2) DEFAULT 0.75,
    review_status           VARCHAR(20) DEFAULT 'verified',
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_air_unit ON air_resource(unit_id);
CREATE INDEX idx_air_geom ON air_resource USING GIST(geom);
CREATE INDEX idx_air_solar ON air_resource(solar_irradiance_avg DESC NULLS LAST);

-- ------------------------------------------------------------
-- 4. Opportunities
-- ------------------------------------------------------------
CREATE TABLE opportunities (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title               VARCHAR(250) NOT NULL,
    title_hi            VARCHAR(250),
    category            VARCHAR(80) NOT NULL,
    sub_category        VARCHAR(80),
    description         TEXT,
    description_hi      TEXT,
    score               NUMERIC(5,2) CHECK (score >= 0 AND score <= 100),
    score_factors       JSONB DEFAULT '{}',
    image_url           TEXT,
    unit_id             UUID REFERENCES admin_boundaries(id),
    district_name       VARCHAR(100),
    geom                GEOMETRY(Point, 4326),
    tags                TEXT[],
    source              VARCHAR(150) NOT NULL,
    collection_method   VARCHAR(100),
    collected_at        DATE,
    valid_until         DATE,
    confidence          NUMERIC(3,2) DEFAULT 0.80,
    review_status       VARCHAR(20) DEFAULT 'verified',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opp_geom ON opportunities USING GIST(geom);
CREATE INDEX idx_opp_district ON opportunities(district_name);
CREATE INDEX idx_opp_category ON opportunities(category);
CREATE INDEX idx_opp_score ON opportunities(score DESC);
CREATE INDEX idx_opp_unit ON opportunities(unit_id);

CREATE TABLE opportunity_setup_steps (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id  UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    step_number     INTEGER NOT NULL,
    title           VARCHAR(200) NOT NULL,
    title_hi        VARCHAR(200),
    description     TEXT NOT NULL,
    description_hi  TEXT,
    estimated_days  INTEGER,
    estimated_cost  VARCHAR(60),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_steps_opp ON opportunity_setup_steps(opportunity_id);

-- ------------------------------------------------------------
-- 5. Industrial Assets & Sustainable Projects
-- ------------------------------------------------------------
CREATE TABLE industrial_assets (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(250) NOT NULL,
    asset_type          VARCHAR(80),
    sector              VARCHAR(80),
    description         TEXT,
    employment_est      INTEGER,
    unit_id             UUID REFERENCES admin_boundaries(id),
    district_name       VARCHAR(100),
    geom                GEOMETRY(Geometry, 4326),
    properties          JSONB DEFAULT '{}',
    source              VARCHAR(150) NOT NULL,
    collected_at        DATE,
    confidence          NUMERIC(3,2) DEFAULT 0.75,
    review_status       VARCHAR(20) DEFAULT 'verified',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ind_geom ON industrial_assets USING GIST(geom);
CREATE INDEX idx_ind_district ON industrial_assets(district_name);

CREATE TABLE sustainable_projects (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(250) NOT NULL,
    project_type        VARCHAR(80),
    status              VARCHAR(40) DEFAULT 'potential',
    description         TEXT,
    capacity_info       VARCHAR(120),
    unit_id             UUID REFERENCES admin_boundaries(id),
    district_name       VARCHAR(100),
    geom                GEOMETRY(Geometry, 4326),
    score               NUMERIC(5,2),
    properties          JSONB DEFAULT '{}',
    source              VARCHAR(150) NOT NULL,
    collected_at        DATE,
    confidence          NUMERIC(3,2) DEFAULT 0.75,
    review_status       VARCHAR(20) DEFAULT 'verified',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sust_geom ON sustainable_projects USING GIST(geom);
CREATE INDEX idx_sust_type ON sustainable_projects(project_type);
CREATE INDEX idx_sust_district ON sustainable_projects(district_name);

-- ------------------------------------------------------------
-- 6. Observation layers
-- ------------------------------------------------------------
CREATE TABLE flora_fauna (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    species_name        VARCHAR(150) NOT NULL,
    species_name_hi     VARCHAR(150),
    common_name         VARCHAR(150),
    common_name_hi      VARCHAR(150),
    type                VARCHAR(30) CHECK (type IN ('flora','fauna','both')),
    description         TEXT,
    habitat_notes       TEXT,
    unit_id             UUID REFERENCES admin_boundaries(id),
    district_name       VARCHAR(100),
    geom                GEOMETRY(Point, 4326),
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

CREATE TABLE water_soil (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    indicator_type      VARCHAR(50) NOT NULL,
    value               NUMERIC(12,3),
    unit                VARCHAR(30),
    quality_label       VARCHAR(50),
    notes               TEXT,
    unit_id             UUID REFERENCES admin_boundaries(id),
    district_name       VARCHAR(100),
    geom                GEOMETRY(Point, 4326),
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

CREATE TABLE conservation_zones (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(250) NOT NULL,
    name_hi             VARCHAR(250),
    zone_type           VARCHAR(80),
    description         TEXT,
    district_name       VARCHAR(100),
    geom                GEOMETRY(MultiPolygon, 4326),
    source              VARCHAR(150) NOT NULL,
    collection_method   VARCHAR(100),
    collected_at        DATE,
    valid_until         DATE,
    confidence          NUMERIC(3,2) DEFAULT 0.80,
    review_status       VARCHAR(20) DEFAULT 'verified',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cz_geom ON conservation_zones USING GIST(geom);

-- ------------------------------------------------------------
-- 7. Plant knowledge base
-- ------------------------------------------------------------
CREATE TABLE plant_species (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scientific_name     VARCHAR(150),
    common_name         VARCHAR(150) NOT NULL,
    common_name_hi      VARCHAR(150),
    local_names         TEXT[],
    family              VARCHAR(100),
    description         TEXT,
    cultivation_notes   TEXT NOT NULL,
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

-- ------------------------------------------------------------
-- 8. Intelligence Pack metadata (for PDF / download products)
-- ------------------------------------------------------------
CREATE TABLE intelligence_packs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id         UUID REFERENCES admin_boundaries(id),
    pack_type       VARCHAR(40) DEFAULT 'village_brief',
    title           VARCHAR(250),
    generated_at    TIMESTAMPTZ DEFAULT NOW(),
    parameters      JSONB DEFAULT '{}',
    file_formats    TEXT[] DEFAULT ARRAY['pdf','geojson','csv'],
    status          VARCHAR(20) DEFAULT 'ready'
);

CREATE OR REPLACE VIEW v_district_summary AS
SELECT
    d.id, d.name, d.name_hi, d.district_code,
    d.area_sqkm, d.population,
    p.entrepreneurship_index, p.industrial_suitability,
    p.sustainability_index, p.conservation_value, p.overall_opportunity,
    ST_AsGeoJSON(d.geom)::json AS geometry
FROM admin_boundaries d
LEFT JOIN unit_profiles p ON p.unit_id = d.id
WHERE d.level = 'district';

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pris;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pris;
