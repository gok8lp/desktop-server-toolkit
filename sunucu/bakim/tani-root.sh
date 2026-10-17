#!/bin/bash
# SADECE OKUMA: root gerektiren tani bilgileri. Hicbir ayar degistirmez.
O=/home/flugel/sistem-bakim/tani-root.txt
{
echo "##### SMART sda (SSD)"; smartctl -H -A -l error /dev/sda
echo "##### SMART sdb (USB Samsung M3)"; smartctl -d sat -H -A -l error -l selftest /dev/sdb
echo "##### SMART sdc"; smartctl -H -A -l error -l selftest /dev/sdc
echo "##### HDPARM"; for d in sdb sdc; do hdparm -B -S /dev/$d 2>&1 | head -4; hdparm -C /dev/$d; done
echo "##### CRYPTTAB"; cat /etc/crypttab
echo "##### CLEVIS/TPM"; ls /etc/clevis* /etc/dracut.conf.d 2>/dev/null; dpkg -l | grep -E "clevis|tpm2" | awk '{print $2}'; cryptsetup luksDump /dev/sda3 2>/dev/null | grep -E "Keyslots|^\s+[0-9]: luks2|Tokens|systemd-tpm2|clevis" 
echo "##### FSTAB"; cat /etc/fstab
echo "##### UFW"; ufw status verbose
echo "##### JOURNAL"; journalctl --disk-usage; grep -vE "^#|^$" /etc/systemd/journald.conf
echo "##### DOCKER daemon.json"; cat /etc/docker/daemon.json 2>/dev/null || echo yok
echo "##### FAIL2BAN"; fail2ban-client status 2>&1 | head -5
echo "##### SSHD"; sshd -T 2>/dev/null | grep -E "^(passwordauthentication|permitrootlogin|pubkeyauthentication|port) "
echo "##### CLOUDFLARED"; systemctl cat cloudflared 2>/dev/null | grep -E "ExecStart"; ls /etc/cloudflared 2>/dev/null; journalctl -u cloudflared --since "3 days ago" --no-pager -o cat | grep -iE "err|fail|reconnect|retry" | sed -E "s/[0-9]+/N/g" | sort | uniq -c | sort -rn | head -8
echo "##### TAILSCALE"; tailscale netcheck 2>&1 | head -15
echo "##### WARP"; systemctl status warp-svc --no-pager 2>&1 | head -4; ip link show warp 2>&1 | head -1
} > $O 2>&1
chown flugel:flugel $O; echo "=== TANI TAMAM: $O ==="
