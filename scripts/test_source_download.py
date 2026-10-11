import gzip
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from prepare_geo import download


class SourceDownloadTests(unittest.TestCase):
    def test_compressed_snapshot_keeps_exact_source_and_reuses_cache(self):
        features = [{'properties': {'mrgid': i}} for i in range(101)]
        canonical = json.dumps({'type': 'FeatureCollection', 'features': features},
                               sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
        digest = hashlib.sha256(canonical).hexdigest()
        with tempfile.TemporaryDirectory() as directory:
            with patch('prepare_geo.SOURCES', {'iho': ('https://original.example', digest)}), \
                    patch('prepare_geo.urllib.request.urlopen', return_value=io.BytesIO(gzip.compress(canonical))) as request:
                path = download(Path(directory), 'iho')
                self.assertEqual(path.read_bytes(), canonical)
                self.assertEqual(download(Path(directory), 'iho'), path)
                request.assert_called_once()
                self.assertIn('/releases/download/', request.call_args.args[0].full_url)

    def test_bad_checksum_does_not_publish_or_leave_partial_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch('prepare_geo.SOURCES', {'rivers': ('https://original.example', 'invalid')}), \
                    patch('prepare_geo.urllib.request.urlopen', return_value=io.BytesIO(b'bad source')):
                with self.assertRaisesRegex(ValueError, 'checksum changed'):
                    download(Path(directory), 'rivers')
                self.assertEqual(list(Path(directory).iterdir()), [])
