"""
Prajna Opportunity Engine — full Phase 1 / 2 / 3 diagnostics.
District matching is fuzzy; image basenames are taken EXACTLY from CSV (spaces preserved).
"""
from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

DATA = Path(__file__).parent / "data"


def _norm(s: str) -> str:
    return "".join(c for c in s.lower() if c.isalnum())


ALIASES = {
    _norm("Gautam Buddha Nagar"): _norm("Noida"),
    _norm("Gautam Buddh Nagar"): _norm("Noida"),
    _norm("GB Nagar"): _norm("Noida"),
    _norm("Siddharth Nagar"): _norm("Siddharthnagar"),
}


def _read_csv(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    out: list[dict[str, Any]] = []
    for r in rows:
        d: dict[str, Any] = {}
        for k, v in r.items():
            if v is None or v == "":
                d[k] = None
                continue
            try:
                if "." in str(v):
                    d[k] = float(v)
                else:
                    d[k] = int(v)
            except (ValueError, TypeError):
                d[k] = v
        out.append(d)
    return out


@lru_cache(maxsize=1)
def _load() -> dict[str, list[dict[str, Any]]]:
    return {
        "water": _read_csv(DATA / "Phase_1" / "water_climate.csv"),
        "agro": _read_csv(DATA / "Phase_1" / "agro_economic.csv"),
        "energy": _read_csv(DATA / "Phase_1" / "renewable_energy.csv"),
        "labour": _read_csv(DATA / "Phase_1" / "labour_human_capital.csv"),
        "infra": _read_csv(DATA / "Phase_1" / "infrastructure_readiness.csv"),
        "context": _read_csv(DATA / "Phase_2" / "district_context.csv"),
        "startups": _read_csv(DATA / "Phase_2" / "startup_ideas.csv"),
        "potential": _read_csv(DATA / "Phase_3" / "district_potential_score.csv"),
        "profiles": _read_csv(DATA / "Phase_3" / "global_development_profiles.csv"),
        "archetypes": _read_csv(DATA / "Phase_3" / "regional_archetypes.csv"),
    }


def list_districts() -> list[str]:
    water = _load()["water"]
    return sorted({str(r["district"]) for r in water if r.get("district")})


def _find_row(rows: list[dict], district: str) -> Optional[dict]:
    key = ALIASES.get(_norm(district), _norm(district))
    for r in rows:
        if _norm(str(r.get("district", ""))) == key:
            return r
    return None


def _yes(v: Any) -> bool:
    return str(v).lower() in ("yes", "1", "true")


def _quadrant(readiness: float, need: float) -> dict[str, Any]:
    if readiness >= 50 and need >= 50:
        return {
            "code": "high_readiness_high_need",
            "label": "High Readiness · High Need",
            "color": "#10B981",
            "meaning": "The district faces significant development pressure. Infrastructure and systems are sufficiently functional.",
            "focus": "Rapid deployment, outcome-oriented execution, time-bound interventions.",
            "example_startups": ["Water purification", "Decentralized energy", "Agri-processing", "Skill platforms"],
        }
    if readiness < 50 and need >= 50:
        return {
            "code": "low_readiness_high_need",
            "label": "Low Readiness · High Need",
            "color": "#F59E0B",
            "meaning": "Serious challenges with limited institutional or infrastructural capacity.",
            "focus": "Infrastructure development, capacity building, institutional strengthening.",
            "example_startups": ["Basic infrastructure services", "Community skill centres", "Micro-finance support"],
        }
    if readiness >= 50 and need < 50:
        return {
            "code": "high_readiness_low_need",
            "label": "High Readiness · Low Need",
            "color": "#0284C7",
            "meaning": "Relatively stable with capacity beyond immediate needs — regional anchor potential.",
            "focus": "Innovation enablement, regional leadership, long-term growth.",
            "example_startups": ["SaaS", "Manufacturing", "Logistics", "R&D centres"],
        }
    return {
        "code": "low_readiness_low_need",
        "label": "Low Readiness · Low Need",
        "color": "#EF4444",
        "meaning": "Stable but underdeveloped; low immediate pressure, limited capacity.",
        "focus": "Human capital, education & skilling, incremental infrastructure.",
        "example_startups": ["Education platforms", "Skilling programmes", "Local services"],
    }


def _image_urls(raw_path: Optional[str]) -> dict[str, Optional[str]]:
    """Exact basename from CSV — spaces preserved, no forced hyphens."""
    if not raw_path or not str(raw_path).strip():
        return {
            "image_path": None,
            "image_basename": None,
            "image_url": "/startup_images/_placeholder.svg",
            "image_url_api": "/api/diagnostics/static/startup_images/_placeholder.svg",
        }
    name = Path(str(raw_path).strip()).name
    return {
        "image_path": str(raw_path).strip(),
        "image_basename": name,
        "image_url": f"/startup_images/{name}",
        "image_url_api": f"/api/diagnostics/static/startup_images/{name}",
    }


def _compute_startup_match(s: dict, d: dict, infra_score: float, need_score: float) -> float:
    score = 0.0
    high_readiness = infra_score >= 60
    high_need = need_score >= 60
    suits_hi = _yes(s.get("suits_high_readiness"))
    suits_lo = _yes(s.get("suits_low_readiness"))
    tgt_hi = _yes(s.get("targets_high_need"))
    tgt_lo = _yes(s.get("targets_low_need"))
    full_match = partial_match = False
    if high_readiness and high_need:
        if suits_hi and tgt_hi:
            full_match = True
        elif suits_hi or tgt_hi:
            partial_match = True
    elif high_readiness and not high_need:
        if suits_hi and tgt_lo:
            full_match = True
        elif suits_hi or tgt_lo:
            partial_match = True
    elif (not high_readiness) and high_need:
        if suits_lo and tgt_hi:
            full_match = True
        elif suits_lo or tgt_hi:
            partial_match = True
    else:
        if suits_lo and tgt_lo:
            full_match = True
        elif suits_lo or tgt_lo:
            partial_match = True
    if full_match:
        score += 30
    elif partial_match:
        score += 18
    else:
        score += 5
    try:
        infra_need = float(s.get("infrastructure_need") or 50)
    except (TypeError, ValueError):
        infra_need = 50
    gap = infra_score - infra_need
    if gap >= 20:
        score += 20
    elif gap >= 0:
        score += 15
    elif gap >= -20:
        score += 8
    sector_score = 0.0
    try:
        if int(s.get("focus_health") or 0) == 1:
            sector_score += min(6, float(d.get("healthcare_gap_score") or 0) / 12)
        if int(s.get("focus_education") or 0) == 1:
            sector_score += min(6, float(d.get("education_gap_score") or 0) / 12)
        if int(s.get("focus_tourism") or 0) == 1:
            sector_score += min(6, float(d.get("tourism_potential_score") or 0) / 12)
        if int(s.get("focus_agri") or 0) == 1:
            sector_score += min(6, float(d.get("agro_strength_score") or 0) / 12)
        if int(s.get("focus_industry") or 0) == 1:
            sector_score += min(6, float(d.get("industrial_base_score") or 0) / 12)
    except (TypeError, ValueError):
        pass
    score += min(25, sector_score)
    urban = str(d.get("urbanization_type") or "").strip().lower()
    pref = str(s.get("urban_preference") or "").strip().lower()
    if urban == "urban":
        if pref == "urban":
            score += 15
        elif pref in ("semi-urban", "semi urban", "semiurban"):
            score += 6
    elif urban in ("semi-urban", "semi urban", "semiurban"):
        if pref in ("semi-urban", "semi urban", "semiurban"):
            score += 15
        elif pref == "rural":
            score += 8
        elif pref == "urban":
            score += 5
    else:
        if pref == "rural":
            score += 15
        elif pref in ("semi-urban", "semi urban", "semiurban"):
            score += 12
    try:
        if float(s.get("pollution_sensitivity") or 0) >= 70 and float(d.get("pollution_level_score") or 0) >= 70:
            score -= 5
        if float(s.get("security_sensitivity") or 0) >= 70 and float(d.get("security_risk_score") or 0) >= 60:
            score -= 5
    except (TypeError, ValueError):
        pass
    return max(0.0, min(100.0, score))


def _assign_archetypes(d3: dict) -> list[str]:
    archetypes: list[str] = []
    if float(d3.get("industrial_potential_score") or 0) >= 75:
        archetypes.append("Western Industrial")
    if float(d3.get("metro_services_potential_score") or 0) >= 80:
        archetypes.append("Capital Metro")
    if float(d3.get("sacred_tourism_potential_score") or 0) >= 70:
        archetypes.append("Sacred Tourism")
    if float(d3.get("terai_forest_potential_score") or 0) >= 60:
        archetypes.append("Terai Forest")
    if float(d3.get("bundelkhand_drought_potential_score") or 0) >= 65:
        archetypes.append("Bundelkhand")
    if float(d3.get("floodplain_agri_potential_score") or 0) >= 65:
        archetypes.append("Eastern Floodplain")
    if float(d3.get("humid_agri_potential_score") or 0) >= 65:
        archetypes.append("Eastern Humid")
    if float(d3.get("doab_semi_urban_potential_score") or 0) >= 60:
        archetypes.append("Doab Semi-Urban")
    if float(d3.get("migrant_labor_potential_score") or 0) >= 65:
        archetypes.append("Migrant Belt")
    if float(d3.get("semi_arid_agri_potential_score") or 0) >= 60:
        archetypes.append("Central Semi-Arid")
    if not archetypes:
        return ["Transitional / Mixed"]
    return archetypes[:2]


def get_diagnostic(district: str) -> Optional[dict[str, Any]]:
    data = _load()
    w = _find_row(data["water"], district)
    a = _find_row(data["agro"], district)
    e = _find_row(data["energy"], district)
    l = _find_row(data["labour"], district)
    i = _find_row(data["infra"], district)
    if not all([w, a, e, l, i]):
        return None

    readiness = float(i.get("infrastructure_readiness_index") or 0)
    need = (
        (100 - float(w.get("water_climate_index") or 0))
        + float(e.get("power_deficit_score") or 0)
        + float(l.get("migration_score") or 0)
    ) / 3.0

    indices = {
        "water_climate": float(w.get("water_climate_index") or 0),
        "agro_economic": float(a.get("agro_economic_index") or 0),
        "renewable_energy": float(e.get("renewable_energy_index") or 0),
        "labour_human_capital": float(l.get("labour_human_capital_index") or 0),
        "infrastructure": readiness,
    }

    indicators = {
        "water_climate": {
            "labels": ["Rainfall", "Groundwater", "Drought", "Flood"],
            "values": [
                float(w.get("rainfall_score") or 0),
                float(w.get("groundwater_score") or 0),
                float(w.get("drought_score") or 0),
                float(w.get("flood_score") or 0),
            ],
        },
        "agro_economic": {
            "labels": ["Productivity", "Crop Diversity", "Irrigation", "Agri Activity"],
            "values": [
                float(a.get("agri_productivity_score") or 0),
                float(a.get("crop_diversity_score") or 0),
                float(a.get("irrigation_score") or 0),
                float(a.get("agri_activity_score") or 0),
            ],
        },
        "renewable_energy": {
            "labels": ["Solar", "Biomass", "Power Deficit"],
            "values": [
                float(e.get("solar_score") or 0),
                float(e.get("biomass_score") or 0),
                float(e.get("power_deficit_score") or 0),
            ],
        },
        "labour_human_capital": {
            "labels": ["Labour Availability", "Migration", "Skill"],
            "values": [
                float(l.get("labour_availability_score") or 0),
                float(l.get("migration_score") or 0),
                float(l.get("skill_score") or 0),
            ],
        },
        "infrastructure": {
            "labels": ["Roads", "Market Access", "Power Reliability", "Digital"],
            "values": [
                float(i.get("road_score") or 0),
                float(i.get("market_access_score") or 0),
                float(i.get("power_reliability_score") or 0),
                float(i.get("digital_score") or 0),
            ],
        },
    }

    context_row = _find_row(data["context"], district)
    context: Optional[dict[str, Any]] = None
    if context_row:
        context = {k: context_row[k] for k in context_row if k != "district"}

    infra_score = float((context_row or {}).get("infrastructure_readiness_score") or readiness)
    need_score = float((context_row or {}).get("development_need_score") or need)

    ranked_ideas: list[dict[str, Any]] = []
    if context_row:
        scored: list[tuple[float, dict]] = []
        for s in data["startups"]:
            fit = _compute_startup_match(s, context_row, infra_score, need_score)
            imgs = _image_urls(s.get("image_path"))
            scored.append(
                (
                    fit,
                    {
                        "id": s.get("startup_id"),
                        "title": s.get("startup_name"),
                        "description": s.get("description"),
                        "sector": s.get("sector"),
                        "urban_preference": s.get("urban_preference"),
                        "capex_band": s.get("capex_band"),
                        "labour_type": s.get("labour_type"),
                        "mgnrega_flag": s.get("mgnrega_flag"),
                        "water_need": s.get("water_need"),
                        "solar_need": s.get("solar_need"),
                        "infrastructure_need": s.get("infrastructure_need"),
                        "fit_score": round(fit, 1),
                        **imgs,
                    },
                )
            )
        scored.sort(key=lambda x: x[0], reverse=True)
        ranked_ideas = [item for sc, item in scored if sc >= 25][:12]
        if not ranked_ideas:
            ranked_ideas = [item for _, item in scored[:8]]

    potential_row = _find_row(data["potential"], district)
    potential: Optional[dict[str, float]] = None
    top_potentials: list[dict[str, Any]] = []
    global_models: list[dict[str, Any]] = []
    archetype_names: list[str] = []

    if potential_row:
        pot_map = {
            "industrial_potential_score": "Industrial",
            "metro_services_potential_score": "Metro Services",
            "humid_agri_potential_score": "Humid Agriculture",
            "semi_arid_agri_potential_score": "Semi-arid Agriculture",
            "sacred_tourism_potential_score": "Sacred Tourism",
            "migrant_labor_potential_score": "Migrant Labour",
            "bundelkhand_drought_potential_score": "Bundelkhand Drought",
            "doab_semi_urban_potential_score": "Doab Semi-urban",
            "terai_forest_potential_score": "Terai Forest",
            "floodplain_agri_potential_score": "Floodplain Agriculture",
        }
        potential = {label: float(potential_row.get(key) or 0) for key, label in pot_map.items()}
        top_potentials = sorted(
            [{"name": k, "score": v} for k, v in potential.items()],
            key=lambda x: x["score"],
            reverse=True,
        )
        archetype_names = _assign_archetypes(potential_row)
        profiles = data["profiles"]
        for name in archetype_names:
            match = next(
                (
                    p
                    for p in profiles
                    if str(p.get("development_profile") or "").strip().lower() == name.lower()
                ),
                None,
            )
            if match:
                global_models.append(
                    {
                        "archetype": name,
                        "profile_id": match.get("profile_id"),
                        "development_profile": match.get("development_profile"),
                        "global_regions": match.get("global_regions"),
                        "profile_description": match.get("profile_description"),
                        "situation_20_years_ago": match.get("situation_20_years_ago"),
                        "key_transformation_strategies": match.get("key_transformation_strategies"),
                        "startup_ecosystem_today": match.get("startup_ecosystem_today"),
                        "typical_startup_ideas": match.get("typical_startup_ideas"),
                        "relevant_policies": match.get("relevant_policies"),
                    }
                )
            else:
                global_models.append({"archetype": name, "development_profile": name, "missing": True})

    matched = str(w.get("district"))
    radar = {
        "labels": [
            "Water & Climate",
            "Agro-Economic",
            "Renewable Energy",
            "Labour & Human Capital",
            "Infrastructure",
        ],
        "values": [
            indices["water_climate"],
            indices["agro_economic"],
            indices["renewable_energy"],
            indices["labour_human_capital"],
            indices["infrastructure"],
        ],
    }
    nvr = {
        "readiness": round(readiness, 1),
        "need": round(need, 1),
        "quadrant": _quadrant(readiness, need),
    }
    return {
        "district": matched,
        "requested": district,
        "phase1": {"indices": indices, "radar": radar, "indicators": indicators, "need_vs_readiness": nvr},
        "indices": indices,
        "radar": radar,
        "indicators": indicators,
        "need_vs_readiness": nvr,
        "phase2": {
            "context": context,
            "startup_ideas": ranked_ideas,
            "infra_score": infra_score,
            "need_score": need_score,
        },
        "context": context,
        "startup_ideas": ranked_ideas,
        "phase3": {
            "potential": potential,
            "top_potentials": top_potentials,
            "archetypes": archetype_names,
            "global_models": global_models,
        },
        "potential": potential,
        "top_potentials": top_potentials[:5],
        "archetypes": archetype_names,
        "global_models": global_models,
        "available_districts": list_districts(),
    }
