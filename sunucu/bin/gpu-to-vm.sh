#!/bin/bash
GPU="0000:29:00.0"

# Nvidia sürücüsünü ayır
echo $GPU > /sys/bus/pci/drivers/nvidia/unbind 2>/dev/null

# vfio-pci'ye bağla
echo $GPU > /sys/bus/pci/drivers/vfio-pci/bind
echo "GPU → VM'e verildi"
