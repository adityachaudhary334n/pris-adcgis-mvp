-- ============================================================
-- Seed Data for Pilot Districts: Ayodhya, Kaushambi, Agra
-- All points carry explicit provenance
-- ============================================================

-- ------------------------------------------------------------
-- Administrative Boundaries (simplified centroids + polygons)
-- In production these would come from official Survey of India / Bhuvan
-- ------------------------------------------------------------

-- Districts
INSERT INTO admin_boundaries (id, level, name, name_hi, district_code, geom) VALUES
('a1000000-0000-4000-8000-000000000001', 'district', 'Ayodhya', 'अयोध्या', 'AY',
 ST_GeomFromText('MULTIPOLYGON(((82.05 26.70, 82.25 26.70, 82.25 26.90, 82.05 26.90, 82.05 26.70)))', 4326)),
('a1000000-0000-4000-8000-000000000002', 'district', 'Kaushambi', 'कौशाम्बी', 'KS',
 ST_GeomFromText('MULTIPOLYGON(((81.30 25.30, 81.55 25.30, 81.55 25.55, 81.30 25.55, 81.30 25.30)))', 4326)),
('a1000000-0000-4000-8000-000000000003', 'district', 'Agra', 'आगरा', 'AG',
 ST_GeomFromText('MULTIPOLYGON(((77.90 27.05, 78.20 27.05, 78.20 27.30, 77.90 27.30, 77.90 27.05)))', 4326));

-- Sample Villages / Blocks (simplified)
INSERT INTO admin_boundaries (id, level, name, name_hi, parent_id, district_code, geom) VALUES
-- Ayodhya villages
('b1000000-0000-4000-8000-000000000011', 'village', 'Raunahi', 'रौनही', 'a1000000-0000-4000-8000-000000000001', 'AY',
 ST_GeomFromText('MULTIPOLYGON(((82.10 26.78, 82.14 26.78, 82.14 26.82, 82.10 26.82, 82.10 26.78)))', 4326)),
('b1000000-0000-4000-8000-000000000012', 'village', 'Sohawal', 'सोहावल', 'a1000000-0000-4000-8000-000000000001', 'AY',
 ST_GeomFromText('MULTIPOLYGON(((82.15 26.75, 82.19 26.75, 82.19 26.79, 82.15 26.79, 82.15 26.75)))', 4326)),
-- Kaushambi
('b1000000-0000-4000-8000-000000000021', 'village', 'Manjhanpur', 'मंझनपुर', 'a1000000-0000-4000-8000-000000000002', 'KS',
 ST_GeomFromText('MULTIPOLYGON(((81.37 25.40, 81.41 25.40, 81.41 25.44, 81.37 25.44, 81.37 25.40)))', 4326)),
('b1000000-0000-4000-8000-000000000022', 'village', 'Chail', 'चैल', 'a1000000-0000-4000-8000-000000000002', 'KS',
 ST_GeomFromText('MULTIPOLYGON(((81.42 25.38, 81.46 25.38, 81.46 25.42, 81.42 25.42, 81.42 25.38)))', 4326)),
-- Agra
('b1000000-0000-4000-8000-000000000031', 'village', 'Fatehabad', 'फतेहाबाद', 'a1000000-0000-4000-8000-000000000003', 'AG',
 ST_GeomFromText('MULTIPOLYGON(((78.05 27.15, 78.09 27.15, 78.09 27.19, 78.05 27.19, 78.05 27.15)))', 4326)),
('b1000000-0000-4000-8000-000000000032', 'village', 'Kiraoli', 'किराओली', 'a1000000-0000-4000-8000-000000000003', 'AG',
 ST_GeomFromText('MULTIPOLYGON(((77.95 27.12, 77.99 27.12, 77.99 27.16, 77.95 27.16, 77.95 27.12)))', 4326));

-- ------------------------------------------------------------
-- Opportunities (with transparent scores + provenance)
-- ------------------------------------------------------------
INSERT INTO opportunities (id, title, title_hi, category, description, score, score_factors, image_url, village_id, district_name, geom, source, collection_method, collected_at, valid_until, confidence, review_status) VALUES
-- Ayodhya
('c1000000-0000-4000-8000-000000000101', 'Marigold Cultivation for Temple Demand', 'मंदिर मांग के लिए गेंदा की खेती', 'floriculture',
 'High local demand from temples and flower markets. Soil and climate in this belt suit marigold well.', 86.5,
 '{"suitability": 90, "market_proximity": 88, "resource_availability": 82, "local_demand": 92}',
 NULL, 'b1000000-0000-4000-8000-000000000011', 'Ayodhya',
 ST_SetSRID(ST_MakePoint(82.12, 26.80), 4326),
 'PRIS Field Pilot + Local Market Survey', 'On-site soil check + market interview', '2025-11-12', '2026-11-12', 0.88, 'verified'),

('c1000000-0000-4000-8000-000000000102', 'Backyard Dairy Micro-Unit', 'आंगन डेयरी सूक्ष्म इकाई', 'dairy',
 'Small-scale dairy with 2-4 animals is viable. Existing milk collection routes pass nearby.', 74.0,
 '{"suitability": 78, "market_proximity": 80, "resource_availability": 70, "local_demand": 72}',
 NULL, 'b1000000-0000-4000-8000-000000000012', 'Ayodhya',
 ST_SetSRID(ST_MakePoint(82.17, 26.77), 4326),
 'PRIS Field Pilot', 'Village survey', '2025-10-20', '2026-10-20', 0.82, 'verified'),

-- Kaushambi
('c1000000-0000-4000-8000-000000000201', 'Banana + Intercrop Model', 'केला + अंतर फसल मॉडल', 'horticulture',
 'Suitable soil and water availability support banana with short-duration intercrops for extra income.', 81.0,
 '{"suitability": 85, "market_proximity": 75, "resource_availability": 84, "local_demand": 78}',
 NULL, 'b1000000-0000-4000-8000-000000000021', 'Kaushambi',
 ST_SetSRID(ST_MakePoint(81.39, 25.42), 4326),
 'PRIS Field Pilot + Agriculture Dept open data', 'Soil sampling + secondary data', '2025-09-05', '2026-09-05', 0.85, 'verified'),

('c1000000-0000-4000-8000-000000000202', 'Handmade Paper & Craft Unit', 'हस्तनिर्मित कागज एवं शिल्प इकाई', 'crafts',
 'Local demand for eco-friendly packaging and religious items. Low capital entry.', 69.5,
 '{"suitability": 72, "market_proximity": 68, "resource_availability": 65, "local_demand": 75}',
 NULL, 'b1000000-0000-4000-8000-000000000022', 'Kaushambi',
 ST_SetSRID(ST_MakePoint(81.44, 25.40), 4326),
 'PRIS Field Pilot', 'Artisan interview', '2025-12-01', '2026-12-01', 0.78, 'verified'),

-- Agra
('c1000000-0000-4000-8000-000000000301', 'Heritage Craft Souvenir Micro-Enterprise', 'हेरिटेज शिल्प स्मृति चिन्ह सूक्ष्म उद्यम', 'crafts',
 'Strong tourist footfall. Small units making marble inlay, leather and textile souvenirs have proven demand.', 88.0,
 '{"suitability": 85, "market_proximity": 95, "resource_availability": 80, "local_demand": 92}',
 NULL, 'b1000000-0000-4000-8000-000000000031', 'Agra',
 ST_SetSRID(ST_MakePoint(78.07, 27.17), 4326),
 'PRIS Field Pilot + Tourism Dept data', 'Market observation + artisan survey', '2025-08-18', '2026-08-18', 0.90, 'verified'),

('c1000000-0000-4000-8000-000000000302', 'Solar Dryer for Agricultural Produce', 'कृषि उपज के लिए सोलर ड्रायर', 'renewable',
 'High solar irradiance belt. Solar dryers reduce post-harvest loss for local farmers.', 79.5,
 '{"suitability": 88, "market_proximity": 70, "resource_availability": 82, "local_demand": 75}',
 NULL, 'b1000000-0000-4000-8000-000000000032', 'Agra',
 ST_SetSRID(ST_MakePoint(77.97, 27.14), 4326),
 'PRIS Field Pilot + MNRE open data', 'Site assessment', '2025-07-22', '2026-07-22', 0.84, 'verified');

-- ------------------------------------------------------------
-- Setup Steps for Opportunities
-- ------------------------------------------------------------
INSERT INTO opportunity_setup_steps (opportunity_id, step_number, title, description, estimated_days, estimated_cost) VALUES
-- Marigold (Ayodhya)
('c1000000-0000-4000-8000-000000000101', 1, 'Soil Testing & Land Preparation', 'Test soil pH and organic carbon. Prepare raised beds or flat beds depending on drainage.', 7, '₹1,500–3,000'),
('c1000000-0000-4000-8000-000000000101', 2, 'Seed / Seedling Procurement', 'Source quality marigold seedlings from a reliable nursery (African or French type as per market).', 3, '₹2,000–4,000'),
('c1000000-0000-4000-8000-000000000101', 3, 'Planting & Basic Irrigation Setup', 'Transplant at recommended spacing. Install simple drip or furrow irrigation if possible.', 5, '₹3,000–8,000'),
('c1000000-0000-4000-8000-000000000101', 4, 'Market Linkage', 'Connect with local temple committees and wholesale flower markets in Ayodhya / nearby towns.', 10, 'Mostly time'),

-- Banana (Kaushambi)
('c1000000-0000-4000-8000-000000000201', 1, 'Land Selection & Pit Preparation', 'Choose well-drained plot. Dig pits and fill with mixture of soil, FYM and neem cake.', 10, '₹4,000–7,000'),
('c1000000-0000-4000-8000-000000000201', 2, 'Sucker Planting', 'Plant healthy sword suckers. Maintain proper spacing.', 3, '₹5,000–10,000'),
('c1000000-0000-4000-8000-000000000201', 3, 'Intercrop Planning', 'Introduce short-duration intercrops (vegetables or pulses) in the first 4–6 months.', 5, '₹2,000–5,000'),

-- Heritage Craft (Agra)
('c1000000-0000-4000-8000-000000000301', 1, 'Skill Mapping & Design Selection', 'Identify family or local artisans. Select 3–5 fast-moving souvenir designs.', 7, 'Low'),
('c1000000-0000-4000-8000-000000000301', 2, 'Raw Material Sourcing', 'Arrange marble dust, leather, or textile inputs from local suppliers.', 5, '₹5,000–15,000'),
('c1000000-0000-4000-8000-000000000301', 3, 'Market Channel Setup', 'Link with tourist shops, online platforms or cooperative outlets near Taj / Fatehabad road.', 14, 'Variable');

-- ------------------------------------------------------------
-- Flora & Fauna sample points
-- ------------------------------------------------------------
INSERT INTO flora_fauna (species_name, common_name, common_name_hi, type, description, district_name, geom, source, collection_method, collected_at, confidence, review_status) VALUES
('Tagetes erecta', 'Marigold', 'गेंदा', 'flora', 'Commonly cultivated and also found near temple gardens.', 'Ayodhya',
 ST_SetSRID(ST_MakePoint(82.13, 26.805), 4326), 'PRIS Field Pilot', 'Direct observation', '2025-11-12', 0.92, 'verified'),
('Ficus religiosa', 'Peepal', 'पीपल', 'flora', 'Sacred tree, frequently protected by communities.', 'Ayodhya',
 ST_SetSRID(ST_MakePoint(82.16, 26.79), 4326), 'PRIS Field Pilot', 'Direct observation', '2025-10-20', 0.95, 'verified'),
('Musa sp.', 'Banana', 'केला', 'flora', 'Cultivated and semi-wild patches along water channels.', 'Kaushambi',
 ST_SetSRID(ST_MakePoint(81.40, 25.415), 4326), 'PRIS Field Pilot', 'Direct observation', '2025-09-05', 0.90, 'verified'),
('Azadirachta indica', 'Neem', 'नीम', 'flora', 'Widely present, used in traditional practices.', 'Kaushambi',
 ST_SetSRID(ST_MakePoint(81.43, 25.405), 4326), 'Open + Field verification', 'Observation', '2025-09-05', 0.88, 'verified'),
('Prosopis cineraria', 'Khejri / Shami', 'शमी', 'flora', 'Drought-tolerant species found in drier pockets.', 'Agra',
 ST_SetSRID(ST_MakePoint(78.06, 27.16), 4326), 'PRIS Field Pilot', 'Direct observation', '2025-08-18', 0.85, 'verified'),
('Boswellia serrata', 'Salai', 'सलई', 'flora', 'Recorded in residual dry forest patches.', 'Agra',
 ST_SetSRID(ST_MakePoint(77.98, 27.145), 4326), 'Secondary literature + field check', 'Literature + observation', '2025-07-22', 0.80, 'verified');

-- ------------------------------------------------------------
-- Water & Soil Indicators
-- ------------------------------------------------------------
INSERT INTO water_soil (indicator_type, value, unit, quality_label, notes, district_name, geom, source, collection_method, collected_at, valid_until, confidence) VALUES
('soil_ph', 7.2, 'pH', 'good', 'Slightly alkaline, suitable for marigold and many vegetables.', 'Ayodhya',
 ST_SetSRID(ST_MakePoint(82.12, 26.80), 4326), 'PRIS Field Pilot', 'Portable pH meter', '2025-11-12', '2026-05-12', 0.87),
('groundwater_depth', 8.5, 'metres', 'moderate', 'Seasonal variation expected.', 'Ayodhya',
 ST_SetSRID(ST_MakePoint(82.17, 26.77), 4326), 'PRIS Field Pilot + CGWB context', 'Local enquiry + secondary', '2025-10-20', '2026-04-20', 0.75),
('soil_ph', 6.9, 'pH', 'good', 'Near neutral, favourable for banana.', 'Kaushambi',
 ST_SetSRID(ST_MakePoint(81.39, 25.42), 4326), 'PRIS Field Pilot', 'Portable pH meter', '2025-09-05', '2026-03-05', 0.86),
('soil_ph', 7.8, 'pH', 'moderate', 'Alkaline tendency; amendments may be needed for some crops.', 'Agra',
 ST_SetSRID(ST_MakePoint(78.07, 27.17), 4326), 'PRIS Field Pilot', 'Portable pH meter', '2025-08-18', '2026-02-18', 0.84);

-- ------------------------------------------------------------
-- Plant Species Knowledge Base
-- ------------------------------------------------------------
INSERT INTO plant_species (scientific_name, common_name, common_name_hi, local_names, description, cultivation_notes, suitable_soil_ph_min, suitable_soil_ph_max, water_requirement, sunlight, best_season, tags) VALUES
('Tagetes erecta', 'Marigold', 'गेंदा', ARRAY['Genda', 'Gainda'], 'Popular ornamental and religious flower with strong local market in temple towns.',
 'Prepare well-drained beds. Transplant 20–25 day old seedlings at 30×30 cm or 45×30 cm spacing. Prefer full sun. Regular but moderate watering. Pinch terminal buds for bushier plants. Harvest when flowers are fully open. Very suitable for small backyard or commercial plots near Ayodhya.',
 6.5, 7.5, 'moderate', 'full sun', 'October–February (main), also rainy season varieties', ARRAY['floriculture', 'temple', 'backyard', 'market']),

('Musa sp.', 'Banana', 'केला', ARRAY['Kela'], 'Important horticultural crop. Can be grown with intercrops in early stages.',
 'Dig 60×60×60 cm pits. Fill with topsoil + FYM + neem cake. Plant healthy sword suckers. Maintain moisture especially in first 3 months. Suitable for Kaushambi belt where water is available. Intercrop with vegetables or pulses in the first season for extra income.',
 6.0, 7.5, 'high', 'full sun', 'June–August (planting)', ARRAY['horticulture', 'intercrop', 'income']),

('Azadirachta indica', 'Neem', 'नीम', ARRAY['Nim'], 'Multipurpose tree. Leaves and seeds have traditional and commercial value.',
 'Extremely hardy. Plant during monsoon. Minimal aftercare once established. Good for boundary planting and agro-forestry. Leaves can be used for organic pest management.',
 6.0, 8.0, 'low', 'full sun', 'Monsoon', ARRAY['tree', 'medicinal', 'boundary']),

('Ficus religiosa', 'Peepal', 'पीपल', ARRAY['Pipal', 'Ashvattha'], 'Sacred tree, often protected by communities. Large canopy.',
 'Not typically planted for commercial harvest. Community protection is common. Suitable for open village spaces and institutions.',
 6.0, 8.0, 'low to moderate', 'full sun', 'Monsoon', ARRAY['sacred', 'shade', 'community']);
