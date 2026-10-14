#!/usr/bin/env python3
"""island-veri.py — FLUGEL Island icin hafif sunucu durumu (sistem-bakim, v2).

systemd zamanlayicisi 20 sn'de bir calistirir; sonucu ~/sistem-bakim/durum/island.json'a atomik yazar.
FLUGEL Akis bu dosyayi /api/island olarak sunar (sadece ev agi + tailnet). PC her sorguda SSH acmaz.
"""
import json
import os
import subprocess
import time

CIKTI = "/home/flugel/sistem-bakim/durum/island.json"
DURUM = "/home/flugel/sistem-bakim/durum"


def sh(komut, zaman=6):
    try:
        return subprocess.run(komut, shell=True, capture_output=True, text=True, timeout=zaman).stdout.strip()
    except Exception:
        return ""


def oku(yol, varsayilan=""):
    # bozuk bayt (yarım yazılmış log satırı) tüm paketi düşürmesin
    try:
        with open(yol, encoding="utf-8", errors="replace") as f:
            return f.read().strip()
    except OSError:
        return varsayilan


def jsonoku(yol):
    try:
        with open(yol, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def cpu_yuzde():
    a = [int(x) for x in oku("/proc/stat").split("\n")[0].split()[1:]]
    time.sleep(0.4)
    b = [int(x) for x in oku("/proc/stat").split("\n")[0].split()[1:]]
    top, bos = sum(b) - sum(a), (b[3] + b[4]) - (a[3] + a[4])
    return round(100 * (top - bos) / max(top, 1))


VM_ONBELLEK = "/home/flugel/sistem-bakim/durum/.vm-sabit.json"


def vm_ayrinti(ad, acik):
    """vCPU, RAM, GPU aktarımı (10 dk önbellekli) + açıksa IP ve ne kadar süredir açık olduğu."""
    onb = jsonoku(VM_ONBELLEK)
    k = onb.get(ad)
    if not k or time.time() - k.get("t", 0) > 600:
        bilgi = sh(f"virsh -c qemu:///system dominfo {ad}")
        cpu = next((x.split()[-1] for x in bilgi.split("\n") if x.startswith("CPU(s)")), "?")
        ram = next((x.split()[-2] for x in bilgi.split("\n") if x.startswith("Max memory")), "0")
        gpu = sh(f"virsh -c qemu:///system dumpxml {ad} | grep -c '<hostdev'") not in ("", "0")
        k = {"t": int(time.time()), "vcpu": cpu, "ram_gb": round(int(ram or 0) / 1048576, 1), "gpu_aktarim": gpu}
        onb[ad] = k
        try:
            with open(VM_ONBELLEK + ".yeni", "w", encoding="utf-8") as f:
                json.dump(onb, f)
            os.replace(VM_ONBELLEK + ".yeni", VM_ONBELLEK)
        except OSError:
            pass
    d = {"vcpu": k["vcpu"], "ram_gb": k["ram_gb"], "gpu_aktarim": k["gpu_aktarim"]}
    if acik:
        ip = sh(f"virsh -c qemu:///system domifaddr {ad} --source lease 2>/dev/null | awk '/ipv4/{{print $4; exit}}'")
        d["ip"] = ip.split("/")[0] if ip else ""
        pid = oku(f"/run/libvirt/qemu/{ad}.pid")
        sure = sh(f"ps -o etimes= -p {pid}") if pid.isdigit() else ""
        d["acik_sn"] = int(sure) if sure.strip().isdigit() else None
    return d


def main():
    m = {s.split(":")[0]: int(s.split()[1]) for s in oku("/proc/meminfo").split("\n") if s}
    dur = oku(f"{DURUM}/.durum", "?").split("\n")
    disk = {}
    for mp in ("/", "/mnt/side", "/mnt/sidemain"):
        try:
            s = os.statvfs(mp)
            disk[mp] = round(100 * (1 - s.f_bavail / s.f_blocks))
        except OSError:
            disk[mp] = None
    g = sh("nvidia-smi --query-gpu=temperature.gpu,power.draw,utilization.gpu,memory.used --format=csv,noheader,nounits", 4).split(", ")
    gpu_vmde = "vfio" in os.path.realpath("/sys/bus/pci/devices/0000:29:00.0/driver")
    kont = [s.split("|") for s in sh("docker ps -a --format '{{.Names}}|{{.State}}|{{.Status}}'").split("\n") if s]
    vm = []
    for s in sh("virsh -c qemu:///system list --all | tail -n +3").split("\n"):
        p = s.split()
        if len(p) >= 3:
            vm.append({"ad": p[1], "durum": " ".join(p[2:]), **vm_ayrinti(p[1], " ".join(p[2:]) == "running")})
    # son 30 dakikadaki UYARI/HATA bildirimleri (Island'da "kritik uyari" canli etkinligi)
    uyarilar, simdi = [], time.time()
    for satir in oku(f"{DURUM}/bildirimler.log").split("\n")[-40:]:
        p = satir.split("|", 2)
        if len(p) == 3 and p[1] in ("UYARI", "HATA", "KRITIK"):
            try:
                ts = time.mktime(time.strptime(p[0], "%Y-%m-%d %H:%M:%S"))
            except ValueError:
                continue
            if simdi - ts < 1800:
                uyarilar.append({"ts": int(ts), "seviye": p[1], "metin": p[2][:160]})
    # son 24 saatin bütün bildirimleri (Island "Bildirimler" sekmesi; en yeni önce, en fazla 80)
    bildirimler = []
    for satir in reversed(oku(f"{DURUM}/bildirimler.log").split("\n")[-400:]):
        p = satir.split("|", 2)
        if len(p) != 3:
            continue
        try:
            ts = time.mktime(time.strptime(p[0], "%Y-%m-%d %H:%M:%S"))
        except ValueError:
            continue
        if simdi - ts > 86400:
            break
        bildirimler.append({"ts": int(ts), "seviye": p[1], "metin": p[2].strip()[:1200]})
        if len(bildirimler) >= 80:
            break
    basket = jsonoku("/var/lib/basket-bot/maclar.json")
    anime = jsonoku("/var/lib/basket-bot/anime.json")
    bolumler = sorted(({"ad": a.get("ad"), "bolum": a.get("sonraki_bolum"), "yayin": a.get("yayin")}
                       for a in anime.get("anime", []) if a.get("yayin")), key=lambda a: a["yayin"])[:8]
    veri = {
        "zaman": int(simdi),
        "durum": dur[0] or "?", "sorunlar": [x for x in dur[1:6] if x],
        "cpu": cpu_yuzde(),
        "temp": sh("sensors 2>/dev/null | awk '/Tctl|Tdie/{gsub(/[+°C]/,\"\",$2); print int($2); exit}'"),
        "ram_kul": round((m["MemTotal"] - m["MemAvailable"]) / 1048576, 1), "ram_top": round(m["MemTotal"] / 1048576),
        "swap": round((m["SwapTotal"] - m["SwapFree"]) / 1048576, 1),
        "yuk": oku("/proc/loadavg").split()[0], "uptime": sh("uptime -p").replace("up ", ""),
        "disk": disk,
        "gpu_vmde": gpu_vmde,
        "gpu_temp": g[0] if not gpu_vmde and g and g[0] else "", "gpu_w": g[1] if not gpu_vmde and len(g) > 1 else "",
        "gpu_kul": g[2] if not gpu_vmde and len(g) > 2 else "",
        "konteyner": f"{sum(1 for k in kont if k[1] == 'running')}/{len(kont)}",
        "sagliksiz": [k[0] for k in kont if "unhealthy" in k[2]],
        "vpn": sh("docker inspect -f '{{.State.Health.Status}}' gluetun"),
        "ollama": any(k[0] == "ollama" and k[1] == "running" for k in kont),
        "yedek": oku("/var/lib/sistem-bakim/son-kritik-yedek", "-"),
        "vm": vm, "vm_acik": sum(1 for v in vm if v["durum"] == "running"),
        "uyarilar": uyarilar,
        "bildirimler": bildirimler,
        "basket": {"gelecek": basket.get("gelecek", []), "guncelleme": basket.get("guncelleme")},
        "anime": bolumler,
    }
    gecici = CIKTI + ".yeni"
    with open(gecici, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False)
    os.chmod(gecici, 0o644)
    os.replace(gecici, CIKTI)


if __name__ == "__main__":
    main()
