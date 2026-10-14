# FLUGEL Island — temel proje araştırması (2026-10-13)

Amaç: sıfırdan yazmak yerine bakımı süren, GNOME 50 uyumlu, GPL ile yayınlanabilir bir "Dynamic Island" eklentisini temel almak.
Arama: GitHub `dynamic island`, `notch`, `pill`, `mpris`, `media controls` (+ `topic:gnome-shell-extension`). Adaylar yalnızca
okumak için klonlandı (`~/Projects/island-adaylar`, çalıştırılmadı). Yıldızlar ve tarihler 2026-10-13 itibarıyla.

## Karşılaştırma

| Aday | ★ | Son commit | Lisans | shell-version | Boyut | Artıları | Eksileri |
|---|---|---|---|---|---|---|---|
| **hacksynth/gnome-dynamic-island** | 1 | 2026-04-20 | **GPL-2.0+** | 50 | 1 164 satır, 23 dosya | Saf JS **etkinlik yöneticisi** (tier: transient/persistent/ambient, öncelik, leading/trailing yuva) → **4 durum**: idle/compact/split/expanded; sağlayıcı (provider) mimarisi (medya, bildirim, güç, ses/parlaklık, klavye); hover-genişlet + tıkla-sabitle; prefs.js + GSettings şeması; **birim testleri + CI**; disable()'da paneli geri yükler | Görünüm yalnızca metin; genişletilmiş hal panel yüksekliğini aşamıyor; animasyon St'nin desteklemediği CSS `transition`'a dayanıyor; ikon/kapak yok |
| **HIMURAw/gnome-dynamic-island** | 0 | 2026-10-12 | GPL-3.0 | 50 | 7 419 satır | **Sönümlü yay animasyonu** (`spring.js`, Clutter.Timeline, `enable_animations`'a uyar, çakışan geçişi durdurur); **gizlilik izleyici** (`privacy.js`: Gvc kayıt akışları + `Shell.CameraMonitor`); ses dalgası (`wave.js`); panelin üstünde ayrı **chrome katmanı** (büyük kart açılabilir); eslint yapılandırması | 2 470 satırlık tek extension.js; kendi kontrol merkezi/sohbet/hesap makinesi gibi FLUGEL'e yabancı çok özellik; mikrofonu **ses düzeyi için kaydediyor** (istemiyoruz) |
| NexVar/NexNotch | 10 | 2026-07-05 | GPL-3.0+ | 49, 50 | 4 292 satır | Çentik tarzı hover merkezi, modüller (mpris, takvim, sistem, bildirim), Gio.Subprocess ile async | Mimari tek büyük `notch.js` etrafında; durum makinesi yok; Claude kullanım/pomodoro gibi ilgisiz modüller |
| Adityasah2004/NotchNux | 24 | 2026-08-04 | MIT | 45–51 | 11 871 satır | En çok yıldız, geniş sürüm desteği, müzik/hava/sistem panosu | Tek dosyada ~8k satır; karmaşık; canlı-etkinlik önceliği kavramı yok |
| D3ft4cKeR/FloeIsland | 1 | 2026-09-02 | GPL-3.0 | 50 | 7 114 satır | Zengin modüller (mpris, bildirim, OSD durumu, takvim) | Çince ay takvimi/şarkı sözü/çeviri gibi bize gereksiz bölümler; durum modeli dağınık |
| Nayzer974/GNOMAC | 3 | 2026-10-08 | GPL-3.0 | 50, 51 | 19 686 satır | macOS görünüm paketi (cam, dock, **genie/sihirli lamba**) — 4. bölüm için örnek | Island'dan çok bütün masaüstünü değiştiriyor; tek eklenti olarak çok büyük |

Parça adayları: `sakithb/media-controls` (MIT, 397★, GNOME 46–50; kapak + PlayerProxy), `JasonLG1979/mpris-indicator-button` (GPL-3, 160★, GNOME ≤42 — eski).

## Karar

**Temel: hacksynth/gnome-dynamic-island** (GPL-2.0-or-later). Nedeni: istenen 4 durumu, öncelik/yuva tabanlı canlı etkinlik
modelini, sağlayıcı mimarisini, ayarlar penceresini ve testleri zaten doğru biçimde kuruyor; kod küçük ve okunaklı, GNOME 50 hedefli.
Zayıf olduğu tek yer görünüm — onu yeniden yazıyoruz.

**Eklenen parçalar (atıf korunarak):**
- `spring.js` ← HIMURAw (GPL-3.0): genişlik/yükseklik/köşe yarıçapı için yaylı geçiş.
- gizlilik algılama ← HIMURAw `privacy.js` (GPL-3.0): yalnızca "mikrofon/kamera kullanımda mı" kısmı; **ses ölçer (mikrofonu kaydeden) bölüm alınmadı.**
- ses dalgası ← HIMURAw `wave.js` (GPL-3.0): medya çalarken dekoratif dalga (mikrofona bağlı değil).
- Island'ın panel üstünde ayrı chrome katmanı olarak yaşaması fikri ← HIMURAw.

**Sonuç lisansı:** GPL-2.0+ ve GPL-3.0 kod birleşince `flugel-island` **GPL-3.0-or-later** olmalı. Deponun geri kalanı için seçenekler
`THIRD_PARTY.md` ve yayın aşamasında sunulacak.

**Uyumsuz/alınmayan:** NotchNux (MIT, uyumlu ama mimari uymadı), NexNotch, FloeIsland, GNOMAC (Island için değil; 4. bölümde sihirli lamba
için ayrıca değerlendirilecek), mpris-indicator-button (GNOME 42'de kalmış).
