# FLUGEL ortak mimari planı

## Amaç ve sınır

GNOME dizüstü, ev sunucusu ve kişisel Akış uygulaması arasında hızlı, denetlenebilir geliştirme. Codex ve Claude aynı bulguyu tekrar keşfetmeden çalışmalı; her karar kaynak, zaman damgası, kod değişikliği ve doğrulama ile devredilmeli. Yerel `SERVER_STATE_INDEX.json` ölçülen durumdur; buradaki yol haritası öneri ve niyettir.

## Paylaşılabilir topoloji (2026-10-17)

```text
GNOME PC
 ├─ flugel ana deposu: Island kaynağı, Akış ve sunucu betikleri
 ├─ flugel-island ayrı deposu: yayınlanan Island kopyası
 └─ SSH / LAN / Tailscale ───────────→ ev sunucusu
                                     ├─ Docker: Akış, gündem, ana sayfa ve başka servisler
                                     ├─ Ollama ve libvirt VM'leri
                                     └─ veri diskleri ve izleme araçları
```

Akış uygulaması: `sunucu/panel/akis/akis.py` Python HTTP/API ve arka plan veri işlemleri; `web/` PWA arayüzü. Docker canlı dosyaları `/opt/stacks/panel/akis/` üzerinden bağlıyor. 17 Ekim'de üç temel dosya checksum'ı eşleşti ve `/` HTTP 200 döndü. Island: GNOME/GJS uzantısı, veri okuması `pc/bin/ust-panel-veri`; sunucu anlık verisi `sunucu/sbin/island-veri.py` ile üretiliyor. Büyük GNOME aktör güncellemelerini veri döngüsünden ayırın; `CLAUDE.md` tasarım kuralları geçerlidir.

## Mimari hedefler

1. **Island kaynağını koruma.** Asıl geliştirme ana depoda, ayrı depo yayın kopyasıdır. Her senkronizasyon öncesi iki çalışma ağacının ve diff'in durumunu denetle; otomatik kopyalama başka ajanın değişikliğini ezmemeli.
2. **Kanıtlı devir.** Her görev için sahip, etkilenen yollar, commit, diff/test, canlı dağıtım ve sonraki adım tutulur. Eksik Claude geçmişi uydurulmaz.
3. **Tekrarlanabilir envanter.** `refresh_state.py` güvenli ve sınırlı veri toplar; JSON'a zaman damgası ve bağlantı tazeliği ekler. İleride geçmiş karşılaştırması, alarm eşikleri ve makine okunur şema eklenebilir.
4. **Ayrık çalışma ve dağıtım.** Ajanlar ayrı branch/worktree üzerinde değişiklik hazırlar, lint/test ve gözden geçirme sonrası canlı sisteme uygulanır. Sunucuda deployment dosya eşitliği, sağlık kontrolü ve geri dönüş yolu ile doğrulanır.
5. **Kaynak ve yüzey denetimi.** Yerel envanterde yüksek disk doluluğu ve tüm arayüzlerde dinleyen servisler görüldü. Disk büyümesi, yedek geri yükleme denemesi, gerekli portların LAN/Tailnet/public ayrımı ve mevcut güvenlik duvarı gerçek durumu öncelikle incelenir. Bind adresi tek başına İnternet erişimi kanıtı değildir.

## Altyapı hazırlık sırası

| Aşama | Somut çıktı | Geçiş koşulu |
| --- | --- | --- |
| Envanter | Yerel JSON ve kaynak dosya haritası | SSH verisi taze, hata alanları incelendi |
| Koruma | Port/servis sahipliği matrisi, depolama büyüme raporu, yedek geri dönüş denemesi | Yanlış kesinti veya veri kaybı riski anlaşılmış |
| Geliştirme | Ayrı çalışma dalları, lint/birim/başsız GNOME test komutları | Mevcut testler ve süreler biliniyor |
| Dağıtım | Akış için kaynak→sunucu checksum, health endpoint, rollback reçetesi; Island için oturum testi | Canlı sürüm kaydı ve geri dönüş var |
| Otomasyon | CI kuralları, seçilmiş alarm ve ölçüm eşikleri | Mevcut Netdata/Uptime Kuma/Watchers ile çakışmıyor |

Yeni konteyner veya eklenti kurulumu tasarımdan sonra seçilmeli. Şu anda Netdata, Uptime Kuma, Portainer ve çok sayıda watcher zaten çalışıyor; benzer işi yapan ikinci bir yığın kurmadan önce bunların mevcut kapsamını ölçün. `n8n`, `gotify`, `ai-sandbox` compose dosyaları bulundu, ancak çalışır durumda oldukları doğrulanmadı.

## Doğrulanmamış alanlar

Claude 2026-10-17'de Island depolarını eşitledi ve push etti; sonraki aktif görevi bilinmiyor. Sunucudaki tüm compose yapılandırmalarının kaynak depoyla eşitliği, güvenlik duvarının dış erişim politikası ve yedeklerden gerçek geri yükleme sonucu ayrıca denetlenmeli. Yerel JSON'daki dinleyici listesi bir güvenlik duvarı taraması değildir.
