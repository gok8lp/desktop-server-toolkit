#!/bin/bash
# FLUGEL: mullvad-ts GNOME sadeleştirme/optimizasyon (VPN, ağ, Syncthing, Eclipse dokunulmaz). Günlük: /var/log/flugel-sade.log
exec >>/var/log/flugel-sade.log 2>&1
echo "== $(date)"
# 1) GNOME varsayılanları: animasyon yok, düz arka plan, masaüstü simgeleri yok, arama/indeksleme yok
cat > /etc/dconf/db/local.d/01-flugel-sade <<'D'
[org/gnome/desktop/interface]
enable-animations=false
enable-hot-corners=false
show-battery-percentage=false
[org/gnome/desktop/background]
picture-uri=''
picture-uri-dark=''
picture-options='none'
primary-color='#1e1e22'
color-shading-type='solid'
[org/gnome/desktop/screensaver]
picture-uri=''
[org/gnome/shell]
disabled-extensions=['<e-posta>', '<e-posta>', '<e-posta>']
[org/gnome/desktop/search-providers]
disable-external=true
[org/gnome/desktop/privacy]
remember-recent-files=false
report-technical-problems=false
send-software-usage-stats=false
[org/gnome/software]
download-updates=false
allow-updates=false
[org/freedesktop/tracker/miner/files]
index-recursive-directories=@as []
index-single-directories=@as []
enable-monitors=false
[org/gnome/desktop/notifications]
show-in-lock-screen=false
[org/gnome/mutter]
experimental-features=@as []
D
dconf update
# 2) Dosya indeksleme (tracker) kullanıcı servisleri kapalı
systemctl --global mask tracker-miner-fs-3.service tracker-extract-3.service tracker-miner-fs-control-3.service tracker-writeback-3.service 2>/dev/null || true
# 3) Oturumda kendiliğinden açılan gereksizler
for f in org.gnome.Software update-notifier gnome-initial-setup-first-login org.gnome.Evolution-alarm-notify tracker-miner-fs-3 orca-autostart \
         snap-userd-autostart org.gnome.DejaDup.Monitor spice-vdagent; do
  [ -f /etc/xdg/autostart/$f.desktop ] && { grep -q '^Hidden=true' /etc/xdg/autostart/$f.desktop || echo 'Hidden=true' >> /etc/xdg/autostart/$f.desktop; }
done
# ilk kurulum sihirbazı çıkmasın
mkdir -p /home/hello/.config && echo yes > /home/hello/.config/gnome-initial-setup-done && chown -R hello: /home/hello/.config
# 4) Sistem servisleri: yazıcı, bluetooth, modem, mDNS, hata raporu, güncelleme bildirimi, firmware
for s in cups cups-browsed bluetooth ModemManager avahi-daemon avahi-daemon.socket whoopsie apport kerneloops \
         packagekit fwupd fwupd-refresh.timer switcheroo-control colord; do
  systemctl disable --now $s 2>/dev/null; systemctl mask $s 2>/dev/null
done
# 5) xrdp: daha hafif görüntü (sıkıştırma, 24 bit), ses yok
sed -i 's/^max_bpp=.*/max_bpp=24/; s/^#\?tcp_nodelay=.*/tcp_nodelay=true/' /etc/xrdp/xrdp.ini
systemctl restart xrdp
echo "bitti"
