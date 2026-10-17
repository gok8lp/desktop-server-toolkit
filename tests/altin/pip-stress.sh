# Başsız island-test.sh tarafından source edilir; gerçek oturum ayarlarını değiştirmez.
E="Main.extensionManager.lookup('flugel-island@flugel')"
ev "Main.extensionManager.disableExtension('flugel-panel@flugel'); Main.extensionManager.enableExtension('flugel-island@flugel'); '$E'" >/dev/null
sleep 2
WD=$(sed -n "s/.*Using Wayland display name '\([^']*\)'.*/\1/p" "$T/shell.log" | head -1)
FIXTURE="$(dirname "$ADIM")/sahte-pip.py"
GORDUK=0
gorundu_mu() {
    ev "global.get_window_actors().some(a => a.meta_window?.get_title() === 'Picture in picture')" | grep -Fq "(true, 'true')"
}
gorunmesini_bekle() {
    for _ in $(seq 1 20); do
        if gorundu_mu; then return 0; fi
        sleep 0.1
    done
    return 1
}
for bad in 'null' '{broken' '{"kose":42,"dx":0,"dy":0,"w":480,"h":270}' '{"kose":"sol-alt","dx":0,"dy":0,"w":1e999,"h":270}'; do
    ev "$E.stateObj._ayar.set_string('pip-konum', '$bad'); true" >/dev/null
    WAYLAND_DISPLAY="$WD" GDK_BACKEND=wayland python3 "$FIXTURE" & pip_pid=$!
    if gorunmesini_bekle; then GORDUK=$((GORDUK + 1)); fi
    kill "$pip_pid" 2>/dev/null
    wait "$pip_pid" 2>/dev/null
done
ev "$E.stateObj._ayar.reset('pip-konum'); true" >/dev/null
for i in $(seq 1 20); do
    WAYLAND_DISPLAY="$WD" GDK_BACKEND=wayland python3 "$FIXTURE" & pip_pid=$!
    if gorunmesini_bekle; then GORDUK=$((GORDUK + 1)); fi
    kill "$pip_pid" 2>/dev/null
    wait "$pip_pid" 2>/dev/null
done
sleep 1
echo "GNOME tarafından görülen PiP döngüsü: $GORDUK/24"
echo "PiP izlenen pencere sayısı: $(ev "$E.stateObj._pip._pencereler.size")"
echo "PiP aktör yaşam döngüsü hataları: $(rg -c 'pip.js:|already disposed|has no handler with id' "$T/shell.log" || true)"
