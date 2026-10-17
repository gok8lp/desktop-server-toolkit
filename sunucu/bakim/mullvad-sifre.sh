#!/bin/bash
# mullvad-ts sanal makinesindeki "hello" kullanicisinin sifresini degistirir (makine kapaliyken, disk uzerinden).
# Sifre ekranda gorunmez; komut satirina yazilmaz (gecici dosya, hemen silinir).
set -e
D=/var/lib/libvirt/images/mullvad-ts.qcow2
[ "$(sudo virsh domstate mullvad-ts)" = "shut off" ] || { echo "Makine acik: once kapatilmali."; exit 1; }
read -rsp "hello icin yeni sifre: " S1; echo
read -rsp "Tekrar: " S2; echo
[ -n "$S1" ] && [ "$S1" = "$S2" ] || { echo "Sifreler uyusmuyor ya da bos. Hicbir sey degismedi."; exit 1; }
T=$(mktemp); chmod 600 "$T"; printf "%s" "$S1" > "$T"; unset S1 S2
sudo virt-customize -q -a "$D" --password "hello:file:$T"; R=$?
shred -u "$T" 2>/dev/null || rm -f "$T"
[ $R -eq 0 ] && echo "Tamam: hello kullanicisinin sifresi degisti." || echo "Hata olustu (kod $R)."
