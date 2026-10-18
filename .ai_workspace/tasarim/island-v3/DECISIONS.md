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
