#!/bin/bash
modprobe vfio-pci

for GPU in "0000:29:00.0" "0000:29:00.1" "0000:29:00.2" "0000:29:00.3"; do
    echo "$GPU" > /sys/bus/pci/drivers/nvidia/unbind 2>/dev/null
    echo "$GPU" > /sys/bus/pci/drivers/nvidia-gpu/unbind 2>/dev/null
    echo "$GPU" > /sys/bus/pci/drivers/snd_hda_intel/unbind 2>/dev/null
    echo "$GPU" > /sys/bus/pci/drivers/xhci_pci/unbind 2>/dev/null
    echo "$GPU" > /sys/bus/pci/drivers/xhci_hcd/unbind 2>/dev/null
    echo "$GPU" > /sys/bus/pci/drivers/i2c_nvidia_gpu/unbind 2>/dev/null

    echo "vfio-pci" > /sys/bus/pci/devices/$GPU/driver_override
    echo "$GPU" > /sys/bus/pci/drivers_probe

    echo "$GPU → vfio-pci bağlandı"
done
