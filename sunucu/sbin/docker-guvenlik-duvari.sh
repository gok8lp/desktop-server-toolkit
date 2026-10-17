#!/bin/sh
# Docker'in yayinladigi portlara internetten (fiziksel ag kartindan, ev agi disindan) gelen yeni baglantilari engeller.
# Ev agi (<IP>/16) ve Tailscale (tailscale0 arayuzu, bu kurala hic girmez) erisebilir. (sistem-bakim)
IF=enp37s0
iptables -N DOCKER-USER 2>/dev/null || true
for r in "-i $IF -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN" "-i $IF -s <IP>/16 -j RETURN" "-i $IF -j DROP"; do
  iptables -C DOCKER-USER $r 2>/dev/null || iptables -A DOCKER-USER $r
done
# DOCKER-USER'in sonunda RETURN varsa DROP'tan once kalmasin diye sirayi kontrol et
