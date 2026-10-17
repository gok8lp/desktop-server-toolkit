# Ev sunucusu (flugelserver)

Sunucunun yapılandırması: Docker yığınları, sistem servisleri, betikler, Cloudflare tüneli, sanal makineler.
Gizli ve kişisel bilgiler depoya girmeden önce `temizle.py` ile çıkarılır:

- Şifre/token/anahtar değerleri `${DEGISKEN}` yer tutucusu olur; gerçekleri sunucuda ilgili yığının `.env`
  dosyasındadır. Hangi değişkenin nerede kullanıldığı: `env.ornek`.
- IP adresleri `<IP>`, alan adı `<alan-adı>`, tailnet `<tailnet>`, e-postalar `<e-posta>` olur.
- `.env` dosyaları, Cloudflare kimlik dosyaları ve veri klasörleri hiç alınmaz.

Bu yüzden buradaki dosyalar doğrudan kopyalanıp çalıştırılmamalı; canlı kopya sunucudadır.

| Klasör | İçerik |
| --- | --- |
| `yiginlar/` | `/opt/stacks/*` compose dosyaları (Immich, Nextcloud, Jellyfin, Guacamole, Webtop, Kasm…), giriş sayfası, masaüstü anahtarı |
| `panel/` | Homepage paneli, FLUGEL Akış, gündem botu |
| `basket-bot/` | basketbol hakem ve anime takip botları |
| `systemd/` | sunucuya özel servis, zamanlayıcı ve yol birimleri |
| `bin/`, `sbin/`, `lib/` | bildirim, izleme, yedek, güvenlik duvarı, Island veri betikleri |
| `bakim/` | bakım yardımcıları (sanal makinede root komutu, şifre koyma betikleri) |
| `scripts/` | Gmail bildirici |
| `cloudflared/` | yerel tünel giriş kuralları |
| `libvirt/` | GPU geçirme kancası ve sanal makine tanımları (`vm/`) |
| `vm/mullvad-ts/` | geliştirme masaüstü sanal makinesindeki oturum ve boşta kapatma betikleri |

Güncelleme: depo kökünde `./guncelle.sh "açıklama"` (sunucu kısmı `sunucu/topla.sh`).
