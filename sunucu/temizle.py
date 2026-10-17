#!/usr/bin/env python3
"""Depoya giden sunucu dosyalarından gizli ve kişisel bilgileri çıkarır (yerinde değiştirir).
Kullanım: temizle.py KLASOR [gizli.txt]
- Şifre/token/anahtar benzeri değişkenlerin değerleri ${DEGISKEN} yer tutucusu olur (.env.ornek'te listelenir).
- Adresteki kullanıcı:şifre, IPv4/IPv6 adresleri, tailnet adı ve e-postalar yer tutucuyla değişir.
- Alan adı gibi kişisel değerler depo dışındaki gizli.txt ile değiştirilir (uzun olan önce).
- gizli.txt (değer<TAB>yer tutucu) satırları ayrıca uygulanır.
"""
import os, re, sys, ipaddress

KOK = sys.argv[1]
GIZLI = sys.argv[2] if len(sys.argv) > 2 else None
SIR = r"[A-Z0-9_]*(?:PASS|PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|APIKEY|PRIVATE|JWT|SALT|CREDENTIAL|AUTH_KEY|ACCESS_KEY|CLIENT_ID|CHAT_ID)[A-Z0-9_]*"
KORU_IP = {"127.0.0.1", "0.0.0.0", "1.1.1.1", "9.9.9.9", "8.8.8.8", "8.8.4.4", "255.255.255.0", "255.255.255.255"}
anahtarlar = {}

def ip_degis(m):
    s = m.group(0)
    try:
        ip = ipaddress.ip_address(s)
    except ValueError:
        return s
    if s in KORU_IP or (ip.version == 4 and ip.is_private and str(ip).startswith(("172.17.", "172.18.", "172.19.", "172.2", "10.0.2."))):
        return s
    return "<IP>"

def satir_sir(m):
    anahtar, ayrac, tirnak, deger = m.group(1), m.group(2), m.group(3) or "", m.group(4)
    if deger.startswith(("${", "$(")) or deger.strip() in ("", "''", '""', "true", "false") or deger.startswith("<"):
        return m.group(0)
    anahtarlar.setdefault(anahtar, set()).add(os.path.relpath(yol, KOK))
    return f"{anahtar}{ayrac}{tirnak}${{{anahtar}}}{tirnak}"

gizli = []
if GIZLI and os.path.exists(GIZLI):
    for s in open(GIZLI, encoding="utf-8"):
        s = s.rstrip("\n")
        if "\t" in s:
            d, y = s.split("\t", 1)
            if d:
                gizli.append((d, y))
    gizli.sort(key=lambda x: -len(x[0]))

for k, _, dosyalar in os.walk(KOK):
    if "/.git" in k:
        continue
    for ad in dosyalar:
        if ad in ("temizle.py", "topla.sh"):
            continue
        yol = os.path.join(k, ad)
        try:
            s = open(yol, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        o = s
        for d, y in gizli:
            s = s.replace(d, y)
        # KEY: deger / KEY=deger / - KEY=deger (YAML, shell, ini)
        s = re.sub(rf"\b({SIR})(\s*[:=]\s*)([\"']?)([^\"'\s#]+)\3?", satir_sir, s)
        s = re.sub(r"(\w+://)[^/\s:@]+:[^/\s@]+@", r"\1<kullanici>:<gizli>@", s)
        s = re.sub(r"\b\d{8,10}:[A-Za-z0-9_-]{30,}\b", "<TELEGRAM_TOKEN>", s)
        s = re.sub(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", ip_degis, s)
        s = re.sub(r"\b(?:[0-9a-f]{1,4}:){4,7}[0-9a-f]{1,4}\b", "<IPv6>", s, flags=re.I)
        s = re.sub(r"tail[0-9a-f]{6}\.ts\.net", "<tailnet>.ts.net", s)
        s = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", lambda m: m.group(0) if m.group(0).endswith(("example.com", "anthropic.com", "users.noreply.github.com")) else "<e-posta>", s)
        if s != o:
            open(yol, "w", encoding="utf-8").write(s)

with open(os.path.join(KOK, ".env.ornek"), "w", encoding="utf-8") as f:
    f.write("# Depodan çıkarılan gizli değerler (gerçekleri sunucuda, ilgili yığının .env dosyasında).\n")
    for a in sorted(anahtarlar):
        f.write(f"{a}=   # {', '.join(sorted(anahtarlar[a]))}\n")
print(f"temizlendi; gizlenen değişken: {len(anahtarlar)}")
