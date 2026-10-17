# FLUGEL: Codex ve Claude ortak giriş noktası

- Önce `CLAUDE.md` ve `.ai_workspace/README.md` dosyalarını oku; görev için `.ai_workspace/AGENT_TASK_BOARD.md` ve `RULES_AND_PERMISSIONS.md` dosyalarını kullan.
- **Kesin sınır:** `/home/flugel/Projects/weekly-task` ve `/home/flugel/Projects/weekly-tasks` dizinlerinde okuma, değişiklik, test, commit, push veya otomasyon yapma. Bu projeler görevin parçası değildir.
- Island'ın asıl kaynağı `extensions/flugel-island@flugel/`; ayrı yayın deposu `../flugel-island/`. Eşitlemeden önce iki çalışma ağacını ve diff'i kontrol et. Başka ajanın değişikliklerini ezme.
- Aynı PC'deki görev sahipliğini `.ai_workspace/task_board.py` ile kaydet. Büyük kod değişikliğinden sonra görev kanıtını, test sonucunu, commit'i ve sıradaki adımı güncelle.
- `.ai_workspace/SERVER_STATE_INDEX.json` ve `AI_STATE_INDEX.md` yereldir; public GitHub'a ekleme. `tasks.json` ile `AGENT_TASK_BOARD.md` birlikte sürümlenir.
- Commit ve push öncesinde `git status`, `git fetch` ve uzak dalın durumunu kontrol et. Kullanıcının açık yayın isteğini uygula; sürüm etiketi için ayrıca talimat bekle.
