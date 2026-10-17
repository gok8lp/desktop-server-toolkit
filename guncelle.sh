#!/bin/bash
# FLUGEL deposunu guncelle (sistem-bakim): PC + sunucudaki guncel dosyalari topla, gizli bilgileri temizle,
# tara, commit'le ve GitHub'a gonder.   Kullanim: ./guncelle.sh "degisiklik aciklamasi"
set -e
R="$(cd "$(dirname "$0")" && pwd)"; cd "$R"
MESAJ="${1:-Guncelleme $(date '+%F %H:%M')}"
S=$(mktemp -d); trap 'rm -rf "$S"' EXIT

# ---- PC ----
for u in flugel-panel@flugel flugel-kilit@flugel; do rsync -a --delete --exclude '*.onceki*' ~/.local/share/gnome-shell/extensions/$u pc/gnome-uzantilari/; done
for f in ust-panel-veri pil-modu w11-gpu vm flugel-akis google-chrome bildirim-pc bot-yedek pc-yedek.sh sunucu-ac sunucu-bildirim-izle sunucu-durum-ac; do
  [ -f ~/.local/bin/$f ] && cp ~/.local/bin/$f pc/bin/; done
cp ~/.config/systemd/user/*.service ~/.config/systemd/user/*.timer pc/systemd-kullanici/ 2>/dev/null || true
cp ~/sistem-bakim/acilis-flugel/{ciz.py,flugel.script,Cinzel.ttf} pc/acilis-ekrani/
cp ~/sistem-bakim/giris-ekrani/ciz.py pc/giris-ekrani/; cp ~/sistem-bakim/kilit-flugel/ciz-arkaplan.py pc/kilit-ekrani/
cp ~/sistem-bakim/araclar/*.sh pc/araclar/; cp ~/.local/share/applications/flugel-akis.desktop pc/ 2>/dev/null || true
rsync -a --delete --exclude anahtar --exclude bin --exclude gen --exclude obj ~/sistem-bakim/flugel-apk/ android/

# ---- sunucu ----
ssh flugelserver 'cd / && sudo tar czf - --exclude=__pycache__ --exclude=opt/stacks/panel/akis/web/indir \
  opt/stacks/panel/compose.yaml opt/stacks/panel/homepage/{settings,services,widgets,bookmarks,docker}.yaml opt/stacks/panel/homepage/custom.{css,js} \
  opt/stacks/panel/gundem/gundem_botu.py opt/stacks/panel/akis/akis.py opt/stacks/panel/akis/web \
  opt/basket-bot/{basket_bot.py,anime_takip.py,ayar.json} \
  usr/local/sbin/{ai-gozcu,disk-koruyucu,docker-guvenlik-duvari,flugel-uyari,kritik-yedek,torrent-bekci,virus-tarama,vm-yonlendir}.sh \
  usr/local/bin/{bildirim,telegram-kur,boot-notify.sh,disk-health-report.sh,docker-watcher.sh,morning-report.sh,self-heal.sh,smartd-whatsapp.sh,ssh-login-watcher.sh,weekly-maintenance.sh} \
  usr/local/lib/sistem-bakim etc/libvirt/hooks/qemu \
  $(cd /etc/systemd/system && ls | grep -E "^(ai-gozcu|anime-takip|basket-bot|disk-apm|disk-health|disk-keepalive|disk-koruyucu|docker-guvenlik-duvari|docker-watcher|flugel-uyari|kritik-yedek|self-heal|torrent-bekci|virus-tarama)\.(service|timer|path)$" | sed "s|^|etc/systemd/system/|")' | tar xzf - -C "$S"
rm -rf sunucu/panel; mkdir -p sunucu/panel sunucu/systemd
cp -r "$S"/opt/stacks/panel/* sunucu/panel/; cp "$S"/opt/basket-bot/* sunucu/basket-bot/
cp "$S"/usr/local/sbin/* sunucu/sbin/; cp "$S"/usr/local/bin/* sunucu/bin/; cp "$S"/usr/local/lib/sistem-bakim/* sunucu/lib/
cp "$S"/etc/libvirt/hooks/qemu sunucu/libvirt/qemu-hook; cp "$S"/etc/systemd/system/* sunucu/systemd/

# ---- sunucunun geri kalanı: Docker yığınları, servisler, betikler, tünel, sanal makineler (kendi temizliğiyle) ----
"$R/sunucu/topla.sh"
# ---- gizli bilgileri temizle (sadece depodaki kopyalarda) ----
# Degerler depo DISINDAKI ~/.config/flugel-depo/gizli.txt dosyasinda: "gizli_deger<TAB>yer_tutucu" (bu betikte asla yazmaz)
GIZLI=~/.config/flugel-depo/gizli.txt
[ -f "$GIZLI" ] || { echo "!!! $GIZLI yok, gonderilmedi"; exit 1; }
while IFS=$'\t' read -r deger yer; do
  [ -n "$deger" ] || continue
  grep -rlF --exclude-dir=.git --exclude=guncelle.sh -- "$deger" . | while read -r f; do
    DEGER="$deger" YER="$yer" python3 -c 'import os,sys; p=sys.argv[1]; s=open(p,encoding="utf-8",errors="surrogateescape").read(); open(p,"w",encoding="utf-8",errors="surrogateescape").write(s.replace(os.environ["DEGER"], os.environ["YER"]))' "$f"
  done
done < "$GIZLI"

# ---- son tarama: bir sey bulursa GONDERMEZ ----
if grep -rnIF --exclude-dir=.git -f <(cut -f1 "$GIZLI") . \
   || grep -rnIE --exclude-dir=.git "[0-9]{8,10}:[A-Za-z0-9_-]{30,}|BEGIN [A-Z ]*PRIVATE KEY|gh[op]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}" . ; then
  echo "!!! Gizli bilgi bulundu, gonderilmedi. Yukaridaki satirlari temizle."; exit 1
fi
git add -A
git diff --cached --quiet && { echo "Degisiklik yok."; exit 0; }
git commit -q -m "$MESAJ"
git push -q origin main && echo "Gonderildi: $(git log -1 --format='%h %s')"
