# ust-dugmeler.sh — kart başlığındaki düğmeler gerçek fare tıklamasıyla çalışıyor mu
a "__A.E()._ayar.set_string('tetik', 'hover'); __A.E()._yonetici.setPinned(true); 1" >/dev/null; sleep 1.5
dugme(){ # $1: sıra (başlıktaki düğme), $2: kontrol ifadesi, $3: ad
  a "const ust = __A.E()._kart.ustSerit; const d = ust.get_children().filter(c => c.style_class && c.style_class.includes('flugel-dugme'))[$1]; const [x, y] = __A.merkez(d); __A.git(x, y); 1" >/dev/null; sleep 0.4
  a "__A.bas(); __A.birak(); 1" >/dev/null; sleep 1
  a "__A.yaz('başlık düğmesi: $3', $2, ''); 1" >/dev/null
  a "Main.panel.statusArea.quickSettings.menu.close(); Main.panel.statusArea.dateMenu.menu.close(); if (Main.overview.visible) Main.overview.hide(); __A.git(300, 700); 1" >/dev/null; sleep 1.2
  a "__A.E()._yonetici.setPinned(true); 1" >/dev/null; sleep 1
}
dugme 0 "Main.panel.statusArea.quickSettings.menu.isOpen" "Hızlı ayarlar"
dugme 1 "Main.panel.statusArea.dateMenu.menu.isOpen" "Takvim"
dugme 2 "Main.overview.visible" "Etkinlikler"
dugme 3 "__A.E()._kart._gucPanel.visible" "Güç paneli"
a "__A.E()._yonetici.setPinned(false); 1" >/dev/null; sleep 0.5
a "const [x, y] = __A.merkez(__A.E()._ada._kok); __A.git(x, y); 1" >/dev/null; sleep 1.2
a "const ust = __A.E()._kart.ustSerit; const d = ust.get_children().filter(c => c.style_class && c.style_class.includes('flugel-dugme'))[4]; const [x, y] = __A.merkez(d); __A.git(x, y); 1" >/dev/null; sleep 0.4
a "__A.bas(); __A.birak(); 1" >/dev/null; sleep 0.6
a "__A.yaz('başlık düğmesi: Açık tut', __A.E()._yonetici._pinned === true, String(__A.E()._yonetici._pinned)); 1" >/dev/null
a "const ust = __A.E()._kart.ustSerit; const d = ust.get_children().filter(c => c.style_class && c.style_class.includes('flugel-dugme'))[6]; const [x, y] = __A.merkez(d); __A.git(x, y); 1" >/dev/null; sleep 0.4
a "__A.bas(); __A.birak(); 1" >/dev/null; sleep 1
a "__A.yaz('başlık düğmesi: Kapat', __A.E()._ada.durum !== 'genis', __A.E()._ada.durum); 1" >/dev/null
