"""Save synchronized simulator image/metric pairs using only Python's standard library."""
import argparse
import base64
import json
from pathlib import Path
import time
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend', default='http://127.0.0.1:3000')
    parser.add_argument('--count', type=int, default=1)
    parser.add_argument('--output', type=Path, default=Path('observations'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    previous = None
    saved = 0
    deadline = time.monotonic() + max(10, args.count * 3)
    while saved < args.count:
        if time.monotonic() > deadline:
            raise SystemExit('Timed out waiting for new frames. Keep the simulator tab visible.')
        with urllib.request.urlopen(args.backend.rstrip('/') + '/api/camera/frame', timeout=3) as response:
            observation = json.load(response)
        identity = (observation['sessionId'], observation['frameId'])
        if identity == previous:
            time.sleep(0.1)
            continue
        previous = identity
        image = base64.b64decode(observation.pop('image'))
        stem = args.output / f'{identity[0]}-{identity[1]:06d}'
        stem.with_suffix('.jpg').write_bytes(image)
        stem.with_suffix('.json').write_text(json.dumps(observation, indent=2), encoding='utf-8')
        print(f'Saved frame {identity[1]}: {observation["distances"]}')
        saved += 1
        time.sleep(0.2)


if __name__ == '__main__':
    main()
