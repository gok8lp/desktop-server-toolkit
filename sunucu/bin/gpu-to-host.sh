#!/bin/bash
GPU="0000:29:00.0"

# vfio'dan ayır
echo $GPU > /sys/bus/pci/drivers/vfio-pci/unbind 2>/dev/null

# nvidia sürücüsüne bağla
echo $GPU > /sys/bus/pci/drivers/nvidia/bind
echo "GPU → Host'a verildi"
