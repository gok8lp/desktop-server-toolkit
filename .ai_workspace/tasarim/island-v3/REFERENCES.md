# Açık kaynak örneklerden uyarlama notları

Kullanıcı 2026-10-18'de [dynamic-island-windows koleksiyonunu](https://github.com/topics/dynamic-island-windows) örnek gösterdi. Bu not yalnız davranış/ürün fikri araştırmasıdır; hiçbir üçüncü taraf kod, SVG, marka, ekran görüntüsü veya lisanslı görsel varlık alınmadı. FLUGEL GNOME Shell uzantısı olarak kalır; Windows/Tauri görev çubuğu kodu taşınmaz.

| Kaynak | Gözlenen fikir | FLUGEL v3 uyarlaması | Dışarıda bırakılan |
| --- | --- | --- | --- |
| [Nectar](https://github.com/kua8/Nectar) | Reaktif notch, müzik/hızlı kontroller, durum takibi ve fiziksel genişlik/yükseklik hareketi; boşta kaynak işlerinin durması | Mevcut `YayFizik` hız koruyan geometriyi daha yüksek sönümle kullan; v3 kompakt→kart hareketi tek gövdeden gelsin. Boşta gereksiz görünüm yenileme olmasın. | Dock/görev çubuğu ikamesi, canlı ses spektrumu, Windows kabuğu kancaları |
| [PILLAR](https://github.com/warpirate/pillar-dynamic-island-for-windows) | Hover ile kısa bakış, tıkla genişlet, medya/bildirim/sistem özeti; klavye ve azaltılmış hareket desteği | V3'te tıkla kart + mevcut kompakt bağlamsal bilgi. Yeni geometri gerektiren ayrı “Quick Peek” yalnız isteğe bağlı v3.1 adayı; fare gecikmesi testi sonrası. | Yeni AI asistanı, ağ servisi, telemetri veya otomatik polling |
| [Quick Pill](https://github.com/nabil24024004/Quick-Pill-Dynamic-Island-for-Windows) | Dinlenme / hover hızlı / tıkla geniş görünüm ve sabit hızlı uygulamalar | V3'te dinlenme/canlı/kart durumları; mevcut kullanıcı sabit uygulamalarını Hızlı'nın ilk görünümünde dört yuvada göster, `Tümü` hepsine eriştir. Quick Peek geometri değişimi v3.1'e ertelenir. | 15 sekme ve 60 FPS batarya/ses görselleştiricileri; eski özellikleri çoğaltan yeni sekme |
| [IsleBar](https://github.com/ds3owl/islebar) | “Çalışıyor / sana ihtiyaç var / bitti” gibi okunur durum mikro-metni | FLUGEL'in zaten aldığı sunucu/VM/bildirim durumlarında ikon+tek kısa metin hiyerarşisi; gerçek olay varsa balonda kısa durum. | Claude/Codex CLI başlatıcısı veya ajan durumu toplama; bu ayrı güvenlik/ürün işi |

## Tasarımda görünür benzerlik, özgün uygulama

1. **V3'te mevcut geometri:** Dinlenme 32px kapsül → bağlamsal canlı kapsül → tıklamayla tam kart. Hover rengi/odak tepkisi kalır; ayrı genişlik/yükseklikli “Kısa Bakış” yalnız v3.1 deneyi olarak prototipte tutulur. Fare üstünde dolaşırken tekrarlanan genişlet/küçült animasyonu başlatılmaz.
2. **Bağlamsal kompakt içerik:** Medya oynuyorsa kapak, kısa başlık, süre; bildirim gelirse en öncelikli kısa metin ve sayaç; sistem uyarısında semantik renk/ikon. Saat ve kapsül çerçevesi içerik değişiminde yerinde kalır. Aynı anda birkaç olay geldiğinde görünüm zıplamaz; mevcut provider öncelik sırası korunur.
3. **Kartta görev odaklı gezinti:** Beş grup altında on eski sayfa. Üstte hızlı anlaşılan ikon+etiket; `+N daha` yalnız gerçek gizli etkinlik sayısı. Çok bilgi ilk kareye yığılmaz.
4. **Çekimser görsellik:** Kaynak örneklerdeki parlak cam, yüksek frekanslı ses çizimi ve ağır hover blur yerine opak yüzey, net beyaz/ikincil gri, geçici 4–6px hareket. Bu karar kullanıcının fare takılması A/B bulgusuna dayanır; performans iddiası ancak canlı ölçümle yapılır.

Claude için uygulama sırası: Önce `MOTION.md` ile mevcut kapsül/kart geçişleri ve kaynak kullanımı; ardından medya/bildirim kompakt düzeni, beş grup, ikonlar. Yeni Quick Peek geometri durumunu ilk yayına katma. Özellik ekleme gerektiren fikirler ayrı görev olarak önerilsin. GNOME'a özgü erişilebilirlik, TR/EN ve mevcut kullanıcı ayarı dönüşü korunur.
