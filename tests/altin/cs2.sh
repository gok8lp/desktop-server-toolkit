# cs2.sh — CS2 canlı raund: kazanan takım vurgusu, harita değişimi, maç bitişi
js 06-cs2.js; sleep 1
a "__A.veriVer('cs2', __A.cs2(6, 3)); __A.cs2Etiket()"; sleep 0.5
a "const e = __A.cs2Etiket(); __A.yaz('CS2: raundu alan (ev) vurgulandı', e.includes('Eternal Fire*') && !e.includes('Vitality*'), e); 1" >/dev/null
foto cs2-vurgu
sleep 5
a "const e = __A.cs2Etiket(); __A.yaz('CS2: vurgu 4,5 sn sonra söner', !e.includes('*'), e); __A.veriVer('cs2', __A.cs2(6, 4)); 1" >/dev/null; sleep 0.5
a "const e = __A.cs2Etiket(); __A.yaz('CS2: rakip raundu alınca o vurgulanır', e.includes('Vitality*') && !e.includes('Eternal Fire*'), e); __A.veriVer('cs2', __A.cs2(0, 0, 1, 0, 2)); 1" >/dev/null; sleep 0.5
a "const e = __A.cs2Etiket(); const ak = __A.E()._yonetici._activities.get('basket:cs2'); __A.yaz('CS2: harita değişince sıfırdan, yanlış vurgu yok', ak && ak.data.mac.skor === '0 – 0' && ak.data.mac.dakika === 'Inferno', ak ? JSON.stringify(ak.data.mac) : 'yok'); __A.veriVer('cs2', {canli: [], yaklasan: []}); __A.E()._ayar.set_int('cs2-takip', 0); 1" >/dev/null; sleep 0.5
a "__A.yaz('CS2: maç bitince kapsülden kalkar', __A.E()._yonetici._activities.get('basket:cs2')?.data?.mac?.ev !== 'Eternal Fire'); 1" >/dev/null
