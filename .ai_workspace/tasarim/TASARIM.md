# FLUGEL Island — Monochrome Contour tasarım paketi (AI-010)

Tarih: 2026-10-17. Tasarım ve prototip: Codex; uygulama/test: Claude. Bu dizindeki [mockup.html](mockup.html) dört görünümü tek sayfada gösterir. Maket yalnız HTML/CSS'tir; GNOME Shell kodu değildir. Island kaynak JS/CSS dosyaları bu görevde değiştirilmedi.

## Hedef ve mevcut geometri

Kullanıcının istediği rafine, macOS'a yakın “tek parça siyah donanım” hissini FLUGEL'in kendi kimliğiyle sağla: siyah kapsül, ölçülü beyaz vurgu, net tipografi, ince kenar, fiziksel ama gösterişsiz hareket. Logo/marka, emoji, renkli dekor, arka plan bulanıklığı, ağır gölge yok. Sistem GNOME 50 Wayland ve dokunmatik yüzeyde akıcı kalmalı.

Mevcut gerçek kısıtlar: `src/island-gorunumu.js` boş kapsülü en az 132 mantıksal px, etkinlik kapsülünü 180–440 px (maçta 660 px), kartı `kart-genislik` ayarından (varsayılan 720, aralık 560–960 px) hesaplıyor; kart yüksekliği monitörün %86'sını aşmıyor ve köşe yarıçapı 26 px. Kapsül yüksekliği GNOME panelinden türetiliyor (çoğunlukla yaklaşık 30–34 px). Kart `src/kart.js` mevcut sekme/sayfa mimarisini korur. Mevcut CSS kapsül siyahını, beyaz yazıyı ve nötr yüzeyleri zaten kullanıyor; tasarım yeni widget veya veri kaynağı gerektirmiyor.

## Görsel tokenlar (mantıksal px)

| Token | Değer | Kullanım |
| --- | --- | --- |
| `ink` | `#050506` | Kapsül ve notch; tam siyaha yakın, düz renk. |
| `card` | `#101114` | Açık kartın opak gövdesi; cam efekti olmadan katman ayrımı. |
| `raised` | `#1b1c20` | Seçili sekme, birincil etkinlik ve önemli kontrol. |
| `hover` | `#26272c` | Üzerine gelinen tıklanabilir yüzey. |
| `line` | `rgba(255,255,255,.12)` | Kapsül/kart 1 px kenarı ve ayrımlar. |
| `line-strong` | `rgba(255,255,255,.22)` | Hover/klavye odağı sınırı. |
| `text` | `#f5f5f7` | Başlık ve eylem. |
| `muted` | `#a7a8b0` | Açıklama, tarih, pasif ikon. |
| `quiet` | `#777982` | Üçüncül/meta metin; bilgi taşıyan tek metin için kullanılmaz. |
| `success / warn / danger` | Mevcut yeşil/sarı/kırmızı durum renkleri | Yalnız gerçek durum/uyarı; seçili sekmede renk yok. |
| `space` | 4 / 8 / 12 / 16 / 24 | Tutarlı boşluk ölçeği. |
| `radius` | 12 (küçük), 16 (karo), 26 (kart), kapsül yüksekliğinin yarısı | Yalnız geometrik köşeler; çok katmanlı çerçeve yok. |

Yazı: GNOME'un sistem fontu. Kapsül ana değer 11 pt / 700, etkinlik 10 pt / 700, ikincil 9 pt / 400, kart saat 21 pt / 800, kart başlıkları 10.5 pt / 700, sekme ipucu 9 pt. Sayısal değerlerde tabular rakam. Türkçe/İngilizce taşma için tek satır elips ve ikonlar için 36×36 px asgari tıklama alanı.

## Dört durum

1. **Boş kapsül:** ~180×32 px örnek görünüm, kodun min 132 px kuralı geçerli. Sol mini durum noktası 6 px, saat ortada, pil/sunucu kısa değeri sağda; yatay iç boşluk 14–16 px. Tek bakışta okunur, dekoratif parlama yok. Tam ekran/notch modunda üst kenara oturur; ayrım için 1 px mat kenar yeterli.
2. **Kompakt etkinlik:** 240–360×32 px tipik, gerçek içerik 180–440 px sınırlarına göre kısalır. 20 px kapak/ikon, başlık ve kısa alt satır, sağda kalan süre veya tek eylem. İç boşluk 12–14 px, öğe aralığı 8 px. Uzun metin kapsülü gereksiz büyütmez; ikincil metin önce kısalır.
3. **Bölünmüş görünüm:** Ana kapsül + 8 px ayrık küçük balon. Balon ikincil canlı durumu gösterir; parlaklık yarışına girmez. Birinci etkinlik beyaz ana metin, ikincil simge `muted`; yalnız uyarı gerçek uyarı rengini alır. Mevcut aktör yerleşimi korunur.
4. **Açık kart:** Varsayılan 720 px genişlik, 26 px köşe, 14–16 px dış iç boşluk. Başlık şeridi ~56 px: solda hava/saat/tarih, sağda en fazla beş görünür eylem + kapat; çok darsa mevcut kaydırma/kısaltma davranışı korunur. Canlı etkinlik satırı 44–52 px. Sekme rayı 40 px, 3 px iç boşluk; seçili sekme `raised`, pasif ikon `muted`; isimler mevcut erişilebilir ad/ipucunda kalır. İçerik alanında 16 px ayraç ve 12 px yüzey arası boşluk. 560 px en dar kartta iki sütun zorunlu değil; içerik taşarsa dikey kaydırma.

## Durum ve hareket

| Olay | Önerilen görünüm | Süre / eğri |
| --- | --- | --- |
| Hover | Kenar `line` → `line-strong`; yüzey `raised` → `hover`; yalnız renk/opaklık. | 120–160 ms ease-out |
| Aktif/basılı | Yüzey `#303137`; metin beyaz; en çok 1 px aşağı konum. | 80 ms ease-out |
| Seçili sekme | Dolu `raised` zemin; ikon beyaz. Diğer sekme `muted`. | Mevcut seçici hareketi ≤220 ms, ease-out; `EASE_OUT_BACK` taşmasını azalt. |
| Kart aç/kapat | Mevcut geometri yayı korunur; içerik yalnız opaklık + hafif (≤6 px) çeviri. | 180–240 ms ease-out; kapanış ≤180 ms |
| Azaltılmış animasyon | Geometri haricindeki geçişler 0–80 ms; stagger, blur ve ekstra ölçek yok. | Kullanıcının mevcut azaltma ayarına uy. |
| Kapalı/devre dışı | `quiet` ikon, yüzey `card`; eylem tıklanamaz, ipucu nedenini açıklayabilir. | Hareket yok |
| Klavye odağı | 2 px açık renk iç halka, hover'a bağımlı olmadan görünür. | Anında |

Performans sınırı: **`cam-efekti` ve `bulanik-gecis` kapalıyken tasarım bütünüyle anlaşılır olmalı.** Kullanıcı A/B testinde her iki blur'u ayrı ayrı açınca fare takılması gözlendi. Şema hâlen ikisini `true` varsayıyor; mevcut kullanıcı değerini sessizce ezme. Claude yeni kurulum varsayılanını değiştirmeyi düşünürse önce canlı ölçüm ve kullanıcı kararı alsın. CSS/GJS'de `filter`, büyük `box-shadow`, `backdrop-filter`, sürekli dönen animasyon, değişmeyen aktör yeniden yapımı ekleme. Yalnız opaklık/çeviri/kenar rengi gibi hafif geçişler.

## Claude için uygulama sırası ve kabul ölçütü

1. `stylesheet.css` token eşlemesini mevcut sınıflara küçük diff'lerle uygula: `.flugel-island-zemin`, `.flugel-kart`, `.flugel-sekmeler-zemin`, `.flugel-sekme-secici`, `.flugel-etkinlik-satir`, `.flugel-karo`, `.flugel-dugme`. Ana kapsül rengi ve yarıçapının JS'den dinamik yazıldığını unutma; CSS ile yarışan sabit kural koyma.
2. Sadece gerekiyorsa `src/kart.js` sekme seçici süresini/taşmasını ve dar genişlik düzenini ayarla. Var olan sekme erişilebilir adlarını ve ipuçlarını koru. `src/island-gorunumu.js` geometri sınırlarını değiştirme; önce maketi mevcut ölçüye adapte et.
3. Kompakt/bölünmüş etiket kısalmasını ve 560/720/960 px kart genişliklerini başsız GNOME'da dene. Türkçe ve İngilizce uzun etiket, yüksek DPI, 1366×768 ekran ve azaltılmış animasyon durumlarını kontrol et.
4. İki Island deposunu eşitle, `po/derle.sh --kontrol`, ESLint, birim testler ve bir başsız görsel kontrol çalıştır. Canlı fare akıcılığını ancak kullanıcı GNOME oturumunu yeniledikten sonra A/B karşılaştır. Ölçülmeyen FPS/kazanç yüzdesi iddia etme. Push/etiket için kullanıcının tercihini uygula.

Başarı: kapsül kapalı ve açık kart aynı görsel dilde; metinler okunur, sekmeler net, hover/odak anlaşılır; iki blur kapalıyken eksik görünmez; fare takılması ya da yeni sürekli render işi eklenmez.
