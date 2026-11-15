"""Migrate local Excel to 12 columns and refresh offline preview. Standard library only."""
from pathlib import Path
import json
import shutil
import xml.etree.ElementTree as E
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Catàleg exercicis.xlsx'
HEADERS = ['ID', 'Nom CA', 'Nom EN', 'Modalitat', 'Grups musculars', 'Grups articulars', 'Patró de moviment', 'Material', 'Lateralitat', 'Mètriques de registre', 'Instruccions', 'Vídeo / enllaç']
NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
N = {'m': NS}

def read_rows(z):
    strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        strings = [''.join(x.itertext()) for x in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', N)]
    rows = []
    for r in E.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('m:sheetData/m:row', N):
        cells = {}
        for c in r.findall('m:c', N):
            v = c.find('m:v', N)
            value = v.text if v is not None else ''
            if c.get('t') == 's': value = strings[int(value)]
            elif c.get('t') == 'inlineStr': value = ''.join(c.find('m:is', N).itertext())
            cells[''.join(x for x in c.get('r') if x.isalpha())] = value
        rows.append(cells)
    headers = {col: value.strip() for col, value in rows[0].items()}
    return [{headers[col]: value for col, value in row.items() if col in headers} for row in rows[1:] if row.get('A')]

def main():
    with zipfile.ZipFile(SOURCE) as z:
        rows = read_rows(z)
        files = {name: z.read(name) for name in z.namelist()}
    assert len({r['ID'] for r in rows}) == len(rows)
    backup = ROOT / 'backups' / 'Catàleg exercicis.original.xlsx'
    backup.parent.mkdir(exist_ok=True)
    if not backup.exists(): shutil.copy2(SOURCE, backup)
    joints = {
        'Monster walk': 'Maluc', 'Obertura de banda': 'Espatlla; escàpula',
        'Pullover': 'Espatlla', 'Elevació de talons': 'Turmell',
        'Elevació unilateral de taló': 'Turmell', 'Face pull': 'Espatlla; escàpula',
        'Hip hike': 'Maluc; pelvis', 'Estirament de pectoral a la paret': 'Espatlla',
        'Estirament dorsal amb suport': 'Espatlla', "Estirament d'isquiotibials": 'Maluc; genoll',
        'Estirament de glutis': 'Maluc', 'Estirament de bessons': 'Turmell',
        'Rotació externa activa amb banda': 'Espatlla',
    }
    for row in rows:
        if row.get('Nom CA') in joints: row['Grups articulars'] = joints[row['Nom CA']]
    sheet = E.Element('worksheet', xmlns=NS)
    E.SubElement(sheet, 'dimension', ref=f'A1:L{len(rows)+1}')
    data = E.SubElement(sheet, 'sheetData')
    values = [HEADERS] + [[r.get(h, '') for h in HEADERS] for r in rows]
    for rn, row in enumerate(values, 1):
        element = E.SubElement(data, 'row', r=str(rn))
        for cn, value in enumerate(row):
            cell = E.SubElement(element, 'c', r=f'{chr(65+cn)}{rn}', t='inlineStr')
            E.SubElement(E.SubElement(cell, 'is'), 't').text = str(value)
    E.SubElement(sheet, 'autoFilter', ref=f'A1:L{len(rows)+1}')
    files['xl/worksheets/sheet1.xml'] = E.tostring(sheet, encoding='utf-8', xml_declaration=True)
    temp = SOURCE.with_suffix('.tmp.xlsx')
    with zipfile.ZipFile(temp, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, content in files.items(): z.writestr(name, content)
    temp.replace(SOURCE)
    (ROOT / 'catalog-preview-data.js').write_text('window.CATALOG_PREVIEW_ROWS = ' + json.dumps(values, ensure_ascii=False) + ';\n', encoding='utf-8')
    print(f'Converted {len(rows)} exercises to {len(HEADERS)} columns. Original preserved in backups/.')

if __name__ == '__main__': main()
