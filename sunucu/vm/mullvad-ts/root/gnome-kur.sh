#!/bin/bash
# FLUGEL: mullvad-ts'e Ubuntu GNOME masaüstü (xrdp ile). Günlük: /var/log/flugel-gnome.log
exec >>/var/log/flugel-gnome.log 2>&1
echo "== $(date) başladı"
export DEBIAN_FRONTEND=noninteractive
echo "lightdm shared/default-x-display-manager select lightdm" | debconf-set-selections
echo "gdm3 shared/default-x-display-manager select lightdm" | debconf-set-selections
apt-get update -q
apt-get install -y -q -o Dpkg::Options::=--force-confold ubuntu-desktop-minimal gnome-tweaks gnome-shell-extension-manager yaru-theme-gtk yaru-theme-icon
# lightdm ana ekran yöneticisi kalsın (gdm3 gelse de)
echo /usr/sbin/lightdm > /etc/X11/default-display-manager
systemctl disable gdm3 2>/dev/null || true
# xrdp oturumunda GNOME (Ubuntu oturumu)
cat > /home/hello/.xsession <<'X'
export GNOME_SHELL_SESSION_MODE=ubuntu
export XDG_CURRENT_DESKTOP=ubuntu:GNOME
export XDG_SESSION_DESKTOP=ubuntu
export XDG_CONFIG_DIRS=/etc/xdg/xdg-ubuntu:/etc/xdg
exec gnome-session
X
chown hello: /home/hello/.xsession
# uzak oturumda "renk profili için kimlik doğrulama" ve benzeri sorular çıkmasın
mkdir -p /etc/polkit-1/rules.d
cat > /etc/polkit-1/rules.d/45-flugel-xrdp.rules <<'R'
polkit.addRule(function(action, subject) {
  if ((action.id.indexOf("org.freedesktop.color-manager.") == 0 ||
       action.id == "org.freedesktop.packagekit.system-sources-refresh") && subject.user == "hello") {
    return polkit.Result.YES;
  }
});
R
# karanlık tema, Türkçe klavye, ekran kilidi/karartma yok (boşta kapanmayı flugel-bosta yapar)
mkdir -p /etc/dconf/db/local.d /etc/dconf/profile
printf "user-db:user\nsystem-db:local\n" > /etc/dconf/profile/user
cat > /etc/dconf/db/local.d/00-flugel <<'D'
[org/gnome/desktop/interface]
color-scheme='prefer-dark'
gtk-theme='Yaru-dark'
icon-theme='Yaru'
[org/gnome/desktop/input-sources]
sources=[('xkb', 'tr')]
[org/gnome/desktop/screensaver]
lock-enabled=false
idle-activation-enabled=false
[org/gnome/desktop/session]
idle-delay=uint32 0
[org/gnome/settings-daemon/plugins/power]
sleep-inactive-ac-type='nothing'
[org/gnome/shell]
favorite-apps=['eclipse_eclipse.desktop', 'org.gnome.Nautilus.desktop', 'org.gnome.Terminal.desktop', 'firefox_firefox.desktop']
D
dconf update
# boşta kapanma betiği GNOME oturumunu da kapatabilsin
sed -i 's|calistir xfce4-session-logout --logout --fast 2>/dev/null \|\| pkill -u "$KULLANICI" -TERM xfce4-session|calistir gnome-session-quit --logout --no-prompt 2>/dev/null \|\| calistir xfce4-session-logout --logout --fast 2>/dev/null \|\| pkill -u "$KULLANICI" -TERM -f "gnome-session\|xfce4-session"|' /usr/local/bin/flugel-bosta.sh
bash -n /usr/local/bin/flugel-bosta.sh && echo "bosta betigi tamam"
echo "== $(date) bitti"
