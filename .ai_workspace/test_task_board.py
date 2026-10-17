#!/usr/bin/env python3
"""Isolated protocol tests; never access the real task board."""

from pathlib import Path
import json
import shutil
import subprocess
import tempfile
import unittest


SOURCE = Path(__file__).with_name('task_board.py')


class TaskBoardTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='flugel-board-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'Projects' / 'flugel' / '.ai_workspace'
        self.root.mkdir(parents=True)
        shutil.copyfile(SOURCE, self.root / 'task_board.py')
        self.call('init', expected=0)

    def call(self, *args, expected):
        result = subprocess.run(['python3', str(self.root / 'task_board.py'), *args],
                                capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return result

    def test_overlap_and_release(self):
        self.call('add', 'AI-101', '--agent', 'codex', '--title', 'Akış',
                  '--paths', 'sunucu/panel/akis', expected=0)
        self.call('add', 'AI-102', '--agent', 'claude', '--title', 'Panel',
                  '--paths', 'sunucu/panel', expected=0)
        self.call('claim', 'AI-101', '--agent', 'codex', expected=0)
        conflict = self.call('claim', 'AI-102', '--agent', 'claude', expected=2)
        self.assertIn('çakışıyor', conflict.stderr)
        self.call('release', 'AI-101', '--agent', 'codex', '--status', 'ready', expected=0)
        self.call('claim', 'AI-102', '--agent', 'claude', expected=0)
        board = (self.root / 'AGENT_TASK_BOARD.md').read_text(encoding='utf-8')
        self.assertIn('sahip: `claude`', board)

    def test_forbidden_sibling_project(self):
        rejected = self.call('add', 'AI-103', '--agent', 'codex', '--title', 'Yasak',
                             '--paths', '../weekly-task', expected=2)
        self.assertIn('kapsamı yasak', rejected.stderr)
        self.assertEqual(json.loads((self.root / 'tasks.json').read_text())['tasks'], [])


if __name__ == '__main__':
    unittest.main()
