-- PRIS + adcGIS demo data (profiles, air, opportunities, observations). CRS EPSG:4326 (lon, lat).
-- Boundaries come from 03_up_admin_load.sql.gz (real SOI/LGD data). Demo rows below attach to the 5 pilot districts
-- (Ayodhya, Kaushambi, Agra, Lucknow, Varanasi) and to points that the geotag trigger links to the right village/block.

-- Sample profiles for districts
INSERT INTO unit_profiles (
    unit_id, soil_profile, human_capital, infrastructure, water_profile, climate_air,
    industrial, sustainable, conservation_risk,
    entrepreneurship_index, industrial_suitability, sustainability_index,
    conservation_value, overall_opportunity, profile_source, confidence, review_status
) VALUES
('a1000000-0000-4000-8000-000000000001',
 '{"ph_avg": 7.2, "texture": "loam", "crop_suitability": ["marigold", "wheat"]}',
 '{"literacy_proxy": 72, "workforce_youth_share": 0.35}',
 '{"road_access": "good", "power_reliability": "moderate"}',
 '{"gw_depth_m": 8.5, "quality": "moderate"}',
 '{"solar_kwh": 5.4, "crs": "EPSG:4326"}',
 '{"existing": "agro-processing"}',
 '{"potential": ["temple flower value chain"]}',
 '{"heritage_buffer": "high near core"}',
 82, 68, 75, 70, 78, 'PRIS composite v2', 0.80, 'verified'),
('a1000000-0000-4000-8000-000000000002',
 '{"ph_avg": 6.9, "texture": "alluvial"}',
 '{"literacy_proxy": 68}',
 '{"road_access": "moderate"}',
 '{"gw_depth_m": 10.0}',
 '{"solar_kwh": 5.3, "crs": "EPSG:4326"}',
 '{"existing": "agro"}',
 '{"potential": ["banana value chain"]}',
 '{"heritage_buffer": "low"}',
 76, 62, 78, 55, 72, 'PRIS composite v2', 0.78, 'verified'),
('a1000000-0000-4000-8000-000000000003',
 '{"ph_avg": 7.8, "texture": "alluvial"}',
 '{"literacy_proxy": 74, "skill_notes": "crafts, tourism"}',
 '{"road_access": "good", "tourism_access": "excellent"}',
 '{"gw_depth_m": 12.0}',
 '{"solar_kwh": 5.6, "crs": "EPSG:4326"}',
 '{"existing": "tourism, leather"}',
 '{"potential": ["heritage crafts", "solar dryers"]}',
 '{"heritage_buffer": "very high"}',
 85, 70, 72, 88, 80, 'PRIS composite v2', 0.85, 'verified'),
('a1000000-0000-4000-8000-000000000004',
 '{"ph_avg": 7.1}',
 '{"literacy_proxy": 80}',
 '{"road_access": "excellent", "digital": "high"}',
 '{"gw_depth_m": 15.0}',
 '{"solar_kwh": 5.2, "crs": "EPSG:4326"}',
 '{"existing": "services"}',
 '{"potential": ["urban farming", "logistics"]}',
 '{"heritage_buffer": "medium"}',
 88, 75, 70, 50, 81, 'PRIS composite v2', 0.82, 'verified'),
('a1000000-0000-4000-8000-000000000005',
 '{"ph_avg": 7.0}',
 '{"literacy_proxy": 76}',
 '{"road_access": "good", "tourism_access": "excellent"}',
 '{"gw_depth_m": 11.0}',
 '{"solar_kwh": 5.3, "crs": "EPSG:4326"}',
 '{"existing": "handloom, tourism"}',
 '{"potential": ["craft value chain"]}',
 '{"heritage_buffer": "high"}',
 84, 65, 74, 82, 79, 'PRIS composite v2', 0.83, 'verified');

INSERT INTO air_resource (
    unit_id, airspace_class, max_usable_height_m, drone_corridor_score,
    solar_irradiance_avg, wind_class, heritage_sensitivity, agrivoltaic_suitability,
    source, collection_method, collected_at, confidence, review_status
) VALUES
('a1000000-0000-4000-8000-000000000001', 'sensitive', 120, 55, 5.40, 'low-moderate', 'high', 70, 'PRIS', 'proxy', '2025-11-01', 0.80, 'verified'),
('a1000000-0000-4000-8000-000000000002', 'unrestricted', 150, 72, 5.30, 'low', 'low', 78, 'PRIS', 'proxy', '2025-11-01', 0.78, 'verified'),
('a1000000-0000-4000-8000-000000000003', 'restricted', 80, 40, 5.60, 'low-moderate', 'very high', 60, 'PRIS', 'proxy', '2025-11-01', 0.85, 'verified'),
('a1000000-0000-4000-8000-000000000004', 'controlled', 130, 68, 5.20, 'low', 'medium', 65, 'PRIS', 'proxy', '2025-11-01', 0.80, 'verified'),
('a1000000-0000-4000-8000-000000000005', 'sensitive', 100, 50, 5.30, 'low', 'high', 68, 'PRIS', 'proxy', '2025-11-01', 0.82, 'verified');

-- Opportunities pinned to villages (first village-ish points per district)

INSERT INTO opportunities (id, title, category, description, score, score_factors, unit_id, district_name, geom, source, collection_method, collected_at, valid_until, confidence, review_status)
VALUES
('c1000000-0000-4000-8000-000000000101', 'Marigold Cultivation for Temple Demand', 'floriculture', 'High temple and market demand.', 86.5,
 '{"suitability": 90, "market_proximity": 88, "resource_availability": 82, "local_demand": 92}',
 'a1000000-0000-4000-8000-000000000001', 'Ayodhya', ST_SetSRID(ST_MakePoint(82.12, 26.80), 4326),
 'PRIS Field Pilot', 'survey', '2025-11-12', '2026-11-12', 0.88, 'verified'),
('c1000000-0000-4000-8000-000000000201', 'Banana + Intercrop Model', 'horticulture', 'Suitable soil and water for banana intercrops.', 81.0,
 '{"suitability": 85, "market_proximity": 75, "resource_availability": 84, "local_demand": 78}',
 'a1000000-0000-4000-8000-000000000002', 'Kaushambi', ST_SetSRID(ST_MakePoint(81.39, 25.42), 4326),
 'PRIS Field Pilot', 'survey', '2025-09-05', '2026-09-05', 0.85, 'verified'),
('c1000000-0000-4000-8000-000000000301', 'Heritage Craft Souvenir Micro-Enterprise', 'crafts', 'Tourist demand for souvenirs.', 88.0,
 '{"suitability": 85, "market_proximity": 95, "resource_availability": 80, "local_demand": 92}',
 'a1000000-0000-4000-8000-000000000003', 'Agra', ST_SetSRID(ST_MakePoint(78.07, 27.17), 4326),
 'PRIS Field Pilot', 'survey', '2025-08-18', '2026-08-18', 0.90, 'verified'),
('c1000000-0000-4000-8000-000000000302', 'Solar Dryer for Agricultural Produce', 'renewable', 'High solar irradiance belt.', 79.5,
 '{"suitability": 88, "market_proximity": 70, "resource_availability": 82, "local_demand": 75}',
 'a1000000-0000-4000-8000-000000000003', 'Agra', ST_SetSRID(ST_MakePoint(77.97, 27.14), 4326),
 'PRIS Field Pilot', 'survey', '2025-07-22', '2026-07-22', 0.84, 'verified');

INSERT INTO opportunity_setup_steps (opportunity_id, step_number, title, description, estimated_days, estimated_cost) VALUES
('c1000000-0000-4000-8000-000000000101', 1, 'Soil Testing', 'Test soil pH and prepare beds.', 7, 'Rs 1500-3000'),
('c1000000-0000-4000-8000-000000000101', 2, 'Seedling Procurement', 'Source quality marigold seedlings.', 3, 'Rs 2000-4000'),
('c1000000-0000-4000-8000-000000000101', 3, 'Planting', 'Transplant and set up irrigation.', 5, 'Rs 3000-8000'),
('c1000000-0000-4000-8000-000000000301', 1, 'Skill Mapping', 'Identify artisans and designs.', 7, 'Low'),
('c1000000-0000-4000-8000-000000000301', 2, 'Material Sourcing', 'Local marble, leather, textile inputs.', 5, 'Rs 5000-15000')
;

-- Point observations (demo). unit_id left NULL on purpose: the geotag trigger links each point to the smallest unit containing it.

INSERT INTO flora_fauna (species_name, common_name, common_name_hi, type, description, unit_id, district_name, geom, source, collection_method, collected_at, confidence, review_status) VALUES
('Tagetes erecta', 'Marigold', 'Genda', 'flora', 'Cultivated and near temple gardens.', NULL, 'Ayodhya',
 ST_SetSRID(ST_MakePoint(82.13, 26.805), 4326), 'PRIS Field Pilot', 'Direct observation', '2025-11-12', 0.92, 'verified'),
('Ficus religiosa', 'Peepal', 'Peepal', 'flora', 'Sacred tree, community protected.', NULL, 'Ayodhya',
 ST_SetSRID(ST_MakePoint(82.16, 26.79), 4326), 'PRIS Field Pilot', 'Direct observation', '2025-10-20', 0.95, 'verified'),
('Musa sp.', 'Banana', 'Kela', 'flora', 'Cultivated and semi-wild along channels.', NULL, 'Kaushambi',
 ST_SetSRID(ST_MakePoint(81.40, 25.415), 4326), 'PRIS Field Pilot', 'Direct observation', '2025-09-05', 0.90, 'verified'),
('Prosopis cineraria', 'Khejri', 'Shami', 'flora', 'Drought-tolerant species in drier pockets.', NULL, 'Agra',
 ST_SetSRID(ST_MakePoint(78.06, 27.16), 4326), 'PRIS Field Pilot', 'Direct observation', '2025-08-18', 0.85, 'verified');

INSERT INTO water_soil (indicator_type, value, unit, quality_label, notes, unit_id, district_name, geom, source, collection_method, collected_at, valid_until, confidence, review_status) VALUES
('soil_ph', 7.2, 'pH', 'good', 'Slightly alkaline.', NULL, 'Ayodhya',
 ST_SetSRID(ST_MakePoint(82.12, 26.80), 4326), 'PRIS Field Pilot', 'Portable pH meter', '2025-11-12', '2026-05-12', 0.87, 'verified'),
('groundwater_depth', 8.5, 'metres', 'moderate', 'Seasonal variation expected.', NULL, 'Ayodhya',
 ST_SetSRID(ST_MakePoint(82.17, 26.77), 4326), 'PRIS Field Pilot + CGWB context', 'Local enquiry + secondary', '2025-10-20', '2026-04-20', 0.75, 'verified'),
('soil_ph', 6.9, 'pH', 'good', 'Near neutral.', NULL, 'Kaushambi',
 ST_SetSRID(ST_MakePoint(81.39, 25.42), 4326), 'PRIS Field Pilot', 'Portable pH meter', '2025-09-05', '2026-03-05', 0.86, 'verified'),
('soil_ph', 7.8, 'pH', 'moderate', 'Alkaline tendency.', NULL, 'Agra',
 ST_SetSRID(ST_MakePoint(78.07, 27.17), 4326), 'PRIS Field Pilot', 'Portable pH meter', '2025-08-18', '2026-02-18', 0.84, 'verified');

INSERT INTO plant_species (scientific_name, common_name, common_name_hi, local_names, description, cultivation_notes, suitable_soil_ph_min, suitable_soil_ph_max, water_requirement, sunlight, best_season, tags) VALUES
('Tagetes erecta', 'Marigold', 'Genda', ARRAY['Genda'], 'Popular religious and market flower.',
 'Well-drained beds. Transplant at 30x30 cm. Full sun. Moderate water. Suitable near Ayodhya.',
 6.5, 7.5, 'moderate', 'full sun', 'October-February', ARRAY['floriculture', 'temple', 'backyard']),
('Musa sp.', 'Banana', 'Kela', ARRAY['Kela'], 'Horticultural crop with intercrop potential.',
 'Pits 60x60x60 cm with FYM. Plant sword suckers. Intercrop in year one.',
 6.0, 7.5, 'high', 'full sun', 'June-August', ARRAY['horticulture', 'intercrop']),
('Azadirachta indica', 'Neem', 'Neem', ARRAY['Nim'], 'Multipurpose hardy tree.',
 'Plant in monsoon. Minimal aftercare. Boundary and agro-forestry use.',
 6.0, 8.0, 'low', 'full sun', 'Monsoon', ARRAY['tree', 'medicinal']),
('Ficus religiosa', 'Peepal', 'Peepal', ARRAY['Pipal'], 'Sacred community-protected tree.',
 'Suitable for open village spaces and institutions.',
 6.0, 8.0, 'low to moderate', 'full sun', 'Monsoon', ARRAY['sacred', 'shade']);
