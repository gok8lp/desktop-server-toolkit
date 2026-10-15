# hizli-detay.sh — ses/parlaklık + uygulama sesleri, Wi-Fi ve Bluetooth ayrıntı panelleri
a "__A.E()._yonetici.setPinned(true); __A.E()._kart.sekmeSec('hizli', false); 1" >/dev/null; sleep 2; foto hz-ust
a "__A.sayfa('hizli')._cubuklar.uygulamalar(true); 1" >/dev/null; sleep 1; foto hz-uyg
a "const p = __A.sayfa('hizli'); __A.yaz('uygulama sesleri paneli açıldı', p._cubuklar._uygKap.visible && p._cubuklar._uyg.actor.get_n_children() > 0); p._cubuklar.uygulamalar(false); 1" >/dev/null; sleep 0.6
a "const p = __A.sayfa('hizli'); __A.yaz('uygulama sesleri paneli kapandı', !p._cubuklar._uygKap.visible && !p._cubuklar._uyg); p._detayAcKapa('wifi'); 1" >/dev/null; sleep 2; foto hz-wifi
a "const p = __A.sayfa('hizli'); __A.yaz('Wi-Fi paneli', p._detayId === 'wifi' && p._detay.actor.get_n_children() > 0, String(p._detay?.actor.get_n_children())); p._detayAcKapa('bt'); 1" >/dev/null; sleep 2; foto hz-bt
a "const p = __A.sayfa('hizli'); __A.yaz('Bluetooth paneli', p._detayId === 'bt' && p._detay.actor.get_n_children() > 0); p._detayAcKapa('bt'); 1" >/dev/null; sleep 1
a "const p = __A.sayfa('hizli'); __A.yaz('detay kapanır', !p._detay && !p._detayKap.visible); __A.E()._kart.sekmeSec('sistem', false); 1" >/dev/null; sleep 1
a "__A.yaz('Sistem sekmesinde çubuk yok', !__A.sayfa('sistem')._cubuklar); 1" >/dev/null
