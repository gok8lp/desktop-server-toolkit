# FLUGEL Cyber Range — Master Specification

## 1. Amaç ve kullanıcı profili

Bu ürün, yalnızca sahibinin kendi ev sunucusunda çalışan, saldırı ve savunmayı aynı senaryo içinde öğreten kişisel bir siber güvenlik eğitim platformudur. Kullanıcı C ve C++ temellerini biliyor; ağ, Linux, web, log analizi, güvenli kodlama ve savunma otomasyonu alanlarında sistematik gelişmek istiyor.

Ürün adı: **FLUGEL Cyber Range**

Uygulama dili: Türkçe varsayılan, İngilizce terimler parantez içinde

Hedef süre: 12 haftalık temel yol + sınırsız pratik

Hedef cihazlar: masaüstü tarayıcı, tablet; telefonda ilerleme ve teori, terminal görevleri masaüstünde

## 2. Değişmez güvenlik sınırı

Platform gerçek ev sunucusunu, router'ı, NAS'ı, Nextcloud'u, Cloudflare tünelini, VM'leri veya üretim konteynerlerini **hedef olarak kullanmaz**. Tüm saldırı görevleri kasıtlı zafiyetli, tek kullanımlık laboratuvar konteynerlerinde gerçekleşir.

- Laboratuvar hedefleri internete ve ev LAN'ına çıkamaz.
- Zafiyetli servisler Cloudflare üzerinden yayımlanamaz.
- Dashboard Cloudflare Access ile yayımlanabilir; hedef portlar yalnız Tailscale/WireGuard veya localhost üzerinden erişilir.
- `network_mode: host`, `privileged: true`, host PID/IPC, `/`, `/var/run/docker.sock`, gerçek kullanıcı dizinleri ve gerçek secret mount yasaktır.
- Her hedefte `cap_drop: [ALL]`, `no-new-privileges`, salt-okunur kök dosya sistemi, tmpfs `/tmp`, CPU/RAM/PID sınırı ve sağlık kontrolü zorunludur. Bir challenge açıkça ham soket gerektiriyorsa yalnız o hedefe `NET_RAW` eklenir.
- Attacker terminali de ayrı kullanıcıyla, host mount olmadan ve internetsiz çalışır.
- Flag'ler görüntüye gömülmez; oturum başında türetilir ve salt-okunur küçük volume/env ile yalnız ilgili hedefe verilir.
- “Gerçek sisteme uygula” düğmesi yoktur. Savunma dersleri kopya log, kopya config ve disposable hedefte yapılır.

## 3. Öğrenme döngüsü

Her ders aynı beş adımı izler:

1. **Kavram (5–12 dk):** kısa anlatım, diyagram, bir güvenlik ilkesi.
2. **Keşif:** hedefi gözlemleme; amaç, izinli yüzey ve beklenen çıktı açıkça yazılır.
3. **Saldırı bulmacası:** oyuncu yalnız izole hedefte kanıt/flag bulur.
4. **Savunma bulmacası:** aynı açığı config veya kod değişikliğiyle kapatır.
5. **Doğrulama:** otomatik test saldırının artık başarısız, normal işlevin hâlâ başarılı olduğunu kanıtlar.

Her saldırı görevinin mutlaka eşlenmiş bir savunma görevi vardır. Platform “flag aldın, bitti” yaklaşımını kullanmaz.

## 4. Uygulama deneyimi

### Ana ekran

- Günlük hedef, seri (streak), toplam XP, seviye ve son kaldığın ders.
- “Bugünün üçlüsü”: 1 teori, 1 saldırı, 1 savunma.
- Laboratuvar durumu: kapalı / hazırlanıyor / sağlıklı / süre doluyor / sıfırlanıyor.
- Sunucu yükü güvenli değilse yeni lab başlatılmaz; kullanıcıya açık sebep gösterilir.

### Yol haritası

- Düğümler: Linux → Ağ → Web → Kimlik → C/C++ Bellek → Tersine Mühendislik → Savunma → Final.
- Kilitler yalnız önkoşula göre; ücretli/rasgele kilit yok.
- Her modül saldırı ve kalkan puanlarını ayrı gösterir.

### Challenge ekranı

- Sol: amaç, kapsam, ipucu katmanları, başarı ölçütü.
- Orta: tarayıcı terminali veya görev için gerekli mini araç.
- Sağ: hedef topolojisi, servis sağlığı, kalan süre, flag/cevap alanı.
- Alt: olay zaman çizgisi; kullanılan ipuçları, başarısız denemeler ve savunma doğrulaması.

### Ders sonrası rapor

- Ne yaptın, hangi sinyal önemliydi, saldırı neden çalıştı, savunma neden durdurdu.
- Kopyalanabilir ama gerçek sisteme otomatik uygulanmayan “güvenli kontrol listesi”.
- Tekrar önerisi: 1 gün, 7 gün ve 30 gün aralıklı tekrar.

## 5. Teknik mimari

Yeni ve ayrı depo: `/home/flugel/Projects/flugel-cyber-lab`

```text
browser
  │ HTTPS + Cloudflare Access (yalnız dashboard)
  ▼
reverse-proxy
  ├── web (React/Vite static build)
  └── api (FastAPI)
         ├── PostgreSQL veya MVP'de SQLite
         ├── scoring / lessons / attempts
         └── runner-client (yalnız allowlist challenge ID)

host systemd service: cyberlab-runner
  └── yalnız önceden tanımlı compose projectlerini start/stop/reset
      ├── attacker workspace (browser terminal, labnet only)
      ├── target-<challenge> (disposable)
      └── verifier-<challenge> (tek seferlik test)

networks
  cyberlab_frontend: proxy ↔ web/api
  cyberlab_control: api ↔ runner (Unix socket tercih)
  cyberlab_<session>: attacker ↔ target/verifier, internal:true
```

### Teknoloji seçimi

- Frontend: React + TypeScript + Vite; erişilebilir, koyu ve sade arayüz.
- Backend: FastAPI + Pydantic + SQLModel/Alembic.
- Tek kullanıcı MVP: SQLite WAL. Çoklu kullanıcı gerekirse PostgreSQL'e geçiş.
- İçerik: sürümlenen YAML/Markdown; uygulama kodundan ayrıdır.
- Terminal: ttyd tabanlı özel attacker image; yalnız oturum tokenı ile iframe, `connect-src` dar CSP.
- Runner: Python systemd servisi; challenge slug'ı dışında komut kabul etmez, shell string birleştirmez, `subprocess` argv kullanır.
- Konteyner: mevcut host Docker ile önceden oluşturulmuş/etiketlenmiş compose projeleri. Web API'ye Docker socket verilmez.
- Gözlem: yalnız lab container logları; üretim Docker logları uygulamaya bağlanmaz.

## 6. Veri modeli

- `User`: id, locale, timezone, current_level, xp, streak.
- `Module`: slug, order, title, prerequisites.
- `Lesson`: slug, module, type (`theory|attack|defense|quiz`), estimated_minutes, content_path.
- `Challenge`: slug, difficulty, profile, timeout, resources, verifier, paired_defense_slug.
- `Session`: id, challenge, state, started_at, expires_at, container_project, flag_hash.
- `Attempt`: session, submitted_hash, result, created_at, hint_count, duration.
- `Progress`: lesson, status, best_score, completed_at, next_review_at.
- `Badge`: deterministic achievements only; loot box/random reward yok.

Flag düz metin saklanmaz. `HMAC(server_secret, user_id + session_id + challenge_slug)` ile üretilen değer kullanıcıya `FLG{...}` biçiminde sunulur; veritabanında hash tutulur.

## 7. Puanlama

- Teori kontrolü: 50 XP.
- Kolay saldırı/savunma: 100/120 XP.
- Orta: 180/220 XP.
- Zor: 300/350 XP.
- İlk ipucu ücretsiz yönlendirme; ikinci ipucu −10%, çözüm niteliğindeki üçüncü ipucu −25%.
- Hız bonusu en fazla +10%; brute-force teşvik edilmez.
- Savunma testi geçmeden modül “ustalaşıldı” sayılmaz.
- Günlük seri yalnız en az bir doğrulanmış öğrenme etkinliğiyle artar.

Skor panosunda saldırı (`red`) ve savunma (`blue`) puanları ayrı; denge rozeti ikisi arasındaki fark %20'den azsa verilir.

## 8. Laboratuvar yaşam döngüsü

1. API `POST /sessions` ile challenge slug ister.
2. Runner slug'ı yerel manifest allowlist'inde doğrular.
3. Kaynak eşiği kontrol edilir: `MemAvailable >= 4 GiB`, IO PSI `avg60 < 20`, load15 mantıksal CPU sayısından küçük. Eşik sağlanmazsa kuyruğa alınır.
4. Oturum ağı ve rastgele flag oluşturulur; hedef healthcheck geçene kadar UI “hazırlanıyor” der.
5. Varsayılan 45 dakika; kullanıcı aktifken bir kez +15 dakika.
6. Süre/bitirme/sıfırlamada compose project kapatılır, yalnız progress ve güvenli audit kaydı kalır.
7. Yetim proje temizleyici yalnız `com.flugel.cyberlab.managed=true` etiketli ve süresi geçmiş projeleri kaldırır.

## 9. API yüzeyi

- `GET /api/modules`, `GET /api/lessons/{slug}`
- `POST /api/sessions`, `GET /api/sessions/{id}`, `POST /api/sessions/{id}/reset`, `DELETE /api/sessions/{id}`
- `POST /api/sessions/{id}/submit` (flag veya savunma verifier sonucu)
- `POST /api/lessons/{slug}/hints/{index}`
- `GET /api/progress`, `GET /api/reviews/today`
- `GET /api/health/capacity` (yalnız yuvarlatılmış RAM/load/queue; host ayrıntısı yok)

Tüm mutasyonlarda CSRF koruması, rate limit ve audit event bulunur. Runner socket yalnız API servis kullanıcısına açıktır.

## 10. Tasarım dili

- FLUGEL Island v3'ten bağımsız fakat aynı sakin mat dil: `#08090b`, `#14161a`, ince sınır, blur yok.
- Red/blue renkleri yalnız rol/durum için; başarının tek işareti renk değildir.
- Terminal monospace; açıklamalar okunaklı sans-serif.
- 44px ana hedef, 36px ikincil hedef, görünür focus, reduced-motion.
- Topoloji diyagramları SVG; hareketli ağ haritası yok.

## 11. MVP kapsamı

İlk yayın 12 ders ve 8 gerçek challenge içerir:

- Linux izinleri saldırı+savunma
- HTTP keşfi ve güvenli header düzeltmesi
- SQL injection oyuncak hedefi + parametrik sorgu savunması
- Broken access control + sunucu tarafı yetki kontrolü
- Log analizi ve brute-force tespiti
- C stack taşması (yalnız yerel toy binary) + sınır kontrollü düzeltme
- Format string (toy binary) + güvenli printf
- Final mini incident: web logu → zafiyet → patch → doğrulama

MVP'de internet taraması, gerçek IP keşfi, malware, phishing, kablosuz saldırı, credential stuffing ve kalıcılık yoktur.

## 12. Kabul kriterleri

- `docker compose config` temiz; hiçbir service privileged/host network/docker.sock/gerçek secret mount kullanmıyor.
- Dashboard hedef servis portlarını public proxy'ye bağlamıyor.
- Yeni lab, eşik altında başlatılmıyor; var olan oturum güvenli şekilde resetleniyor.
- Her challenge saldırı flag'i ve savunma verifier'ı ile uçtan uca geçiyor.
- Flag başka oturumda kullanılamıyor.
- Tarayıcı yenilenince session/progress korunuyor; süresi dolan hedef kapanıyor.
- 20 ardışık start/reset/stop döngüsünde yetim container/network/volume yok.
- API testleri, frontend erişilebilirlik testi ve compose güvenlik linter'ı CI'da geçiyor.
- Haftalık görev dizinleri hiçbir komut, volume veya dokümantasyon kapsamına alınmıyor.
- Deploy öncesi kullanıcıya port, alan adı ve Cloudflare Access politikası açıkça gösteriliyor; onay olmadan sunucuya kurulum/push/yayın yapılmıyor.
