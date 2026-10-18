# 12 haftalık kişisel eğitim yolu

Tempo: haftada 4 gün, günde 45–75 dakika. Her hafta en az bir saldırı ve eşlenmiş savunma görevi vardır.

## Hafta 0 — Güvenli laboratuvar kullanımı

- Yetki, kapsam, etik ve “yalnız cyberlab ağı” sözleşmesi.
- Terminal, dosya yolları, stdin/stdout/stderr, exit code.
- Bulmaca: doğru hedefi seç; üretim IP'sini reddeden scope guard testi.
- Savunma: yanlış ağ hedefi verildiğinde runner'ın başlamadığını doğrula.

## Hafta 1 — Linux temeli

- Kullanıcı/grup, UID/GID, rwx, umask, process, environment.
- Saldırı: yanlış dosya izninden flag oku.
- Savunma: owner/group/permission düzelt; normal servis çalışmaya devam etsin.
- Puzzle: PATH gölgelemesini kopya bir shell ortamında bul.

## Hafta 2 — Ağ ve paket mantığı

- IP, port, TCP handshake, DNS, HTTP, TLS; LAN/VPN/internet ayrımı.
- Saldırı: labnet içindeki üç servisten doğru olanı banner/health ile keşfet.
- Savunma: allowlist firewall kuralı seç; verifier yalnız attacker subnetini kabul etsin.
- Wireshark yerine başlangıçta sağlanan küçük pcap ve `tcpdump -r`.

## Hafta 3 — Web keşfi

- Request/response, method, header, cookie, status, same-origin.
- Saldırı: robots/header/source içindeki kasıtlı bilgi sızıntısını bul.
- Savunma: debug header ve directory listing kapat; health endpoint korunur.

## Hafta 4 — Kimlik ve erişim kontrolü

- Authentication vs authorization, session, object ownership.
- Saldırı: toy uygulamada başka kullanıcının notuna ID değiştirerek eriş.
- Savunma: her sorguda server-side owner check; negatif testler.

## Hafta 5 — Enjeksiyon ve veri tabanı

- SQL söz dizimi, string birleştirme riski, prepared statement.
- Saldırı: yalnız toy SQLite uygulamasında login bypass/tek kayıt okuma.
- Savunma: parametrik sorgu; doğru/yanlış giriş regresyon testleri.
- Yasak: veri silme, gerçek veritabanı, otomatik geniş tarama.

## Hafta 6 — Log ve olay analizi

- Access/auth/app logları, timestamp, correlation ID, false positive.
- Savunma öncelikli puzzle: brute-force dizisini bul, saldırgan IP değil oturum desenini kanıtla.
- Saldırı simülasyonu önceden üretilmiş log replay ile yapılır.

## Hafta 7 — C belleği I

- Stack/heap, pointer, array boundary, compiler warning, ASan.
- Saldırı: internetsiz toy binary'de kontrollü stack taşmasıyla flag fonksiyonuna ulaş.
- Savunma: uzunluk kontrolü + güvenli API; ASan ve unit test geçsin.
- Derleme: `-Wall -Wextra -Werror`, savunma aşamasında PIE/NX/canary karşılaştırması.

## Hafta 8 — C belleği II

- Format string, integer dönüşümü, lifetime ve double free kavramı.
- Saldırı: toy `printf(user_input)` programında yalnız flag değerini göster.
- Savunma: formatı sabitle, input uzunluğunu sınırla, compiler testleri.
- Ek C++ puzzle: RAII ile açık dosya/kaynak sızıntısını düzelt.

## Hafta 9 — Tersine mühendislik temeli

- ELF bölümleri, symbols, strings, objdump, gdb temel akışı.
- Puzzle: stripped olmayan eğitim binary'sinde doğrulama mantığını anlayıp doğru anahtarı türet.
- Savunma: sırların binary içine gömülmemesi; sunucu tarafı doğrulama tasarımı.

## Hafta 10 — Güvenli konteyner ve servis

- Image, container, volume, namespace, capability, seccomp.
- Saldırı: manifestteki fazla capability/secret mount'u bul; çalıştırmadan risk puanla.
- Savunma: compose dosyasını least privilege hâline getir; policy testini geçir.

## Hafta 11 — İzleme ve müdahale

- Baseline, alert severity, containment, evidence preservation.
- Blue-team puzzle: sahte servis çöküşünde gürültü ile kök nedeni ayır.
- Savunma: doğru healthcheck/backoff; restart loop üretmeden toparlanma.

## Hafta 12 — Final: mini olay müdahalesi

- Verilenler: web logu, uygulama kaynak kopyası, container manifesti.
- Aşama 1: ilk erişim vektörünü kanıtla.
- Aşama 2: izole hedefte flag al.
- Aşama 3: kodu/config'i düzelt.
- Aşama 4: saldırı artık başarısız, normal özellik başarılı, log alarmı doğru.
- Aşama 5: beş paragraflık olay raporu ve kişisel kontrol listesi.

## Seviye sonrası yollar

- C/C++ güvenliği: fuzzing, sanitizers, heap, yarış koşulları.
- Blue team: Sigma benzeri kurallar, log pipeline, container incident response.
- Web güvenliği: CSRF, SSRF'nin oyuncak simülasyonu, upload doğrulama, CSP.
- Home server hardening: yalnız kopya config üzerinde; gerçek sisteme uygulama ayrı değişiklik incelemesi gerektirir.
