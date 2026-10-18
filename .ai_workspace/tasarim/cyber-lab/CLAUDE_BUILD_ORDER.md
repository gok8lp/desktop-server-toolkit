# Claude uygulama sırası

## Faz 0 — Keşif ve çakışma önleme

1. Island yayın kapıları bitmeden yeni deploy başlatma.
2. Yeni repo yolu `/home/flugel/Projects/flugel-cyber-lab`; varlık kontrolü yap, mevcutsa ezme.
3. `weekly-task` ve `weekly-tasks` dizinlerini okuma, değiştirme, test veya Git kapsamına alma.
4. Sunucuda read-only kapasite/port incelemesi yap; secret değerlerini log/devir dosyasına yazma.
5. Kullanıcı onayı olmadan GitHub repo, push, Cloudflare route veya sunucu deploy yapma.

## Faz 1 — Güvenli iskelet

- Monorepo: `apps/web`, `apps/api`, `runner`, `content`, `labs`, `tests`, `docs`.
- Docker Compose yalnız dashboard/api/db; kasıtlı zafiyetli hedefler ayrı profile ve `internal:true` ağda.
- Security policy testi: privileged, host network, docker.sock ve geniş host mount varsa CI başarısız.
- İlk migration, tek kullanıcı bootstrap, health endpoint.

Teslim kanıtı: compose config, API unit test, frontend smoke, security linter.

## Faz 2 — İçerik ve puan motoru

- YAML/Markdown loader; prerequisite doğrulama ve döngü tespiti.
- Session/attempt/progress/hint/XP modelleri.
- Oturum bazlı HMAC flag; tekrar kullanım testi.
- Türkçe temel içerik ve İngilizce terim sözlüğü.

Teslim kanıtı: 12 ders seed edilir, progress ve aralıklı tekrar testleri geçer.

## Faz 3 — Runner

- Host systemd servisi veya eşdeğer dar broker; yalnız manifest allowlist slug kabul eder.
- Shell string yok; argv; container label ve timeout kontrolü.
- Kapasite eşiği; start/reset/stop; yetim temizleyici yalnız managed label.
- Web/API Docker socket görmez.

Teslim kanıtı: 20 start/reset/stop döngüsü, sıfır yetim kaynak; scope guard dış hedefi reddeder.

## Faz 4 — İlk dört challenge

1. scope-guard
2. linux-permission-leak
3. http-info-leak
4. auth-log-hunt

Her biri için lesson, attack, defense, verifier, üç kademeli ipucu ve çözüm sonrası rapor.

## Faz 5 — C/C++ yolu

- Attacker image: gcc/g++/gdb/objdump/strings/ASan; internet yok.
- `c-stack-boundary`, `c-format-string`, `cpp-raii-leak`.
- Toy binary dışında hedef yok; exploit çıktısı lab dışı adres kabul etmez.
- Savunma verifier'ı hem açığı kapatır hem normal davranışı korur.

## Faz 6 — UI ve erişilebilirlik

- Dashboard, yol haritası, challenge üç paneli, rapor ve tekrar ekranı.
- Terminal tokenı kısa ömürlü; iframe CSP dar.
- 1366x768 ve mobil ilerleme görünümü; terminal mobilde yalnız read-only uyarı.
- Klavye, focus, reduced-motion, TR uzun metin testleri.

## Faz 7 — Pilot ve deploy önerisi

- Yerelde tam uçtan uca test.
- Sunucu kaynak bütçesi raporu; ağır servislerle çakışma analizi.
- Önerilen alan adı, yalnız dashboard için Cloudflare Access, lab için Tailscale/WireGuard.
- Kullanıcı onayından sonra deploy; ilk sürüm public repository olacaksa kasıtlı secret/host topolojisi taraması.

## Claude'un kullanıcıya göstereceği ilk kilometre taşı

- Çalışan dashboard.
- İlk iki challenge (scope + Linux izinleri).
- Bir saldırı ve savunma doğrulamasının ekran görüntüsü.
- Security policy test özeti.
- Sunucuya henüz kurulmadığı ve nasıl güvenle kurulacağı bilgisi.
