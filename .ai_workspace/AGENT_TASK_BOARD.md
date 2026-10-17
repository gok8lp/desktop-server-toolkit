# Ajan görev panosu

Kaynak: `tasks.json`; bu dosya `task_board.py` tarafından üretilir. Yerel sunucu durumu için `SERVER_STATE_INDEX.json`, kurallar için `RULES_AND_PERMISSIONS.md` okuyun.

Aktif görevler sahip alanında görünür. Başka ajanın işi varsayılmaz.

## AI-001 — İki Island deposu arasındaki farkı ve yayımlama yönünü doğrula

- Durum: `done`; sahip: `yok`; kira sonu: `yok`
- Dosyalar: `extensions/flugel-island@flugel`, `../flugel-island/flugel-island@flugel`
- Kanıt: Claude raporu: 2026-10-17 iki Island klasörü eşitlendi, lint ve 35/35 birim testi geçti. Codex origin/main üzerinde flugel ca85d9b ve flugel-island 27f3ba3 commitlerini doğruladı; klasör diff'i boş.
- Sonraki adım: Yeni Island değişikliğinde iki klasörü ve uzak dalları tekrar karşılaştır; etiket için kullanıcı isteğini bekle

## AI-002 — Akış API ve canlı dağıtım denetimi

- Durum: `ready`; sahip: `yok`; kira sonu: `yok`
- Dosyalar: `sunucu/panel/akis`
- Kanıt: 2026-10-17: konteyner healthy, / HTTP 200, üç temel dosya SHA-256 eşit
- Sonraki adım: API uçları ve diğer statik dosyalar için hedefli doğrulama

## AI-003 — Sunucuda dışa açık portları ve kaynak baskısını gözden geçir

- Durum: `ready`; sahip: `yok`; kira sonu: `yok`
- Dosyalar: `sunucu/panel`, `sunucu/cloudflared`
- Kanıt: 2026-10-17 yerel envanter: yüksek disk doluluğu ve tüm arayüzlerde dinleyen servisler görüldü; ayrıntılar yerel SERVER_STATE_INDEX.json dosyasında
- Sonraki adım: Erişim amacını ve güvenlik duvarı gerçek politikasını doğrula; değişiklik önerisi hazırla

## AI-004 — Claude son oturum durumunu doğrula

- Durum: `done`; sahip: `yok`; kira sonu: `yok`
- Dosyalar: `CLAUDE.md`
- Kanıt: Kullanıcının aktardığı Claude raporu alındı; iki uzak dal ve klasör eşitliği Codex tarafından doğrulandı. Claude'un sonraki aktif görevi bildirilmedi.
- Sonraki adım: Claude yeni işe başladığında task_board.py ile görevi alsın

## AI-000 — AI çalışma merkezini ve güvenli envanteri kur

- Durum: `done`; sahip: `yok`; kira sonu: `yok`
- Dosyalar: `.ai_workspace`
- Kanıt: 2026-10-17: yerel envanter üretildi, JSON doğrulandı ve görev kapsamı çakışması testi geçti; uygulama/sunucu konfigürasyonu değişmedi
- Sonraki adım: AI-002 ve AI-003 uygun ajanlar tarafından üstlenilebilir

## AI-005 — Island derin performans ve hata analizi

- Durum: `ready`; sahip: `yok`; kira sonu: `yok`
- Dosyalar: `extensions/flugel-island@flugel`, `../flugel-island/flugel-island@flugel`
- Kanıt: Ana 4f6ad37, ayrı Island 64ccaf9 (yerel; push yok). ESLint, iki depoda 35/35, başsız 24 PiP döngüsü: 0 izleyici/0 PiP hatası. Canlı oturum yenilenmedi
- Sonraki adım: Canlı oturum sonrası PiP doğrula; GJS GC kapanış uyarısını A/B incele, animasyon/veri ömrünü profil et

## AI-006 — PC kasma ve kaynak analizi

- Durum: `ready`; sahip: `yok`; kira sonu: `yok`
- Dosyalar: `pc`
- Kanıt: RAM/swap/I-O baskısı yok; Btrfs kök %82 dolu; libinput 20-39 ms gecikme ve Chrome renderer yüksek CPU görüldü; servis/cache/kernel değişmedi
- Sonraki adım: Chrome Görev Yöneticisi ile yoğun sekmeleri saptayıp GNOME efektleri açık/kapalı gecikme ölçümü yap

## Kullanım

```bash
python3 .ai_workspace/task_board.py list
python3 .ai_workspace/task_board.py claim AI-002 --agent codex
python3 .ai_workspace/task_board.py update AI-002 --agent codex --evidence "Dosya/satır ve test sonucu" --next "Sıradaki işlem"
python3 .ai_workspace/task_board.py release AI-002 --agent codex --status done
```

Kira bitse bile açık dosyayı zorla ezme; önce çalışma ağacı ve son değişiklikleri denetle.
