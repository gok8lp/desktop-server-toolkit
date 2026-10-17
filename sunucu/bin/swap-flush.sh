#!/bin/bash
# Swap kullanımı belirli eşiği geçince, RAM'de yeterli boş alan varsa
# swap'i temizler (sayfaları RAM'e geri çeker).

THRESHOLD=70   # Swap doluluğu yüzde kaçı geçerse temizle

# Swap toplam ve kullanılan (MB)
SWAP_TOTAL=$(free -m | awk '/^Swap:/ {print $2}')
SWAP_USED=$(free -m | awk '/^Swap:/ {print $3}')

# Swap yoksa çık
[ "$SWAP_TOTAL" -eq 0 ] && exit 0

# Kullanım yüzdesi
SWAP_PCT=$(( SWAP_USED * 100 / SWAP_TOTAL ))

if [ "$SWAP_PCT" -ge "$THRESHOLD" ]; then
    # RAM'de boş alan (MB) - swap'i geri çekebilir miyiz?
    MEM_FREE=$(free -m | awk '/^Mem:/ {print $7}')   # available sütunu

    if [ "$MEM_FREE" -gt "$SWAP_USED" ]; then
        logger -t swap-flush "Swap %$SWAP_PCT dolu. Temizleniyor (swapoff/swapon)."
        swapoff -a && swapon -a
        logger -t swap-flush "Swap temizlendi."
    else
        logger -t swap-flush "Swap %$SWAP_PCT dolu ama RAM yetersiz (avail: ${MEM_FREE}MB, swap: ${SWAP_USED}MB). Atlandı."
    fi
fi
