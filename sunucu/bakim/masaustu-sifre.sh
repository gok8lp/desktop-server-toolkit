#!/bin/bash
# Webtop girişi ve ana sayfadaki "masaüstü seç" düğmeleri için şifre (kullanıcı adı: flugel). Şifre ekranda görünmez.
set -e
read -rsp "Webtop / masaüstü seçimi için şifre: " S1; echo
read -rsp "Tekrar: " S2; echo
[ ${#S1} -ge 6 ] || { echo "En az 6 karakter olsun. Hiçbir şey değişmedi."; exit 1; }
[ "$S1" = "$S2" ] || { echo "Şifreler uyuşmuyor. Hiçbir şey değişmedi."; exit 1; }
umask 077
printf "WEBTOP_SIFRE=%s\n" "$S1" > /opt/stacks/webtop/.env
printf "flugel:%s\n" "$(printf "%s" "$S1" | openssl passwd -apr1 -stdin)" > /opt/stacks/giris/htpasswd
chmod 644 /opt/stacks/giris/htpasswd
unset S1 S2
docker exec giris nginx -s reload >/dev/null 2>&1 || true
systemctl is-active --quiet flugel-webtop && sudo systemctl restart flugel-webtop || true
echo "Tamam: şifre kondu. Kullanıcı adı: flugel"
