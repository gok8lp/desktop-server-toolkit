#!/bin/bash
. /usr/local/lib/sistem-bakim/whatsapp-kapat.sh  # sistem-bakim
PHONE="<TELEFON>"
APIKEY="<CALLMEBOT_APIKEY>"
GOTIFY="http://<IP>:8482/message?token=<GOTIFY_TOKEN>"
STATE="/var/lib/self-heal"; mkdir -p "$STATE"
# GPU sanal makinedeyken (W11-GPU, kart vfio-pci'de) bu konteynerler bilerek durdurulur — sorun sayma (sistem-bakim)
GPU_KONTEYNERLER="ollama jellyfin plex immich_machine_learning subgen"
gpu_vmde(){ readlink /sys/bus/pci/devices/0000:29:00.0/driver 2>/dev/null | grep -q vfio; }
gpu_beklenen(){ gpu_vmde && [[ " $GPU_KONTEYNERLER " == *" $1 "* ]]; }

notify() {  # notify <anahtar> <mesaj>  — ayni anahtar icin saatte 1 mesaj
  local key="$1" msg="$2" now last
  now=$(date +%s); last=$(cat "$STATE/n-$key" 2>/dev/null || echo 0)
  [ $((now - last)) -lt 3600 ] && return
  echo "$now" > "$STATE/n-$key"
  curl -s -m 10 "$GOTIFY" -F "title=🔧 Self-heal" -F "message=$msg" -F "priority=7" >/dev/null
  curl -s -m 10 -G "https://api.callmebot.com/whatsapp.php" \
    --data-urlencode "phone=$PHONE" --data-urlencode "text=🔧 Self-heal: $msg" \
    --data-urlencode "apikey=$APIKEY" >/dev/null
}

# ── 1. Kritik systemd servisleri: dustuyse kaldir ──
for s in docker cloudflared fail2ban crowdsec tailscaled apache2 smbd disk-keepalive earlyoom; do
  if ! systemctl is-active --quiet "$s"; then
    systemctl restart "$s"
    sleep 3
    if systemctl is-active --quiet "$s"; then
      notify "svc-$s" "$s dusmustu, yeniden baslatildi ✅"
    else
      notify "svc-$s-fail" "$s dustu ve RESTART BASARISIZ ❌ Elle bak: journalctl -u $s"
    fi
  fi
done

# ── 2. Exited containerlar (exit != 0): yeniden baslat ──
while IFS= read -r c; do
  [ -z "$c" ] && continue
  gpu_beklenen "$c" && continue
  code=$(docker inspect --format '{{.State.ExitCode}}' "$c" 2>/dev/null)
  [ "$code" = "0" ] && continue
  docker start "$c" >/dev/null 2>&1
  sleep 5
  if [ "$(docker inspect --format '{{.State.Running}}' "$c" 2>/dev/null)" = "true" ]; then
    notify "ct-$c" "Container $c cokmustu (exit $code), yeniden baslatildi ✅"
  else
    notify "ct-$c-fail" "Container $c cokmus (exit $code) ve baslatilamiyor ❌"
  fi
done < <(docker ps -a --filter status=exited --format '{{.Names}}')

# ── 3. Unhealthy containerlar: restart ──
# (sistem-bakim) anlik dalgalanmaya karisma: 10 dk boyunca unhealthy kalirsa yeniden baslat (gluetun kendi VPN'ini zaten yeniler)
for f in "$STATE"/uh-ilk-*; do
  [ -e "$f" ] || continue
  c=${f##*/uh-ilk-}
  docker ps --filter health=unhealthy --format '{{.Names}}' | grep -qx "$c" || rm -f "$f"
done
while IFS= read -r c; do
  [ -z "$c" ] && continue
  [ -f "$STATE/uh-ilk-$c" ] || date +%s > "$STATE/uh-ilk-$c"
  [ $(( $(date +%s) - $(cat "$STATE/uh-ilk-$c") )) -lt 600 ] && continue
  docker restart "$c" >/dev/null 2>&1
  rm -f "$STATE/uh-ilk-$c"
  notify "uh-$c" "Container $c 10 dakikadir unhealthy idi, restart edildi"
done < <(docker ps --filter health=unhealthy --format '{{.Names}}')

# ── 4. Disk doluluk: %90 ustu otomatik temizlik ──
while read -r line; do
  pct=$(echo "$line" | awk '{print $5}' | tr -d '%')
  mnt=$(echo "$line" | awk '{print $6}')
  if [ "$pct" -ge 90 ]; then
    if [ "$mnt" = "/" ]; then
      docker image prune -af >/dev/null 2>&1
      docker builder prune -af >/dev/null 2>&1
      journalctl --vacuum-size=300M >/dev/null 2>&1
      apt-get clean >/dev/null 2>&1
      newpct=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
      notify "disk-root" "/ %$pct doluydu, temizlik yapildi → %$newpct"
    else
      notify "disk-$mnt" "DIKKAT: $mnt %$pct dolu — otomatik temizlenemez, medya sil"
    fi
  fi
done < <(df -h | grep '^/dev/')

# ── 5. Internet kontrolu ──
if ! ping -c1 -W3 1.1.1.1 >/dev/null 2>&1 && ! ping -c1 -W3 8.8.8.8 >/dev/null 2>&1; then
  act_last=$(cat "$STATE/a-net" 2>/dev/null || echo 0)
  if [ $(( $(date +%s) - act_last )) -gt 1800 ]; then
    date +%s > "$STATE/a-net"
    systemctl restart NetworkManager
    sleep 20
    ping -c1 -W3 1.1.1.1 >/dev/null 2>&1 && notify "net" "Internet kopmustu, NetworkManager restart ile duzeldi ✅"
  fi
fi

# ── 6. Cloudflare tunel sagligi (metrics endpoint) ──
CONN=$(curl -s -m 5 http://127.0.0.1:20241/metrics 2>/dev/null | awk '/^cloudflared_tunnel_ha_connections/ {print int($2)}')
if [ -n "$CONN" ] && [ "$CONN" -eq 0 ]; then
  systemctl restart cloudflared
  notify "cf-tunnel" "Cloudflare tuneli 0 baglantida kalmisti, restart edildi"
fi
