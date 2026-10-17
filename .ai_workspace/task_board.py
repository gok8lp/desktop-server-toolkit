#!/usr/bin/env python3
"""Cooperative task claims with one writer lock and atomic board updates."""

import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import shutil
import tempfile

ROOT = Path(__file__).resolve().parent
STORE = ROOT / 'tasks.json'
BOARD = ROOT / 'AGENT_TASK_BOARD.md'
FORBIDDEN = (ROOT.parent.parent / 'weekly-task', ROOT.parent.parent / 'weekly-tasks')


def now():
    return dt.datetime.now(dt.timezone.utc)


def stamp(value):
    return value.isoformat(timespec='seconds')


def atomic(path, content):
    fd, name = tempfile.mkstemp(prefix='.task-', dir=ROOT)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def seed():
    return {'schema_version': 1, 'tasks': []}


def overlap(a, b):
    a, b = a.rstrip('/'), b.rstrip('/')
    return a == b or a.startswith(b + '/') or b.startswith(a + '/')


def forbidden(path):
    candidate = (ROOT.parent / path).resolve()
    return any(candidate == target or candidate.is_relative_to(target) or target.is_relative_to(candidate)
               for target in FORBIDDEN)


def active(task, moment):
    if task['status'] != 'in_progress' or not task.get('owner'):
        return False
    try:
        return dt.datetime.fromisoformat(task['lease_until']) > moment
    except (KeyError, ValueError):
        return True


def render(data):
    lines = ['# Ajan görev panosu', '', 'Kaynak: `tasks.json`; bu dosya `task_board.py` tarafından üretilir. Yerel sunucu durumu için `SERVER_STATE_INDEX.json`, kurallar için `RULES_AND_PERMISSIONS.md` okuyun.', '', 'Aktif görevler sahip alanında görünür. Başka ajanın işi varsayılmaz.', '']
    for task in data['tasks']:
        lines += [f"## {task['id']} — {task['title']}", '',
                  f"- Durum: `{task['status']}`; sahip: `{task.get('owner') or 'yok'}`; kira sonu: `{task.get('lease_until') or 'yok'}`",
                  f"- Dosyalar: {', '.join('`' + p + '`' for p in task['paths'])}",
                  f"- Kanıt: {task.get('evidence') or 'yok'}",
                  f"- Sonraki adım: {task.get('next') or 'yok'}", '']
    lines += ['## Kullanım', '', '```bash', 'python3 .ai_workspace/task_board.py list', 'python3 .ai_workspace/task_board.py claim AI-002 --agent codex', 'python3 .ai_workspace/task_board.py update AI-002 --agent codex --evidence "Dosya/satır ve test sonucu" --next "Sıradaki işlem"', 'python3 .ai_workspace/task_board.py release AI-002 --agent codex --status done', '```', '', 'Kira bitse bile açık dosyayı zorla ezme; önce çalışma ağacı ve son değişiklikleri denetle.']
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['init', 'list', 'add', 'claim', 'update', 'release'])
    parser.add_argument('task_id', nargs='?')
    parser.add_argument('--agent')
    parser.add_argument('--title')
    parser.add_argument('--paths', nargs='+')
    parser.add_argument('--evidence')
    parser.add_argument('--next')
    parser.add_argument('--status', choices=['done', 'blocked', 'ready'])
    parser.add_argument('--lease-hours', type=int, default=4)
    args = parser.parse_args()
    with open(ROOT / '.tasks.lock', 'w', encoding='utf-8') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        data = json.loads(STORE.read_text(encoding='utf-8')) if STORE.exists() else seed()
        task = next((t for t in data['tasks'] if t['id'] == args.task_id), None)
        if args.action not in ('init', 'list', 'add') and not task:
            parser.error('Bilinmeyen görev ID')
        if args.action in ('add', 'claim', 'update', 'release') and not args.agent:
            parser.error('--agent gerekli')
        moment = now()
        if args.action == 'add':
            if not args.task_id or not args.title or not args.paths:
                parser.error('Yeni görev için ID, --title ve --paths gerekli')
            if any(forbidden(path) for path in args.paths):
                parser.error('weekly-task ve weekly-tasks kapsamı yasak')
            if task or not args.task_id.startswith('AI-'):
                parser.error('Görev ID mevcut veya AI- ile başlamıyor')
            data['tasks'].append({'id': args.task_id, 'title': args.title, 'status': 'ready',
                                  'owner': None, 'paths': args.paths, 'evidence': args.evidence or '',
                                  'next': args.next or '', 'created_by': args.agent,
                                  'updated_at': stamp(moment)})
        elif args.action == 'claim':
            if any(forbidden(path) for path in task['paths']):
                parser.error('weekly-task ve weekly-tasks kapsamı yasak')
            if active(task, moment) and task['owner'] != args.agent:
                parser.error('Görev başka ajanda; çakışma var')
            for other in data['tasks']:
                if other is not task and active(other, moment) and other['owner'] != args.agent:
                    if any(overlap(a, b) for a in task['paths'] for b in other['paths']):
                        parser.error('Dosya kapsamı ' + other['id'] + ' ile çakışıyor')
            if task['status'] == 'done':
                parser.error('Tamamlanan görev tekrar açılamaz; yeni görev açın')
            task.update(status='in_progress', owner=args.agent, lease_until=stamp(moment + dt.timedelta(hours=args.lease_hours)), updated_at=stamp(moment))
        elif args.action in ('update', 'release'):
            if task.get('owner') != args.agent or task['status'] != 'in_progress':
                parser.error('Yalnızca görev sahibi güncelleyebilir')
            if args.evidence is not None:
                task['evidence'] = args.evidence
            if args.next is not None:
                task['next'] = args.next
            task['updated_at'] = stamp(moment)
            if args.action == 'update':
                task['lease_until'] = stamp(moment + dt.timedelta(hours=args.lease_hours))
            else:
                task.update(status=args.status or 'ready', owner=None, lease_until=None)
        if args.action != 'list':
            if STORE.exists():
                shutil.copy2(STORE, ROOT / 'tasks.previous.json')
            atomic(STORE, json.dumps(data, ensure_ascii=False, indent=2) + '\n')
            atomic(BOARD, render(data))
            if args.action != 'init':
                with open(ROOT / 'task_events.jsonl', 'a', encoding='utf-8') as events:
                    events.write(json.dumps({'at_utc': stamp(moment), 'action': args.action,
                                             'task_id': args.task_id, 'agent': args.agent,
                                             'evidence': args.evidence, 'next': args.next}, ensure_ascii=False) + '\n')
                    events.flush()
                    os.fsync(events.fileno())
        else:
            print(render(data))
        if args.action != 'list':
            print(f"{args.action}: {args.task_id or 'board'}")


if __name__ == '__main__':
    main()
