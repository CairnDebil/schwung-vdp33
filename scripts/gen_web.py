#!/usr/bin/env python3
"""Keep the browser editor and the manual in step with the engine.

Reads the parameter table (g_params), the presets (g_presets) and the on-screen
pages (get_ui_hierarchy) from src/dsp/vdp33.c and writes them
  * as JSON into src/web/web_ui.html   (between the vdp-data script tags),
  * as JSON, the parameter reference table, the preset list and the version
    into docs/index.html               (between the data:, params:, presets:
                                        and ver: markers),
then copies the editor to docs/editor.html so the manual can show it in demo mode.

  python3 scripts/gen_web.py          update the files
  python3 scripts/gen_web.py --check  exit 1 if any file is out of date
"""
import html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src', 'dsp', 'vdp33.c')
MODULE = os.path.join(ROOT, 'src', 'module.json')
EDITOR = os.path.join(ROOT, 'src', 'web', 'web_ui.html')
MANUAL = os.path.join(ROOT, 'docs', 'index.html')
DEMO = os.path.join(ROOT, 'docs', 'editor.html')

# the panel sections, in the order of the manual and the editor; every parameter belongs to exactly one
GROUPS = [
    ('Balance and output', ['volume', 'lvl_str', 'lvl_voice', 'lvl_org', 'direct_mic', 'ext_ens', 'out_tone']),
    ('Vocoder', ['zone_voc', 'mic_gain', 'voc_tone', 'ens_voc', 'sibilance']),
    ('Human voice', ['hv_m8_low', 'hv_m4_low', 'hv_m8_up', 'hv_f4_up', 'att_voice', 'ens_voice']),
    ('Strings', ['zone_str', 'str_reg', 'att_str', 'tone', 'att_legato', 'vib_str']),
    ('Organ', ['zone_org', 'org_8', 'org_4', 'org_2', 'org_1', 'org_tone', 'ens_org', 'vib_org']),
    ('Envelope', ['release', 'rel_mode']),
    ('Ensemble', ['ens_mode', 'ens_depth', 'ens_rate']),
    ('Vibrato', ['vib_rate', 'vib_delay', 'vib_depth']),
    ('Pitch shift and tuning', ['ps_mode', 'ps_set', 'ps_time', 'ps_fader', 'tune', 'tune_ref', 'bend_range',
                                'octave_transpose']),
    ('Keyboard and pedals', ['split', 'velocity', 'voc_pedal']),
]

# what a preset keeps from the player when it is loaded (see apply_preset in vdp33.c)
KEEP = ['octave_transpose', 'bend_range', 'volume', 'tune', 'velocity', 'tune_ref', 'out_tone']


def num(s):
    s = s.strip().rstrip('fF')
    return float(s)


def read_c():
    return open(SRC, encoding='utf-8').read()


def enums(c):
    """Every `enum { A, B, C };` as name -> index."""
    out, p_order = {}, []
    for m in re.finditer(r'enum\s*\{([^}]*)\};', c):
        body = re.sub(r'/\*.*?\*/', '', m.group(1), flags=re.S)
        names = [n.strip() for n in body.split(',') if n.strip()]
        for i, n in enumerate(names):
            out[n] = i
        if 'P_VOLUME' in names:
            p_order = [n for n in names if n.startswith('P_') and n != 'P_COUNT']
    return out, p_order


def parse(c):
    consts, p_order = enums(c)
    consts['ON'] = 1
    opts = {m.group(1): re.findall(r'"([^"]*)"', m.group(2))
            for m in re.finditer(r'static const char \*const (OPT_\w+)\[\]\s*=\s*\{([^}]*)\}', c)}
    table = c[c.index('static const pdef_t g_params[P_COUNT]'):]
    table = table[:table.index('\n};')]
    by_enum = {}
    for line in table.splitlines():
        m = re.match(r'\s*\[(P_\w+)\]\s*=\s*(PF|PI|PE)\((.*)\),?\s*$', line)
        if not m:
            continue
        pid, kind, args = m.groups()
        a = [x.strip() for x in re.findall(r'"[^"]*"|[^,]+', args)]
        key, name, short = (x.strip('"') for x in a[:3])
        p = {'key': key, 'name': name, 'short': short}

        def val(tok):
            return float(consts[tok]) if tok in consts else num(tok)
        if kind == 'PF':
            p.update(type='float', min=0.0, max=1.0, default=val(a[3]), step=0.01)
        elif kind == 'PI':
            p.update(type='int', min=val(a[3]), max=val(a[4]), default=val(a[5]), step=1)
        else:
            o = opts[a[3]]
            assert int(a[4]) == len(o), 'option count of %s' % key
            p.update(type='enum', options=o, min=0, max=len(o) - 1, default=val(a[5]), step=1)
        by_enum[pid] = p
    params = [by_enum[k] for k in p_order]
    assert len(params) == len(by_enum) >= 40, 'parameter table not found (%d entries)' % len(params)
    group_of = {k: g for g, ks in GROUPS for k in ks}
    for p in params:
        assert p['key'] in group_of, 'parameter %s has no group in gen_web.py' % p['key']
        p['group'] = group_of[p['key']]
    for g, ks in GROUPS:
        for k in ks:
            assert any(p['key'] == k for p in params), 'group member %s is not a parameter' % k
    key_of = {pid: p['key'] for pid, p in by_enum.items()}

    # presets
    block = c[c.index('static const preset_t g_presets[] = {'):]
    block = block[:block.index('\n};')]
    block = re.sub(r'/\*.*?\*/', '', block, flags=re.S)
    presets = []
    for m in re.finditer(r'\{\s*"([^"]+)",\s*\{(.*?)END\s*\}\s*\}', block, flags=re.S):
        vals = {}
        for pid, v in re.findall(r'\{\s*(P_\w+)\s*,\s*([^}]+?)\s*\}', m.group(2)):
            vals[key_of[pid]] = float(consts[v]) if v in consts else num(v)
        presets.append({'name': m.group(1), 'values': vals})
    assert len(presets) >= 15

    # on-screen pages
    h = c[c.index('static int get_ui_hierarchy'):]
    h = h[h.index('static const char *h ='):]
    h = h[:h.index(';')]
    lit = ''.join(re.findall(r'"((?:[^"\\]|\\.)*)"', h))
    tree = json.loads(lit.replace('\\"', '"'))
    levels = tree['levels']
    root = levels['root']
    labels = {x['level']: x['label'] for x in root['params'] if isinstance(x, dict)}
    pages = [{'id': 'root', 'label': 'Main', 'knobs': root['knobs'], 'params': root['knobs']}]
    for lid, label in labels.items():
        lv = levels[lid]
        pages.append({'id': lid, 'label': label, 'knobs': lv['knobs'], 'params': lv['params']})
    keys = {p['key'] for p in params}
    for pg in pages:
        for k in pg['knobs'] + pg['params']:
            assert k in keys, 'page %s lists unknown parameter %s' % (pg['id'], k)
    version = json.load(open(MODULE))['version']
    return {'version': version, 'params': params, 'presets': presets, 'pages': pages, 'keep': KEEP,
            'groups': [g for g, _ in GROUPS]}


def fmt_num(v):
    return '%g' % v


def ref_table(data):
    rows = []
    for g, keys in GROUPS:
        rows.append('<tr class="grp"><th colspan="4" scope="rowgroup">%s</th></tr>' % html.escape(g))
        for k in keys:
            p = next(x for x in data['params'] if x['key'] == k)
            if p['type'] == 'enum':
                rng = ' / '.join(html.escape(o) for o in p['options'])
                d = html.escape(p['options'][int(p['default'])])
            else:
                rng = '%s to %s' % (fmt_num(p['min']), fmt_num(p['max']))
                d = fmt_num(p['default'])
            rows.append('<tr><td>%s</td><td><code>%s</code></td><td>%s</td><td>%s</td></tr>'
                        % (html.escape(p['name']), html.escape(k), rng, d))
    return '\n'.join(rows)


def preset_list(data):
    by_key = {p['key']: p for p in data['params']}
    items = []
    for i, pr in enumerate(data['presets']):
        bits = []
        for k, v in pr['values'].items():
            p = by_key[k]
            if p['type'] == 'enum':
                bits.append('%s %s' % (p['name'], p['options'][int(v)]))
            elif p['type'] == 'int':
                bits.append('%s %d' % (p['name'], int(v)))
            else:
                bits.append('%s %d%%' % (p['name'], round(v * 100)))
        items.append('<li><b>%02d</b><span>%s</span><i>%s</i></li>'
                     % (i, html.escape(pr['name']), html.escape(', '.join(bits))))
    return '\n'.join(items)


def splice(text, start, end, body):
    i, j = text.index(start) + len(start), text.index(end)
    return text[:i] + body + text[j:]


def main():
    check = '--check' in sys.argv
    data = parse(read_c())
    blob = '\n' + json.dumps(data, separators=(',', ':')) + '\n'
    stale = []

    ed = open(EDITOR, encoding='utf-8').read()
    ed2 = splice(ed, '<script id="vdp-data" type="application/json">', '</script>', blob)
    if ed2 != ed:
        stale.append(EDITOR)
        if not check:
            open(EDITOR, 'w', encoding='utf-8').write(ed2)

    if os.path.exists(MANUAL):
        man = open(MANUAL, encoding='utf-8').read()
        man2 = splice(man, '<script id="vdp-data" type="application/json">', '</script>', blob)
        man2 = splice(man2, '<!-- params:begin -->', '<!-- params:end -->', '\n' + ref_table(data) + '\n')
        man2 = splice(man2, '<!-- presets:begin -->', '<!-- presets:end -->', '\n' + preset_list(data) + '\n')
        man2 = re.sub(r'(<!-- ver:begin -->).*?(<!-- ver:end -->)',
                      lambda m: m.group(1) + data['version'] + m.group(2), man2)
        man2 = re.sub(r'(<!-- n:begin -->).*?(<!-- n:end -->)',
                      lambda m: m.group(1) + str(len(data['params'])) + m.group(2), man2)
        man2 = re.sub(r'(<!-- np:begin -->).*?(<!-- np:end -->)',
                      lambda m: m.group(1) + str(len(data['presets'])) + m.group(2), man2)
        if man2 != man:
            stale.append(MANUAL)
            if not check:
                open(MANUAL, 'w', encoding='utf-8').write(man2)

    demo_old = open(DEMO, encoding='utf-8').read() if os.path.exists(DEMO) else ''
    if demo_old != ed2:
        stale.append(DEMO)
        if not check:
            open(DEMO, 'w', encoding='utf-8').write(ed2)

    if check:
        if stale:
            print('out of date (run python3 scripts/gen_web.py):', ', '.join(os.path.relpath(s, ROOT) for s in stale))
            sys.exit(1)
        print('web files up to date (%d parameters, %d presets)' % (len(data['params']), len(data['presets'])))
    else:
        print('%d parameters, %d presets; updated: %s' % (
            len(data['params']), len(data['presets']),
            ', '.join(os.path.relpath(s, ROOT) for s in stale) or 'nothing'))


if __name__ == '__main__':
    main()
