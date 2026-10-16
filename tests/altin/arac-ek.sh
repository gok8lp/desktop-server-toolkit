# arac-ek.sh — ek araçlar: hesap makinesi, kronometre (kapsülde), QR, hızlı not, pano dönüştürme
a "const u = Main.extensionManager.lookup('flugel-island@flugel').dir.get_uri(); import(u + '/src/araclar-ek.js').then(m => { __A.ek = m; }); import(u + '/src/araclar.js').then(m => { __A.ar = m; }); 1" >/dev/null; sleep 1
a "const h = s => __A.ek.sayiMetni(__A.ek.hesapla(s)); const d = [['1250*18%','225'],['200+15%','230'],['(3+4)^2','49'],['sqrt(16)+2','6'],['sin 30','0.5'],['2pi','6.28318530718'],['1,5 x 4','6'],['10/4','2.5'],['5!','120'],['-2^2','-4']]; const yanlis = d.filter(([g, b]) => { try { return h(g) !== b; } catch (e) { return true; } }).map(x => x[0] + '=' + (() => { try { return h(x[0]); } catch (e) { return 'hata'; } })()); let hatali = false; try { __A.ek.hesapla('2+'); } catch (e) { hatali = true; } __A.yaz('hesap: ifadeler doğru', !yanlis.length && hatali, yanlis.join(' ')); 1" >/dev/null
a "__A.E()._yonetici.setPinned(true); __A.E()._kart.sekmeSec('hizli', false); 1" >/dev/null; sleep 1.2
a "const p = __A.sayfa('hizli'); p._detayAcKapa('hesap'); 1" >/dev/null; sleep 0.8
a "const p = __A.sayfa('hizli'); p._detay._giris.text = '1250*18%'; 1" >/dev/null; sleep 0.3
a "const p = __A.sayfa('hizli'); __A.yaz('hesap: yazarken sonuç', p._detay._sonuc.text === '= 225', p._detay._sonuc.text); __A.yaz('hesap: panel açılınca yazı kutusu odakta', global.stage.key_focus === p._detay._giris.clutter_text && Main.modalCount > 0, String(Main.modalCount)); 1" >/dev/null
foto arac-hesap
a "const p = __A.sayfa('hizli'); p._detay._kaydet(); 1" >/dev/null; sleep 0.3
a "imports.gi.St.Clipboard.get_default().get_text(imports.gi.St.ClipboardType.CLIPBOARD, (_c, m) => { __A.pm = m; }); 1" >/dev/null; sleep 0.3
a "const p = __A.sayfa('hizli'); __A.yaz('hesap: Enter sonucu kopyalar, geçmişe ekler', __A.pm === '225' && p._detay._gecmis.get_n_children() > 0, __A.pm); p._detayAcKapa('krono'); 1" >/dev/null; sleep 0.8
a "__A.yaz('hesap: panel kapanınca kip bırakılır', Main.modalCount === 0, String(Main.modalCount)); __A.ar.kronometre.baslatDurdur(); 1" >/dev/null; sleep 1.3
a "__A.ar.kronometre.tur(); 1" >/dev/null; sleep 0.4
a "const p = __A.sayfa('hizli'); const k = __A.ar.kronometre; const e = __A.E()._yonetici._activities.get('zamanlayici:krono'); __A.yaz('kronometre: sayar, tur alır, kapsülde görünür', k.gecen > 1000 && k.turlar.length === 1 && !!e && p._detay._turlar.get_n_children() === 1 && p._detay._buyuk.text.includes('.'), p._detay._buyuk.text + ' ' + (e ? e.label : 'etkinlik yok')); 1" >/dev/null
foto arac-krono
a "__A.ar.kronometre.baslatDurdur(); const g = __A.ar.kronometre.gecen; __A.kg = g; 1" >/dev/null; sleep 0.5
a "const k = __A.ar.kronometre; __A.yaz('kronometre: durunca sayaç durur', k.gecen === __A.kg && !k.calisiyor); k.sifirla(); 1" >/dev/null; sleep 0.4
a "__A.yaz('kronometre: sıfırlanınca kapsülden kalkar', !__A.E()._yonetici._activities.get('zamanlayici:krono')); imports.gi.St.Clipboard.get_default().set_text(imports.gi.St.ClipboardType.CLIPBOARD, 'https://example.com/flugel'); __A.sayfa('hizli')._detayAcKapa('qr'); 1" >/dev/null; sleep 2.5
a "const p = __A.sayfa('hizli'); const d = p._detay; const yol = d._resim.gicon?.get_file?.()?.get_path?.(); __A.yaz('QR: panodaki bağlantıdan QR çizilir', d._giris.text === 'https://example.com/flugel' && d._resim.visible && !!yol && imports.gi.GLib.file_test(yol, imports.gi.GLib.FileTest.EXISTS), d._giris.text + ' ' + yol + ' ' + d._durum.text); 1" >/dev/null
foto arac-qr
a "__A.E()._ayar.set_string('hizli-not', 'ilk'); __A.sayfa('hizli')._detayAcKapa('not'); 1" >/dev/null; sleep 0.9
a "const d = __A.sayfa('hizli')._detay; __A.yaz('not: kayıtlı not açılır', d._giris.text === 'ilk'); d._giris.text = 'ilk' + String.fromCharCode(10) + 'ikinci satır'; 1" >/dev/null; sleep 0.9
a "__A.yaz('not: yazdıkça kaydedilir', __A.E()._ayar.get_string('hizli-not') === 'ilk' + String.fromCharCode(10) + 'ikinci satır', __A.E()._ayar.get_string('hizli-not')); __A.E()._ayar.reset('hizli-not'); __A.sayfa('hizli')._detayAcKapa('pano'); 1" >/dev/null; sleep 0.9
a "const p = __A.sayfa('hizli'); __A.yaz('pano: dönüştürme düğmeleri görünür', __A.bul(p._detay.actor, c => c.label === 'Bağlantıyı temizle').length === 1); imports.gi.St.Clipboard.get_default().set_text(imports.gi.St.ClipboardType.CLIPBOARD, 'Bak: https://x.com/a?utm_source=tw&id=5&fbclid=zz'); 1" >/dev/null; sleep 0.3
a "__A.ek.panoDonustur('izleme').then(m => { __A.pd1 = m; return __A.ek.panoDonustur('buyuk'); }).then(m => { __A.pd2 = m; }); 1" >/dev/null; sleep 0.6
a "__A.yaz('pano: izleme ekleri silinir, büyük harfe çevrilir', __A.pd1 === 'Bak: https://x.com/a?id=5' && __A.pd2 === 'BAK: https://x.com/a?id=5', __A.pd1 + ' | ' + __A.pd2); __A.sayfa('hizli')._detayAcKapa('pano'); __A.E()._yonetici.setPinned(false); __A.E()._ada.daralt(); 1" >/dev/null; sleep 1
a "__A.yaz('araçlar sonrası kip yok', Main.modalCount === 0, String(Main.modalCount)); 1" >/dev/null
# ekran görüntüsü: kart açıkken açılırsa önce ada kapsüle döner ve oturur, sonra yakalanır
a "const ada = __A.E()._ada; __A.ssAsil = ada._ekranAsil; ada._ekranAsil = function () { __A.ssDurum = ada._durum + ' yay=' + !!ada._yay + ' kartKutu=' + ada._kartKutu.visible + '/' + ada._kartKutu.opacity; return Promise.resolve(); }; __A.E()._yonetici.setPinned(true); 1" >/dev/null; sleep 1.2
a "Main.screenshotUI.open(); 1" >/dev/null; sleep 1.5
a "const ada = __A.E()._ada; ada._ekranAsil = __A.ssAsil; __A.yaz('ekran görüntüsü: kart kapanıp oturduktan sonra yakalanır', /^(bos|kompakt) yay=false/.test(__A.ssDurum ?? '') && !__A.E()._yonetici.isPinned(), __A.ssDurum); 1" >/dev/null
