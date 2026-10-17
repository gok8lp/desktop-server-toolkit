# FLUGEL AI çalışma alanı

Başlangıç sırası: `RULES_AND_PERMISSIONS.md` → `AGENT_TASK_BOARD.md` → `MASTER_BLUEPRINT.md` → ana depo `CLAUDE.md` → göreve ilgili kaynak dosyaları. Bu PC'de `SERVER_STATE_INDEX.json` ve `AI_STATE_INDEX.md` ek yerel bağlamdır. JSON'un zaman damgasını ve `server_fresh` alanını kontrol edin.

Bu dizinin görev panosu, kuralları, mimari planı ve araçları ana GitHub deposunda sürümlenir. Canlı sunucu envanteri, yerel görev olayları, yedekler ve kilit dosyaları `.ai_workspace/.gitignore` ile yalnızca bu PC'de kalır. İki ajan aynı PC'de ortak `tasks.json` ve dosya kilidini kullanır. Ayrı iş kopyalarında çalışırlarsa görev panosunu ana depo kopyasında güncellerler.

Ana Island kaynağı `extensions/flugel-island@flugel/`; ayrı GitHub deposu `../flugel-island/flugel-island@flugel/`. 2026-10-17 tarihinde Claude'un taşıdığı düzeltmeyle iki klasör eşitlendi: ana depo `ca85d9b`, ayrı depo `27f3ba3` (GitHub'da doğrulandı). Her yeni yayın öncesinde iki kopyayı yeniden karşılaştırın. `weekly-task` ve `weekly-tasks` projelerine hiçbir ajan dokunmaz.

```bash
cd /home/flugel/Projects/flugel
python3 .ai_workspace/refresh_state.py
python3 .ai_workspace/task_board.py list
python3 .ai_workspace/task_board.py claim AI-002 --agent codex
python3 .ai_workspace/test_task_board.py -v
```

`refresh_state.py` sunucuya `ssh flugelserver` üzerinden parola istemeyen salt okunur sorgu yapar. SSH başarısızsa önceki sunucu envanteri korunur ve `server_fresh=false` olur. Çıktı yereldir. `task_board.py` görev kaydını kilitleyerek günceller; ajanlar ilgili görevi üstlenmeden kaynak dosyalarını değiştirmez. `tasks.json` ve üretilen `AGENT_TASK_BOARD.md` birlikte commit edilir.

Yeni görev için `python3 .ai_workspace/task_board.py add AI-005 --agent codex --title 'Görev adı' --paths sunucu/panel/akis --next 'İlk adım'` kullanın. İşlemler `task_events.jsonl` dosyasına kaydedilir. Uzun işlemlerde `update` kiranın süresini yeniler.

GitHub paylaşımı görev bilgisini taşır; eşzamanlı düzenleme kilidi aynı PC'deki `flock` ile çalışır. GitHub commit'i gerçek zamanlı kilit değildir. Her push öncesinde `git fetch` ile uzak dalı kontrol edin; ilerlemişse değişiklikleri birleştirip test edin. Etiket için ayrıca kullanıcı isteği gerekir.
