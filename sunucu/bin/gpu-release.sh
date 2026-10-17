#!/bin/bash
for GPU in "0000:29:00.0" "0000:29:00.1" "0000:29:00.2" "0000:29:00.3"; do
    echo "$GPU" > /sys/bus/pci/drivers/vfio-pci/unbind 2>/dev/null

    # Override'ı temizle
    echo "" > /sys/bus/pci/devices/$GPU/driver_override

    # nvidia'ya geri ver
    echo "$GPU" > /sys/bus/pci/drivers_probe

    echo "$GPU → serbest bırakıldı"
done
