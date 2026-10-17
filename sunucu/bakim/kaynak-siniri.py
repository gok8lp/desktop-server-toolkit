#!/usr/bin/env python3
"""kaynak-siniri.py — compose dosyalarına mem_limit ve healthcheck ekler (sistem-bakim v2).
Sadece bu bilgilerin olmadığı servislere ekler; dosyayı satır satır düzenler (yorumlar korunur).
Kullanım: kaynak-siniri.py [--uygula]   (varsayılan: sadece ne yapacağını yazar)"""
import json, subprocess, sys

SINIR = {"stirling-pdf": "1536m", "flaresolverr": "1536m", "komga": "1536m", "bazarr": "1g", "kamiyomu": "1g",
         "netdata": "768m", "radarr": "768m", "kavita": "768m", "tranga-api": "768m", "sonarr": "768m",
         "prowlarr": "512m", "libreoffice": "1536m", "jackett": "512m", "nextcloud": "1536m", "code-server": "1536m",
         "transmission": "768m", "convertx": "2g", "immich_server": "3g", "immich_postgres": "1536m",
         "immich_redis": "256m", "tranga-website": "256m", "it-tools": "256m", "openbooks": "256m", "gluetun": "256m"}
SAGLIK = {
    "jellyfin": '["CMD", "curl", "-fsS", "-m", "8", "http://localhost:8096/health"]',
    "nextcloud": '["CMD", "curl", "-fsSk", "-m", "8", "https://localhost/status.php"]',
    "plex": '["CMD", "curl", "-fsS", "-m", "8", "http://localhost:32400/identity"]',
    "ollama": '["CMD", "ollama", "list"]',
    "flugel-akis": '["CMD", "wget", "-qO-", "-T", "8", "http://127.0.0.1:8091/api/istatistik"]',
}
uygula = "--uygula" in sys.argv


def etiket(c, k):
    return subprocess.run(["docker", "inspect", "-f", "{{index .Config.Labels \"%s\"}}" % k, c],
                          capture_output=True, text=True).stdout.strip()


degisen = {}
for c in sorted(set(SINIR) | set(SAGLIK)):
    dizin, servis = etiket(c, "com.docker.compose.project.working_dir"), etiket(c, "com.docker.compose.service")
    dosyalar = etiket(c, "com.docker.compose.project.config_files").split(",")
    if not dizin.startswith(("/opt/stacks", "/arrapps/compose")) or not servis or not dosyalar[0]:
        print(f"ATLA {c}: compose dışı ({dizin})")
        continue
    yol = dosyalar[0]
    satirlar = degisen.get(yol) or open(yol, encoding="utf-8").read().split("\n")
    # servis bloğunu bul
    bas = next((i for i, s in enumerate(satirlar) if s.rstrip() == f"  {servis}:"), None)
    if bas is None:
        print(f"ATLA {c}: '{servis}:' satırı bulunamadı ({yol})")
        continue
    son = next((i for i in range(bas + 1, len(satirlar)) if satirlar[i][:3].strip() and not satirlar[i].startswith("   ")
                and satirlar[i].strip() and not satirlar[i].lstrip().startswith("#")), len(satirlar))
    blok = satirlar[bas:son]
    ekle = []
    if c in SINIR and not any(s.strip().startswith(("mem_limit:", "memory:")) for s in blok):
        ekle.append(f"    mem_limit: {SINIR[c]}   # sistem-bakim v2: makul bellek sınırı")
    if c in SAGLIK and not any(s.strip().startswith("healthcheck:") for s in blok):
        ekle += ["    healthcheck:   # sistem-bakim v2", f"      test: {SAGLIK[c]}",
                 "      interval: 60s", "      timeout: 10s", "      retries: 3", "      start_period: 120s"]
    if not ekle:
        print(f"TAMAM {c}: zaten var")
        continue
    imaj = next((i for i in range(bas, son) if satirlar[i].strip().startswith("image:")), bas)
    satirlar[imaj + 1:imaj + 1] = ekle
    degisen[yol] = satirlar
    print(f"EKLE {c} ({servis} @ {yol}): " + "; ".join(e.strip() for e in ekle if not e.strip().startswith(("interval", "timeout", "retries", "start_period"))))

for yol, satirlar in degisen.items():
    yeni = "\n".join(satirlar)
    if uygula:
        gecici = yol + ".v2yeni"
        open(gecici, "w", encoding="utf-8").write(yeni)
        r = subprocess.run(["docker", "compose", "-f", gecici, "config", "-q"], capture_output=True, text=True,
                           cwd=yol.rsplit("/", 1)[0])
        if r.returncode:
            print(f"HATA {yol}: {r.stderr.strip()[:200]} — dokunulmadı")
            subprocess.run(["rm", "-f", gecici])
            continue
        subprocess.run(["mv", gecici, yol])
        print(f"YAZILDI {yol}")
