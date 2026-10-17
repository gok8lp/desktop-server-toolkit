#!/bin/bash
. /usr/local/lib/sistem-bakim/whatsapp-kapat.sh  # sistem-bakim
PHONE="<TELEFON>"
APIKEY="<CALLMEBOT_APIKEY>"

send() {
  curl -s -G "https://api.callmebot.com/whatsapp.php" \
    --data-urlencode "phone=$PHONE" \
    --data-urlencode "text=$1" \
    --data-urlencode "apikey=$APIKEY" > /dev/null
}

# journalctl follow ile sshd loglarini izle
sudo journalctl -f -u ssh.service -n 0 --output=short-iso 2>/dev/null | \
while read -r line; do
  # Basarili giris
  if echo "$line" | grep -q "Accepted"; then
    USER=$(echo "$line" | grep -oP 'for \K\S+')
    IP=$(echo "$line" | grep -oP 'from \K[\d.]+')
    METHOD=$(echo "$line" | grep -oP 'Accepted \K\S+')
    PORT=$(echo "$line" | grep -oP 'port \K\d+')
    TIMESTAMP=$(echo "$line" | awk '{print $1}')
    
    # LAN mi WAN mi
    if echo "$IP" | grep -qE '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|100\.)'; then
      # ev agi / Tailscale: bilinen cihazlar -> bildirim yok, sadece kayit (sistem-bakim: 7 gunde 94 gereksiz bildirim)
      echo "$TIMESTAMP $USER $IP $METHOD" >> /var/log/ssh-girisleri.log
      continue
    else
      ICON="🌍"
      LOC="WAN"
      # WAN icin geolocation dene (basit, hizli)
      GEO=$(curl -s --max-time 3 "https://ipapi.co/${IP}/city/" 2>/dev/null)
      COUNTRY=$(curl -s --max-time 3 "https://ipapi.co/${IP}/country_name/" 2>/dev/null)
      [ -n "$GEO" ] && LOC="$GEO, $COUNTRY"
    fi
    
    send "$ICON SSH GIRISI

👤 Kullanici: $USER
🌐 IP: $IP
📍 Konum: $LOC
🔑 Yontem: $METHOD
🔌 Port: $PORT
🕐 Saat: $TIMESTAMP"
  fi
  
  # Basarisiz girisleri sessizce gec (CrowdSec hallediyor)
  # Ama cok deneme olursa uyari ver - opsiyonel
done
