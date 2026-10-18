# FLUGEL Island v3 — Quiet Orbit

Durum: Codex görsel tasarım devri, 2026-10-18. Uygulama sahibi Claude. `mockup.html` bu belgenin statik görsel karşılığıdır; GNOME kodu değildir. Önceki `Monochrome Contour` ve `menu-v2` taslaklarından bağımsız yeni tasarım seçeneğidir. Kullanıcı verisi, ayarlar ve on mevcut sayfa silinmez.

## Karakter

Tek, mat, neredeyse siyah bir kapsül; açık kartta aynı dilin üç düzeyi. Renk yalnız gerçek durum/uyarı için. Süs amaçlı cam, blur, parlama, ağır gölge, dönen animasyon ve Apple markası/logosu yok. Amaç “daha çok efekt” değil; sık kullanılan eylemin bir bakışta bulunması ve giriş gecikmesinin hissedilmemesi.

## Görsel tokenlar (GNOME mantıksal px)

| Token | Değer | İşlev |
| --- | --- | --- |
| `shell` | `#08090b` | Kapsül ve dış kart |
| `surface` | `#14161a` | İç kart ve sayfa yüzeyi |
| `raised` | `#202329` | Seçim/eylem yüzeyi |
| `hover` | `#2b3037` | İmleç/aktif yüzey |
| `hairline` | `rgba(255,255,255,.11)` | Tek 1px ayraç |
| `focus` | `rgba(255,255,255,.70)` | 2px iç odak halkası |
| `primary` | `#f5f6f7` | Ana içerik |
| `secondary` | `#a7abb2` | Yardımcı içerik |
| `tertiary` | `#818790` | Meta veri; tek bilgi kaynağı olamaz |
| `positive/warning/critical` | Mevcut semantik renkler | Gerçek durum dışında kullanılmaz |

Sistem yazı tipi korunur. Kapsül saat 12pt/700 tabular, kompakt etkinlik 10.5pt/650, kart saat 24pt/750, bölüm başlığı 10pt/700, içerik 10–11pt. Boşluk ölçeği 4/8/12/16/24; kart dış iç boşluğu 16; küçük yüzey radius 10, karo 14, kart 24; kapsül radius yüksekliğinin yarısı. İkonlar 24×24 SVG viewBox, 1.8 stroke, yuvarlak uç/köşe, tek renk `currentColor`, fill yok; etkinlik kapakları veri olduğu için istisna. Etkileşim hedefi en az 36×36.

## Durumlar ve kompozisyon

1. **Dinlenme:** 176–220×32 örnek; mevcut kodun minimum genişlik sınırına uyar. Sol 6px sağlık noktası sadece gerçek uyarı/bağlantı durumu için; normalde görünmez. Saat merkezde, sağda tek kısa değer (pil veya sunucu). Boş dekor ve sürekli hareket yok.
2. **Canlı:** kapsül 240–360×32 örnek; mevcut genişlik sınırları geçerli. Solda 20px kapak/ikon, tek satır başlık, sağda zaman/durum; ikincil satır ancak mevcut yükseklik izin veriyorsa. Metin uzarsa önce ikincil bilgi, sonra başlık elips olur; kapsül sürekli genişleyip daralmaz.
3. **Bölünmüş:** ana kapsül ve 8px aralıklı 36px balon; balonun rolü ikincil durum, ana kapsülle kontrast yarışı yok. Kritik durum dışında renk kullanılmaz.
4. **Açık kart:** varsayılan 720px, destekli 560–960px, yükseklik ekranın %86 sınırını aşmaz. Başlıkta solda saat/tarih/hava; sağda 3 temel eylem + taşma menüsü. Canlı alan en çok iki satır; geri kalanı `+N daha` ile ayrı kaydırılabilir liste. Bunun altında beş etiketli gezinme ve tek içerik yüzeyi. Kısa ekranlarda üst başlık/sekme sabit kalır, yalnız içerik kayar.

## Beş grup, on sayfa: kayıpsız harita

| Üst grup | İç seçimler (mevcut ID) | İlk açılan |
| --- | --- | --- |
| Ana | `hizli`, `kisayol` | `hizli` |
| Sistem | `sistem`, `vm` | `sistem` |
| İçerik | `akis`, `anime`, `oyun` | `akis` |
| Takip | `basket`, `kripto` | `basket` |
| Bildirim | `bildirim` | `bildirim` |

Grup sekmesi ikon + kısa etiket içerir; seçili grup `raised` dolu yüzeydir. İç seçimler yalnız seçili grupta görünür. Mevcut `sekmeSec(id)`, `son-sekme`, provider `sekmeAc(id)`, rozetler ve klavye davranışı eski sayfa ID'leriyle kalır. Kritik rozet grup düzeyinde de görünür. On sayfanın her birine en fazla iki seçimle ulaşılır. 560px kartta beş grup hâlâ görünür; metin gerektiğinde kısalır, ipucu ve erişilebilir ad tam kalır. İkinci seviyeye yeni ağ/veri yenileme döngüsü eklenmez.

`Hızlı` ilk görünüm: ses + parlaklık iki kompakt satır, dört günlük anahtar, dört sabit uygulama ve dört araç. `Tümü` mevcut kalan denetimleri, 12 aracı, uygulama eklemeyi, alt panelleri ve riskli eylemleri açık isimleriyle gösterir. Bu yeniden düzenleme hiçbir yetenek veya kullanıcı sabitini silmez. Panik/zorla kapatma gibi eylemler `Tümü > Araçlar` altında, mevcut onay/korumalarıyla kalır.

## Hareket ve geri dönüş

| Geçiş | Süre | Kurgu |
| --- | --- | --- |
| Hover/odak | 120ms | Yalnız yüzey/kenar/opaklık; odak halkası anında |
| Kapsül → kart | 210–230ms | Mevcut yay geometrisi; damping yüksek, overshoot yok; içerik en çok 6px Y + opacity |
| Kart → kapsül | ≤180ms | İçerik opacity, geometri yay; kapanış açılıştan yavaş değil |
| Grup/iç sayfa | 150–180ms | Kısa opacity + en çok 4px Y; veri/actor yeniden kurulumu animasyon ortasında yok |
| Canlı etkinlik değişimi | ≤180ms | Yalnız değişen satır; tüm kartı tekrar çizme |
| Azaltılmış animasyon | 0–80ms | Blur, scale, stagger ve yay taşması yok |

`cam-efekti` ve `bulanik-gecis` yeni `v3` seçeneğinde kapalı varsayılanla gelmeli; mevcut kullanıcının kayıtlı seçimini sessizce ezme. Efekt açıkken geçmişte fare takılması gözlendi; canlı A/B ancak yeni kod oturuma yüklendikten sonra yapılır. CSS filter/backdrop-filter, büyük shadow ve sürekli frame callback eklenmez. GSettings `tasarim` anahtarına `v3` eklenirken mevcut `atoll`/`klasik` değerleri ve geri dönüş korunur.

## İkon teslimi

Bu klasördeki `ikon/*-mono.svg` beş grup için özgün set: `ana`, `sistem`, `icerik`, `takip`, `bildirim`. `daha` taşma/ek liste simgesidir. Claude bunları Island kaynak `ikon/` dizinine kopyalayıp grup ID'leriyle eşler; mevcut sayfa ve eylem simgelerini kaldırmaz. Her ikonun ipucu ve erişilebilir adı çevrilmiş tam etikettir. Yeni görünen metinlerin tümü `_()` ve TR/EN kataloglarına girer.

## Claude uygulama ve kabul kapısı

Önce yeni `v3` tasarımını ayrı seçim olarak ekle; eski iki görünümü değiştirme. Sonra kapsül/kart yüzeyleri, beş grup kabuğu, iki satır canlı alan ve Hızlı/Tümü düzeni, son olarak ikon/çeviri. Test matrisinde 0/1/2/5 canlı etkinlik, 560/720/960 kart, 1366×768 ve 2560×1600 ekran, TR/EN uzun metin, klavye/odak/ipucu, azaltılmış animasyon, iki blur kapalı, mevcut kullanıcı ayarından v3'e/geri dönüş var. ESLint, birim, çeviri ve başsız GNOME testi iki depoda geçmeli. Ekran görüntülerini Codex'e görsel inceleme için gönder; canlı akıcılık kullanıcı oturumu yenilemeden doğrulanmış sayılmaz. Ölçülmeyen FPS veya yüzde kazanç iddia edilmez.
