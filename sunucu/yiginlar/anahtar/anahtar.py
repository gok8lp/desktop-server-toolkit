#!/usr/bin/env python3
# FLUGEL masaüstü anahtarı: Webtop ya da Kasm'ı başlatır (systemd Conflicts diğerini durdurur). 172.17.0.1:8104 (docker köprüsü).
# Önünde nginx (giris kapsayıcısı) şifre sorar; burası sadece yerelden erişilir.
import http.server, json, subprocess, threading
SERVIS = {"webtop": "flugel-webtop.service", "kasm": "flugel-kasm.service"}
def durum():
    return {k: subprocess.run(["systemctl", "is-active", v], capture_output=True, text=True).stdout.strip() for k, v in SERVIS.items()}
class H(http.server.BaseHTTPRequestHandler):
    def _yaz(self, kod, veri):
        b = json.dumps(veri).encode(); self.send_response(kod)
        self.send_header("Content-Type", "application/json"); self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        self._yaz(200, durum()) if self.path.rstrip("/").endswith("durum") else self._yaz(404, {"hata": "yok"})
    def do_POST(self):
        hedef = self.path.rstrip("/").rsplit("/", 1)[-1]
        if hedef not in SERVIS:
            return self._yaz(404, {"hata": "bilinmeyen"})
        threading.Thread(target=lambda: subprocess.run(["systemctl", "start", SERVIS[hedef]]), daemon=True).start()
        self._yaz(202, {"baslatiliyor": hedef})
    def log_message(self, *a):
        pass
http.server.ThreadingHTTPServer(("172.17.0.1", 8104), H).serve_forever()
