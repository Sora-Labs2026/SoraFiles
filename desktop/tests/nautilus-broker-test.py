"""Protocol tests without a desktop or gi dependency; not a Linux runtime claim."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

gi = types.ModuleType('gi')
repository = types.ModuleType('gi.repository')
repository.GObject = types.SimpleNamespace(GObject=type('GObject', (), {}))
repository.Nautilus = types.SimpleNamespace(MenuProvider=type('MenuProvider', (), {}))
sys.modules['gi'] = gi
sys.modules['gi.repository'] = repository
source = Path(__file__).parent.parent / 'shell' / 'linux' / 'sorafiles.py.in'
namespace = {}
exec(compile(source.read_text(encoding='utf-8').replace('__SORAFILES_APP_JSON__', json.dumps('/opt/Sora Files/app')), str(source), 'exec'), namespace)


class BrokerTests(unittest.TestCase):
    def setUp(self):
        self.files = [str(Path(tempfile.gettempdir()) / 'some file;$(literal).pdf')]

    def broker(self, response):
        def run(args, **kwargs):
            self.assertEqual(args[:2], ['/opt/Sora Files/app', '--shell-menu'])
            self.assertNotIn('shell', kwargs)
            self.assertEqual(kwargs['timeout'], 1.5)
            request = Path(args[2])
            self.assertRegex(request.parent.name, r'^sorafiles-shell-[a-f0-9-]{36}$')
            self.assertEqual(json.loads(request.read_text(encoding='utf-8')), {'version': 1, 'files': self.files})
            Path(args[3]).write_bytes(response)
            self.directory = request.parent
            return types.SimpleNamespace(returncode=0)
        return run

    def test_valid_response_and_cleanup(self):
        with patch.object(subprocess, 'run', self.broker(b'pdf-compress\tCompress PDF\n')):
            self.assertEqual(namespace['resolve_actions'](self.files), [('pdf-compress', 'Compress PDF')])
        self.assertFalse(self.directory.exists())

    def test_rejects_bad_responses(self):
        for response in [b'bad id\tLabel\n', b'a\tLabel\tx\n', b'a\tOne\na\tTwo\n', b'a\t\n', b'x'*65537, b'\xff', b'a\t'+b'x'*101, b'\n'.join((('a'+str(i)+'\tLabel').encode() for i in range(33)))]:
            with self.subTest(response=response[:20]), patch.object(subprocess, 'run', self.broker(response)):
                self.assertEqual(namespace['resolve_actions'](self.files), [])
                self.assertFalse(self.directory.exists())

    def test_timeout_and_input_bounds(self):
        with patch.object(subprocess, 'run', side_effect=subprocess.TimeoutExpired('broker', 1.5)):
            self.assertEqual(namespace['resolve_actions'](self.files), [])
        with patch.object(subprocess, 'run') as run:
            for files in [[], self.files*257, ['relative.pdf'], [self.files[0]+'x'*65536]]:
                self.assertEqual(namespace['resolve_actions'](files), [])
            run.assert_not_called()

    def test_launch_is_literal(self):
        with patch.object(subprocess, 'Popen') as launch:
            namespace['launch']('pdf-compress', self.files)
            self.assertEqual(launch.call_args.args[0], ['/opt/Sora Files/app', '--action', 'pdf-compress', '--']+self.files)
            self.assertNotIn('shell', launch.call_args.kwargs)


if __name__ == '__main__':
    unittest.main()
