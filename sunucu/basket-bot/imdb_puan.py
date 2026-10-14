#!/usr/bin/env python3
"""imdb_puan.py — takip edilen animelerin son bölümünün IMDb puanı (sistem-bakim, FLUGEL Island).

Kaynak: IMDb'nin resmi, ticari olmayan veri dosyaları (https://datasets.imdbws.com, günlük güncellenir).
"Information courtesy of IMDb (https://www.imdb.com). Used with permission." — yalnızca kişisel kullanım.
- title.basics (iki geçiş) + title.episode haftada bir indirilir, akarak süzülür (sadece animasyon dizileri tutulur),
  ham dosyalar saklanmaz; title.ratings her gün.
- Eşleştirme: anime adı (Season/Part ekleri atılmış) IMDb dizisinin adıyla birebir aynı olmalı; sezon
  numarası addaki "Season N"den, bölüm numarası son yayınlanan bölümden. Eşleşmezse puan BOŞ kalır,
  tahmin yapılmaz.
Çıktı: $BOT_DIR/imdb.json  {mal_id: {"imdb": tt…, "sezon": n, "bolum": n, "puan": 8.1, "oy": 123}}
"""
import csv
import gzip
import io
import json
import os
import re
import sys
import time
import urllib.request

DIR = os.environ.get("BOT_DIR", "/var/lib/basket-bot")
INDEKS = os.path.join(DIR, "imdb-indeks.json")
CIKTI = os.path.join(DIR, "imdb.json")
KOK = "https://datasets.imdbws.com/"
csv.field_size_limit(10 ** 7)


def akis(ad):
    """gzip TSV'yi diske yazmadan satır satır okur."""
    istek = urllib.request.Request(KOK + ad, headers={"User-Agent": "FLUGEL-sistem-bakim"})
    yanit = urllib.request.urlopen(istek, timeout=60)
    return csv.reader(io.TextIOWrapper(gzip.GzipFile(fileobj=yanit), encoding="utf-8"), delimiter="\t",
                      quoting=csv.QUOTE_NONE)


def sade(ad):
    ad = (ad or "").lower()
    ad = re.sub(r"[:\-–—!?.,'’\"()\[\]]", " ", ad)
    return " ".join(ad.split())


def kok_ad(ad):
    """'X Season 2', 'X 2nd Season', 'X Part 2', 'X II' → ('x', sezon)"""
    sezon = 1
    m = re.search(r"(?:season|sezon)\s*(\d+)|(\d+)(?:st|nd|rd|th)\s+season", ad or "", re.I)
    if m:
        sezon = int(m.group(1) or m.group(2))
    temiz = re.sub(r"(?:season|sezon)\s*\d+|\d+(?:st|nd|rd|th)\s+season|part\s*\d+|cour\s*\d+", " ", ad or "", flags=re.I)
    return sade(temiz), sezon


def indeks_yenile():
    """Animasyon dizileri + bölümleri (haftalık)."""
    diziler = {}
    for s in akis("title.basics.tsv.gz"):
        if len(s) < 9 or s[1] not in ("tvSeries", "tvMiniSeries") or "Animation" not in s[8]:
            continue
        diziler[s[0]] = {"ad": sade(s[2]), "orj": sade(s[3]), "yil": s[5]}
    bolumler = {}
    for s in akis("title.episode.tsv.gz"):
        if len(s) < 4 or s[1] not in diziler or not s[2].isdigit() or not s[3].isdigit():
            continue
        bolumler[f"{s[1]}|{s[2]}|{s[3]}"] = s[0]
    # bölümlerin yayın yılı (ikinci geçiş): eski bir bölüme yanlış eşleşmeyi önler
    tt_anahtar = {tt: k for k, tt in bolumler.items()}
    for s in akis("title.basics.tsv.gz"):
        if s and s[0] in tt_anahtar:
            bolumler[tt_anahtar[s[0]]] = f"{s[0]}|{s[5]}"
    adlar = {}
    for tt, d in diziler.items():
        for a in {d["ad"], d["orj"]}:
            if a:
                adlar.setdefault(a, []).append(tt)
    veri = {"zaman": int(time.time()), "adlar": adlar, "bolumler": bolumler}
    with open(INDEKS + ".yeni", "w", encoding="utf-8") as f:
        json.dump(veri, f)
    os.replace(INDEKS + ".yeni", INDEKS)
    return veri


def main():
    try:
        indeks = json.load(open(INDEKS, encoding="utf-8"))
    except (OSError, ValueError):
        indeks = None
    if not indeks or time.time() - indeks.get("zaman", 0) > 7 * 86400 or "--yenile" in sys.argv:
        indeks = indeks_yenile()
    anime = json.load(open(os.path.join(DIR, "anime.json"), encoding="utf-8")).get("anime", [])
    hedef = {}
    for a in anime:
        if not a.get("son_bolum"):
            continue
        for ad in (a.get("ad"), a.get("ad_jp")):
            # "Part 2" gibi devam bölümlerinde numaralama belirsiz: eşleştirme yapılmaz
            if re.search(r"part\s*[2-9]|cour\s*[2-9]", ad or "", re.I):
                break
            kok, sezon = kok_ad(ad)
            for tt in indeks["adlar"].get(kok, []):
                deger = indeks["bolumler"].get(f"{tt}|{sezon}|{a['son_bolum']}")
                if not deger or "|" not in deger:
                    continue
                ep, yil = deger.split("|", 1)
                # bölüm son 1 yılda yayınlanmış olmalı (şu an yayında olan anime)
                if not yil.isdigit() or int(yil) < time.localtime().tm_year - 1:
                    continue
                hedef[ep] = {"mal": a["id"], "imdb": tt, "sezon": sezon, "bolum": a["son_bolum"]}
                break
            if any(h["mal"] == a["id"] for h in hedef.values()):
                break
    sonuc = {}
    if hedef:
        for s in akis("title.ratings.tsv.gz"):
            if s and s[0] in hedef:
                h = hedef[s[0]]
                sonuc[str(h["mal"])] = {**{k: h[k] for k in ("imdb", "sezon", "bolum")}, "bolum_imdb": s[0],
                                        "puan": float(s[1]), "oy": int(s[2])}
    with open(CIKTI + ".yeni", "w", encoding="utf-8") as f:
        json.dump({"zaman": int(time.time()), "kaynak": "IMDb (https://www.imdb.com), kişisel kullanım",
                   "puanlar": sonuc}, f, ensure_ascii=False)
    os.replace(CIKTI + ".yeni", CIKTI)
    print(f"imdb: {len(anime)} anime, {len(hedef)} bölüm eşleşti, {len(sonuc)} puan")


if __name__ == "__main__":
    main()
