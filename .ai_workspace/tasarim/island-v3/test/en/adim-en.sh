#!/bin/bash
# island-test.sh tarafından source edilir; gerçek oturum ve kurulu eklenti dosyaları değişmez.
ev "Main.extensionManager.disableExtension('flugel-panel@flugel'); Main.extensionManager.disableExtension('flugel-island@flugel'); 'disabled'"
sleep 2
ev "Main.extensionManager.enableExtension('flugel-island@flugel'); 'enabled'"
sleep 4
ev "const e=Main.extensionManager.lookup('flugel-island@flugel'); e.stateObj._ayar.set_string('dil','en'); Main.extensionManager.disableExtension('flugel-island@flugel'); 'language-set'"
sleep 2
ev "Main.extensionManager.enableExtension('flugel-island@flugel'); 're-enabled'"
sleep 6
ev "const e=Main.extensionManager.lookup('flugel-island@flugel'); e.stateObj._ayar.set_string('tasarim','v3'); e.stateObj._ayar.set_int('kart-genislik',720); e.stateObj._yonetici.setPinned(true); JSON.stringify({state:e.state,error:e.error?String(e.error):null})"
sleep 5
ev "const e=Main.extensionManager.lookup('flugel-island@flugel').stateObj; e._kart.sekmeSec('hizli'); const h=e._kart._sayfalar.find(s=>s.id==='hizli').sayfa; h._tumu=false; h._kisaUygula(); 'quick-short'"
sleep 3
foto en-720-quick-short
ev "const e=Main.extensionManager.lookup('flugel-island@flugel').stateObj; const h=e._kart._sayfalar.find(s=>s.id==='hizli').sayfa; h._tumu=true; h._kisaUygula(); 'quick-all'"
sleep 3
foto en-720-quick-all
ev "const e=Main.extensionManager.lookup('flugel-island@flugel').stateObj; e._ayar.set_int('kart-genislik',560); const h=e._kart._sayfalar.find(s=>s.id==='hizli').sayfa; h._tumu=false; h._kisaUygula(); 'width-560'"
sleep 3
foto en-560-quick-short
ev "const e=Main.extensionManager.lookup('flugel-island@flugel').stateObj; e._kart._dahaAcKapa(true); 'more'"
sleep 2
foto en-560-more
