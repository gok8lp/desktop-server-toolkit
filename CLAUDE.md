# FLUGEL: proje kuralları

## Makine
- Bu oturum flugelubuntu (PC). Sunucu: ssh flugelserver.
- Ubuntu 26.04, GNOME 50 Wayland, 2560x1600, RTX 4060 hibrit.

## Kesin kurallar
- Şifre, token ve PIN girme. Gerekince dur ve sor.
- Değiştirmeden önce yedek al. ~/sistem-bakim/islem-kaydi.log'a tek satır yaz.
- VM'leri zorla kapatma.
- Lisanssız yayın sitesine link koyma.
- Apple logosu veya markası kullanma.
- Karanlık tema sabit. Açık tema seçeneği ekleme.
- Simgeler *-mono.svg olsun, asla -symbolic.svg değil.
- Etiketler kısa olsun. Her simgede üzerine gelince açıklama balonu çıksın.
- Kullanıcıya görünen her yeni metin _() içinde olsun (TR/EN çeviri için).
- GJS'de her şey asenkron. Ağ ve SSH işini ust-panel-veri veya sunucu ucu yapar, Island sadece JSON okur.
- Animasyonlar "animasyonları azalt" ayarına uysun. Animasyon sırasında veri yenileme veya aktör yeniden kurma yapma.

## Token tasarrufu
- Sadece görevde adı geçen dosyaları oku. Büyük dosyada önce grep, sonra ilgili satır aralığı.
- Depoyu baştan tarama, aşağıdaki haritayı kullan.
- Dosya yeri değişirse haritayı güncelle.
- Bitince sırayla:
  1. Sadece değişen dosyalarda lint (`npx eslint <dosyalar>`, depo kökünde)
  2. Başsız testi bir kez çalıştır
  3. Commit at: "gN: ..."
  4. 5 satırlık rapor yaz: ne değişti, nasıl test ettim, bana kalan iş.

## Test
- Başsız kabuk (gerçek ayarlara dokunmaz, dconf kopyası kullanır):
  `~/sistem-bakim/v2-is/island-test.sh ADIMLAR.sh [2560x1600]` — ADIMLAR.sh içinde `ev 'js'` (Eval) ve `foto ad`.
  Örnek adımlar: ~/sistem-bakim/v2-is/adim1.sh (sekmeler), adim3.sh (20/40 enable-disable sızıntı), adim-pip.sh (PiP).
  Ham komut: `dbus-run-session -- gnome-shell --headless --virtual-monitor 1920x1080 --wayland --no-x11 --unsafe-mode`
- Test bitince: `systemctl --user restart xdg-document-portal` (betik kendisi yapar)
- Birim testleri: `npm test` (tests/*.test.js, saf modüller).
- Kurulum: `./kur-island.sh` (depo → ~/.local/share kopyalar, şema derler). Gerçek test için oturumu
  kapatıp açmak gerekir. Bunu bana söyle, kendin yapma. Geri dönüş: `geri-al-panel.sh`.

## Dosya haritası
- Island kaynağı: `extensions/flugel-island@flugel/` (asıl). Kurulu kopya `~/.local/share/gnome-shell/extensions/flugel-island@flugel/` (sembolik bağ yok, kur-island.sh rsync'ler).
- `extension.js` — açılış/kapanış; sayfa listesi (sekmeler), sağlayıcı listesi, dateMenu gizleme.
- `prefs.js` — Adw ayar penceresi (Genel, Canlı etkinlikler, Yenileme, "eski panele dön").
- `stylesheet.css` — tüm renkler ve görünüm (zemin rengi/saydamlık koddan: island-gorunumu.js `_radiusYaz`).
- `schemas/…gschema.xml` — anahtarlar: tetik, hover-gecikme, monitor, pip-konum, son-sekme, genislik-carpani, kart-genislik, saydamlik, animasyon-hizi, ekip-*, etkin-saglayicilar, oncelik-sirasi, transient-duration-ms, osd-yerine, eşikler (kripto/basket/anime/power/cihaz), notification-*, keyboard-*, sunucu-goruldu, yenileme-*, pil-carpani.
- `src/island-gorunumu.js` — kapsül/balon/kart katmanı, yay animasyonu, hover/pin, dışarı tıklama.
- `src/kart.js` — kart başlığı, canlı etkinlik satırları, sekme çubuğu, kaydırmalı sayfa alanı.
- `src/etkinlik-gorunumu.js` — bir etkinliğin kapsül/balon/flaş/satır görünümü.
- `src/spring.js` — yay animasyonu (HIMURAw). `src/activity*.js` — etkinlik modeli (hacksynth).
- `src/ortak.js` — simge (`ikon/*-mono.svg`), komut çalıştırma, menü satırı, ipucu yardımcıları.
- `src/veri-merkezi.js` — ust-panel-veri çağrıları, tek zamanlayıcı/kaynak, pilde seyrek.
- `src/guc.js` (pil/Pil Tasarrufu QuickToggle), `src/panik.js`, `src/ekip.js` (Re:Zero), `src/pencere.js` (Masaüstüne ekle), `src/pip.js` (PiP sol alt + konum hafızası).
- Sekmeler `src/sayfalar/`: hizli (başlat + zorla kapat + panik + uyku/karanlık), kisayol, sistem, vm, kripto, basket, anime, ekip, tepsi (AppIndicator), sayfa.js (temel sınıf).
- Canlı etkinlikler `src/providers/`: privacy, panik, sunucu (+gpu-vm, akis), media, basket, anime, kripto, osd, power, cihaz, notification, keyboard; provider-base.js (`oncelik()`).
- Veri: `~/.local/bin/ust-panel-veri` (depoda `pc/bin/`) — `kripto | canli | pc | sunucu | island | basket | anime`; önbellek `~/.cache/sistem-bakim/*.json`. VM: `pc/bin/vm`, `pc/bin/w11-gpu`.
- Sunucu veri ucu: `http://192.168.0.15:3012/api/island` (dışarıda `https://flugelserver.tail42f1f4.ts.net:8443/api/island`), FLUGEL Akış `sunucu/panel/akis/akis.py`; paket `~/sistem-bakim/durum/island.json` ← `sunucu/sbin/island-veri.py` (20 sn timer). Alanlar: durum, sorunlar, cpu, temp, ram, swap, disk, gpu_*, konteyner, sagliksiz, vpn, ollama, yedek, vm[], vm_acik, uyarilar[], basket{gelecek}, anime[], takip[], eski.
- Testler `tests/`, lint `eslint.config.js`, kurulum `kur-island.sh`, geri dönüş `geri-al-panel.sh`, depo eşitleme `guncelle.sh`.
- v1 panel (kapalı, kurulu): `pc/gnome-uzantilari/flugel-panel@flugel`; kilit ekranı `flugel-kilit@flugel` (ekip SVG'lerini v1 klasöründen okur).
- Görev listesi: `~/Downloads/FLUGEL-ISLAND-GOREVLER.md` (G0–G14). İlerleme: `~/sistem-bakim/v2-gorevler.md`.
