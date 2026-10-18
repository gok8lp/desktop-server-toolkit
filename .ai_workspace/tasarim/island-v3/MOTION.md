# Quiet Orbit — ön yüz hareket tasarımı

Bu belge `SPEC.md` içindeki görünümün olay koreografisidir; v3'e özgüdür. Eski tasarım seçeneklerinin hareketini değiştirme. Süreler toplam “aktif kullanıcıya görünür” süredir; yay çözümleyicisinin iç sayısal oturma süresi değil. 60Hz'de kare aralığı 16,7ms olduğundan her küçük hareket ayrı animasyon bütçesi harcar.

## Hareket dili

- Tepki hemen: tıklama/hover sonrası ilk görünür değişim en geç 80ms.
- Tek bir olay en fazla bir geometri ve bir içerik geçişi sürsün. Aynı aktörde scale, blur, opacity ve yeniden yerleşim zincirlenmesin.
- Kapsül/kart gövdesi `YayFizik` ile aynı konum+hız akışını sürdürür; üst üste tıklamada hedef değiştirilir, önce sıfırlanmaz. v3'te damping 0.92–0.97 denensin; görsel overshoot hedefe göre ≤2px, son sürümde mümkünse yok. Yay response başlangıç 0.30–0.36s; 0.5s mevcut değerden daha hızlı. Ölçümde 16ms p95 kare hedefi tutmazsa öncelik akıcılık, süre değil.
- İçerik için `opacity` ve `translation_y` tercih edilir. Kapsül sınırında içerik 4px'den, kartta 6px'den fazla kaymaz. Metin scale edilmez; tipografi bulanıklaşır. Kapak görseli de yalnız opacity değiştirir.
- Seçimler ve butonlar renk/kenar değiştirir; `EASE_OUT_BACK` ve “pıt” sıçraması v3'te kaldırılır. Uyarı dışında tekrarlayan dikkat çekme animasyonu yok.

## Olay zaman çizelgesi

| Olay | 0–80ms | 80–220ms | Son durum |
| --- | --- | --- | --- |
| Kapsüle bas | Yüzey `raised`, scale en çok 0.985, hedef 70–90ms | Bırakınca 100–120ms ease-out ile 1.0; bounce yok | Basılı/serbest net |
| Boş → canlı kapsül | Eski içerik opacity 255→0 / 90ms | Yeni içerik opacity 0→255 ve Y +4→0 / 170ms; kapsül genişliği aynı yayda | Tek içerik, eski aktör temiz |
| Canlı → başka canlı | Metin eski opacity→0 / 80–100ms | Yeni opacity→255 / 140–170ms; değişmeyen saat/çerçeve yerinde | Saat titremez, kapsül pulse yok |
| Kapsül → açık kart | Gövde anında büyüme hedefi alır, içerik opacity 0 | Kart başlığı ve etkinlik 90–190ms; gezinme + içerik 120–220ms, hepsi aynı bitişe yaklaşır | Geometri doğal yayla ≤360ms oturur |
| Kart → kapsül | İçerik opacity 255→0 / 100ms | Gövde mevcut hızla küçülür; kompakt içerik son 120–180ms'de belirir | Gizli kart aktörü input yakalamaz |
| Grup/alt sayfa | Seçici anında hareket başlar | Seçici 170–190ms ease-out; içerik opacity+Y 150–180ms | Rozet/odak/son sayfa değişmez |
| İkincil balon | Opacity+scale 0.96→1 / 150–180ms | Kapanış opacity 120–150ms | Balon ana kapsülle “yarışmaz” |
| Azaltılmış animasyon | İçerik yer değişimi 0ms | Yalnız opsiyonel opacity ≤80ms | Sıfır scale/stagger/blur |

Kart açılışında çocuk başına `70+i*45ms` gecikme yapılmaz; özellikle çok etkinlikte son çocuk gecikir. Bunun yerine en çok iki grup (başlık+canlı, gezinme+içerik) tek seferde başlatılır. 5+ etkinlikte iki satırdan fazlası çizilmez; `+N daha` açılana kadar gizli öğelerin aktörlerini oluşturma. Sekme değişiminde eski sayfa gizlenip yeni sayfa 26px kaydırılmasın; 4px yeterli. Veri yenileme ve sayfa aktörünün oluşturulması animasyonun kritik 0–220ms penceresinde yapılmamalı; mevcut ısıtma/önbellekle önceden hazırla.

## Claude için mevcut kod eşlemesi

| Yer | V3 kararı |
| --- | --- |
| `src/island-gorunumu.js::_kompaktGoster` çevresindeki 110+380ms `EASE_OUT_BACK` pulse | V3'te kaldır; yalnız değişen içeriğe kısa opacity+Y uygula |
| `_basKucul` 0.95/340ms geri sıçrama | 0.985 basış, 90/110ms bounce olmayan bırakış |
| `_balonGoster` 0.6 scale/260ms BACK | 0.96 scale, 150–180ms; blur yok |
| `_genislet` 90ms delay+300ms kart görünüşü | 60ms'den geç başlamayan, 180–220ms opacity+Y; gövde yayını bekleyip inputu kilitleme |
| `src/kart.js::sekmeSec` 26px/240ms | 4px/170ms; eski actor transition'larını iptal et |
| `src/kart.js::acildi` 70+i*45ms stagger+280ms | İki sabit grup, ortak 180–220ms bitiş |
| `src/island-gorunumu.js::_bicimle` `YayFizik` response 0.5/0.42, damping 0.78/0.88 | V3 dalında 0.30–0.36 response ve 0.92–0.97 damping; hedef değişiminde hız korunmalı |

## Performans ve debug kapısı

1. Başsız testte 20–40 kez aç/kapat, hızlı çift tık, etkinlik gelirken kart aç/kapat, sekmeler arası hızlı gezin. `destroy` ve geçiş durdurmalarında aktör/sinyal/timeline sızıntısı olmamalı.
2. 0/1/2/5 etkinlik ve 560/720/960 kartta giriş/kapanış görüntüsü al. Eski içerik hayalet gibi kalmamalı, kart kapandıktan sonra görünmez aktör tıklamayı almamalı.
3. İki blur kapalı ve reduced-motion açık/kapalı durumlarını ayrı dene. Testte ilk tıklama→ilk piksel değişimi, 95. yüzdelik kare süresi ve hızlı etkileşimde input gecikmesini kaydet. Eski/yeni aynı makine-oturum-ölçüm koşullarında karşılaştırılmadıysa yüzde iyileşme yazma.
4. GNOME canlı oturumu yeni kodu ancak yeniden girişten sonra alır; kullanıcı oturumu kapatılmadan canlı fare sonucu iddia edilmez. Yayın öncesi erişilebilir odak, TR/EN metin, ipucu ve tüm eski eylemlere erişim ayrıca geçer.
