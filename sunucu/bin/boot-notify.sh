#!/bin/bash
. /usr/local/lib/sistem-bakim/whatsapp-kapat.sh  # sistem-bakim
curl -s "http://<IP>:8482/message?token=<GOTIFY_TOKEN>" \
  -F "title=flugelserver yeniden başladı 🔄" \
  -F "message=Tarih: $(date)" \
  -F "priority=8"

curl -s "https://api.callmebot.com/whatsapp.php?phone=<TELEFON>&text=flugelserver+yeniden+basladi:+$(date | tr ' ' '+')&apikey=<CALLMEBOT_APIKEY>"
