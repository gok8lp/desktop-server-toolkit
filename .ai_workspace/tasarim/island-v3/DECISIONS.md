# V3 ortak tasarım kararı — Codex + Claude

2026-10-18: Claude maketi, etkileşim prototipini ve uygulama maliyetini inceledi; Codex görsel hedef ve fare performansı açısından değerlendirip aşağıdaki kararı paylaştı. Kullanıcının isteği: tasarıma ikisi birlikte karar verir; özellikler korunur, yayın öncesi ikisi de debug yapar.

1. **Onaylanan yön:** mat siyah yüzey, tek ince ayraç, beş eşit genişlikli grup (ikon üstte/etiket altta), iki satır canlı alan, altı özgün mono ikon. Mevcut on sayfa ID'si ve rozetler korunur.
2. **Başlık:** görünür dört düğme güç / sabitle / taşma / kapat. Taşma GNOME PopupMenu değil, kartın başlığı altında açılan küçük karo şerididir. Hızlı ayarlar, takvim, etkinlikler, ayarlar ve çalışma alanları burada kalır. Eski işlevlerden hiçbiri kaybolmaz. Dar kartta şerit kendi alanında kayar.
3. **Canlı liste:** en çok iki satır, `+N daha` satırın içinde değil altında küçük hap. Açılınca kalan gerçek öğeleri kendi kaydırma alanında gösterir; rozet/öncelik doğru kalır.
4. **Hızlı/Tümü:** ilk uygulama aşamasından ayrı commit, fakat yayın öncesi tamamlanır. Sabit uygulamalar, araçlar ve riskli eylemler kayıpsız.
5. **Hover Quick Peek:** `prototype.html` içinde yalnız gelecek fikir deneyi. Yeni bir geometri durumu; hover gecikmesi, pin, dış tık ve tam ekran çentik mantığına dokunduğu için v3 ilk yayına girmez. Fare gecikmesi ölçüldükten sonra kullanıcıya açık, varsayılan kapalı v3.1 seçeneği olarak değerlendirilebilir.
6. **Yayın kapısı:** Claude kodu/iki depo eşitleme ve başsız GNOME testleri; Codex 560/720/960 gerçek görüntü, uzun TR/EN metin, odak, iki blur kapalı hareketi inceler. Canlı fare testi yeni kodla GNOME oturumu yenilenene dek açık kalır. GitHub push kullanıcı tarafından bu tasarım isteğinde yetkilendirildi; sürüm etiketi ayrı karar.

## İkinci görsel denetim — Codex

- 1440px ve 620px tarayıcı maketleri incelendi. Beş grup 560px'e yakın kartta taşmıyor, ancak düşük ekran yüksekliğinde Hızlı içeriği kartın doğal yüksekliğini aşıyor. Gerçek GNOME kartı %86 ekran sınırında kalmalı; yalnız içerik kaymalı, başlık ve grup çubuğu sabit kalmalı. Claude'un 1366×768 başsız görüntüsüyle yeniden doğrulanacak.
- `+N daha` hapı ve alt sayfa etiketleri makette önce 18–25px kadar küçük tıklama alanıydı; en az 36px yüksekliğe çıkarıldı. GNOME aktörleri için de aynı alt sınır isteniyor.
- Renkler ölçüldü: `primary`/`surface` yaklaşık 16.7:1, `secondary`/`surface` 7.9:1. `tertiary`/`raised` ilk değerde 4.35:1 kalıyordu; `#878d96` ile yaklaşık 4.7:1 oldu. Bu yalnız renk kontrolüdür; gerçek font/ölçek ekran görüntüsü hâlâ gerekli.
- Başlıktaki dört düğme 560px kartta sığıyor; taşma içindeki beş eylem ve çalışma alanlarının gerçekten erişilebilir oluşu ayrı GNOME testinde doğrulanmalı. Kartın `+N`/taşma alanı açıkken odak ve dış tık davranışı ayrıca test edilir.

Bu dosya görüş birliğini kaydeder; `SPEC.md`, `MOTION.md`, `REFERENCES.md` ve `mockup.html` uygulama ayrıntılarını verir.

## Gerçek GNOME ekran görüntüsü denetimi — Codex (ikinci tur)

- Claude'un `test/` görüntülerinde beş grup 560px ve 720px kartta okunuyor; dört başlık eylemi ve taşma şeridindeki hızlı ayarlar/takvim/etkinlikler/ayarlar/çalışma alanları erişilebilir görünüyor. Eski `atoll` tasarımına dönüş görüntüsü de var.
- `x1-1366-560-hizli.png` görüntüsünde Maçlar filtresinin son hapı sağ kenarda kesiliyor. Bu yatay listenin sağa kaydırılabilir olduğu görsel olarak anlaşılmıyor; son öğeye klavyeyle ve pointer ile erişim doğrulanmalı, gerekirse kenar sönümü/kaydırma ipucu konmalı. İçerikteki satırların sağ uçları da dar kartta kesiliyor; tercihen kritik skor/metin korunup yalnız ikincil metin kısaltılmalı.
- `v3-akis.png` ve `v3-sistem.png` içinde kartın alt kısmında duvar kâğıdındaki radyal desen belirgin biçimde görünüyor. V3'ün mat, sakin yüzey hedefi için kart zemini opak `#08090b` olmalı; ağır blur eklenmemeli. Başlık/canlı alanın sakinliği alt sayfada da sürmeli.
- `v2-kart-ana.png` ve `v3-sistem.png` 720px kartta bölümlerin büyük ölçüde okunabildiğini gösteriyor; ancak bunlar 1366×768 gerçek dikey bütçeyi tek başına ispatlamıyor. 560/720/960 genişlik + 1366×768 yükseklik, taşma açık, 0/2/5 canlı etkinlik kombinasyonları ve klavye odağı release kapısı olarak kalır.
- `test/x1-1366-560-hizli.png` ile `test/x2-1366-720-hizli.png` dosya adlarında “hizli” yazsa da ekranda Takip/Maçlar sayfası görünüyor. Test kanıtının adları veya çekim durumu netleştirilmeli; Hızlı sayfasının ayrı gerçek GNOME görüntüsü gerekli.
