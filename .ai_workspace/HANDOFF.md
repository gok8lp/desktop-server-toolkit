# İki ajan için son doğrulanmış devir

Güncelleme: 2026-10-17, Europe/Istanbul. Bu belge public GitHub'a uygun proje düzeyi özetidir. Anlık makine ve ağ ayrıntıları yerel `SERVER_STATE_INDEX.json` dosyasındadır.

- Claude, Island'ın ana ve ayrı depolarını eşitledi. Kullanıcının aktardığı raporda lint temiz, birim testleri 35/35 ve başsız GNOME testleri bu değişiklik için yeniden çalıştırılmadı. Codex uzak `main` commitlerini doğruladı: `flugel` `ca85d9b`, `flugel-island` `27f3ba3`; eklenti klasörleri üretilmiş şema hariç aynı.
- Son sürüm etiketi `v2.9.0`; yeni etiket için ayrıca kullanıcı isteği gerekir. Claude'un bundan sonraki aktif görevi bildirilmedi.
- Codex `.ai_workspace/` merkezini hazırladı: paylaşılabilir kurallar ve pano Git'e girer, canlı envanter yerel kalır. Görev çakışması ve yasak proje kapsamı için iki yalıtılmış test geçti. Akış uygulama koduna ve sunucudaki servislere dokunulmadı.
- Sıradaki açık işler `AGENT_TASK_BOARD.md` içinde `AI-002` ve `AI-003`. Yeni ajan, işe başlamadan görevi `task_board.py` ile alır.
- Kullanıcı sınırı: `weekly-task` ve `weekly-tasks` projelerine hiçbir ajan dokunmaz.

Her tamamlanan önemli görevden sonra bu özeti en fazla birkaç somut maddeyle yenileyin; eski özetleri aktif durum sanmayın. Kodun ayrıntılı geçmişi commit ve görev panosundadır.
