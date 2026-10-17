#!/bin/bash
# flugelserver optimizasyon - her degisiklik yedeklenir ve loglanir
# Calistirma: scp sunucu-optimizasyon.sh flugelserver:~/sistem-bakim/ && ssh -t flugelserver 'sudo bash ~/sistem-bakim/sunucu-optimizasyon.sh'
set -u
LOG=/home/flugel/sistem-bakim/islem-kaydi.log
BK=/home/flugel/sistem-bakim/yedek-etc-$(date +%F_%H%M); mkdir -p $BK
log(){ echo "[$(date '+%F %T')] [SUNUCU] $*" | tee -a $LOG; }
cp -a /etc/fstab /etc/crypttab /etc/smartd.conf /etc/systemd/journald.conf $BK/; chown -R flugel:flugel $BK
log "Yedek: $BK (fstab crypttab smartd.conf journald.conf)"

# 1) fstab: noatime (gereksiz erisim-zamani yazimlarini keser), veri disklerine
#    nofail + 30sn timeout (USB disk takili degilse acilis kilitlenmez), commit=60 (HDD'ye daha seyrek journal yazimi)
sed -i -E 's#^(/dev/disk/by-id/dm-uuid-LVM-\S+\s+/\s+ext4\s+)defaults#\1defaults,noatime#' /etc/fstab
sed -i -E 's#^(/dev/mapper/sd[cd]_crypt\s+\S+\s+ext4\s+)defaults#\1defaults,noatime,commit=60,nofail,x-systemd.device-timeout=30s#' /etc/fstab
log "fstab: / -> noatime; /mnt/side,/mnt/sidemain -> noatime,commit=60,nofail,x-systemd.device-timeout=30s"
# 2) crypttab: veri diskleri icin nofail
sed -i -E 's#^(sd[cd]_crypt\s+\S+\s+\S+\s+luks)$#\1,nofail#' /etc/crypttab
log "crypttab: sdc_crypt, sdd_crypt -> nofail"
if findmnt --verify --tab-file /etc/fstab >/dev/null 2>&1; then log "fstab dogrulama OK"; else log "FSTAB HATALI - geri aliniyor"; cp $BK/fstab /etc/fstab; cp $BK/crypttab /etc/crypttab; fi
systemctl daemon-reload
mount -o remount,noatime / && mount -o remount,noatime,commit=60 /mnt/side && mount -o remount,noatime,commit=60 /mnt/sidemain && log "Diskler noatime ile canli yeniden baglandi"

# 3) USB disk (Samsung M3) icin USB autosuspend kalici kapali - baglanti kopmalarini onler
cat > /etc/udev/rules.d/90-usb-disk-guc.rules <<'R'
# Samsung M3 Portable (sdb, /mnt/sidemain): USB autosuspend kapali
ACTION=="add", SUBSYSTEM=="usb", ATTR{idVendor}=="04e8", ATTR{idProduct}=="61b6", TEST=="power/control", ATTR{power/control}="on"
R
udevadm control --reload; log "udev: 90-usb-disk-guc.rules (USB disk autosuspend kapali)"

# 4) smartd: 3 diski izle (USB disk -d sat ile), haftalik kisa / aylik uzun SMART testi, sicaklik uyarisi
sed -i -E 's/^DEVICESCAN/#DEVICESCAN/' /etc/smartd.conf
cat >> /etc/smartd.conf <<'S'
# --- sistem-bakim ---
/dev/sda -a -n standby,q -W 4,55,65 -s S/../../7/03 -m root -M exec /usr/share/smartmontools/smartd-runner
/dev/disk/by-id/usb-Samsung_M3_Portable_923D7DF202000065-0:0 -d sat -a -n standby,q -W 4,50,58 -s (S/../../7/04|L/../01/./05) -m root -M exec /usr/share/smartmontools/smartd-runner
/dev/disk/by-id/ata-ST500DM002-1BD142_Z3T34PVR -a -n standby,q -W 4,50,58 -s (S/../../7/04|L/../15/./05) -m root -M exec /usr/share/smartmontools/smartd-runner
S
if systemctl restart smartmontools; then log "smartd: 3 disk izleniyor"; else log "smartd HATA - geri aliniyor"; cp $BK/smartd.conf /etc/smartd.conf; systemctl restart smartmontools; fi

# 5) journald boyut siniri
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=500M\nMaxRetentionSec=1month\n' > /etc/systemd/journald.conf.d/90-sinir.conf
systemctl restart systemd-journald; log "journald: SystemMaxUse=500M, 1 ay"

# 6) Docker, veri diskleri baglandiktan sonra baslasin (Immich/Nextcloud bos klasore yazmasin)
mkdir -p /etc/systemd/system/docker.service.d
printf '[Unit]\nWants=mnt-sidemain.mount mnt-side.mount\nAfter=mnt-sidemain.mount mnt-side.mount\n' > /etc/systemd/system/docker.service.d/90-diskleri-bekle.conf
systemctl daemon-reload; log "docker.service drop-in: diskler baglandiktan sonra baslar"

# 7) HDD readahead 2MB (buyuk medya dosyalarinda daha az kafa hareketi)
echo 'ACTION=="add|change", KERNEL=="sd[b-z]", ATTR{queue/rotational}=="1", ATTR{bdi/read_ahead_kb}="2048"' > /etc/udev/rules.d/91-hdd-readahead.rules
udevadm trigger --subsystem-match=block --action=change; log "udev: HDD read_ahead_kb=2048"
log "OPTIMIZASYON BITTI"
echo "=== OPTIMIZASYON TAMAM ==="
