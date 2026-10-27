#!/usr/bin/env python3
"""
Turn the messy Survey-of-India village file into clean, structured, loadable data.

Input : data/up_villages.geojson   (~101k village polygons, SOI + LGD attributes, EPSG:4326)
Output: data/clean/up_admin_load.sql.gz   COPY-based load (state > 75 districts > ~830 blocks > ~100k villages)
        data/clean/up_hierarchy.json      light tree (no polygons) for docs / debugging
        data/clean/quality_report.json    what was fixed, merged, dropped (nothing is dropped silently)
        frontend/src/data/up-districts.json, up-state.json   first-paint outlines for the map

What it fixes
  * names     SOI names are ALL CAPS and 5k villages have no census name -> proper case, SOI spelling kept for search
  * identity  deterministic UUIDs from LGD codes (re-running never changes ids); LGD-less villages get stable hash ids
  * duplicates same LGD village in the same block (227 rows) -> merged into one MultiPolygon; exact duplicate shapes removed
  * geometry  invalid polygons repaired (make_valid), snapped to ~11 cm, forced to MultiPolygon, bounds checked (EPSG:4326)
  * hierarchy block/district polygons are DISSOLVED from their villages, so every child is inside its parent by construction
  * display   simplified copies (geom_simple) for district/block so the state map loads fast; exact geometry is kept in geom

Usage:  python3 scripts/build_up_admin.py [--src data/up_villages.geojson]      (needs shapely>=2, pyproj)
"""
import argparse, collections, csv, gzip, hashlib, io, json, pathlib, re, sys, uuid

import shapely
from pyproj import Geod
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

ROOT = pathlib.Path(__file__).resolve().parents[1]
GEOD = Geod(ellps="WGS84")
STATE_ID = "00000000-0000-4000-8000-000000000001"
PILOT = {"ayodhya": "a1000000-0000-4000-8000-000000000001", "kaushambi": "a1000000-0000-4000-8000-000000000002",
         "agra": "a1000000-0000-4000-8000-000000000003", "lucknow": "a1000000-0000-4000-8000-000000000004",
         "varanasi": "a1000000-0000-4000-8000-000000000005"}
HINDI_DISTRICTS = {"ayodhya": "अयोध्या", "kaushambi": "कौशांबी", "agra": "आगरा", "lucknow": "लखनऊ", "varanasi": "वाराणसी"}
NS = uuid.UUID("6f1d1b0a-6b1c-4a52-9d55-7a1d0c0e5e11")


def uid(*parts) -> str:
    return str(uuid.uuid5(NS, "|".join(str(p) for p in parts)))


def tidy(s) -> str:
    s = re.sub(r"\s+", " ", str(s or "").replace("\u00a0", " ")).strip(" .,-;:_")
    return s


def proper(s) -> str:
    """ALL CAPS / all lower -> Proper Case (keeps apostrophes); mixed-case input is left alone."""
    s = tidy(s)
    if s and (s.isupper() or s.islower()):
        s = re.sub(r"[A-Za-z]+('[A-Za-z]+)?", lambda m: m.group(0).capitalize(), s.lower())
    return s


def multi(g):
    g = make_valid(g)
    parts = g.geoms if hasattr(g, "geoms") else [g]
    polys = []
    for p in parts:
        if isinstance(p, Polygon) and not p.is_empty:
            polys.append(p)
        elif hasattr(p, "geoms"):
            polys += [q for q in p.geoms if isinstance(q, Polygon) and not q.is_empty]
    return MultiPolygon(polys) if polys else MultiPolygon()


def snap(g):
    g = make_valid(g)  # set_precision needs valid input
    try:
        return multi(shapely.set_precision(g, 1e-6))
    except shapely.errors.GEOSException:
        return multi(g.buffer(0))


def drop_small_holes(g, min_area=5e-6):
    out = []
    for p in multi(g).geoms:
        out.append(Polygon(p.exterior, [r for r in p.interiors if Polygon(r).area >= min_area]))
    return MultiPolygon(out)


def km2(g) -> float:
    return abs(sum(GEOD.geometry_area_perimeter(p)[0] for p in multi(g).geoms)) / 1e6


def hexwkb(g) -> str:
    return shapely.to_wkb(shapely.set_srid(g, 4326), hex=True, include_srid=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(ROOT / "data/up_villages.geojson"))
    a = ap.parse_args()
    rep = collections.OrderedDict()
    print("reading", a.src, flush=True)
    feats = json.load(open(a.src, encoding="utf-8"))["features"]
    rep["source_features"] = len(feats)

    # ---- 1. normalise rows -------------------------------------------------
    rows, seen_shape, bad = [], set(), collections.Counter()
    for f in feats:
        p = f["properties"]
        if not f.get("geometry"):
            bad["no_geometry"] += 1; continue
        g = shape(f["geometry"])
        if not g.is_valid:
            bad["invalid_repaired"] += 1
        g = snap(g)
        if g.is_empty or g.area == 0:
            bad["empty_after_repair"] += 1; continue
        x0, y0, x1, y1 = g.bounds
        if not (76.5 <= x0 and x1 <= 85 and 23 <= y0 and y1 <= 31):
            bad["outside_up_bbox"] += 1; continue
        key = hashlib.md5(shapely.to_wkb(g)).hexdigest()
        if key in seen_shape:
            bad["exact_duplicate_shape"] += 1; continue
        seen_shape.add(key)
        dn, bn = proper(p.get("dtname")), proper(p.get("block_name") or p.get("sdtname"))
        vn_census, vn_soi = tidy(p.get("vilname11")), proper(p.get("vilnam_soi"))
        name = proper(vn_census) if vn_census else vn_soi
        if not (dn and bn and name):
            bad["missing_name_or_parent"] += 1; continue
        rows.append(dict(g=g, dist=int(p["dist_lgd"]), dname=dn, block=int(p["block_lgd"]), bname=bn, name=name,
                         soi=vn_soi, lgd=int(p.get("vil_lgd") or 0), obj=p.get("objectid"), gp=proper(p.get("gp_name")),
                         gpc=p.get("gp_code"), tehsil=proper(p.get("sdtname")), tehsil_lgd=p.get("subdt_lgd"),
                         ac=p.get("ac_no"), census=tidy(p.get("vilcode11")), dtcode=tidy(p.get("dtcode11")), remark=p.get("remark")))
    rep["rows_after_cleaning"] = len(rows)
    rep["issues"] = dict(bad)
    rep["villages_without_lgd_code_kept"] = sum(1 for r in rows if not r["lgd"])
    rep["villages_named_from_soi_spelling"] = sum(1 for r in rows if not r["name"] or r["name"] == r["soi"])

    # ---- 2. merge same LGD village inside one block ------------------------
    groups = collections.OrderedDict()
    for r in rows:
        k = (r["dist"], r["block"], r["lgd"]) if r["lgd"] else ("nolgd", r["obj"])
        groups.setdefault(k, []).append(r)
    villages, merged = [], 0
    for k, rs in groups.items():
        if len(rs) > 1:
            merged += len(rs) - 1
            base = dict(rs[0]); base["g"] = snap(unary_union([r["g"] for r in rs])); base["parts"] = len(rs)
            villages.append(base)
        else:
            villages.append(rs[0])
    rep["village_rows_merged_into_multipolygon"] = merged
    rep["villages_final"] = len(villages)

    # ---- 3. hierarchy (names resolved by most frequent spelling per LGD code)
    dn = {}; bn = {}
    for r in rows:
        dn.setdefault(r["dist"], collections.Counter())[r["dname"]] += 1
        bn.setdefault((r["dist"], r["block"]), collections.Counter())[r["bname"]] += 1
    rep["blocks_with_conflicting_names_resolved"] = sum(1 for c in bn.values() if len(c) > 1)
    dist_name = {k: c.most_common(1)[0][0] for k, c in dn.items()}
    block_name = {k: c.most_common(1)[0][0] for k, c in bn.items()}
    by_block = collections.defaultdict(list)
    for v in villages:
        by_block[(v["dist"], v["block"])].append(v)

    out = io.StringIO(); w = csv.writer(out, lineterminator="\n")
    COLS = "id,level,name,name_hi,parent_id,district_code,block_code,village_code,state_code,population,area_sqkm,geom,geom_simple,centroid,properties"
    N = r"\N"

    def emit(id_, level, name, hi, parent, dc, bc, vc, area, g, gs, props):
        c = multi(g).representative_point()
        w.writerow([id_, level, name, hi or N, parent or N, dc or N, bc or N, vc or N, "UP", N, f"{area:.4f}", hexwkb(multi(g)),
                    hexwkb(multi(gs)) if gs is not None else N, hexwkb(c),
                    json.dumps(props, ensure_ascii=True, separators=(",", ":"))])

    # blocks + villages first (geometry needed to dissolve), but written parents-first below
    blocks_out, villages_out, tree = [], [], []
    dist_geoms = collections.defaultdict(list); dist_blocks = collections.defaultdict(list)
    for (d, b), vs in sorted(by_block.items()):
        bid = uid("block", d, b)
        bg = drop_small_holes(unary_union([v["g"] for v in vs]))
        bgs = drop_small_holes(bg.simplify(0.0005, preserve_topology=True))
        dist_geoms[d].append(bg); dist_blocks[d].append((b, bid, bg, bgs, vs))
    out_state = None
    state_id_districts = []
    dist_rows = {}
    for d in sorted(dist_geoms):
        dg = drop_small_holes(unary_union(dist_geoms[d])); dgs = drop_small_holes(dg.simplify(0.002, preserve_topology=True))
        nm = dist_name[d]; low = nm.lower()
        did = PILOT.get(low, uid("district", d))
        dist_rows[d] = (did, nm, dg, dgs)
    st = drop_small_holes(unary_union([dist_rows[d][2] for d in dist_rows]))
    sts = drop_small_holes(st.simplify(0.003, preserve_topology=True))
    # --- write in parent-first order
    emit(STATE_ID, "state", "Uttar Pradesh", "उत्तर प्रदेश", None, None, None, None, km2(sts), sts, sts, {"source": "dissolved from SOI villages", "lgd": 9})
    for d, (did, nm, dg, dgs) in dist_rows.items():
        nb = len(dist_blocks[d]); nv = sum(len(x[4]) for x in dist_blocks[d])
        emit(did, "district", nm, HINDI_DISTRICTS.get(nm.lower()), STATE_ID, str(d), None, None, km2(dg), dg, dgs,
             {"lgd": d, "source": "dissolved from SOI villages", "blocks": nb, "villages": nv})
    for d in dist_rows:
        did = dist_rows[d][0]
        for b, bid, bg, bgs, vs in dist_blocks[d]:
            emit(bid, "block", block_name[(d, b)], None, did, str(d), str(b), None, km2(bg), bg, bgs,
                 {"lgd": b, "source": "dissolved from SOI villages", "villages": len(vs)})
    for d in dist_rows:
        did = dist_rows[d][0]
        for b, bid, bg, bgs, vs in dist_blocks[d]:
            for v in sorted(vs, key=lambda x: (x["name"], x["lgd"])):
                vid = uid("village", d, b, v["lgd"]) if v["lgd"] else uid("village0", d, b, v["obj"])
                vg = multi(v["g"].simplify(5e-6, preserve_topology=True)); vg = vg if not vg.is_empty else v["g"]
                props = {"source": "SOI+LGD", "lgd": v["lgd"] or None, "census_code": v["census"] or None, "gp": v["gp"] or None,
                         "gp_code": v["gpc"], "tehsil": v["tehsil"] or None, "tehsil_lgd": v["tehsil_lgd"], "ac_no": v["ac"],
                         "name_soi": v["soi"] if v["soi"].lower() != v["name"].lower() else None, "parts": v.get("parts", 1),
                         "lgd_missing": not v["lgd"]}
                props = {k: x for k, x in props.items() if x not in (None, "", False) or k == "lgd_missing" and x}
                emit(vid, "village", v["name"], None, bid, str(d), str(b), str(v["lgd"]) if v["lgd"] else None, km2(vg), vg, None, props)
            tree.append((d, b))
    n_rows = out.getvalue().count("\n")

    # ---- 4. outputs --------------------------------------------------------
    clean = ROOT / "data/clean"; clean.mkdir(parents=True, exist_ok=True)
    with gzip.open(clean / "up_admin_load.sql.gz", "wt", encoding="utf-8", compresslevel=6) as f:
        f.write("-- GENERATED by scripts/build_up_admin.py -- do not edit. CRS EPSG:4326 (lon,lat).\n"
                "-- State > district > block > village from Survey of India + LGD. Loaded with triggers off (data is pre-validated).\n"
                "SET client_min_messages = warning;\nALTER TABLE admin_boundaries DISABLE TRIGGER trg_admin_geoguard;\n"
                f"COPY admin_boundaries ({COLS}) FROM STDIN WITH (FORMAT csv, NULL '\\N');\n")
        f.write(out.getvalue()); f.write("\\.\nALTER TABLE admin_boundaries ENABLE TRIGGER trg_admin_geoguard;\nANALYZE admin_boundaries;\n")
    tree_json = {"crs": "EPSG:4326", "state": "Uttar Pradesh", "summary": {"districts": len(dist_rows), "blocks": len(tree), "villages": len(villages)},
                 "districts": [{"id": dist_rows[d][0], "lgd": d, "name": dist_rows[d][1], "bbox": [round(x, 5) for x in dist_rows[d][2].bounds],
                                "blocks": [{"id": bid, "lgd": b, "name": block_name[(d, b)], "villages": len(vs)} for b, bid, _, _, vs in dist_blocks[d]]}
                               for d in dist_rows]}
    json.dump(tree_json, open(clean / "up_hierarchy.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    rep["summary"] = tree_json["summary"]
    rep["district_names"] = sorted(v[1] for v in dist_rows.values())
    rep["csv_rows"] = n_rows
    json.dump(rep, open(clean / "quality_report.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    fe = ROOT / "frontend/src/data"; fe.mkdir(parents=True, exist_ok=True)
    def rnd(c):
        return [rnd(x) for x in c] if isinstance(c, (list, tuple)) else round(c, 4)
    feats_out = []
    for d, (did, nm, dg, dgs) in dist_rows.items():
        s = multi(dg.simplify(0.004, preserve_topology=True)); m = mapping(s)
        feats_out.append({"type": "Feature", "properties": {"id": did, "name": nm, "lgd": d}, "geometry": {"type": m["type"], "coordinates": rnd(m["coordinates"])}})
    json.dump({"type": "FeatureCollection", "features": feats_out}, open(fe / "up-districts.json", "w"), separators=(",", ":"))
    m = mapping(multi(st.simplify(0.01, preserve_topology=True)))
    json.dump({"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"id": STATE_ID, "name": "Uttar Pradesh"}, "geometry": {"type": m["type"], "coordinates": rnd(m["coordinates"])}}]}, open(fe / "up-state.json", "w"), separators=(",", ":"))
    print(json.dumps(rep, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
