"""Extract only numeric illustration tables; never copy client identifiers into the repo.

Usage: python scripts/extract-metlife-fixtures.py --male male.pdf --female female.pdf
Requires pdftotext; standard-library Python only.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROW = re.compile(r'^\s*(\d+)(개월|년)\s+(\d+)세\s+([\d,]+)\s+(.+?)\s*$')


def table(page, kind):
    rows = []
    for line in page.splitlines():
        match = ROW.match(line)
        if not match:
            continue
        amount, unit, age, paid, rest = match.groups()
        tokens = rest.split()
        count = 6 if kind == 'surrender' else 3
        if len(tokens) != count:
            raise ValueError(f'Unexpected {kind} row: {line}')
        row = {'month': int(amount) * (12 if unit == '년' else 1),
               'label': amount + unit, 'age': int(age),
               'paidDisplayWon': int(paid.replace(',', '')) * 10000}
        if kind == 'surrender':
            row['scenarios'] = {
                rate: {'surrenderDisplayWon': int(tokens[2*i].replace(',', '')) * 10000,
                       'refundRatePercent': float(tokens[2*i+1].rstrip('%'))}
                for i, rate in enumerate(['-1', '2.5', '3.75'])}
        else:
            row['death'] = {rate: int(tokens[i].replace(',', '')) * 10000
                            for i, rate in enumerate(['-1', '2.5', '3.75'])}
        rows.append(row)
    if len(rows) != 29:
        raise ValueError(f'Expected 29 rows, got {len(rows)}')
    return rows


def extract(path, gender):
    text = subprocess.check_output(['pdftotext', '-layout', str(path), '-']).decode('utf-8')
    pages = text.split('\f')
    base = table(pages[12], 'surrender')
    death = {r['month']: r['death'] for r in table(pages[11], 'death')}
    for row in base:
        for rate in row['scenarios']:
            row['scenarios'][rate]['deathDisplayWon'] = death[row['month']][rate]
    result = {'gender': gender, 'sourceTitle': path.name,
              'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
              'sourcePages': {'contract': 9, 'death': 12, 'base': 13},
              'monthlyBasePremiumWon': 1136000 if gender == 'male' else 775000,
              'base': base}
    if gender == 'male':
        result['extra100'] = table(pages[14], 'surrender')
        result['sourcePages']['extra100'] = 15
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--male', type=Path, required=True)
    parser.add_argument('--female', type=Path, required=True)
    args = parser.parse_args()
    data = {'version': '0.1.0', 'product': '무배당 메트라이프 변액리치정기보험',
            'productVersionDate': '2026-10-20', 'illustrationDate': '2026-10-28',
            'issueAge': 40, 'maturityAge': 90, 'sumAssuredWon': 1000000000,
            'underwriting': '일반가입형', 'paymentTerm': '전기납',
            'funds': '골드투자형 20% · 미국주식형3호 80%',
            'rates': ['-1', '2.5', '3.75'],
            'amountPrecisionWon': 10000,
            'profiles': {g: extract(p, g) for g, p in [('male', args.male), ('female', args.female)]}}
    destination = Path(__file__).resolve().parents[1] / 'metlife' / 'fixtures.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'Extracted 87 illustration points to {destination.name}')
