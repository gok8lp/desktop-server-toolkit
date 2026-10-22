# Masaüstü ve Sunucu Araçları

Gökalp Göksu'nun Linux masaüstü ve ev sunucusu için geliştirdiği kişisel araçlar.
[English](README.md) · Türkçe

Bu depo tek bir uygulamadan oluşmuyor. Haber akışı, GNOME eklentileri, sunucu yapılandırmaları ve bakım betikleri aynı yerde tutuluyor.
Hazır bir işletim sistemi veya herkesin doğrudan çalıştırabileceği otomatik kurulum paketi değildir.

## Nereden başlamalıyım?

| İhtiyacın | İlgili bölüm |
| --- | --- |
| Haberleri tek yerde okumak | `sunucu/panel/akis/`: Python arka uç ve web/PWA arayüzü |
| GNOME kapsül/panel eklentisi | [gnome-island](https://github.com/gok8lp/gnome-island); asıl kaynak burada `extensions/flugel-island@flugel/` |
| Sunucunun yapılandırmalarını incelemek | `sunucu/` ve [home-server](https://github.com/gok8lp/home-server) |
| Sunucuyu Android'den izlemek | [home-server-android](https://github.com/gok8lp/home-server-android) |
| Masaüstü veri yardımcıları | `pc/bin/` |

Akış; RSS/YouTube içerikleri, isteğe bağlı Ollama çeviri/özetleri ve kişisel kaynak listeleri kullanır.
Kaynaklar, hesap bağlantıları ve sunucu adresleri kendi ortamına göre yapılandırılmalıdır.
GNOME bileşenleri Shell 50 hedefler; diğer sürümler için uyumluluk iddiası yoktur.

## Kaynak kod üzerinde çalışma

```bash
git clone https://github.com/gok8lp/desktop-server-toolkit.git
cd desktop-server-toolkit
npm ci
npm run lint
npm test
```

Bu komutlar yalnız JavaScript denetimlerini çalıştırır. Eklentiyi kurmaz, sunucuda servis başlatmaz.
`kur-*.sh` ve `guncelle.sh` kişisel makine yolları ve kurulum adımları içerir; genel kurulum sihirbazı gibi çalıştırılmamalıdır.
Akış için önce `sunucu/panel/compose.yaml` ve `sunucu/panel/akis/akis.py` dosyalarını incele.

## İsimler ve uyumluluk

Eski eklenti UUID'si, ayar şemaları ve servis adları mevcut kurulumların ayarlarını kaybetmemesi için teknik kimlik olarak korunur.
Depo adı ve kullanıcıya sunulan proje başlıkları bunlardan ayrıdır.
Üçüncü taraf bileşenlerin lisans ve atıfları kendi dosyalarında korunmuştur.
