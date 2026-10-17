#!/bin/bash
# FLUGEL: hello için tek masaüstü oturumu. Biri açılınca (lightdm ekranı ya da xrdp/web) diğer türdeki oturum
# önce kaydedilir (Eclipse: Ctrl+Shift+S, sonra düzgün kapat) ve sonlandırılır. PAM pam_exec ile root olarak çalışır.
[ "${PAM_TYPE:-}" = "open_session" ] || exit 0
[ "${PAM_USER:-}" = "hello" ] || exit 0
case "${PAM_SERVICE:-}" in
  lightdm|lightdm-autologin) YENI=lightdm ;;
  xrdp-sesman) YENI=xrdp ;;
  *) exit 0 ;;
esac
exec >>/var/log/flugel-tek-oturum.log 2>&1
echo "== $(date '+%F %T') yeni oturum: $YENI"
for s in $(loginctl list-sessions --no-legend | awk '$3=="hello" {print $1}'); do
  srv=$(loginctl show-session "$s" -p Service --value)
  case "$srv" in lightdm|lightdm-autologin) tur=lightdm ;; xrdp-sesman) tur=xrdp ;; *) continue ;; esac
  [ "$tur" = "$YENI" ] && continue
  [ "$(loginctl show-session "$s" -p State --value)" = "closing" ] && continue
  # oturumun X ekranını bul (oturumdaki bir sürecin ortamından)
  d=""
  for p in $(cat /sys/fs/cgroup/user.slice/user-1000.slice/session-$s.scope/cgroup.procs 2>/dev/null); do
    d=$(tr '\0' '\n' < /proc/$p/environ 2>/dev/null | sed -n 's/^DISPLAY=//p' | head -1); [ -n "$d" ] && break
  done
  echo "kapatılacak: oturum $s ($tur) ekran ${d:-yok}"
  if [ -n "$d" ]; then
    c() { timeout 5 sudo -u hello env DISPLAY="$d" XAUTHORITY=/home/hello/.Xauthority "$@"; }
    for w in $(c xdotool search --class Eclipse 2>/dev/null); do c xdotool windowactivate --sync "$w" key --clearmodifiers ctrl+shift+s; done
    sleep 3
    c wmctrl -c Eclipse; sleep 2
    for w in $(c xdotool search --name "Confirm Exit" 2>/dev/null); do c xdotool windowactivate --sync "$w" key Return; done
    for i in $(seq 1 8); do pgrep -u hello -f org.eclipse.equinox.launcher >/dev/null || break; sleep 1; done
  fi
  loginctl terminate-session "$s"
  for i in $(seq 1 10); do loginctl show-session "$s" >/dev/null 2>&1 || break; sleep 1; done
  echo "oturum $s kapandı"
done
exit 0
