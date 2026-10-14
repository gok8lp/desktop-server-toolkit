#!/usr/bin/env python3
"""Gundem botu (sistem-bakim) — Homepage paneli icin haber/mac/sorun akislari.

Her 10 dk RSS kaynaklarini, AniList yeni bolumlerini ve ESPN mac programini toplar;
her dakika sunucu sorunlarini (ai-gozcu ciktilari) ve hakemlik atamalarini (basket-bot) okur.
Sonuclari /veri altina JSON + iCal olarak yazar ve 8090 portundan sunar.
  /teknoloji.json /anime-haber.json /gundem.json /yeni-bolumler.json
  /maclar.json /sorunlar.json /ozet.json /takvim.ics
Bagimlilik yok (sadece Python standart kutuphanesi).
"""
import email.utils
import html
import json
import os
import re
import threading
import time
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

VERI = os.environ.get("VERI", "/veri")
DURUM = os.environ.get("DURUM_DIR", "/durum")          # ~/sistem-bakim/durum (ai-gozcu)
BOT = os.environ.get("BOT_DIR", "/basket")             # /var/lib/basket-bot
TR = timezone(timedelta(hours=3))
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"}

KAYNAKLAR = {
    "teknoloji": [
        ("Webtekno", "https://www.webtekno.com/rss.xml"),
        ("ShiftDelete", "https://shiftdelete.net/feed"),
        ("DonanımHaber", "https://www.donanimhaber.com/rss/tum/"),
        ("The Verge", "https://www.theverge.com/rss/index.xml"),
        ("Hacker News", "https://hnrss.org/frontpage?points=150"),
    ],
    "anime-haber": [
        ("ANN", "https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w"),
        ("MAL", "https://myanimelist.net/rss/news.xml"),
        ("Crunchyroll", "https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss"),
    ],
    "gundem": [
        ("BBC Türkçe", "https://feeds.bbci.co.uk/turkce/rss.xml"),
        ("NTV", "https://www.ntv.com.tr/gundem.rss"),
        ("AA", "https://www.aa.com.tr/tr/rss/default?cat=guncel"),
        ("Google Haberler", "https://news.google.com/rss?hl=tr&gl=TR&ceid=TR:tr"),
    ],
}
ESPN = [
    ("Süper Lig", "soccer/tur.1"),
    ("Şampiyonlar Ligi", "soccer/uefa.champions"),
    ("NBA", "basketball/nba"),
]


def al(url, zaman=20):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=zaman).read()


def yaz(ad, veri):
    yol = os.path.join(VERI, ad)
    with open(yol + ".yeni", "w", encoding="utf-8") as f:
        if isinstance(veri, str):
            f.write(veri)
        else:
            json.dump(veri, f, ensure_ascii=False)
    os.replace(yol + ".yeni", yol)


def once(ts, simdi=None):
    """Unix zamani -> '12 dk', '3 sa', '2 g' (gecmis) ya da '3 sa sonra' (gelecek)."""
    simdi = simdi or time.time()
    fark = int(simdi - ts)
    sonra = fark < 0
    fark = abs(fark)
    if fark < 3600:
        m = f"{max(1, fark // 60)} dk"
    elif fark < 86400:
        m = f"{fark // 3600} sa"
    else:
        m = f"{fark // 86400} g"
    return f"{m} sonra" if sonra else m


def tarih_coz(s):
    if not s:
        return 0
    s = s.strip()
    try:
        return email.utils.parsedate_to_datetime(s).timestamp()
    except Exception:
        pass
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0


def temiz(s):
    s = html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()
    return re.sub(r"\s+", " ", s)


def rss_oku(kaynak, url):
    kok = ET.fromstring(al(url))
    ogeler = []
    for o in kok.iter():
        etiket = o.tag.split("}")[-1]
        if etiket not in ("item", "entry"):
            continue
        d = {}
        for c in o:
            ct = c.tag.split("}")[-1]
            if ct == "link":
                d.setdefault("link", c.get("href") or (c.text or "").strip())
            elif ct in ("title", "pubDate", "published", "updated", "date"):
                d.setdefault(ct, c.text or "")
        baslik = temiz(d.get("title"))
        ad = kaynak
        if kaynak == "Google Haberler" and " - " in baslik:      # "Baslik - Kaynak"
            baslik, ad = baslik.rsplit(" - ", 1)
        ts = tarih_coz(d.get("pubDate") or d.get("published") or d.get("updated") or d.get("date"))
        if baslik and d.get("link"):
            ogeler.append({"baslik": baslik, "kaynak": ad, "ts": ts, "link": d["link"]})
    return ogeler[:25]


def haberleri_topla():
    for tur, liste in KAYNAKLAR.items():
        hepsi, hatalar = [], []
        with ThreadPoolExecutor(6) as h:
            isler = {h.submit(rss_oku, k, u): k for k, u in liste}
            for i, k in isler.items():
                try:
                    hepsi += i.result()
                except Exception as e:
                    hatalar.append(f"{k}: {type(e).__name__}")
        gorulen, ogeler = set(), []
        for o in sorted(hepsi, key=lambda x: -x["ts"]):
            anahtar = re.sub(r"\W+", "", o["baslik"].lower())[:60]
            if anahtar in gorulen:
                continue
            gorulen.add(anahtar)
            ogeler.append(o)
        # ayni kaynaktan art arda cok haber gelmesin: kaynaklari sirayla karistir (en yeniler once)
        simdi = time.time()
        for o in ogeler:
            o["etiket"] = f"{o['kaynak']} · {once(o['ts'], simdi)}" if o["ts"] else o["kaynak"]
        if ogeler or not os.path.exists(os.path.join(VERI, f"{tur}.json")):
            yaz(f"{tur}.json", {"ogeler": ogeler[:40], "hatalar": hatalar,
                                "guncelleme": datetime.now(TR).strftime("%H:%M")})


def yeni_bolumler():
    simdi = int(time.time())
    sorgu = """query($a:Int,$b:Int){Page(perPage:50){airingSchedules(airingAt_greater:$a,airingAt_lesser:$b,sort:TIME_DESC){
      episode airingAt media{title{romaji english} popularity siteUrl isAdult countryOfOrigin}}}}"""
    istek = urllib.request.Request("https://graphql.anilist.co", headers={**UA, "Content-Type": "application/json"},
                                   data=json.dumps({"query": sorgu, "variables": {"a": simdi - 86400, "b": simdi}}).encode())
    d = json.load(urllib.request.urlopen(istek, timeout=25))["data"]["Page"]["airingSchedules"]
    ogeler = []
    for s in sorted(d, key=lambda x: -(x["media"]["popularity"] or 0)):
        m = s["media"]
        if m["isAdult"] or m["countryOfOrigin"] != "JP":
            continue
        ad = m["title"]["english"] or m["title"]["romaji"]
        ogeler.append({"baslik": ad, "etiket": f"{s['episode']}. bölüm · {once(s['airingAt'], simdi)}",
                       "link": m["siteUrl"], "ts": s["airingAt"]})
    yaz("yeni-bolumler.json", {"ogeler": ogeler[:25], "guncelleme": datetime.now(TR).strftime("%H:%M")})


def espn_maclar():
    ogeler = []
    bugun = datetime.now(TR)
    gunler = [(bugun + timedelta(days=k)).strftime("%Y%m%d") for k in range(-1, 4)]   # ESPN aralik kabul etmiyor
    def getir(is_):
        yol, gun = is_
        try:
            return json.loads(al(f"https://site.api.espn.com/apis/site/v2/sports/{yol}/scoreboard?dates={gun}")).get("events", [])
        except Exception:
            return []
    isler = [(lig, yol, gun) for lig, yol in ESPN for gun in gunler]
    with ThreadPoolExecutor(6) as h:
        sonuclar = list(h.map(lambda x: getir((x[1], x[2])), isler))
    gorulen = set()
    for (lig, _yol, _gun), olaylar in zip(isler, sonuclar):
        for e in olaylar:
            if e.get("id") in gorulen:
                continue
            gorulen.add(e.get("id"))
            ts = tarih_coz(e.get("date"))
            c = e["competitions"][0]
            takim = {t["homeAway"]: t for t in c["competitors"]}
            ev, dep = takim.get("home", {}), takim.get("away", {})
            durum = e["status"]["type"]
            if durum["state"] == "post":
                if time.time() - ts > 36 * 3600:
                    continue
                sonuc = f"{ev.get('score', '')}-{dep.get('score', '')} · bitti"
            elif durum["state"] == "in":
                sonuc = f"{ev.get('score', '')}-{dep.get('score', '')} · CANLI {durum.get('shortDetail', '')}"
            else:
                sonuc = datetime.fromtimestamp(ts, TR).strftime("%a %H:%M").replace("Mon", "Pzt").replace(
                    "Tue", "Sal").replace("Wed", "Çar").replace("Thu", "Per").replace("Fri", "Cum").replace(
                    "Sat", "Cmt").replace("Sun", "Paz")
            link = next((l["href"] for l in e.get("links", []) if "summary" in l.get("rel", []) or "gamecast" in l.get("rel", [])),
                        e.get("links", [{}])[0].get("href", "https://www.espn.com"))
            ogeler.append({"baslik": f"{ev['team']['shortDisplayName']} – {dep['team']['shortDisplayName']}",
                           "etiket": f"{lig} · {sonuc}", "link": link, "ts": ts,
                           "canli": durum["state"] == "in", "bitti": durum["state"] == "post"})
    # once canli, sonra yaklasanlar, en son bitenler
    ogeler.sort(key=lambda o: (0 if o["canli"] else 2 if o["bitti"] else 1, o["ts"] if not o["bitti"] else -o["ts"]))
    return ogeler


def hakem_maclari():
    try:
        d = json.load(open(os.path.join(BOT, "maclar.json"), encoding="utf-8"))
    except Exception:
        return [], None
    ogeler = []
    for m in d.get("gelecek", []):
        tarih = " ".join(x for x in (m.get("tarih"), m.get("saat")) if x)
        mac = " – ".join(x for x in (m.get("ev"), m.get("dep")) if x) or "Maç"
        ogeler.append({"baslik": f"{mac}", "etiket": " · ".join(x for x in (tarih, m.get("gorev"), m.get("salon")) if x),
                       "link": m.get("link") or "https://www.ankarabasket.org.tr", "ts": 0, "hakem": True})
    return ogeler, d.get("guncelleme")


ESPN_ON = {"zaman": 0, "veri": []}


def maclari_yaz():
    if time.time() - ESPN_ON["zaman"] > 300:
        try:
            ESPN_ON["veri"] = espn_maclar()
            ESPN_ON["zaman"] = time.time()
        except Exception:
            pass
    hakem, gunc = hakem_maclari()
    if not hakem:
        hakem = [{"baslik": "Hakemlik ataması yok", "etiket": f"bülten {gunc or '?'} tarandı",
                  "link": "https://www.ankarabasket.org.tr", "ts": 0}]
    yaz("maclar.json", {"ogeler": hakem + ESPN_ON["veri"][:30], "hakem": hakem,
                        "guncelleme": datetime.now(TR).strftime("%H:%M")})


def sorunlari_yaz():
    ogeler = []
    try:
        satirlar = open(os.path.join(DURUM, ".durum"), encoding="utf-8").read().strip().splitlines()
        durum, sorunlar = satirlar[0], satirlar[1:]
        degisti = os.path.getmtime(os.path.join(DURUM, ".durum"))
    except Exception:
        durum, sorunlar, degisti = "BILINMIYOR", ["ai-gozcu durum dosyasi okunamadi"], 0
    for s in sorunlar:
        ogeler.append({"baslik": f"! {s}", "etiket": "şimdi", "link": "/durum", "tur": "sorun"})
    if durum == "IYI":
        ogeler.append({"baslik": "✓ Sunucu sağlıklı — sorun yok", "etiket": f"kontrol {once(degisti)} önce",
                       "link": "/durum", "tur": "iyi"})
    try:
        bild = open(os.path.join(DURUM, "bildirimler.log"), encoding="utf-8").read().strip().splitlines()[-12:]
        eklenen = 0
        for b in reversed(bild):
            p = b.split("|", 2)
            if len(p) == 3 and eklenen < 3:
                ts = datetime.strptime(p[0], "%Y-%m-%d %H:%M:%S").replace(tzinfo=TR).timestamp()
                if time.time() - ts > 12 * 3600:      # sadece son 12 saat
                    continue
                eklenen += 1
                ikon = {"UYARI": "▲", "KRITIK": "■", "BILGI": "•"}.get(p[1], "•")
                ogeler.append({"baslik": f"{ikon} {re.sub(r'[^\w\s.,:;()%/+-]', '', temiz(p[2])).strip()[:90]}", "etiket": once(ts), "link": "/durum",
                               "tur": "bildirim"})
    except Exception:
        pass
    ai = ""
    try:
        ai = open(os.path.join(DURUM, "gunluk-ozet.txt"), encoding="utf-8").read().split("\n", 1)[1].strip()
    except Exception:
        pass
    yaz("sorunlar.json", {"durum": durum, "sorun_sayisi": len(sorunlar), "ogeler": ogeler, "ozet": ai,
                          "guncelleme": datetime.now(TR).strftime("%H:%M")})
    # durum.html'i panelden /durum olarak gostermek icin kopyala
    try:
        yaz("durum.html", open(os.path.join(DURUM, "durum.html"), encoding="utf-8").read())
    except Exception:
        pass
    return durum, len(sorunlar)


def ics_yaz():
    """Anime yayinlari (MAL listesi) + hakemlik atamalari -> takvim.ics (Homepage takvim widget'i)."""
    olaylar = []
    try:
        d = json.load(open(os.path.join(BOT, "anime.json"), encoding="utf-8"))
        for a in d.get("anime", []):
            if a.get("yayin"):
                olaylar.append((a["yayin"], 24, f"{a['ad']} — {a.get('sonraki_bolum', '?')}. bölüm", a.get("url", "")))
    except Exception:
        pass
    try:
        for m in json.load(open(os.path.join(BOT, "maclar.json"), encoding="utf-8")).get("gelecek", []):
            b = datetime.strptime(f"{m['tarih']} {m.get('saat') or '00:00'}", "%Y-%m-%d %H:%M").replace(tzinfo=TR)
            olaylar.append((b.timestamp(), 90, f"{m.get('gorev', 'Maç')}: {m.get('ev')} – {m.get('dep')} ({m.get('salon')})", ""))
    except Exception:
        pass
    s = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//flugel//gundem-botu//TR", "CALSCALE:GREGORIAN"]
    for i, (ts, dk, ad, url) in enumerate(olaylar):
        b = datetime.fromtimestamp(ts, timezone.utc)
        s += ["BEGIN:VEVENT", f"UID:flugel-{i}-{int(ts)}@flugelserver", f"DTSTAMP:{b:%Y%m%dT%H%M%SZ}",
              f"DTSTART:{b:%Y%m%dT%H%M%SZ}", f"DTEND:{b + timedelta(minutes=dk):%Y%m%dT%H%M%SZ}",
              "SUMMARY:" + ad.replace(",", "\\,").replace(";", "\\;"), f"URL:{url}", "END:VEVENT"]
    s.append("END:VCALENDAR")
    yaz("takvim.ics", "\r\n".join(s) + "\r\n")


def ozet_yaz(durum, sayi):
    """Telefon uygulamasi / kilit ekrani icin tek bakista ozet."""
    def ilk(ad, n=3):
        try:
            return json.load(open(os.path.join(VERI, ad), encoding="utf-8"))["ogeler"][:n]
        except Exception:
            return []
    yaz("ozet.json", {"durum": durum, "sorun_sayisi": sayi, "gundem": ilk("gundem.json"),
                      "teknoloji": ilk("teknoloji.json"), "anime": ilk("anime-haber.json"),
                      "bolumler": ilk("yeni-bolumler.json"), "maclar": ilk("maclar.json", 4),
                      "guncelleme": datetime.now(TR).strftime("%H:%M")})


def guvenli(f, *a):
    try:
        return f(*a)
    except Exception as e:
        print(time.strftime("%F %T"), f.__name__, "HATA:", type(e).__name__, e, flush=True)


def dongu():
    son_haber = 0
    while True:
        if time.time() - son_haber > 600:
            son_haber = time.time()
            guvenli(haberleri_topla)
            guvenli(yeni_bolumler)
            guvenli(ics_yaz)
        guvenli(maclari_yaz)
        r = guvenli(sorunlari_yaz) or ("BILINMIYOR", 0)
        guvenli(ozet_yaz, *r)
        time.sleep(60)


class Sunucu(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=VERI, **k)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        if self.path.rstrip("/") == "/durum":
            self.path = "/durum.html"
        if self.path.endswith(".ics"):
            self.extensions_map[".ics"] = "text/calendar; charset=utf-8"
        return super().do_GET()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    os.makedirs(VERI, exist_ok=True)
    threading.Thread(target=dongu, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", 8090), Sunucu).serve_forever()
