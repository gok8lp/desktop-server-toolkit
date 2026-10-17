# Ajan çalışma ve izin protokolü

Bu kurallar, kullanıcının tam sistem erişimi yetkisiyle çalışan ajanların ortak dosyaları ve canlı sunucuyu tutarlı biçimde yönetmesi içindir. Yetki beyanı terminaldeki gerçek izinlerin yerine geçmez. Ana deponun `CLAUDE.md` kuralları da geçerlidir.

**Dokunulmaz kapsam:** `/home/flugel/Projects/weekly-task` ve `/home/flugel/Projects/weekly-tasks`. Codex ve Claude bu dizinlerde okuma, düzenleme, test, commit, push veya otomasyon çalıştırmaz. Bu projeler için görev oluşturulmaz.

## Okuma, yazma ve canlı işlem

- Salt okunur: `git status/log/diff`, `ss -ltn`, `ip -j -4 addr`, `df`, `free`, `docker ps`, `systemctl status/list-units`, `virsh list`, kontrollü `ssh flugelserver` sorguları. `refresh_state.py` bunların daraltılmış alt kümesini kullanır.
- Kod yazma: yalnızca alınmış görevdeki yollar. Düzenlemeden önce mevcut çalışma ağacını, son commit'i ve dosya sahibini kontrol et; mevcut değişiklikleri koru. Ayrı ajanlar aynı dosyayı eşzamanlı düzenlemez. Ayrı worktree/branch önerilir.
- Canlı işlem: gerekli task açıklaması, alınmış yedek, test edilmiş geri dönüş, değişiklik kaydı ve son sağlık kontrolü ile yürütülür. `docker compose up`, servis restart, GNOME eklenti kurulumu, firewall/SSH değişikliği, VM start/stop ve disk işlemleri için etki alanı tek tek belirlenir. Kullanıcının mevcut görev yetkisi varsa rutin adımlar ilerler; hedef belirsizse yön istenir.
- Yıkıcı işlem: doğrulanmış dar hedef, geri yüklenebilir yedek ve etkilenebilecek servisler listelenir. VM zorla kapatılmaz. Home, repo kökü veya `/` gibi geniş yollar silme hedefi olmaz.
- Şifre, PIN, token, SSH özel anahtarı, `.env`, ham `docker inspect Env`, tarayıcı profili ve kişisel hesap listesi ortak dosyaya/loga yazılmaz. Gerekli loglardan yalnızca ilgili satır maskelenerek alınır.

## Görev alma ve devretme

1. `python3 .ai_workspace/task_board.py list` ve `git status -sb` ile mevcut durumu oku.
2. `claim TASK-ID --agent AD` kullan. Araç dosya yolu çakışmasını ve kira süresini denetler; bu işbirliği kilididir, işletim sistemi düzeyinde koruma değildir.
3. Çalışırken `update TASK-ID --agent AD --evidence 'commit/dosya/test' --next 'somut adım'` ile kayıt ve kirayı yenile.
4. Tamamlayınca `release TASK-ID --agent AD --status done --evidence '...'`; beklemede `--status blocked` veya `ready` kullan.
5. Kira bitmiş olsa bile başka ajanın yarım işini körlemesine devralma. Git durumu, çalışma ağacı, ilgili not ve varsa işlem kaydını incele. Kullanıcıdan aktarılan raporu kaynak olarak belirt; commit ve uzak dal durumunu bağımsız doğrula.

## Her büyük kod değişikliği sonrası devir paketi

Görev ID, repo ve branch, başlangıç/son commit, değişen dosyalar ve ilgili işlev/satır, amaç, test komutu/sonucu, dağıtım yapıldı mı, bilinen hata/karar ve bir sonraki adım. Anlık kaynak durumu için `refresh_state.py` çalıştır; anlatısal `AI_STATE_INDEX.md` ve görev panosunu güncelle. Envanter ve görev verisini public repoya göndermeden önce paylaşım kapsamını açıkça değerlendir.

GitHub'da `tasks.json`, `AGENT_TASK_BOARD.md` ve paylaşılabilir planlar birlikte güncellenir. `SERVER_STATE_INDEX.json`, `AI_STATE_INDEX.md`, yedekler ve olay kaydı yereldir. Kod commit'inden önce `git status` ve uzak dalı kontrol et; başkasının ilerleyen commit'ini ezme. Push görevdeki kullanıcı yetkisiyle yapılır; sürüm etiketi ayrıca istenir.

## Çatışma çözümü

İki ajan aynı yola ihtiyaç duyarsa biri sahipliği alır, diğeri bağımsız dosya veya incelemeye geçer. Son sahibin değişikliği diff ile okunur; `git reset --hard`, zorla checkout, force push ve başkasının değişikliğini yedeği olmadan üzerine yazma kullanılmaz. Gerekirse ayrı dalda çözüm hazırlanır ve çakışan karar kullanıcıya kısa, somut seçeneklerle sunulur.

## Ölçüm ve dağıtım eşiği

Yeni sürekli çalışan servisler için bellek, disk yazma hızı, port, erişim kapsamı ve mevcut servisle görev tekrarı ölçülür. Her canlı değişiklikten önce mevcut konfigürasyonun geri dönüş kopyası alınır; sonra beklenen sağlık sinyali doğrulanır. Ayrıntılı kapasite değerleri yalnızca yerel sunucu envanterinde tutulur.
