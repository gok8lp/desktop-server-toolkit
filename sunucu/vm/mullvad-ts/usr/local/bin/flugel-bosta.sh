#!/bin/bash
# FLUGEL: masaüstü 15 dk boşta kalınca Eclipse'te her şeyi kaydet, Eclipse'i kapat, oturumu kapat.
# Boşta: X ekranında 15 dk fare/klavye yok (bağlantı kesilmiş oturum da sayılır). Dakikada bir (flugel-bosta.timer).
ESIK_MS=$((15 * 60 * 1000))
KULLANICI=hello
for soket in /tmp/.X11-unix/X*; do
  [ -e "$soket" ] || continue
  d=":${soket##*/X}"
  [ "$(stat -c %U "$soket")" = "$KULLANICI" ] || continue
  calistir() { sudo -u "$KULLANICI" env DISPLAY="$d" XAUTHORITY="/home/$KULLANICI/.Xauthority" "$@"; }
  bos=$(calistir xprintidle 2>/dev/null) || continue
  [ "$bos" -ge "$ESIK_MS" ] || continue
  logger -t flugel-bosta "$d ${bos}ms boşta: kaydedip kapatılıyor"
  for w in $(calistir xdotool search --class Eclipse 2>/dev/null); do
    calistir xdotool windowactivate --sync "$w" key --clearmodifiers ctrl+shift+s 2>/dev/null
  done
  sleep 4
  calistir wmctrl -c Eclipse 2>/dev/null
  # "Çıkışı onayla" penceresi çıkarsa onayla (kayıt zaten yapıldı)
  sleep 2
  for w in $(calistir xdotool search --name "Confirm Exit" 2>/dev/null); do
    calistir xdotool windowactivate --sync "$w" key Return 2>/dev/null
  done
  for i in $(seq 1 20); do pgrep -u "$KULLANICI" -f org.eclipse.equinox.launcher >/dev/null || break; sleep 2; done
  if pgrep -u "$KULLANICI" -f org.eclipse.equinox.launcher >/dev/null; then
    logger -t flugel-bosta "Eclipse kapanmadı (kaydedilmemiş iş olabilir): oturum açık bırakıldı"
    continue
  fi
  calistir gnome-session-quit --logout --no-prompt 2>/dev/null || calistir xfce4-session-logout --logout --fast 2>/dev/null || pkill -u "$KULLANICI" -TERM -f "gnome-session|xfce4-session"
done
