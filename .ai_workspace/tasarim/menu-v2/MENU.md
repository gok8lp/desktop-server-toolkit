# Island kart menüsü v2 — bilgi mimarisi taslağı (AI-016)

2026-10-17. Bu paket yalnız tasarım kararı ve [üç statik maket](mockup.html) içerir; GNOME kaynak kodu, ayar şeması ve canlı oturum değiştirilmedi. AI-010'un Monochrome Contour tokenları kullanılır: `ink`, `card`, `raised`, `line`, `text`, `muted`; opak yüzey, blur ve büyük gölge yok. Ölçüler mantıksal px. Varsayılan kart 720, desteklenen aralık 560–960; yükseklik monitörün %86'sını aşmamalı.

## Gerçek sorun ve sınır

- `src/kart.js::canliGuncelle` tüm kalıcı ve `data.kartta` ortam etkinliklerini başlığın altına sınırsız ekliyor. Beş adet 44–52 px satır, sekmeler ve sayfa içeriği başlamadan yaklaşık 250 px yer tüketebilir. Bazı etkinlikler medya denetimi gibi daha yüksek olabilir.
- `extension.js` on görünür sayfa kuruyor: Hızlı, Kısayollar, Sistem, Sanal makineler, Kripto ve döviz, Maçlar, Anime ve manga, Oyunlar, Akış, Bildirimler. `kart.js` bunları yalnız 18 px simgeyle gösteriyor; `accessible_name` ve ipucu var ama ilk bakışta ayrım zor. Rozetli sekmeler kaybolmamalı.
- `src/sayfalar/hizli.js` tek kaydırmada ses/parlaklık, yedi civarı sistem anahtarı, sabit uygulamalar/ekleme ve 12 araç gösteriyor. `sabit-uygulamalar` zaten ayarlanabilir; araç sırası/görünürlüğü için mevcut bir ayar doğrulanmadı. Aşağıdaki araç kişiselleştirmesi **yeni özellik önerisidir**, varmış gibi sunulmaz.
- Saat/tarih, hava, üst eylemler, güç alt paneli ve tepsi var. Bunları kaldırmak kapsam dışı; yeni gezinme, mevcut `sekmeSec` ve son-sekme davranışının üstünde düşünülebilir. GNOME/GJS kaynakları Claude'un görevidir.

## Ortak kurallar — her alternatifte

1. Başlık altında en çok **iki** canlı satır göster. Üçüncü ve sonrası `+N daha` düğmesine gider. Öncelik: kritik uyarı > kullanıcı etkileşimli etkinlik > durum; yalnız dizi sırasına güvenme. İki satırdan biri büyük medya oynatıcıysa iki satırın toplam yüksekliğini sınırla veya ikinciyi özetle. `+N` görünümü açılınca etkinlikler kendi kaydırma alanında; kartın ana sayfa alanını tüketmez. `+N` sayısı gizlenen gerçek öğeleri gösterir. Klavyeyle açılır/kapanır, kapatınca odak düğmeye döner. Yeni bildirimler `+N` alanı kapalıyken yalnız sayaç/öncelik değiştirir, kartı sürekli yeniden kurmaz.
2. Grup etiketleri Türkçe/İngilizce kısa: Ana/Home, Sistem/System, İçerik/Content, Takip/Tracking, Bildirim/Alerts. Açıklayıcı ipucu, erişilebilir ad ve klavye odağı zorunlu; 36×36 px asgari hedef. Etkinlik/uyarı gerçek rengi hariç seçili grup nötr `raised` olur. Uzun İngilizce/Türkçe etiket 560 px'de elips + ipucu; tüm gruplar görünür kalmalı.
3. Hızlı başlangıçta en çok dört günlük kontrol, dört sabit uygulama, dört sık araç gösterir. `Tümü` içerik alanında geri dönüşü olan liste açar. Kullanıcı seçim yapana dek hiçbir mevcut araç kaybolmaz. Zorla kapat/panik/geri al gibi riskli eylemler `Tümü > Araçlar` altında açık isim ve mevcut korumalarıyla kalır; ana ekrana otomatik önerilmez. Ses/parlaklık iki kompakt satırdan fazla yer tutmaz.
4. Kart için yeni blur, sürekli animasyon, actor yeniden kurma veya veri çekme döngüsü ekleme. Seçim geçişi AI-010'un ≤220 ms opaklık/çeviri bütçesine ve azaltılmış animasyona uyar. Kullanıcının `cam-efekti`/`bulanik-gecis` tercihlerini değiştirme.

## Alternatifler

| | A — Dengeli beş grup (öneri) | B — Dört görev alanı | C — Kişisel beş yuva |
| --- | --- | --- | --- |
| Üst gezinme | Ana, Sistem, İçerik, Takip, Bildirim | Bugün, Kontrol, Keşfet, Araçlar | Dört kullanıcı yuvası + sabit Tümü |
| Eski sayfalar | Ana=Hızlı+Kısayollar; Sistem=Sistem+VM; İçerik=Akış+Oyun+Anime; Takip=Maçlar+Kripto; Bildirim=Bildirimler | Bugün=canlı+Bildirimler; Kontrol=Hızlı+Sistem+VM; Keşfet=Akış+Oyun+Anime+Maçlar+Kripto; Araçlar=Kısayollar+Hızlı araçları | Kullanıcı dört eski sayfayı öne sabitler; Tümü on sayfayı kategorili listeler |
| İç gezinme | Her grupta kısa etiketli ikincil seçim; son alt sayfa hatırlanır | Bölüm başlıkları + birincil içerik; bazı alanlarda daha derin seçim | Hızlı erişim iyi, Tümü içinde eski on sayfa kalır |
| Artı | Mevcut on sayfayı kayıpsız ve öngörülebilir indirger; rozetler grup toplamında görünür | Az üst sekme; “şimdi ne yapmak istiyorum?” zihinsel modeli | Yoğun kullanıcı kendi rutinine uyarlar |
| Eksi | Bir iç seviye eklenir; grup rozetleri için toplama gerekir | “Keşfet” çok kalabalık; Bugün canlı başlıkla tekrara düşebilir | Varsayılan/ayar/taşıma maliyeti en yüksek, ilk açılışta keşif zor |
| Kod/riske etkisi | Orta: grup kabuğu ve eski sayfaların sarmalanması | Yüksek: sayfa içeriklerini yeniden dilimleme | Yüksek: şema, tercih taşıma ve sıralama UI'sı |

### Önerilen A düzeni

Başlık → en çok iki canlı satır / `+N daha` → beş etiketli grup → seçili grupta kısa ikincil seçim → tek kaydırmalı içerik. `Ana` açılış durumu: iki ses/parlaklık denetimi, dört günlük anahtar, dört sabit uygulama, dört seçili araç; `Tümü` geri kalanları açar. Mevcut kullanıcı sabit uygulamaları korunur; ilk sürümde araçların sırası sabit olabilir, kişiselleştirme ayrı küçük aşamada eklenir. Bildirimler grup olarak görünür ve rozeti saklanmaz. Kritik canlı uyarı, `+N` altında gizlense bile önde uyarı özeti/sayaçla görünür.

## Claude için uygulama sırası

1. **Ölçüm ve test iskeleti:** 0/1/2/5 etkinlik ve 560/720/960 kart için ekran görüntüsü; kart yüksekliği, ana içeriğin görünür ilk satırı ve fare akıcılığını kaydet. Gizli canlı etkinliklerin sıra/öncelik kuralını saf fonksiyon + testle tanımla. Mevcut yüksek öncelikli uyarı/medya aksiyonlarını koru.
2. **Canlı alan bütçesi:** `kart.js` canlı başlığını iki satıra sınırla; `+N daha` kendi kaydırma alanında tüm öğeleri sunar. Kimlik bazlı `Map` yaşam döngüsünü koru; gizlenen öğe için gereksiz aktör/render maliyeti oluşturma. `+N` açıkken yeni etkinlik ve kapanış odak davranışını test et.
3. **Grup kabuğu:** `extension.js` on eski sayfa kimliğini koruyarak A haritasını ekle. `kart.js` üstte beş etiketli grup, altta grup içi eski sayfa seçimleri sunar; mevcut `son-sekme`, provider `sekmeAc(id)` ve rozet davranışlarını göç ettir. Erişilebilir ad/ipucu ve TR/EN `_(...)` yeni metinlerde zorunlu. Eski seçili sayfa açılışta doğru gruba düşmeli.
4. **Ana'yı kısalt:** `hizli.js` ilk ekranda kompakt denetimler ve kullanıcı için açık `Tümü` bölümü; mevcut 12 araç, uygulama ekleme, Wi‑Fi/Bluetooth alt panelleri ve riskli eylemler kayıpsız. Araç seçimi için yeni GSettings gerekiyorsa varsayılan/migrasyonla ayrı commit yap; ilk geçişte zorunlu değil.
5. **Doğrulama:** iki Island deposunu eşitle; çeviri kontrolü, lint, birim testleri, başsız GNOME görsel testi. 1366×768, 560/720/960, TR/EN, klavye, ekran okuyucu adları, azaltılmış animasyon ve çok etkinlik durumları. Canlı fare A/B ancak oturum yenilendikten sonra. Push/etiket kararı kullanıcıya ait.

## Kabul ölçütü

On eski sayfanın her birine en fazla iki seçimle ulaşılır; kritik bildirim ve rozet kaybolmaz; beş etkinlik geldiğinde kart ana içeriği hâlâ görünür; Hızlı'nın ilk görünümünde kaydırmadan günlük eylemler bulunur; `Tümü` hiçbir aracı silmez. Tasarım iki blur kapalıyken eksiksiz görünür. Performans yüzdesi ancak aynı oturum ve ölçüm koşulunda doğrulanır; bu maket hızlanma iddiası değildir.
