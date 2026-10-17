# İki ajan için son doğrulanmış devir

Güncelleme: 2026-10-17, Europe/Istanbul. Bu belge public GitHub'a uygun proje düzeyi özetidir. Anlık makine ve ağ ayrıntıları yerel `SERVER_STATE_INDEX.json` dosyasındadır.

- Claude, Island'ın ana ve ayrı depolarını eşitledi. Kullanıcının aktardığı raporda lint temiz, birim testleri 35/35 ve başsız GNOME testleri bu değişiklik için yeniden çalıştırılmadı. Codex uzak `main` commitlerini doğruladı: `flugel` `ca85d9b`, `flugel-island` `27f3ba3`; eklenti klasörleri üretilmiş şema hariç aynı.
- Son sürüm etiketi `v2.9.0`; yeni etiket için ayrıca kullanıcı isteği gerekir. Claude'un bundan sonraki aktif görevi bildirilmedi.
- Codex `.ai_workspace/` merkezini hazırladı: paylaşılabilir kurallar ve pano Git'e girer, canlı envanter yerel kalır. Görev çakışması ve yasak proje kapsamı için iki yalıtılmış test geçti. Akış uygulama koduna ve sunucudaki servislere dokunulmadı.
- Sıradaki açık işler `AGENT_TASK_BOARD.md` içinde `AI-002` ve `AI-003`. Yeni ajan, işe başlamadan görevi `task_board.py` ile alır.
- Kullanıcı sınırı: `weekly-task` ve `weekly-tasks` projelerine hiçbir ajan dokunmaz.
- Codex 2026-10-17'de PiP aktörü yok edildikten sonra sinyal ayırma hatasını ve bozuk PiP konum kaydını düzeltti; ana `4f6ad37` / ayrı Island `64ccaf9` yerel kod commitleriyle kaynaklar eşitlendi. Yük testi görünürlük doğrulaması ana `26ae29d` / ayrı `ce471b0` commitlerinde; GitHub'a push edilmedi. 35/35 birim testi ve GNOME'un gerçekten gördüğü 24/24 PiP döngüsü geçti; test sonunda 0 izleyici ve 0 PiP yaşam döngüsü hatası kaldı. Başsız kabuk kapanışında 30 GJS uyarısı ayrı inceleme ister. Canlı GNOME oturumu yenilenmedi; performans artış yüzdesi ölçülmedi.
- PC'de RAM/swap/I/O baskısı görülmedi; `libinput` giriş gecikmesi ve yüksek CPU kullanan Chrome renderer süreçleri görüldü. Servis, cache, kernel ve ekran ayarı değiştirilmedi. Sonraki ajan yeni oturumda canlı PiP doğrulaması ve GNOME uyarısı için A/B testi yapmalı; görev ayrıntıları AI-005/AI-006'da.

Her tamamlanan önemli görevden sonra bu özeti en fazla birkaç somut maddeyle yenileyin; eski özetleri aktif durum sanmayın. Kodun ayrıntılı geçmişi commit ve görev panosundadır.

## 2026-10-17 — Çift blur geçişi ayıklaması

- Kullanıcı yeni sürümden sonra henüz GNOME oturumunu yenilemedi; canlı performans ölçümü eski kodu temsil ediyor. Kullanıcı daha sonra oturum kapatıp açacak.
- Kart/kompakt geçişinde aynı anda gelen ve kaybolan aktöre blur bağlanıyordu. Kaybolan aktör zaten opaklık/ölçekle çıkıyor; onun blur'u temizleniyor, gelen aktörün efekti korunuyor. Yeni başsız kontrol, açılışta yalnız gelen tarafta blur olduğunu ve geçiş sonunda efektin kalktığını doğruladı.
- Başsız tek örnek p95 kare aralığı 53.4 ms öncesi, 51.4 ms sonrası; varyans yüksek, güvenilir hızlanma yüzdesi yok. 35/35 birim ve cam görsel kontrolü geçti. Cam yarıçapını 30'dan 12'ye indirmek ve hareket boyunca camı devre dışı bırakmak ölçümde yarar göstermedi; iki prototip de geri alındı.
- Kaynak değişikliği ana/ayrı Island/kurulu kopyaya işlendi, canlı oturumda henüz etkin değil. Sonraki adım: oturum yenilendikten sonra blur ayarlarını tek tek A/B test et. Bu düzeltme için GitHub push yapılmadı.

## 2026-10-17 — Island akıcılığı ve koyu katmanlı görünüm

- Canlı A/B: Island kapalı veya Island açıkken iki blur ayarı kapalı olduğunda fare akıcı; yalnız bulanik-gecis ya da yalnız cam-efekti açıkken takılma geri geliyor. USB G305 kopması veya NVIDIA Xid kanıtı yok. Canlı blur ayarları kapalı bırakıldı.
- cam.js: değişmeyen pencere sahnesini yeniden kurmama, değişmeyen blur yarıçapını tekrar yazmama, geçişin ortasında blur efektini çizimden çıkarma. stylesheet.css: kapsül kenarı, yazı hiyerarşisi, kart ve sekme ayrımı, katmanlı kontrol yüzeyleri. Yeni blur/animasyon ve Apple markası yok.
- Ana/ayrı depo ve kurulu kopya eşit. ESLint temiz, npm test 35/35; başsız GNOME cam görsel testi geçti. Kod ve görünüm GitHub main dallarına gönderildi: flugel 9b0df19, flugel-island 7df2f8a. Ölçülen hızlanma yüzdesi doğrulanmadı. Canlı GNOME oturumu eski JS/CSS'i kullanıyor olabilir.
- Kullanıcı oturumu kapatıp açtıktan sonra iki ayar kapalıyken kontrol et; sonra ayrı ayrı açıp fare ve kart açılışını kıyasla. Takılma sürerse ayarı geri kapat. Sürüm etiketi eklenmedi.
