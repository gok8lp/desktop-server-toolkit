#!/bin/bash
# Sunucudaki yapıyı depoya toplar: Docker yığınları, sistem servisleri, betikler, Cloudflare tüneli, sanal makine
# tanımları ve mullvad-ts masaüstü betikleri. Gizli/kişisel bilgiler temizle.py ile çıkarılır (.env dosyaları hiç alınmaz).
# Kullanım: sunucu/topla.sh   (guncelle.sh de çağırır)
set -e
R="$(cd "$(dirname "$0")" && pwd)"; S=$(mktemp -d); trap 'rm -rf "$S"' EXIT
ssh flugelserver 'cd / && sudo tar czf - --exclude=__pycache__ --exclude="*.bak" --exclude="*.onceki*" \
 $(cd /opt/stacks && ls -d */{docker-compose,compose}.{yml,yaml} 2>/dev/null | grep -v "^panel/" | sed "s|^|opt/stacks/|") opt/stacks/docker-compose.yml \
 opt/stacks/giris/html opt/stacks/giris/nginx.conf opt/stacks/anahtar/anahtar.py opt/stacks/guacamole/initdb/02-flugel.sql opt/scripts \
 etc/cloudflared/akis.yml \
 $(cd /etc/systemd/system && ls | grep -E "\.(service|timer|path)$" | grep -vE "^(dbus|sshd|snap|syslog|cloud-|getty|display-manager|systemd-|chronyd|nmb|smb|smartd|wsdd|nvidia-persistenced)" | sed "s|^|etc/systemd/system/|") \
 $(cd /usr/local/bin && ls | grep -E "\.sh$|^(ai-sohbet|bildirim|emoji-sembol|telegram-kur)$" | sed "s|^|usr/local/bin/|") \
 $(cd /usr/local/sbin && ls | grep -E "\.(sh|py)$" | sed "s|^|usr/local/sbin/|") \
 $(cd /etc/libvirt/qemu && ls *.xml | sed "s|^|etc/libvirt/qemu/|") \
 $(cd /home/flugel/sistem-bakim && ls *.sh *.py 2>/dev/null | sed "s|^|home/flugel/sistem-bakim/|") 2>/dev/null' | tar xzf - -C "$S"
# mullvad-ts (sanal makine) içindeki masaüstü/oturum betikleri
mkdir -p "$S/vm"
ssh flugelserver '~/sistem-bakim/vmroot.sh "cd / && tar czf - usr/local/bin/flugel-bosta.sh usr/local/bin/flugel-tek-oturum.sh etc/systemd/system/flugel-bosta.service etc/systemd/system/flugel-bosta.timer etc/systemd/system/flugel-ekran.service root/xfce-ubuntu.py root/xfce-duzelt.py root/sade.sh root/gnome-kur.sh 2>/dev/null | base64 -w0"' | base64 -d | tar xzf - -C "$S/vm" 2>/dev/null || true
sed -i -E 's/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/<tunel-kimligi>/g' "$S/etc/cloudflared/akis.yml"
# depo düzeni
rm -rf "$R/yiginlar" "$R/bakim" "$R/vm" "$R/libvirt/vm" "$R/scripts"; mkdir -p "$R/yiginlar" "$R/bakim" "$R/vm/mullvad-ts" "$R/libvirt/vm" "$R/scripts" "$R/cloudflared" "$R/systemd" "$R/bin" "$R/sbin"
cp -r "$S"/opt/stacks/* "$R/yiginlar/"; mv "$R/yiginlar/docker-compose.yml" "$R/yiginlar/_ana-docker-compose.yml"
cp -r "$S"/opt/scripts/* "$R/scripts/"; cp "$S"/etc/cloudflared/akis.yml "$R/cloudflared/akis.yml"
cp "$S"/etc/systemd/system/* "$R/systemd/"; cp "$S"/usr/local/bin/* "$R/bin/"; cp "$S"/usr/local/sbin/* "$R/sbin/"
cp "$S"/etc/libvirt/qemu/*.xml "$R/libvirt/vm/"; cp "$S"/home/flugel/sistem-bakim/* "$R/bakim/"
[ -d "$S/vm" ] && cp -r "$S"/vm/* "$R/vm/mullvad-ts/" 2>/dev/null || true
# temizlik bütün sunucu/ klasörüne (guncelle.sh'nin kopyaladığı panel ve botlar dahil)
python3 "$R/temizle.py" "$R" "$HOME/.config/flugel-depo/gizli.txt"; mv "$R/.env.ornek" "$R/env.ornek"
sed -i 's/>[^<]*<\/h1>/>FLUGEL<\/h1>/; s/<title>[^<]*<\/title>/<title>FLUGEL<\/title>/' "$R/yiginlar/giris/html/index.html"
echo "sunucu toplandı: $(find "$R" -type f | wc -l) dosya"
