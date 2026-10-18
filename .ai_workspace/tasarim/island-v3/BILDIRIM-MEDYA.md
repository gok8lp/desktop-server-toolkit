# Quiet Orbit — Bildirim ve medya tasarımı

Amaç, bildirim ve müziği v3'ün sakin hiyerarşisine taşımaktır. Mevcut eylemler korunur; blur, ağır gölge, kapak renginden üretilen hareketli yüzey ve boşta sürekli animasyon eklenmez. Görsel referans `bildirim-medya-mockup.html` dosyasındadır.

## 1. Bildirim afişi — kompakt kapsül

### Düzen

- Afiş, kapsülün mevcut genişleme geometrisini kullanır; yeni bir ada durumu oluşturmaz.
- Sol 28px alan: uygulama simgesi 20px, mat `raised` yüzey içinde 8px yarıçap.
- Orta alan iki katmanlıdır: üstte uygulama adı 10px/700 ve sağında “şimdi”; altta başlık tek satır 12px/700, metin tek satır 10px/400.
- Uzun başlık ve metin ayrı ayrı son üç noktayla kısalır. Saat, kapat ve eylem hedefleri metni ezmez.
- Kritik olmayan bildirimde vurgu yalnız uygulama simgesi ve soldaki 2px durum çizgisidir. Kritik uyarı sıcak kırmızı değil, okunabilir amber çizgi kullanır; renk tek başına anlam taşımaz.
- Sol tık mevcut açma eylemini, sağ tık mevcut kapatmayı korur. Klavye odağında Enter açar, Escape kapatır. Hedef yüksekliği en az 44px.

### Hareket

- Giriş: kapsül geometrisi mevcut v3 yayıyla; içerik `opacity 0→255` ve `translation_y 4→0`, 170ms. Scale, blur ve BACK yok.
- Çıkış: içerik 90ms solar; kapsül kendi mevcut hızıyla önceki duruma döner.
- Aynı uygulamadan yeni bildirim gelirse çerçeve yeniden sıçramaz; yalnız metin 120–150ms çapraz solar.
- Reduced-motion altında konum/ölçek animasyonu yok, içerik doğrudan son duruma geçer.

**GNOME maliyeti:** Düşük–orta; mevcut `EtkinlikGorunumu('bildirim')` sınıfının hiyerarşi ve stil düzeni değişir.

**Risk:** Düşük. Çok uzun uygulama adı, simgesiz kaynak, RTL ve art arda bildirim testleri gerekir.

## 2. Bildirim sayfası — son 24 saat

### Bilgi mimarisi

- Başlık satırı: solda “Bildirimler” ve okunmamış sayısı; sağda `Rahatsız etme`, `Hepsini temizle` ve kategori filtresi. Yıkıcı temizleme eylemi metinli ve ikinci onaylıdır.
- Varsayılan gruplama kategoriye göredir: Kritik, Sunucu, Sistem, Medya ve Diğer. Uygulama bazlı görünüm isteğe bağlı ikinci seçimdir; son seçim hatırlanır.
- Her grup başlığı yapışkan değildir; kaydırma sırasında ek yeniden çizim gerekmez. Başlıkta kategori simgesi, ad, okunmamış sayı ve “1 saat sustur” bulunur.
- Satır: 24px simge, uygulama/kategori etiketi, başlık, en fazla iki satır açıklama, zaman; sağda yalnız hover/odakta görünen küçük eylem düğmesi. Satır tek tıkla mevcut hedefi açar.
- Okunmamış vurgusu: solda 3px açık renk çizgi + başlık `primary`; okunmuş satırda çizgi yok, metin `secondary`. Tam yüzey rengiyle büyük vurgu yapılmaz.
- Gruplar boşsa tek sakin boş durum; kategori susturulduysa başlıkta süre ve geri açma eylemi gösterilir.
- GNOME bildirim sağlayıcısından gelen kart öğeleri ve sunucunun son 24 saat verisi aynı görsel satırı kullanır; kaynak etiketi açıkça “Bu bilgisayar” veya “Sunucu” der. Aynı kimlik varsa çift kayıt gösterilmez.

### Eylemler ve erişilebilirlik

- Tek tık mevcut bildirimi açar; taşma eylemi “Okundu”, “1 saat sustur”, “Bu oturumda sustur”, “Temizle” seçeneklerini sunar.
- `Hepsini temizle`, kritik ve henüz açılmamış kayıtları varsayılan olarak korur; onay ekranında kapsam yazılır.
- Klavye sırası: filtreler → grup başlığı eylemleri → satırlar → satır taşması. Her hedef en az 36px ve erişilebilir ada sahip.

**GNOME maliyeti:** Orta–yüksek; iki veri kaynağını ortak görünüm modeline dönüştürme, okunma durumu ve grup eylemleri gerekir.

**Risk:** Orta. Sunucu/GNOME kimlik çakışması, temizleme kapsamı ve kategori susturmanın kritik bildirimleri gizlememesi test edilmelidir.

## 3. Kart içi medya oynatıcı

### Düzen

- 560–760px kartta iki bölge: solda 112px kare kapak, sağda içerik. 560px altı durumda kapak 80px olur; kontroller yine tek satırda kalır.
- Üst satır: oynatıcı adı küçük `tertiary`, sağda çıkış aygıtı düğmesi. Başlık 16px/750 tek satır, sanatçı 11px `secondary` tek satır.
- İlerleme alanı: 4px ray, 8px görsel tutamak yalnız hover/odakta. Altında geçen ve kalan süre. Geçersiz süre varsa tüm zaman alanı gizlenir.
- Ana kontroller ortalı beşli: karıştır, önceki, oynat/duraklat, sonraki, döngü. Oynat düğmesi 44px, diğerleri en az 36px. Seçili karıştır/döngü yüzey + küçük durum noktasıyla belirtilir; yalnız renk kullanılmaz.
- −10/+10 saniye eylemleri ana sırayı kalabalıklaştırmaz: kapak/ilerleme üzerindeki mevcut iki parmak kaydırma korunur, klavyede yön tuşu ipucunda belirtilir.
- Çıkış aygıtı, oynatıcı içinde açılan tek satırlık chip listesi; seçili aygıt checked ve erişilebilir isim taşır.
- Kapaktan renk örneklenmez. Kapak yoksa oyuncu simgesi bulunan `surface` yer tutucu kullanılır. Kapak, dekoratif olduğunda erişilebilirlik ağacına eklenmez.

### Hareket ve performans

- Parça değişiminde yalnız kapak ve metin 150ms opacity ile değişir; yerleşim ve kontroller sabit kalır.
- İlerleme en çok 1Hz güncellenir ve yalnız görünür/mapped oynatıcıda çalışır. Sürükleme sırasında gerçek MPRIS yazımı bırakma anında yapılır.
- Sarma geri bildirimi ray renginin 120ms değişmesidir; pulse, scale veya blur yoktur.

**GNOME maliyeti:** Orta; mevcut `MedyaOynatici` aktörleri yeniden düzenlenir, eylemler ve MPRIS yetenek kontrolleri korunur.

**Risk:** Orta. Dar kart, eksik kapak, uzun CJK/Latin başlık, seek desteklemeyen oynatıcı ve çıkış aygıtı değişimi test edilmelidir.

## 4. Kompakt medya kapsülü

- Sol: 20px kapak; kapak yoksa 18px sembolik simge.
- Orta: başlık tek satır, gerekirse sanatçı yerine başlık öncelikli. Sağ: süre veya küçük oynat/duraklat durumu.
- Alt iç kenar: v3.1'de eklenen 2px ilerleme çizgisi. Sadece geçerli süre/konum varsa ve kapsül görünürken en çok 1Hz güncellenir.
- Eşitleyici kararı: **üç çubuklu sade gösterge kalsın**, ancak yalnız gerçekten çalarken ve reduced-motion kapalıyken 2fps'i aşmayan üç sabit faz arasında geçsin. Duraklatmada üç çubuk tek düşük seviyede sabitlenir; reduced-motion açıkken animasyon yoktur. Beş veya daha çok çubuk, rastgele kare animasyonu ve her-frame callback kullanılmaz.

**GNOME maliyeti:** Düşük; mevcut kompakt medya görünümü ve eşitleyici zamanlaması sadeleşir.

**Risk:** Düşük–orta. Zamanlayıcının kapsül gizlenince/destroy sırasında kesin durması gerekir; CPU ve sinyal sızıntısı stres testine dahil edilir.

## 5. Bölünmüş medya görünümü

- Ana kapsül başlık + ilerleme bilgisini taşır; sağ balon yalnız tek bağlamsal alan gösterir: kapak ve oynat/duraklat veya çıkış aygıtı. İki tarafta aynı metin tekrarlanmaz.
- Balon 0.96→1 scale + opacity ile en fazla 170ms açılır; blur yoktur. Ana kapsül geometri animasyonuyla aynı anda ikinci bir yay başlatılmaz.
- Balon kapandığında actor input almaz; pin, tam ekran ve hızlı parça değişimi test edilir.

**GNOME maliyeti:** Orta; mevcut balon görünümüne v3 dalı ve içerik paylaşımı gerekir.

**Risk:** Orta. İki görünümün aynı MPRIS sinyallerine ayrı ayrı bağlanması önlenmeli; tek model, iki pasif görünüm kullanılmalıdır.

## Uygulama sırası ve yayın kapısı

1. Kompakt medya + kart içi medya.
2. Bildirim afişi.
3. Bildirim sayfası ve ortak veri görünümü.
4. Bölünmüş görünüm.

Yayın öncesi: 560/720/960 genişlik, uzun TR/EN başlık, kapaksız medya, seek olmayan oynatıcı, art arda 20 bildirim, aynı kaynaktan güncelleme, reduced-motion, klavye odağı ve 40 aç/kapat döngüsü. Her zamanlayıcı/sinyal `destroy` ve görünmez durumda bırakılmamalıdır.
