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
- Kanıt: Blur/CSS kaynakları iki depoda ve kurulu kopyada eşit; lint, 35/35 birim, cam başsız görsel testi geçti; GitHub push hazırlanıyor.
- Sonraki adım: Yeni GNOME oturumunda cam-efekti ve bulanik-gecis ayarlarını tek tek A/B test et; mouse takılırsa kapat.

## AI-006 — PC kasma ve kaynak analizi

- Durum: `ready`; sahip: `yok`; kira sonu: `yok`
- Dosyalar: `pc`
- Kanıt: Island ve iki blur A/B sonucuyla takılma korelasyonu görüldü; OS/NVIDIA/USB ayarı yapılmadı.
- Sonraki adım: Yeni oturum sonrası canlı fare gecikmesi doğrula.

## Kullanım

```bash
python3 .ai_workspace/task_board.py list
python3 .ai_workspace/task_board.py claim AI-002 --agent codex
python3 .ai_workspace/task_board.py update AI-002 --agent codex --evidence "Dosya/satır ve test sonucu" --next "Sıradaki işlem"
python3 .ai_workspace/task_board.py release AI-002 --agent codex --status done
```

Kira bitse bile açık dosyayı zorla ezme; önce çalışma ağacı ve son değişiklikleri denetle.
