#!/usr/bin/env python3
"""Read-only, allowlisted local/SSH inventory. No credentials or raw config dumps."""

import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
REPOS = [ROOT.parent, ROOT.parent.parent / "flugel-island"]
REMOTE = r'''
import json, pathlib, re, subprocess

def run(*args, timeout=12):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)
        return p.stdout.strip() if p.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None

def os_name():
    try:
        for line in pathlib.Path('/etc/os-release').read_text().splitlines():
            if line.startswith('PRETTY_NAME='):
                return line.split('=', 1)[1].strip('"')
    except OSError:
        pass
    return None

def addresses():
    raw = run('ip', '-j', '-4', 'addr', 'show')
    if not raw:
        return []
    rows = json.loads(raw)
    return [{'interface': r['ifname'], 'ipv4': [a['local'] + '/' + str(a['prefixlen']) for a in r.get('addr_info', []) if a.get('family') == 'inet']}
            for r in rows if not re.match(r'^(lo|veth|br-|docker)', r['ifname'])]

def listeners(protocol):
    raw = run('ss', '-H', '-ltn' if protocol == 'tcp' else '-lun') or ''
    result = set()
    allowed = {'0.0.0.0', '*', '[::]', '127.0.0.1', '[::1]'}
    for interface in addresses():
        allowed.update(ip.split('/')[0] for ip in interface['ipv4'])
    for line in raw.splitlines():
        parts = line.split()
        if len(parts) >= 4:
            bind = parts[3]
            match = re.search(r':(\d+)$', bind)
            if match:
                host = bind[:match.start()].split('%')[0]
                if host in allowed:
                    result.add((host, int(match.group(1))))
    return [{'bind': bind, 'port': port, 'protocol': protocol} for bind, port in sorted(result)]

def containers():
    raw = run('docker', 'ps', '--format', '{{json .}}', timeout=20) or ''
    result = []
    for line in raw.splitlines():
        try:
            obj = json.loads(line)
            result.append({k: obj.get(k) for k in ('Names', 'Image', 'Status', 'Ports')})
        except json.JSONDecodeError:
            continue
    return result

def disks():
    raw = run('df', '-B1', '--output=target,size,used,avail,pcent', '/', '/mnt/side', '/mnt/sidemain') or ''
    rows = []
    for line in raw.splitlines()[1:]:
        p = line.split()
        if len(p) == 5 and p[1].isdigit():
            rows.append({'mount': p[0], 'size_bytes': int(p[1]), 'used_bytes': int(p[2]), 'available_bytes': int(p[3]), 'used_percent': p[4]})
    return rows

def memory():
    raw = run('free', '-b') or ''
    out = {}
    for line in raw.splitlines():
        p = line.split()
        if p and p[0].rstrip(':') in ('Mem', 'Swap') and len(p) >= 4:
            out[p[0].rstrip(':').lower()] = {'total_bytes': int(p[1]), 'used_bytes': int(p[2]), 'free_bytes': int(p[3])}
    return out

def services():
    raw = run('systemctl', 'list-units', '--type=service', '--state=running', '--no-legend', '--no-pager') or ''
    return sorted({line.split()[0] for line in raw.splitlines() if line.split()})

def vms():
    raw = run('virsh', 'list', '--all') or ''
    rows = []
    for line in raw.splitlines()[2:]:
        p = line.split(None, 2)
        if len(p) == 3:
            rows.append({'name': p[1], 'state': p[2]})
    return rows

cpu = run('lscpu') or ''
model = next((line.split(':', 1)[1].strip() for line in cpu.splitlines() if line.startswith('Model name:')), None)
gpu = [line.split(': ', 1)[-1] for line in (run('lspci') or '').splitlines() if re.search(r'VGA|3D|Display', line, re.I)]
print(json.dumps({'hostname': run('hostname'), 'os': os_name(), 'kernel': run('uname', '-r'),
 'cpu_model': model, 'cpu_threads': run('nproc'), 'gpu_pci': gpu, 'memory': memory(), 'disks': disks(),
 'addresses': addresses(), 'listeners': listeners('tcp') + listeners('udp'), 'containers': containers(),
 'running_services': services(), 'vms': vms(), 'docker_version': run('docker', 'version', '--format', '{{.Server.Version}}'),
 'tailscale_ipv4': run('tailscale', 'ip', '-4')}, ensure_ascii=False))
'''


def run(*args, timeout=12):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)
        if p.returncode == 0:
            return p.stdout.strip()
        return None
    except (OSError, subprocess.TimeoutExpired):
        return None


def repo_state(path):
    if not (path / '.git').exists():
        return {'path': str(path), 'available': False}
    return {'path': str(path), 'available': True,
            'branch': run('git', '-C', str(path), 'branch', '--show-current'),
            'head': run('git', '-C', str(path), 'rev-parse', 'HEAD'),
            'origin_main_local_ref': run('git', '-C', str(path), 'rev-parse', '--verify', 'refs/remotes/origin/main'),
            'dirty': bool(run('git', '-C', str(path), 'status', '--porcelain=v1'))}


def local_host():
    extensions = (run('gnome-extensions', 'list', '--enabled') or '').splitlines()
    cpu = run('lscpu') or ''
    cpu_model = next((line.split(':', 1)[1].strip() for line in cpu.splitlines() if line.startswith('Model name:')), None)
    pci = run('lspci') or ''
    gpu = [line.split(': ', 1)[-1] for line in pci.splitlines() if re.search(r'VGA|3D|Display', line, re.I)]
    os_name = next((line.split('=', 1)[1].strip('"') for line in Path('/etc/os-release').read_text().splitlines() if line.startswith('PRETTY_NAME=')), None)
    return {'hostname': run('hostname'), 'os': os_name, 'kernel': run('uname', '-r'),
            'cpu_model': cpu_model, 'cpu_threads': run('nproc'), 'gpu_pci': gpu,
            'gnome_shell': run('gnome-shell', '--version'), 'enabled_gnome_extensions': extensions,
            'repositories': [repo_state(p) for p in REPOS]}


def get_remote():
    try:
        p = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5',
                            '-o', 'StrictHostKeyChecking=yes', 'flugelserver', 'python3 -'],
                           input=REMOTE, capture_output=True, text=True, timeout=35, check=False)
        if p.returncode == 0:
            return json.loads(p.stdout), None
        return None, 'SSH inventory failed (exit ' + str(p.returncode) + ')'
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError) as exc:
        return None, type(exc).__name__


def atomic_json(path, data):
    fd, name = tempfile.mkstemp(prefix='.server-state-', dir=ROOT)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(data, stream, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def main():
    lock_path = ROOT / '.inventory.lock'
    with open(lock_path, 'w', encoding='utf-8') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        server, error = get_remote()
        now = dt.datetime.now(dt.timezone.utc).isoformat()
        previous = ROOT / 'SERVER_STATE_INDEX.json'
        previous_server = None
        if previous.exists():
            try:
                previous_server = json.loads(previous.read_text(encoding='utf-8')).get('server')
            except (OSError, json.JSONDecodeError):
                pass
        data = {'schema_version': 1, 'generated_at_utc': now,
                'inventory_policy': 'read-only allowlist; no credentials, environment variables, raw logs or firewall rules',
                'local': local_host(),
                'server': server if server is not None else previous_server,
                'server_fresh': server is not None, 'server_error': error,
                'projects': {
                    'island': {'main_repo_source': 'extensions/flugel-island@flugel',
                               'separate_repo': str(REPOS[1]), 'deployed_copy': '~/.local/share/gnome-shell/extensions/flugel-island@flugel'},
                    'akis': {'source': 'sunucu/panel/akis', 'server_source': '/opt/stacks/panel/akis',
                             'container': 'flugel-akis', 'host_port': 3012}}}
        if previous.exists():
            shutil.copy2(previous, ROOT / 'SERVER_STATE_INDEX.previous.json')
        atomic_json(previous, data)
        print(f"Updated {previous}; server_fresh={data['server_fresh']}; containers={len((data['server'] or {}).get('containers', []))}")
        if error:
            print(error)


if __name__ == '__main__':
    main()
