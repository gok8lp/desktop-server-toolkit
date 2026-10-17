#!/bin/bash
# vmroot.sh KOMUT — mullvad-ts içinde root olarak komut çalıştırır (qemu-guest-agent guest-exec), çıktıyı yazar.
K=$(printf "%s" "$1" | base64 -w0)
P=$(sudo virsh qemu-agent-command mullvad-ts "{\"execute\":\"guest-exec\",\"arguments\":{\"path\":\"/bin/bash\",\"arg\":[\"-c\",\"echo $K | base64 -d | bash\"],\"capture-output\":true}}" | python3 -c "import json,sys; print(json.load(sys.stdin)[\"return\"][\"pid\"])")
for i in $(seq 1 600); do
  R=$(sudo virsh qemu-agent-command mullvad-ts "{\"execute\":\"guest-exec-status\",\"arguments\":{\"pid\":$P}}")
  echo "$R" | python3 -c "import json,sys; r=json.load(sys.stdin)[\"return\"]; sys.exit(0 if r[\"exited\"] else 1)" && break; sleep 1
done
echo "$R" | python3 -c "
import json,sys,base64; r=json.load(sys.stdin)[\"return\"]
sys.stdout.write(base64.b64decode(r.get(\"out-data\",\"\")).decode(errors=\"replace\")); sys.stderr.write(base64.b64decode(r.get(\"err-data\",\"\")).decode(errors=\"replace\")); sys.exit(r.get(\"exitcode\",0))"
