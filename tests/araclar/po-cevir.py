#!/usr/bin/env python3
"""po-cevir.py — en.po'ya JSON sözlükten çeviri uygular (eksik ve 'fuzzy' girdiler; fuzzy işareti kaldırılır).
Kullanım: po-cevir.py po/en.po ceviri.json"""
import json, re, sys

p, sozluk = sys.argv[1], json.load(open(sys.argv[2], encoding='utf-8'))
bloklar = open(p, encoding='utf-8').read().split('\n\n')
out, n = [], 0
for b in bloklar:
    satirlar = b.split('\n')
    if any(s.startswith('#~') for s in satirlar) or not any(s.startswith('msgid ') for s in satirlar):
        out.append(b)
        continue
    i = next(k for k, s in enumerate(satirlar) if s.startswith('msgid '))
    j = next(k for k, s in enumerate(satirlar) if s.startswith('msgstr '))
    mid = ''.join(json.loads(s[6:] if k == i else s) for k, s in enumerate(satirlar[i:j], start=i))
    if mid in sozluk:
        bas = [s for s in satirlar[:i] if not s.startswith('#|')]
        bas = [re.sub(r',\s*fuzzy', '', s) for s in bas]
        bas = [s for s in bas if s.strip() != '#,']
        satirlar = bas + satirlar[i:j] + ['msgstr ' + json.dumps(sozluk[mid], ensure_ascii=False)]
        n += 1
    out.append('\n'.join(satirlar))
open(p, 'w', encoding='utf-8').write('\n\n'.join(out))
print('uygulandı', n)
