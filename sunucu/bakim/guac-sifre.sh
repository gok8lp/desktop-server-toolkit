#!/bin/bash
# Guacamole (tarayıcıdan masaüstü) "flugel" yöneticisinin şifresini koyar. Şifre ekranda görünmez, komut satırına yazılmaz.
# Guacamole biçimi: hash = SHA-256(şifre + BÜYÜK harf onaltılık tuz)
set -e
read -rsp "Guacamole (web masaüstü) için yeni şifre: " S1; echo
read -rsp "Tekrar: " S2; echo
[ ${#S1} -ge 6 ] || { echo "En az 6 karakter olsun. Hiçbir şey değişmedi."; exit 1; }
[ "$S1" = "$S2" ] || { echo "Şifreler uyuşmuyor. Hiçbir şey değişmedi."; exit 1; }
SQL=$(printf "%s" "$S1" | python3 -c "
import sys, os, hashlib
p = sys.stdin.read(); s = os.urandom(32)
h = hashlib.sha256((p + s.hex().upper()).encode()).hexdigest()
print(\"UPDATE guacamole_user SET password_hash = decode(%s, %s), password_salt = decode(%s, %s), password_date = now() WHERE entity_id = (SELECT entity_id FROM guacamole_entity WHERE name = %s AND type = %s);\" % (repr(h), repr(\"hex\"), repr(s.hex()), repr(\"hex\"), repr(\"flugel\"), repr(\"USER\")))
")
unset S1 S2
printf "%s\n" "$SQL" | docker exec -i guac-db psql -q -U guacamole -d guacamole -v ON_ERROR_STOP=1 && echo "Tamam: Guacamole şifresi kondu. Kullanıcı adı: flugel"
