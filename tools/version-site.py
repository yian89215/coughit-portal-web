"""Version local asset URLs in the deployment copy, leaving source files intact."""
import os
import re
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

root = Path('_site')
version = os.environ['GITHUB_SHA']
pattern = re.compile(r'\b(src|href|poster)="([^"]+)"')

def replace(match):
    attribute, value = match.groups()
    url = urlsplit(value)
    if url.scheme or url.netloc or not (
        url.path.startswith('assets/') or url.path in ('styles.css', 'script.js')
    ):
        return match.group(0)
    query = [(k, v) for k, v in parse_qsl(url.query) if k != 'v']
    query.append(('v', version))
    updated = urlunsplit((url.scheme, url.netloc, url.path, urlencode(query), url.fragment))
    return f'{attribute}="{updated}"'

for page in root.glob('*.html'):
    page.write_text(pattern.sub(replace, page.read_text()))

(root / 'version.txt').write_text(version + '\n')
