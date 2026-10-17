#!/bin/bash
# Fiziksel disk kimligi ile calisir, isim kaymasindan etkilenmez
DISKS=(
  "/dev/disk/by-id/usb-Samsung_M3_Portable_923D7DF202000065-0:0"
  "/dev/disk/by-id/ata-ST500DM002-1BD142_Z3T34PVR"
)
while true; do
  for D in "${DISKS[@]}"; do
    [ -b "$D" ] && dd if="$D" of=/dev/null bs=512 count=1 iflag=direct 2>/dev/null
  done
  sleep 5
done
