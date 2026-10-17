#!/usr/bin/env python3
"""FLUGEL Akis — tek kisilik sosyal akis uygulamasi (sistem-bakim). v2

Nasil calisir:
  * Toplayicilar (arka plan is parcaciklari) RSS/Atom kaynaklarini, YouTube kanal akislarini, AniList'i,
    Steam'i ve ESPN'i duzenli araliklarla okur; her haberi SQLite'a (/veri/akis.db) tek satir olarak yazar.
    Ayni link ikinci kez gelirse yeni satir acilmaz (id = linkin ozeti).
  * Cevirmen: Ingilizce anime/oyun haberlerini sunucudaki Ollama'ya (gemma3) gonderir, Turkce baslik+ozet saklar.
  * Resim avcisi: RSS'te resmi olmayan haberlerin sayfasindan og:image etiketini bulur.
  * API: tarayici /api/akis?k=...&once=<zaman> ile 20'ser 20'ser ister (sonsuz kaydirma), /api/yeni ile
    "N yeni gonderi" sayisini sorar. AI penceresi /api/ai'ye yazar, cevap Ollama'dan (qwen3) akarak gelir.
Bagimlilik yok: sadece Python standart kutuphanesi.
"""
import email.utils
import hashlib
import html
import json
import os
import re
import sqlite3
import threading
import time
import urllib.parse
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VERI = os.environ.get("VERI", "/veri")
WEB = os.environ.get("WEB", "/app/web")
BOT = os.environ.get("BOT_DIR", "/basket")
DURUM = os.environ.get("DURUM_DIR", "/durum")
OLLAMA = os.environ.get("OLLAMA", "http://host.docker.internal:11434")
CEVIRI_MODEL = os.environ.get("CEVIRI_MODEL", "gemma3:latest")
SOHBET_MODEL = os.environ.get("SOHBET_MODEL", "gemma3:latest")   # ceviriyle ayni model: GPU'da model degisimi beklemesi olmaz
DB = os.path.join(VERI, "akis.db")
TR = timezone(timedelta(hours=3))
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
      "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.6"}
MEDIA = "{http://search.yahoo.com/mrss/}"
YT = "{http://www.youtube.com/xml/schemas/2015}"
ATOM = "{http://www.w3.org/2005/Atom}"

# (kategori, kaynak adi, adres, dil, kontrol araligi dk, etiket) — onemli kaynaklar 1 dk, digerleri 3 dk — agirlik Turkce; en/ja olanlar Turkceye cevrilir
KAYNAKLAR = [
    # oyun — Turkce
    ("oyun", "Oyungezer", "https://oyungezer.com.tr/rss", "tr", 1, ""),
    ("oyun", "Merlin'in Kazanı", "https://www.merlininkazani.com/rss", "tr", 1, ""),
    ("oyun", "ShiftDelete Oyun", "https://shiftdelete.net/oyun/feed", "tr", 1, ""),
    # oyun — PlayStation
    ("oyun", "PlayStation Blog", "https://blog.playstation.com/feed/", "en", 1, "playstation"),
    ("oyun", "Push Square", "https://www.pushsquare.com/feeds/latest", "en", 1, "playstation"),
    ("oyun", "PlayStation LifeStyle", "https://www.playstationlifestyle.net/feed/", "en", 3, "playstation"),
    # oyun — dunya
    ("oyun", "IGN", "https://feeds.ign.com/ign/news", "en", 1, ""),
    ("oyun", "VGC", "https://www.videogameschronicle.com/feed/", "en", 1, ""),
    ("oyun", "Eurogamer", "https://www.eurogamer.net/feed", "en", 3, ""),
    ("oyun", "GameSpot", "https://www.gamespot.com/feeds/news/", "en", 3, ""),
    ("oyun", "Polygon", "https://www.polygon.com/rss/index.xml", "en", 3, ""),
    ("oyun", "Kotaku", "https://kotaku.com/rss", "en", 3, ""),
    ("oyun", "Xbox Wire", "https://news.xbox.com/en-us/feed/", "en", 3, ""),
    ("oyun", "Nintendo Life", "https://www.nintendolife.com/feeds/latest", "en", 3, ""),
    # teknoloji — Turkce
    ("teknoloji", "Webtekno", "https://www.webtekno.com/rss.xml", "tr", 1, ""),
    ("teknoloji", "DonanımHaber", "https://www.donanimhaber.com/rss/tum/", "tr", 1, ""),
    ("teknoloji", "ShiftDelete", "https://shiftdelete.net/feed", "tr", 1, ""),
    ("teknoloji", "Chip Online", "https://www.chip.com.tr/rss", "tr", 1, ""),
    ("teknoloji", "Technopat", "https://www.technopat.net/feed/", "tr", 1, ""),
    ("teknoloji", "Webrazzi", "https://webrazzi.com/feed", "tr", 3, ""),
    ("teknoloji", "Hardware Plus", "https://hwp.com.tr/feed", "tr", 3, ""),
    ("teknoloji", "Donanım Arşivi", "https://donanimarsivi.com/feed/", "tr", 3, ""),
    ("teknoloji", "LOG", "https://www.log.com.tr/feed/", "tr", 3, ""),
    ("teknoloji", "Teknoblog", "https://www.teknoblog.com/feed/", "tr", 3, ""),
    # gundem
    ("gundem", "NTV", "https://www.ntv.com.tr/gundem.rss", "tr", 1, ""),
    ("gundem", "BBC Türkçe", "https://feeds.bbci.co.uk/turkce/rss.xml", "tr", 1, ""),
    ("gundem", "Hürriyet", "https://www.hurriyet.com.tr/rss/gundem", "tr", 1, ""),
    ("gundem", "Sözcü", "https://www.sozcu.com.tr/feeds-rss-category-gundem", "tr", 1, ""),
    ("gundem", "Cumhuriyet", "https://www.cumhuriyet.com.tr/rss/son_dakika.xml", "tr", 1, ""),
    # anime / manga — dunya + Japonya
    ("anime", "Anime News Network", "https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w", "en", 1, ""),
    ("anime", "Crunchyroll", "https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss", "en", 1, ""),
    ("anime", "MyAnimeList", "https://myanimelist.net/rss/news.xml", "en", 3, ""),
    ("anime", "Anime Corner", "https://animecorner.me/feed/", "en", 3, ""),
    ("anime", "アニメ！アニメ！", "https://animeanime.jp/rss/index.rdf", "ja", 3, "japonya"),
    # film / dizi
    ("film", "Beyazperde", "https://www.beyazperde.com/rss/haberler.xml", "tr", 3, ""),
]
# YouTube kanallari (kimlikler @adlarindan cozuldu): (kategori, ad, kanal)
YOUTUBE = [
    ("teknoloji", "ShiftDelete", "UCICR9zM4mJ7yc0472mn346A"), ("teknoloji", "Webtekno", "UCIw9uiVhJtpzkyQLOOpbjrg"),
    ("teknoloji", "Technopat", "UC-gs6ml23jQKvLC86LzpQ0g"), ("teknoloji", "Barış Özcan", "UCv6jcPwFujuTIwFQ11jt1Yw"),
    ("teknoloji", "Marques Brownlee", "UCBJycsmduvYEL83R_U4JriQ"),
    ("oyun", "Oyungezer", "UCrTo3HDliaWeHWQeMDCE9Ug"), ("oyun", "Merlin'in Kazanı", "UCJjdArZ7l4ysiBuQ9ssyuvw"),
    ("oyun", "PlayStation Türkiye", "UCmf6uj3TuekfV4P5yKULtJw"), ("oyun", "PlayStation", "UC-2Y8dQb0S6DtpxNgAKoJKA"),
    ("oyun", "Xbox", "UCjBp_7RuDBUYbd1LegWEJ8g"), ("oyun", "Nintendo", "UCGIY_O-8vW4rfX98KlMkvRg"),
    ("oyun", "IGN", "UCKy1dAqELo0zrOtPkf0eTMw"), ("oyun", "Ubisoft Türkiye", "UC3hJJ9W1U8LbvbzSDg9dong"),
    ("oyun", "Rockstar Games", "UC6VcWc1rAoWdBCM0JxrRQ3A"), ("oyun", "CD PROJEKT RED", "UCuCtanBJXOPAEIAUXf9944g"),
    ("oyun", "Capcom", "UCW7h-1mymnJ96akzjrmiIgA"), ("oyun", "Square Enix", "UC6SmH9mR82nj28_NNg_rZvA"),
    ("anime", "Crunchyroll", "UC6pGDc4bFGD1_36IKv3FnYg"), ("anime", "Netflix Anime", "UCBSs9x2KzSLhyyA9IKyt4YA"),
    ("anime", "TOHO animation", "UC14Yc2Qv92DMuyNRlHvpo2Q"), ("anime", "Toei Animation", "UCTTv0NxWnJsNzAY3Ivj61zg"),
    ("anime", "Aniplex", "UCDb0peSmF5rLX7BvuTcJfCw"),
    ("film", "Netflix Türkiye", "UCeZOywU-zg9j3SxYG0FdLtw"), ("film", "IMDb", "UC_vz6SvmIkYs1_H3Wv2SKlg"),
    ("film", "Prime Video Türkiye", "UCC2WX81SKnhj7utVypKTzyQ"), ("film", "Disney+ Türkiye", "UCFQ3Joj8PuZD5gWU-mgbEoQ"),
]
FRAGMAN = re.compile(r"\b(trailer|teaser|fragman|tanıtım|pv|cm|reveal|announcement|gameplay|official\s+clip)\b|予告|ＰＶ", re.I)
PS_KELIME = re.compile(r"\b(playstation|ps5|ps4|ps\s?plus|dualsense|ps\s?vr2?|sony interactive|state of play)\b", re.I)


LIGLER = [  # hafta sonu maclari (ESPN)
    ("Süper Lig", "soccer/tur.1"), ("Premier Lig", "soccer/eng.1"), ("La Liga", "soccer/esp.1"),
    ("Serie A", "soccer/ita.1"), ("Bundesliga", "soccer/ger.1"), ("Ligue 1", "soccer/fra.1"),
    ("Şampiyonlar Ligi", "soccer/uefa.champions"), ("Avrupa Ligi", "soccer/uefa.europa"), ("NBA", "basketball/nba"),
]
GUN = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]

ONBELLEK = {}          # ad -> (zaman, veri)
YAZ = threading.Lock()


# ------------------------------------------------------------------ yardimcilar
def al(url, zaman=20, sinir=None, basliklar=None, veri=None):
    istek = urllib.request.Request(url, headers={**UA, **(basliklar or {})}, data=veri)
    with urllib.request.urlopen(istek, timeout=zaman) as y:
        return y.read(sinir) if sinir else y.read()


def db():
    c = sqlite3.connect(DB, timeout=30)
    c.row_factory = sqlite3.Row
    return c


def db_kur():
    with YAZ, db() as c:
        c.executescript("""
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS oge(
          id TEXT PRIMARY KEY, tur TEXT, kaynak TEXT, baslik TEXT, ozet TEXT, resim TEXT, link TEXT,
          ts INTEGER, dil TEXT, baslik_tr TEXT, ozet_tr TEXT, video TEXT, eklendi INTEGER,
          okundu INTEGER DEFAULT 0, kayitli INTEGER DEFAULT 0, ceviri_hata INTEGER DEFAULT 0);
        CREATE INDEX IF NOT EXISTS oge_tur_ts ON oge(tur, ts);
        CREATE INDEX IF NOT EXISTS oge_ts ON oge(ts);
        CREATE TABLE IF NOT EXISTS takip(kelime TEXT PRIMARY KEY);
        """)
        for kolon in ("alt TEXT", "etiket TEXT DEFAULT ''", "onem INTEGER", "kume TEXT", "uyari INTEGER DEFAULT 0", "neden TEXT"):
            try:
                c.execute(f"ALTER TABLE oge ADD COLUMN {kolon}")
            except sqlite3.OperationalError:
                pass
        c.execute("CREATE INDEX IF NOT EXISTS oge_kume ON oge(kume)")
        if not c.execute("SELECT 1 FROM takip LIMIT 1").fetchone():      # baslangic takip kelimeleri
            c.executemany("INSERT INTO takip VALUES(?)", [(k,) for k in ("Re:Zero", "GTA 6", "PlayStation Plus", "Elden Ring")])


def temiz(s, n=None):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    return s[:n] if n else s


def tarih(s):
    if not s:
        return 0
    s = s.strip()
    try:
        return int(email.utils.parsedate_to_datetime(s).timestamp())
    except Exception:
        pass
    try:
        return int(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp())
    except Exception:
        return 0


def kimlik(link):
    return hashlib.sha1(link.encode()).hexdigest()[:16]


def onbellek(ad, sure, f):
    z, v = ONBELLEK.get(ad, (0, None))
    if v is not None and time.time() - z < sure:
        return v
    try:
        v = f()
        ONBELLEK[ad] = (time.time(), v)
    except Exception as e:
        print(time.strftime("%T"), ad, "HATA", type(e).__name__, e, flush=True)
    return ONBELLEK.get(ad, (0, v))[1]


# ------------------------------------------------------------------ RSS / Atom
def resim_bul(oge, metin):
    for e in oge.iter():
        t = e.tag
        if t in (MEDIA + "content", MEDIA + "thumbnail"):
            u = e.get("url")
            if u and (e.get("medium") in (None, "image") or "image" in (e.get("type") or "")) and not u.endswith((".mp4", ".mp3")):
                return u
        if t == "enclosure" and "image" in (e.get("type") or "") and e.get("url"):
            return e.get("url")
    m = re.search(r'<img[^>]+src=["\']([^"\']+)', metin or "")
    return html.unescape(m.group(1)) if m else None


def xml_coz(ham):
    try:
        return ET.fromstring(ham)
    except ET.ParseError:      # bozuk akislar: kacirilmamis & ve kontrol karakterleri
        ham = re.sub(rb"&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)", b"&amp;", ham)
        ham = re.sub(rb"[\x00-\x08\x0b\x0c\x0e-\x1f]", b"", ham)
        ham = re.sub(rb'(<[^>]*?\s[\w:-]+)=([^\s"\'>]+)', rb'\1="\2"', ham)     # tirnaksiz ozellik: type=image/jpeg
        return ET.fromstring(ham)


ETIKET_ONBELLEK = {}   # url -> (ETag, Last-Modified): degismemis akisi tekrar indirme


def al_kosullu(url):
    eski = ETIKET_ONBELLEK.get(url, (None, None))
    b = {}
    if eski[0]:
        b["If-None-Match"] = eski[0]
    if eski[1]:
        b["If-Modified-Since"] = eski[1]
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={**UA, **b}), timeout=20) as y:
            ETIKET_ONBELLEK[url] = (y.headers.get("ETag"), y.headers.get("Last-Modified"))
            return y.read()
    except urllib.error.HTTPError as e:
        if e.code == 304:
            return None
        raise


def rss_regex(ham):
    """XML'i tamamen bozuk akislar icin (ornek: Oyungezer) kaba ama saglam okuyucu."""
    metin = ham.decode("utf8", "ignore")
    cikti = []
    for blok in re.findall(r"(?is)<item[ >].*?</item>", metin):
        al_ = lambda ad: (re.search(rf"(?is)<{ad}[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{ad}>", blok) or [None, ""])[1]
        resim = re.search(r'(?is)<(?:enclosure|media:content|media:thumbnail)[^>]+url=["\']?([^"\' >]+)', blok)
        cikti.append({"title": al_("title"), "link": al_("link").strip(), "pubDate": al_("pubDate"),
                      "description": al_("description"), "_resim": resim.group(1) if resim else None})
    return cikti


def rss_oku(tur, kaynak, url, dil, etiket=""):
    ham = al_kosullu(url)
    if ham is None:
        return []
    ogeler = []
    try:
        kok = xml_coz(ham)
        for oge in kok.iter():
            if oge.tag.split("}")[-1] not in ("item", "entry"):
                continue
            d = {}
            for c in oge:
                ad = c.tag.split("}")[-1]
                if ad == "link":
                    d.setdefault("link", c.get("href") or (c.text or "").strip())
                elif ad in ("title", "pubDate", "published", "updated", "date", "description", "summary", "encoded", "content"):
                    d.setdefault(ad, c.text or "")
            d["_resim_oge"] = oge
            ogeler.append(d)
    except ET.ParseError:
        ogeler = rss_regex(ham)
    cikti = []
    for d in ogeler:
        link = d.get("link")
        if link and link.startswith("//"):
            link = "https:" + link
        baslik = temiz(d.get("title"))
        if not link or not baslik:
            continue
        ham_metin = d.get("encoded") or d.get("content") or d.get("description") or d.get("summary") or ""
        resim = d.get("_resim") or (resim_bul(d["_resim_oge"], ham_metin) if "_resim_oge" in d else None)
        if resim and resim.startswith("//"):
            resim = "https:" + resim
        cikti.append(dict(id=kimlik(link), tur=tur, kaynak=kaynak, baslik=baslik, ozet=temiz(ham_metin, 420), resim=resim,
                          link=link, dil=dil, video=None, alt=None, etiket=etiket,
                          ts=tarih(d.get("pubDate") or d.get("published") or d.get("updated") or d.get("date")) or int(time.time())))
    return cikti[:30]


def youtube_oku(tur, kaynak, kanal):
    ham = al_kosullu(f"https://www.youtube.com/feeds/videos.xml?channel_id={kanal}")
    if ham is None:
        return []
    kok = ET.fromstring(ham)
    cikti = []
    for e in kok.findall(ATOM + "entry")[:12]:
        vid = e.findtext(YT + "videoId")
        baslik = temiz(e.findtext(ATOM + "title"))
        grup = e.find(MEDIA + "group")
        aciklama = grup.findtext(MEDIA + "description") if grup is not None else ""
        if not vid or "#shorts" in baslik.lower():
            continue
        link = f"https://www.youtube.com/watch?v={vid}"
        cikti.append(dict(id=kimlik(link), tur="youtube", kaynak=kaynak, baslik=baslik, ozet=temiz(aciklama, 300),
                          resim=f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg", link=link, dil="tr", video=vid,
                          ts=tarih(e.findtext(ATOM + "published")), alt=tur, etiket="fragman" if FRAGMAN.search(baslik) else ""))
    return cikti


def jeton(b):
    return {w for w in re.findall(r"[\wçğıöşü]{3,}", kucuk(b or "")) if w not in DURAK and not w.isdigit()}


def kume_bul(c, oid, baslik, ts, tur):
    """Ayni olayi anlatan baska kaynaktan bir haber varsa onun kimligini dondur (tekrarlari tek gonderide topla)."""
    j = jeton(baslik)
    if len(j) < 3 or tur == "youtube":
        return None
    for r in c.execute("""SELECT id, COALESCE(baslik_tr, baslik) b FROM oge WHERE id != ? AND kume IS NULL AND tur = ?
                          AND ts BETWEEN ? AND ? ORDER BY ts LIMIT 300""", (oid, tur, ts - 36 * 3600, ts + 3600)):
        k = jeton(r["b"])
        ortak = len(j & k)
        if ortak >= 3 and ortak / len(j | k) >= 0.5:
            return r["id"]
    return None


def takip_kelimeleri(c):
    return [r[0] for r in c.execute("SELECT kelime FROM takip")]


def uyari_kontrol(c, oid, metin):
    """Takip edilen kelime gectiyse isaretle ve sunucunun Telegram bildirimine sirasini yaz."""
    m = kucuk(metin or "")
    for k in takip_kelimeleri(c):
        if kucuk(k) in m:
            c.execute("UPDATE oge SET uyari=1 WHERE id=?", (oid,))
            r = c.execute("SELECT COALESCE(baslik_tr, baslik) b, link, kaynak FROM oge WHERE id=?", (oid,)).fetchone()
            with open(os.path.join(VERI, "uyari.jsonl"), "a", encoding="utf-8") as f:
                f.write(json.dumps({"kelime": k, "baslik": r["b"], "link": r["link"], "kaynak": r["kaynak"], "ts": int(time.time())},
                                   ensure_ascii=False) + "\n")
            return True
    return False


def kaydet(ogeler):
    simdi = int(time.time())
    yeni_sayi = 0
    with YAZ, db() as c:
        for o in ogeler:
            etiket = set(filter(None, (o.get("etiket") or "").split(",")))
            if PS_KELIME.search(o["baslik"] + " " + (o["ozet"] or "")):
                etiket.add("playstation")
            if o["dil"] == "ja":
                etiket.add("japonya")
            yeni = not c.execute("SELECT 1 FROM oge WHERE id=?", (o["id"],)).fetchone()
            c.execute("""INSERT INTO oge(id,tur,kaynak,baslik,ozet,resim,link,ts,dil,video,eklendi,alt,etiket)
                         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET resim=COALESCE(oge.resim, excluded.resim)""",
                      (o["id"], o["tur"], o["kaynak"], o["baslik"], o["ozet"], o["resim"], o["link"], min(o["ts"], simdi),
                       o["dil"], o.get("video"), simdi, o.get("alt"), ",".join(sorted(etiket))))
            if yeni:
                yeni_sayi += 1
                kume = kume_bul(c, o["id"], o["baslik"], min(o["ts"], simdi), o["tur"]) if o["dil"] == "tr" else None
                if kume:
                    c.execute("UPDATE oge SET kume=? WHERE id=?", (kume, o["id"]))
                elif o["dil"] == "tr" and simdi - o["ts"] < 6 * 3600:
                    uyari_kontrol(c, o["id"], o["baslik"] + " " + (o["ozet"] or ""))
        c.execute("DELETE FROM oge WHERE ts < ? AND kayitli = 0", (simdi - 21 * 86400,))
    return yeni_sayi


SON_KONTROL = {}
KAYNAK_DURUM = {}   # ad -> {son_kontrol, son_yeni, yeni_sayi, hata}


def toplayici():
    """Her kaynagi kendi araliginda (1-3 dk) kontrol eder; YouTube 5 dk. Degismemis akis tekrar indirilmez (ETag)."""
    while True:
        simdi = time.time()
        isler = []
        for k in KAYNAKLAR:
            if simdi - SON_KONTROL.get(k[2], 0) >= k[4] * 60:
                SON_KONTROL[k[2]] = simdi
                isler.append((rss_oku, (k[0], k[1], k[2], k[3], k[5])))
        for k in YOUTUBE:
            if simdi - SON_KONTROL.get(k[2], 0) >= 5 * 60:
                SON_KONTROL[k[2]] = simdi
                isler.append((youtube_oku, k))
        if isler:
            with ThreadPoolExecutor(8) as h:
                for (f, a), s in [(i, h.submit(i[0], *i[1])) for i in isler]:
                    d = KAYNAK_DURUM.setdefault(a[1] + (" ▶" if f is youtube_oku else ""), {"yeni_sayi": 0})
                    d["son_kontrol"] = int(time.time())
                    try:
                        sonuc = s.result()
                        yeni = kaydet(sonuc)
                        d["hata"] = None
                        if yeni:
                            d["son_yeni"] = int(time.time())
                            d["yeni_sayi"] += yeni
                    except Exception as e:
                        d["hata"] = f"{type(e).__name__}: {str(e)[:60]}"
                        print(time.strftime("%T"), "kaynak", a[1], type(e).__name__, str(e)[:80], flush=True)
        time.sleep(15)


# ------------------------------------------------------------------ resim avcisi (og:image)
def resim_avcisi():
    while True:
        with db() as c:
            satirlar = c.execute("""SELECT id, link FROM oge WHERE resim IS NULL AND tur != 'youtube'
                                     AND ts > ? ORDER BY ts DESC LIMIT 12""", (int(time.time()) - 3 * 86400,)).fetchall()
        for s in satirlar:
            bulunan = "yok"
            try:
                sayfa = al(s["link"], 12, 300_000).decode("utf8", "ignore")
                m = (re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', sayfa)
                     or re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image', sayfa)
                     or re.search(r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)', sayfa))
                if m:
                    bulunan = urllib.parse.urljoin(s["link"], html.unescape(m.group(1)))
            except Exception:
                pass
            with YAZ, db() as c:
                c.execute("UPDATE oge SET resim=? WHERE id=?", (bulunan, s["id"]))
        time.sleep(45 if satirlar else 120)


# ------------------------------------------------------------------ cevirmen (Ollama)
def ollama(yol, govde, zaman=180):
    return json.loads(al(f"{OLLAMA}{yol}", zaman, veri=json.dumps(govde).encode(),
                         basliklar={"Content-Type": "application/json"}))


DIL_AD = {"en": "İngilizce", "ja": "Japonca"}


def cevirmen():
    """Ingilizce/Japonca anime, oyun ve film haberlerini Turkceye cevirir (once anime, sonra en yeniler)."""
    while True:
        with db() as c:
            satirlar = c.execute("""SELECT id, baslik, ozet, dil, tur, ts FROM oge WHERE dil IN ('en','ja') AND baslik_tr IS NULL
                                     AND ceviri_hata < 3 AND tur IN ('anime','oyun','film') AND ts > ?
                                     ORDER BY (tur='anime') DESC, ts DESC LIMIT 8""", (int(time.time()) - 5 * 86400,)).fetchall()
        if not satirlar:
            time.sleep(60)
            continue
        for s in satirlar:
            istem = (f"Sen bir anime/oyun haber çevirmenisin. {DIL_AD[s['dil']]} başlığı ve özeti akıcı Türkçeye çevir.\n"
                     "KURALLAR: Anime, manga, oyun, film, dizi, stüdyo, şirket ve kişi adlarını ASLA çevirme; orijinal (Latin harfli) haliyle bırak "
                     "(örnek: 'Chainsaw Man' → 'Chainsaw Man', 'Attack on Titan' → 'Attack on Titan', 'The Apothecary Diaries' → "
                     "'The Apothecary Diaries', 'Elden Ring' → 'Elden Ring'). Japonca eser adlarını biliniyorsa yaygın İngilizce/romaji "
                     "adıyla yaz. 'Season 2' → '2. sezon', 'trailer'/'PV' → 'fragman'.\n"
                     'Sadece şu JSON\'u döndür: {"baslik": "...", "ozet": "..."}\n\n'
                     f"Başlık: {s['baslik']}\nÖzet: {(s['ozet'] or '')[:400]}")
            try:
                r = ollama("/api/generate", {"model": CEVIRI_MODEL, "prompt": istem, "stream": False, "format": "json",
                                             "keep_alive": "5m", "options": {"temperature": 0.1, "num_predict": 400}})
                j = json.loads(r.get("response") or "{}")
                bt = temiz(j.get("baslik")) or None
                with YAZ, db() as c:
                    c.execute("UPDATE oge SET baslik_tr=?, ozet_tr=? WHERE id=?", (bt, temiz(j.get("ozet")) or None, s["id"]))
                    if bt:       # cevrilince tekrar haber mi diye bak, takip kelimesi geciyor mu diye bak
                        kume = kume_bul(c, s["id"], bt, s["ts"], s["tur"])
                        if kume:
                            c.execute("UPDATE oge SET kume=? WHERE id=?", (kume, s["id"]))
                        elif time.time() - s["ts"] < 6 * 3600:
                            uyari_kontrol(c, s["id"], bt + " " + s["baslik"])
            except urllib.error.URLError:
                time.sleep(300)      # Ollama kapali (GPU sanal makinede olabilir)
                break
            except Exception:
                with YAZ, db() as c:
                    c.execute("UPDATE oge SET ceviri_hata = ceviri_hata + 1 WHERE id=?", (s["id"],))
        time.sleep(3)


ILGI = ("Kullanıcı: Türk bir üniversite öğrencisi ve basketbol hakemi. Çok ilgilendiği konular: PlayStation/PS5 ve konsol oyunları, "
        "büyük oyun duyuruları/çıkış tarihleri/incelemeler, PC donanımı ve ekran kartları, yapay zekâ, akıllı telefonlar, "
        "anime (özellikle Re:Zero, sezonluk yeni animeler) ve manga, Linux/Ubuntu. Az ilgilendiği: magazin, reklam/indirim kodları, "
        "fiyat karşılaştırma listeleri, küçük mobil oyunlar, kripto pompalama haberleri.")


def degerlendirici():
    """AI haber tarayici: son haberleri 10'arli gruplar halinde 0-100 'senin icin onem' puanlar ve konu etiketi cikarir."""
    while True:
        with db() as c:
            satirlar = c.execute("""SELECT id, tur, COALESCE(baslik_tr, baslik) b, etiket FROM oge WHERE onem IS NULL AND tur != 'gundem'
                                     AND ts > ? AND (dil='tr' OR baslik_tr IS NOT NULL OR ceviri_hata >= 3)
                                     ORDER BY ts DESC LIMIT 10""", (int(time.time()) - 2 * 86400,)).fetchall()
        if not satirlar:
            time.sleep(90)
            continue
        liste = "\n".join(f"{i}. [{r['tur']}] {r['b']}" for i, r in enumerate(satirlar))
        istem = (f"{ILGI}\n\nAşağıdaki haber başlıklarının her birine bu kullanıcı için 0-100 arası bir 'önem/ilgi' puanı ver "
                 "(90+: kaçırmaması gereken büyük haber, 70-89: ilgisini çeker, 40-69: sıradan, <40: ilgisiz). "
                 "Ayrıca her başlık için en fazla 2 kısa konu etiketi yaz (ör. 'PS5', 'GTA 6', 'NVIDIA', 'Re:Zero', 'iPhone'). "
                 'Sadece JSON döndür: {"sonuc": [{"i": 0, "puan": 85, "etiket": ["PS5"], "neden": "kısa gerekçe"}]}\n\n' + liste)
        try:
            r = ollama("/api/generate", {"model": CEVIRI_MODEL, "prompt": istem, "stream": False, "format": "json",
                                         "keep_alive": "5m", "options": {"temperature": 0.1, "num_predict": 900}})
            sonuc = {int(x.get("i", -1)): x for x in json.loads(r.get("response") or "{}").get("sonuc", []) if isinstance(x, dict)}
            with YAZ, db() as c:
                for i, s in enumerate(satirlar):
                    x = sonuc.get(i, {})
                    puan = max(0, min(100, int(x.get("puan", 50) or 50)))
                    et = set(filter(None, (s["etiket"] or "").split(","))) | {temiz(e)[:24] for e in (x.get("etiket") or [])[:2] if temiz(e)}
                    c.execute("UPDATE oge SET onem=?, etiket=?, neden=? WHERE id=?",
                              (puan, ",".join(sorted(et)), temiz(x.get("neden"))[:120] or None, s["id"]))
        except urllib.error.URLError:
            time.sleep(300)
        except Exception as e:
            print(time.strftime("%T"), "degerlendirici", type(e).__name__, str(e)[:80], flush=True)
            with YAZ, db() as c:      # takilmasin: bu grubu notr puanla gec
                c.executemany("UPDATE oge SET onem=50 WHERE id=?", [(s["id"],) for s in satirlar])
        time.sleep(4)


# ------------------------------------------------------------------ anime / manga (AniList + MAL listesi)
def anilist(sorgu, degisken):
    return json.loads(al("https://graphql.anilist.co", 25, veri=json.dumps({"query": sorgu, "variables": degisken}).encode(),
                         basliklar={"Content-Type": "application/json", "Accept": "application/json"}))["data"]


IZLE_SIRA = ["crunchyroll", "netflix", "disney plus", "amazon prime video", "hidive", "youtube", "bilibili tv", "hulu"]


def izle_yerleri(m):
    """AniList'teki YASAL yayin baglantilari (Crunchyroll, Netflix, Disney+, Prime...), tercihe gore sirali."""
    yer = [{"site": l["site"], "url": l["url"], "dil": l.get("language")} for l in (m.get("externalLinks") or [])
           if l.get("type") == "STREAMING" and l.get("url")]
    yer.sort(key=lambda y: IZLE_SIRA.index(y["site"].lower()) if y["site"].lower() in IZLE_SIRA else 99)
    return yer


def crunchyroll(m):
    yer = izle_yerleri(m)
    if yer:
        return yer[0]["url"]
    ad = (m.get("title") or {}).get("english") or (m.get("title") or {}).get("romaji") or ""
    return "https://www.crunchyroll.com/search?q=" + urllib.parse.quote(ad)


def imdb_ara(m):
    ad = (m.get("title") or {}).get("english") or (m.get("title") or {}).get("romaji") or ""
    return "https://www.imdb.com/find/?s=tt&q=" + urllib.parse.quote(ad)


ALAN = """id idMal title{romaji english} coverImage{extraLarge large color} bannerImage averageScore genres episodes chapters
          status siteUrl nextAiringEpisode{episode airingAt} externalLinks{site url type language} format trailer{id site}"""


def anime_verisi():
    try:
        liste = json.load(open(os.path.join(BOT, "anime.json"), encoding="utf-8"))
    except Exception:
        liste = {"anime": [], "manga": []}
    sonuc = {"anime": [], "manga": [], "bugun": [], "sezon": []}
    for tur, anahtar in (("ANIME", "anime"), ("MANGA", "manga")):
        kendi = {a["id"]: a for a in liste.get(anahtar, [])}
        if not kendi:
            continue
        d = anilist(f"query($i:[Int]){{Page(perPage:50){{media(idMal_in:$i,type:{tur}){{{ALAN}}}}}}}", {"i": list(kendi)[:50]})
        for m in d["Page"]["media"]:
            k = kendi.get(m["idMal"], {})
            sonuc[anahtar].append(anime_kart(m, k, tur))
    sonuc["anime"].sort(key=lambda a: (a["sonraki"] or {}).get("airingAt") or 9e12)
    sonuc["manga"].sort(key=lambda a: -(a["ilerleme"] or 0))
    simdi = int(time.time())
    d = anilist(f"query($a:Int,$b:Int){{Page(perPage:40){{airingSchedules(airingAt_greater:$a,airingAt_lesser:$b,sort:TIME_DESC){{episode airingAt media{{{ALAN} popularity isAdult countryOfOrigin}}}}}}}}",
                {"a": simdi - 86400, "b": simdi})
    for s in sorted(d["Page"]["airingSchedules"], key=lambda x: -(x["media"]["popularity"] or 0)):
        m = s["media"]
        if m["isAdult"] or m["countryOfOrigin"] != "JP":
            continue
        sonuc["bugun"].append({**anime_kart(m, {}, "ANIME"), "bolum": s["episode"], "ts": s["airingAt"]})
    sonuc["bugun"] = sonuc["bugun"][:16]
    # bu sezonun en populerleri (fragmanlariyla)
    ay = datetime.now(TR).month
    sezon = ["WINTER", "WINTER", "WINTER", "SPRING", "SPRING", "SPRING", "SUMMER", "SUMMER", "SUMMER", "FALL", "FALL", "FALL"][ay - 1]
    d = anilist(f"query($s:MediaSeason,$y:Int){{Page(perPage:20){{media(season:$s,seasonYear:$y,type:ANIME,sort:POPULARITY_DESC,isAdult:false){{{ALAN}}}}}}}",
                {"s": sezon, "y": datetime.now(TR).year})
    sonuc["sezon"] = [anime_kart(m, {}, "ANIME") for m in d["Page"]["media"]]
    return sonuc


def anime_kart(m, k, tur):
    fr = m.get("trailer") or {}
    return {"id": m["id"], "ad": (m["title"]["english"] or m["title"]["romaji"]), "kapak": m["coverImage"]["extraLarge"] or m["coverImage"]["large"],
            "renk": m["coverImage"]["color"] or "#1d9bf0", "banner": m["bannerImage"], "puan": m["averageScore"],
            "turler": (m["genres"] or [])[:3], "liste": k.get("liste"), "ilerleme": k.get("izlenen", k.get("okunan", 0)),
            "toplam": m.get("episodes") or m.get("chapters") or k.get("toplam") or 0, "mal": k.get("url") or m["siteUrl"],
            "sonraki": m["nextAiringEpisode"], "durum": m["status"],
            "izle": crunchyroll(m) if tur == "ANIME" else None, "izle_yerleri": izle_yerleri(m) if tur == "ANIME" else [],
            "imdb": imdb_ara(m) if tur == "ANIME" else None,
            "fragman": fr.get("id") if fr.get("site") == "youtube" else None,
            "oku": f"https://mangadex.org/search?q={urllib.parse.quote(m['title']['romaji'] or '')}" if tur == "MANGA" else None,
            "anilist": m["siteUrl"]}


# ------------------------------------------------------------------ oyunlar (Steam: puan + oneriler)
def steam_puani(app):
    try:
        q = json.loads(al(f"https://store.steampowered.com/appreviews/{app}?json=1&language=all&purchase_type=all&num_per_page=0", 15))["query_summary"]
        top = q.get("total_reviews") or 0
        return {"yuzde": round(100 * q.get("total_positive", 0) / top) if top else None, "sayi": top}
    except Exception:
        return {"yuzde": None, "sayi": 0}


def oyun_verisi():
    d = json.loads(al("https://store.steampowered.com/api/featuredcategories?cc=tr&l=turkish", 25))
    gruplar = {"cok_satan": "top_sellers", "yeni": "new_releases", "indirim": "specials", "yakinda": "coming_soon"}
    sonuc, hepsi = {}, {}
    for ad, anahtar in gruplar.items():
        sonuc[ad] = []
        for o in (d.get(anahtar) or {}).get("items", [])[:14]:
            if o.get("id") in (None, 0):
                continue
            hepsi[o["id"]] = None
            sonuc[ad].append({"id": o["id"], "ad": o.get("name"), "resim": o.get("large_capsule_image") or o.get("header_image"),
                              "fiyat": (o.get("final_price") or 0) / 100, "para": o.get("currency") or "TRY",
                              "indirim": o.get("discount_percent") or 0, "link": f"https://store.steampowered.com/app/{o['id']}"})
    with ThreadPoolExecutor(8) as h:
        for app, p in zip(hepsi, h.map(steam_puani, hepsi)):
            hepsi[app] = p
    for liste in sonuc.values():
        for o in liste:
            o.update(hepsi.get(o["id"]) or {})
    # oneri: yeni + cok satanlardan en yuksek puanlilar (en az 500 yorum)
    havuz = {o["id"]: o for o in sonuc["yeni"] + sonuc["cok_satan"] + sonuc["indirim"]}
    sonuc["oneri"] = sorted([o for o in havuz.values() if (o.get("yuzde") or 0) >= 85 and (o.get("sayi") or 0) >= 500],
                            key=lambda o: -(o["yuzde"] * 1000 + min(o["sayi"], 999)))[:10]
    return sonuc


# ------------------------------------------------------------------ maclar (hafta sonu)
def gun_adi(d):
    return f"{GUN[d.weekday()]} {d.day} {AY[d.month - 1]}"


def mac_verisi(hafta_sonu=True, gunler=None):
    bugun = datetime.now(TR).date()
    if gunler is not None:
        pass
    elif hafta_sonu:
        cmt = bugun + timedelta(days=(5 - bugun.weekday()) % 7) if bugun.weekday() != 6 else bugun - timedelta(days=1)
        gunler = [d for d in (cmt, cmt + timedelta(days=1)) if d >= bugun]
    else:
        gunler = [bugun + timedelta(days=i) for i in range(0, 3)]
    isler = [(lig, yol, g) for lig, yol in LIGLER for g in gunler]

    def getir(x):
        lig, yol, g = x
        try:
            # ESPN tarihi ABD saatine gore gruplar: bir gun oncesini de alip TR tarihine gore suzecegiz
            return [(lig, e) for gg in (g - timedelta(days=1), g) for e in json.loads(al(
                f"https://site.api.espn.com/apis/site/v2/sports/{yol}/scoreboard?dates={gg:%Y%m%d}", 15)).get("events", [])]
        except Exception:
            return []
    tablo, gorulen = {g: {} for g in gunler}, set()
    with ThreadPoolExecutor(8) as h:
        for sonuc in h.map(getir, isler):
            for lig, e in sonuc:
                if e["id"] in gorulen:
                    continue
                ts = tarih(e.get("date"))
                g = datetime.fromtimestamp(ts, TR).date()
                if g not in tablo:
                    continue
                gorulen.add(e["id"])
                c = e["competitions"][0]
                t = {x["homeAway"]: x for x in c["competitors"]}
                st = e["status"]["type"]
                takim = lambda x: {"ad": x["team"].get("shortDisplayName") or x["team"].get("displayName"),
                                   "logo": x["team"].get("logo"), "skor": x.get("score")}
                tablo[g].setdefault(lig, []).append({
                    "ev": takim(t["home"]), "dep": takim(t["away"]), "ts": ts, "durum": st["state"],
                    "detay": st.get("shortDetail"), "link": next((l["href"] for l in e.get("links", []) if "summary" in l.get("rel", [])), None)})
    hakem = []
    try:
        for m in json.load(open(os.path.join(BOT, "maclar.json"), encoding="utf-8")).get("gelecek", []):
            hakem.append(m)
    except Exception:
        pass
    sira = [l for l, _ in LIGLER]
    return {"gunler": [{"gun": gun_adi(g), "tarih": str(g), "ligler": [{"lig": l, "maclar": sorted(tablo[g][l], key=lambda m: m["ts"])}
                                                                        for l in sira if l in tablo[g]]} for g in gunler],
            "hakem": hakem}


def island_maclar():
    """FLUGEL Island (PC) Maçlar sekmesi: hakemlik görevlerim + bugün/yarın maçları + son 2 günün sonuçları."""
    bugun = datetime.now(TR).date()
    gunler = [bugun - timedelta(days=2), bugun - timedelta(days=1), bugun, bugun + timedelta(days=1)]
    v = mac_verisi(gunler=gunler)
    by = {g["tarih"]: g["ligler"] for g in v["gunler"]}
    alanlar = ("ev", "dep", "ts", "durum", "detay", "link")

    def kucult(ligler, sadece_biten=False):
        sonuc = []
        for lig in ligler:
            ms = [{k: m.get(k) for k in alanlar} for m in lig["maclar"] if not sadece_biten or m["durum"] == "post"]
            if ms:
                sonuc.append({"lig": lig["lig"], "maclar": ms})
        return sonuc
    try:
        bot = json.load(open(os.path.join(BOT, "maclar.json"), encoding="utf-8"))
    except Exception:
        bot = {}
    hepsi = bot.get("maclar", [])
    b, y = str(bugun), str(bugun + timedelta(days=1))
    benim = {"bugun": [m for m in hepsi if m.get("tarih") == b], "yarin": [m for m in hepsi if m.get("tarih") == y],
             "yaklasan": [m for m in bot.get("gelecek", []) if m.get("tarih", "") > y][:5],
             "gecmis": sorted([m for m in hepsi if m.get("tarih", "") < b],
                              key=lambda m: (m.get("tarih", ""), m.get("saat", "")), reverse=True)[:5],
             "guncelleme": bot.get("guncelleme"), "isimler": bot.get("isimler", [])}
    canli = any(m["durum"] == "in" for g in v["gunler"] for lig in g["ligler"] for m in lig["maclar"])
    return {"benim": benim, "bugun": kucult(by.get(b, [])), "yarin": kucult(by.get(y, [])),
            "gecmis": [{"tarih": str(g), "gun": gun_adi(g), "ligler": kucult(by.get(str(g), []), True)} for g in gunler[1::-1]],
            "canli": canli, "zaman": int(time.time())}


def island_maclar_onbellek():
    """Canlı maç varken 2 dk, yokken 15 dk önbellek."""
    z, v = ONBELLEK.get("island_maclar", (0, None))
    if v is None or time.time() - z > (120 if v.get("canli") else 900):
        try:
            v = island_maclar()
            ONBELLEK["island_maclar"] = (time.time(), v)
        except Exception as e:
            print(time.strftime("%T"), "island_maclar HATA", type(e).__name__, e, flush=True)
    return v or {}


# ------------------------------------------------------------------ sunucu durumu + gundemde
def durum_verisi():
    try:
        satir = open(os.path.join(DURUM, ".durum"), encoding="utf-8").read().strip().splitlines()
    except Exception:
        satir = ["BILINMIYOR"]
    bild = []
    try:
        for b in open(os.path.join(DURUM, "bildirimler.log"), encoding="utf-8").read().strip().splitlines()[-5:]:
            p = b.split("|", 2)
            if len(p) == 3:
                bild.append({"zaman": p[0], "seviye": p[1], "metin": re.sub(r"[^\w\s.,:;()%/+-]", "", temiz(p[2]))[:140]})
    except Exception:
        pass
    return {"durum": satir[0], "sorunlar": satir[1:], "bildirimler": bild[::-1]}


DURAK = set("""ve ile için bir bu da de mi mı en çok daha olan oldu olarak gibi sonra yeni nasıl neden ne kadar her ama
the a an of to in for on and with is are at from by new how why what yeni ilk son tüm büyük hakkında açıklama geliyor
oldu ediyor etti yaptı dedi göre karşı üzerinde var yok değil kim işte türkiye türk türkçe pro max plus ultra mini
ocak şubat mart nisan mayıs haziran temmuz ağustos eylül ekim kasım aralık sosyal yapay zeka zekâ resmi resmen son dakika
dünya dünyanın tarihi fiyatı fiyat özellikleri özellik inceleme review season sezon bölüm episode trailer fragman official
anime manga game oyun oyunu oyunun video bugün yarın dün hafta ayrıca belediyesi belediye çıktı açıklandı duyurdu
geldi başladı oldu satışa sunuldu tanıttı iddia ettiler""".split())


def kucuk(s):
    """Turkce kucuk harf: 'İşte' -> 'işte' (Python'un lower()'i noktali i'yi bozar)."""
    return s.replace("İ", "i").replace("I", "ı").lower()


def gundemde():
    with db() as c:
        bas = [r[0] for r in c.execute("SELECT COALESCE(baslik_tr, baslik) FROM oge WHERE ts > ? AND tur != 'youtube'",
                                       (int(time.time()) - 12 * 3600,))]
    say = {}
    for b in bas:
        gor = set()
        kelimeler = b.split()
        govde = " ".join(kelimeler[1:]) if kelimeler and kelimeler[0][:1].isupper() else b   # ilk kelime hep buyuk harfle baslar: say(ma)
        bas_ad = kelimeler[0].strip(":,'\"") if kelimeler else ""
        adaylar = re.findall(r"(?<![\wçğıöşü])[a-z]?[A-ZÇĞİÖŞÜ][\wçğıöşüÇĞİÖŞÜ\-]{1,}(?:\s[A-ZÇĞİÖŞÜ0-9][\wçğıöşüÇĞİÖŞÜ\-]{1,}){0,2}", govde)
        if len(bas_ad) > 2 and bas_ad[:1].isupper() and kucuk(bas_ad) not in DURAK and any(ch.isupper() for ch in bas_ad[1:]) or bas_ad.isupper():
            adaylar.append(bas_ad)          # 'iPhone', 'PS5', 'NVIDIA' gibi markalar ilk kelimede olsa da sayilir
        for k in adaylar:
            k = re.sub(r"['’](\w+)$", "", k.strip(" '’\":,"))   # Apple'in -> Apple
            if len(k) < 3 or kucuk(k) in DURAK or all(kucuk(w) in DURAK or w.isdigit() for w in k.split()) or k in gor or k.isdigit():
                continue
            gor.add(k)
            say[k] = say.get(k, 0) + 1
    return [{"konu": k, "sayi": n} for k, n in sorted(say.items(), key=lambda x: -x[1]) if n >= 2][:10]


# ------------------------------------------------------------------ film & dizi (TVmaze + IMDb puanlari)
IMDB = {"zaman": 0, "puan": {}}


def imdb_puanlari():
    """IMDb'nin herkese acik (kisisel kullanim) puan dosyasini gunde bir indirir; 1000+ oylu yapimlari bellekte tutar."""
    if time.time() - IMDB["zaman"] < 86400 and IMDB["puan"]:
        return IMDB["puan"]
    import gzip
    yol = os.path.join(VERI, "imdb_ratings.tsv.gz")
    if not os.path.exists(yol) or time.time() - os.path.getmtime(yol) > 86400:
        open(yol + ".yeni", "wb").write(al("https://datasets.imdbws.com/title.ratings.tsv.gz", 120))
        os.replace(yol + ".yeni", yol)
    puan = {}
    with gzip.open(yol, "rt", encoding="utf-8") as f:
        next(f)
        for satir in f:
            t, p, o = satir.rstrip("\n").split("\t")
            if int(o) >= 1000:
                puan[t] = (float(p), int(o))
    IMDB.update(zaman=time.time(), puan=puan)
    return puan


def dizi_verisi():
    puan = imdb_puanlari()
    bugun = datetime.now(TR).date()
    goruldu, cikti = set(), []
    for gun in (bugun, bugun + timedelta(days=1), bugun + timedelta(days=2)):
        for yol in (f"schedule/web?date={gun}", f"schedule?country=US&date={gun}", f"schedule?country=GB&date={gun}"):
            try:
                liste = json.loads(al(f"https://api.tvmaze.com/{yol}", 20))
            except Exception:
                continue
            for b in liste:
                s = b.get("_embedded", {}).get("show") or b.get("show") or {}
                tt = (s.get("externals") or {}).get("imdb")
                if not tt or tt not in puan or s["id"] in goruldu:
                    continue
                p, oy = puan[tt]
                if oy < 5000 or p < 6.8:
                    continue
                goruldu.add(s["id"])
                ag = (s.get("webChannel") or s.get("network") or {}).get("name")
                cikti.append({"ad": s["name"], "bolum": f"S{b.get('season') or 0:02d}E{b.get('number') or 0:02d}", "bolum_ad": b.get("name"),
                              "ts": tarih(b.get("airstamp")), "kanal": ag, "imdb_puan": p, "imdb_oy": oy, "imdb": f"https://www.imdb.com/title/{tt}/",
                              "resim": ((s.get("image") or {}).get("medium")), "turler": (s.get("genres") or [])[:3],
                              "ozet": temiz(s.get("summary"), 220)})
    cikti.sort(key=lambda x: (-x["imdb_puan"] * min(x["imdb_oy"], 500000) ** .2))
    return {"diziler": cikti[:40]}


# ------------------------------------------------------------------ fiyatlar (Steam TR, CheapShark, Epic)
def fiyat_verisi():
    magaza = {s["storeID"]: s["storeName"] for s in json.loads(al("https://www.cheapshark.com/api/1.0/stores", 20))}
    firsat = []
    for o in json.loads(al("https://www.cheapshark.com/api/1.0/deals?pageSize=40&sortBy=Deal%20Rating&onSale=1&AAA=1", 25)):
        firsat.append({"ad": o["title"], "magaza": magaza.get(o["storeID"], "?"), "fiyat": float(o["salePrice"]), "eski": float(o["normalPrice"]),
                       "indirim": round(float(o["savings"])), "metacritic": int(o.get("metacriticScore") or 0) or None,
                       "steam_puan": int(o.get("steamRatingPercent") or 0) or None, "resim": o.get("thumb"),
                       "link": f"https://www.cheapshark.com/redirect?dealID={o['dealID']}"})
    tek = {}
    for o in firsat:             # ayni oyun birden fazla magazada: en ucuzunu tut, kac magazada indirimde oldugunu say
        k = kucuk(o["ad"])
        if k not in tek or o["fiyat"] < tek[k]["fiyat"]:
            o["magaza_sayisi"] = tek.get(k, {}).get("magaza_sayisi", 0) + 1
            tek[k] = o
        else:
            tek[k]["magaza_sayisi"] = tek[k].get("magaza_sayisi", 1) + 1
    firsat = list(tek.values())
    epic = []
    try:
        d = json.loads(al("https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=tr&country=TR&allowCountries=TR", 25))
        for e in d["data"]["Catalog"]["searchStore"]["elements"]:
            p = e.get("promotions") or {}
            simdi_bedava = any(o["discountSetting"]["discountPercentage"] == 0 for g in p.get("promotionalOffers") or [] for o in g["promotionalOffers"])
            yakinda = any(o["discountSetting"]["discountPercentage"] == 0 for g in p.get("upcomingPromotionalOffers") or [] for o in g["promotionalOffers"])
            if not (simdi_bedava or yakinda):
                continue
            resim = next((k["url"] for k in e.get("keyImages", []) if k["type"] in ("OfferImageWide", "Thumbnail")), None)
            slug = (e.get("catalogNs", {}).get("mappings") or [{}])[0].get("pageSlug") or e.get("productSlug") or ""
            epic.append({"ad": e["title"], "durum": "Şimdi ücretsiz" if simdi_bedava else "Yakında ücretsiz", "resim": resim,
                         "link": f"https://store.epicgames.com/tr/p/{slug}" if slug else "https://store.epicgames.com/tr/free-games"})
    except Exception:
        pass
    return {"firsatlar": firsat, "epic": epic}


def fiyat_ara(q):
    q = q.strip()[:80]
    steam = json.loads(al(f"https://store.steampowered.com/api/storesearch/?term={urllib.parse.quote(q)}&cc=tr&l=turkish", 15)).get("items", [])
    cs = json.loads(al(f"https://www.cheapshark.com/api/1.0/games?title={urllib.parse.quote(q)}&limit=8", 15))
    return {"steam": [{"ad": s["name"], "resim": s.get("tiny_image"), "fiyat": (s.get("price") or {}).get("final", 0) / 100,
                       "para": (s.get("price") or {}).get("currency", "USD"), "link": f"https://store.steampowered.com/app/{s['id']}"} for s in steam[:8]],
            "en_ucuz": [{"ad": g["external"], "fiyat": float(g["cheapest"]), "resim": g.get("thumb"),
                         "link": f"https://www.cheapshark.com/redirect?dealID={g['cheapestDealID']}"} for g in cs]}


# ------------------------------------------------------------------ uygulamalar (Homepage servis listesi + canli kontrol)
def uygulamalar_verisi():
    gruplar, grup, oge = [], None, None
    try:
        satirlar = open("/homepage/services.yaml", encoding="utf-8").read().splitlines()
    except Exception:
        return {"gruplar": []}
    for s in satirlar:
        if m := re.match(r"^- ([^:#]+):\s*$", s):
            grup = {"ad": m.group(1).strip(), "ogeler": []}
            gruplar.append(grup)
        elif (m := re.match(r"^    - ([^:#]+):\s*$", s)) and grup is not None:
            oge = {"ad": m.group(1).strip()}
            grup["ogeler"].append(oge)
        elif (m := re.match(r"^        (href|icon|description):\s*\"?([^\"]*)\"?\s*$", s)) and oge is not None:
            oge[m.group(1)] = m.group(2).strip()
    gruplar = [g for g in gruplar if g["ad"] not in ("Durum", "Haberler")]

    def kontrol(o):
        h = o.get("href", "")
        u = h.replace("<IP>", "host.docker.internal")
        try:
            istek = urllib.request.Request(u, headers=UA, method="GET")
            import ssl
            with urllib.request.urlopen(istek, timeout=4, context=ssl._create_unverified_context()) as y:
                o["acik"] = y.status < 500
        except urllib.error.HTTPError as e:
            o["acik"] = e.code < 500
        except Exception:
            o["acik"] = False
        i = o.get("icon", "")
        o["ikon"] = (f"https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/{i}" if i.endswith(".png")
                     else f"https://cdn.jsdelivr.net/npm/@mdi/<e-posta>/svg/{i[4:]}.svg" if i.startswith("mdi-") else None)
        return o
    with ThreadPoolExecutor(12) as h:
        for g in gruplar:
            g["ogeler"] = list(h.map(kontrol, g["ogeler"]))
    return {"gruplar": gruplar}


# ------------------------------------------------------------------ akis sorgusu
KATEGORI = {
    "ana": "tur IN ('oyun','teknoloji','anime','youtube','film')",
    "oyun": "tur='oyun'", "teknoloji": "tur='teknoloji'", "gundem": "tur='gundem'", "anime": "tur='anime'",
    "youtube": "tur='youtube'", "kayitli": "kayitli=1", "playstation": "etiket LIKE '%playstation%'",
    "fragman": "tur='youtube' AND etiket LIKE '%fragman%'", "japonya": "etiket LIKE '%japonya%'",
    "film": "(tur='film' OR (tur='youtube' AND alt='film'))", "uyari": "uyari=1",
}


def satir_json(r):
    d = dict(r)
    d["baslik_goster"] = d["baslik_tr"] or d["baslik"]
    d["ozet_goster"] = d["ozet_tr"] or d["ozet"]
    d["cevrildi"] = bool(d["baslik_tr"])
    d["etiketler"] = [e for e in (d.get("etiket") or "").split(",") if e and e not in ("japonya",)]
    if d["resim"] == "yok":
        d["resim"] = None
    return d


def akis(k, once, n, siralama="zaman"):
    kosul = KATEGORI.get(k, KATEGORI["ana"])
    tek = "" if k in ("kayitli",) else " AND kume IS NULL"
    with db() as c:
        if k == "one":          # one cikanlar: AI'nin en onemli buldugu son 36 saatin haberleri
            r = c.execute(f"""SELECT *, (SELECT COUNT(*) FROM oge k WHERE k.kume=oge.id) kume_sayi FROM oge
                              WHERE {KATEGORI['ana']} AND tur!='youtube' AND kume IS NULL AND onem >= 70 AND ts > ?
                              ORDER BY onem DESC, ts DESC LIMIT 40""", (int(time.time()) - 36 * 3600,)).fetchall()
        else:
            r = c.execute(f"""SELECT *, (SELECT COUNT(*) FROM oge k WHERE k.kume=oge.id) kume_sayi FROM oge
                              WHERE {kosul}{tek} AND ts < ? ORDER BY ts DESC LIMIT ?""", (once, n)).fetchall()
    return [satir_json(x) for x in r]


def kume_kaynaklari(oid):
    with db() as c:
        return [dict(x) for x in c.execute("SELECT kaynak, link, COALESCE(baslik_tr, baslik) baslik FROM oge WHERE kume=?", (oid,))]


# ------------------------------------------------------------------ AI (Ollama, akarak)
SISTEM = ("Sen FLUGEL'sin: Gökalp'in kişisel asistanı. Türkçe, samimi ve kısa cevap ver. "
          "İlgi alanları: oyun, teknoloji, anime/manga, basketbol hakemliği.\n"
          "KESİN KURAL: Maçlar, haberler, anime bölümleri gibi güncel bilgileri SADECE aşağıdaki BAĞLAM bölümünden al. "
          "Bağlamda olmayan maç, skor, tarih veya haber UYDURMA; yoksa 'bu bilgi elimde yok' de.")


def ai_baglam(govde):
    simdi = datetime.now(TR)
    ek = [f"BUGÜN: {gun_adi(simdi.date())} {simdi.year}, saat {simdi:%H:%M} (Türkiye)"]
    if govde.get("link"):
        try:
            sayfa = al(govde["link"], 12, 400_000).decode("utf8", "ignore")
            sayfa = re.sub(r"(?is)<(script|style|nav|footer|header)[^>]*>.*?</\1>", " ", sayfa)
            ek.append("HABERİN METNİ (sayfadan):\n" + temiz(sayfa)[:5000])
        except Exception:
            pass
    if govde.get("genel"):
        with db() as c:
            bas = [f"- [{r['tur']}] {r['b']}" for r in c.execute(
                "SELECT tur, COALESCE(baslik_tr, baslik) b FROM oge WHERE ts > ? ORDER BY ts DESC LIMIT 40", (int(time.time()) - 86400,))]
        ek.append("SON 24 SAATİN BAŞLIKLARI:\n" + "\n".join(bas))
        m = onbellek("maclar", 600, lambda: mac_verisi(True))
        if m:
            ek.append("HAFTA SONU MAÇLARI (her satır bir maç: gün · lig · saat · ev sahibi – deplasman):\n" + "\n".join(
                f"- {g['gun']} · {l['lig']} · {datetime.fromtimestamp(x['ts'], TR):%H:%M} · {x['ev']['ad']} – {x['dep']['ad']}"
                + (f" (skor {x['ev']['skor']}-{x['dep']['skor']}, {'canlı' if x['durum'] == 'in' else 'bitti'})" if x["durum"] != "pre" else "")
                for g in m["gunler"] for l in g["ligler"] for x in l["maclar"][:10]))
        a = onbellek("anime", 1800, anime_verisi)
        if a:
            ek.append("TAKİP ETTİĞİ ANİMELERİN SIRADAKİ BÖLÜMLERİ:\n" + "\n".join(
                f"- {x['ad']}: {x['sonraki']['episode']}. bölüm {datetime.fromtimestamp(x['sonraki']['airingAt'], TR):%d.%m %H:%M}"
                for x in a["anime"] if x.get("sonraki"))[:1500])
    return SISTEM + "\n\n=== BAĞLAM ===\n" + "\n\n".join(ek)


# ------------------------------------------------------------------ HTTP
class Sunucu(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _json(self, veri, kod=200):
        b = json.dumps(veri, ensure_ascii=False).encode()
        self.send_response(kod)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b)

    def _dosya(self, yol):
        yol = os.path.normpath(os.path.join(WEB, yol.lstrip("/") or "index.html"))
        if not yol.startswith(WEB) or not os.path.isfile(yol):
            yol = os.path.join(WEB, "index.html")
        tip = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".ttf": "font/ttf", ".svg": "image/svg+xml",
               ".png": "image/png", ".webmanifest": "application/manifest+json", ".apk": "application/vnd.android.package-archive"
               }.get(os.path.splitext(yol)[1], "application/octet-stream")
        b = open(yol, "rb").read()
        self.send_response(200)
        self.send_header("Content-Type", tip + ("; charset=utf-8" if tip.startswith("text") else ""))
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-cache")
        if yol.endswith(".apk"):
            self.send_header("Content-Disposition", 'attachment; filename="FLUGEL.apk"')
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        try:
            if u.path == "/api/akis":
                return self._json(akis(q.get("k", "ana"), int(q.get("once") or 9e12), min(int(q.get("n") or 20), 50)))
            if u.path == "/api/yeni":
                kosul = KATEGORI.get(q.get("k", "ana"), KATEGORI["ana"])
                with db() as c:
                    n = c.execute(f"SELECT COUNT(*) FROM oge WHERE {kosul} AND kume IS NULL AND ts > ?", (int(q.get("sonra") or 0),)).fetchone()[0]
                return self._json({"sayi": n})
            if u.path == "/api/kume":
                return self._json(kume_kaynaklari(q.get("id", "")))
            if u.path == "/api/uyarilar":
                with db() as c:
                    r = c.execute("SELECT * , 0 kume_sayi FROM oge WHERE uyari=1 AND eklendi > ? ORDER BY ts DESC LIMIT 10", (int(q.get("sonra") or 0),)).fetchall()
                return self._json([satir_json(x) for x in r])
            if u.path == "/api/takip":
                with db() as c:
                    return self._json(takip_kelimeleri(c))
            if u.path == "/api/anime":
                return self._json(onbellek("anime", 1800, anime_verisi) or {})
            if u.path == "/api/oyunlar":
                return self._json(onbellek("oyunlar", 3600, oyun_verisi) or {})
            if u.path == "/api/fiyatlar":
                return self._json(onbellek("fiyatlar", 3600, fiyat_verisi) or {})
            if u.path == "/api/fiyat":
                return self._json(fiyat_ara(q.get("ara", "")))
            if u.path == "/api/dizi":
                return self._json(onbellek("dizi", 3 * 3600, dizi_verisi) or {})
            if u.path == "/api/uygulamalar":
                return self._json(onbellek("uygulamalar", 60, uygulamalar_verisi) or {})
            if u.path == "/api/maclar":
                if q.get("island") == "1":          # FLUGEL Island: benim maçlarım + bugün/yarın/geçmiş
                    return self._json(island_maclar_onbellek())
                hs = q.get("hafta_sonu", "1") == "1"
                return self._json(onbellek("maclar" if hs else "maclar3", 600, lambda: mac_verisi(hs)) or {})
            if u.path == "/api/durum":
                return self._json(durum_verisi())
            if u.path == "/api/gundemde":
                return self._json(onbellek("gundemde", 300, gundemde) or [])
            if u.path == "/api/kaynaklar":
                with db() as c:
                    gec = {r["kaynak"]: (r["med"], r["n"]) for r in c.execute(
                        """SELECT kaynak, AVG(eklendi - ts) med, COUNT(*) n FROM oge WHERE ts > ? AND eklendi - ts BETWEEN 0 AND 7200
                           AND eklendi > (SELECT MIN(eklendi) FROM oge) + 600 GROUP BY kaynak""", (int(time.time()) - 86400,))}
                l = []
                for ad, d in KAYNAK_DURUM.items():
                    g = gec.get(ad.replace(" ▶", ""))
                    l.append({"ad": ad, **d, "gecikme_dk": round(g[0] / 60, 1) if g else None, "olcum": g[1] if g else 0})
                return self._json(sorted(l, key=lambda x: (x.get("hata") is None, -(x.get("son_yeni") or 0))))
            if u.path == "/api/island":          # FLUGEL Island (PC ust cubuk) icin tek, hafif durum paketi
                try:
                    d = json.load(open(os.path.join(DURUM, "island.json"), encoding="utf-8"))
                except (OSError, ValueError):
                    d = {"durum": "?", "hata": "island.json okunamadi"}
                d["eski"] = time.time() - d.get("zaman", 0) > 90
                with db() as c:
                    d["takip"] = [{"baslik": r["b"], "link": r["link"], "kaynak": r["kaynak"], "ts": r["eklendi"]} for r in c.execute(
                        "SELECT COALESCE(baslik_tr, baslik) b, link, kaynak, eklendi FROM oge WHERE uyari=1 AND eklendi > ? ORDER BY eklendi DESC LIMIT 3",
                        (int(time.time()) - 1800,))]
                return self._json(d)
            if u.path == "/api/istatistik":
                with db() as c:
                    return self._json({"toplam": c.execute("SELECT COUNT(*) FROM oge").fetchone()[0],
                                       "cevrilen": c.execute("SELECT COUNT(*) FROM oge WHERE baslik_tr IS NOT NULL").fetchone()[0],
                                       "puanlanan": c.execute("SELECT COUNT(*) FROM oge WHERE onem IS NOT NULL").fetchone()[0],
                                       "kaynak": len(KAYNAKLAR) + len(YOUTUBE)})
            if u.path.startswith("/homepage/"):      # Homepage widget'lari icin (Turkce cevrilmis)
                k = u.path.split("/")[-1].replace(".json", "")
                simdi = time.time()
                return self._json({"ogeler": [{"baslik": x["baslik_goster"], "link": x["link"],
                                               "etiket": f"{x['kaynak']} · {int((simdi - x['ts']) // 60)} dk" if simdi - x["ts"] < 3600
                                               else f"{x['kaynak']} · {int((simdi - x['ts']) // 3600)} sa"} for x in akis(k, 9e12, 10)]})
            return self._dosya(u.path)
        except Exception as e:
            return self._json({"hata": str(e)}, 500)

    def do_DELETE(self):
        u = urllib.parse.urlparse(self.path)
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        if u.path == "/api/takip":
            with YAZ, db() as c:
                c.execute("DELETE FROM takip WHERE kelime=?", (q.get("kelime", ""),))
            return self._json({"tamam": True})
        return self._json({"hata": "bilinmeyen"}, 404)

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        govde = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        if u.path in ("/api/kaydet", "/api/okundu"):
            alan = "kayitli" if u.path.endswith("kaydet") else "okundu"
            with YAZ, db() as c:
                c.execute(f"UPDATE oge SET {alan}=? WHERE id=?", (1 if govde.get("deger", True) else 0, govde.get("id")))
            return self._json({"tamam": True})
        if u.path == "/api/takip":
            k = temiz(govde.get("kelime"))[:40]
            if len(k) >= 2:
                with YAZ, db() as c:
                    c.execute("INSERT OR IGNORE INTO takip VALUES(?)", (k,))
            return self._json({"tamam": True})
        if u.path == "/api/ai":
            mesajlar = [{"role": "system", "content": ai_baglam(govde)}] + govde.get("mesajlar", [])[-12:]
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()

            def parca(s):
                b = s.encode()
                self.wfile.write(f"{len(b):x}\r\n".encode() + b + b"\r\n")
                self.wfile.flush()
            try:
                istek = urllib.request.Request(f"{OLLAMA}/api/chat", headers={"Content-Type": "application/json"},
                                               data=json.dumps({"model": SOHBET_MODEL, "messages": mesajlar, "stream": True,
                                                                "keep_alive": "10m", "options": {"temperature": 0.3}}).encode())
                with urllib.request.urlopen(istek, timeout=300) as y:
                    for satir in y:
                        j = json.loads(satir or b"{}")
                        if j.get("message", {}).get("content"):
                            parca(j["message"]["content"])
            except urllib.error.URLError:
                parca("! Yapay zekâya ulaşılamadı. GPU'lu Windows sanal makinesi açıkken Ollama durur; kapatınca geri gelir.")
            except Exception as e:
                parca(f"! Hata: {e}")
            self.wfile.write(b"0\r\n\r\n")
            return
        return self._json({"hata": "bilinmeyen"}, 404)


def isinma():
    """Acilista onbellekleri doldur, sonra periyodik yenile."""
    while True:
        for ad, sure, f in (("anime", 1800, anime_verisi), ("oyunlar", 3600, oyun_verisi), ("maclar", 600, lambda: mac_verisi(True)),
                            ("fiyatlar", 3600, fiyat_verisi), ("dizi", 3 * 3600, dizi_verisi)):
            onbellek(ad, sure, f)
        time.sleep(300)


if __name__ == "__main__":
    os.makedirs(VERI, exist_ok=True)
    db_kur()
    for f in (toplayici, resim_avcisi, cevirmen, degerlendirici, isinma):
        threading.Thread(target=f, daemon=True).start()
    print("FLUGEL Akis :8091", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 8091), Sunucu).serve_forever()
