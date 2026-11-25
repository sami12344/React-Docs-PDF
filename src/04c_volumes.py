"""Writes the volume definitions into src/volumes.json from the live navigation order (build/inventory.json).
The split follows the site's own sections; the sizes were chosen from a measured page model (see CHECKPOINT.md).
Usage: python -I -X utf8 src/04c_volumes.py"""
import os, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
inv = [i for i in json.load(open(os.path.join(ROOT, 'build', 'inventory.json'), encoding='utf-8'))['items'] if i['live']]
inv.sort(key=lambda i: i['order'])
LEARN_CH = {'/learn/describing-the-ui': 1, '/learn/adding-interactivity': 2, '/learn/managing-state': 3, '/learn/escape-hatches': 4}
HOOKS_II_FROM = '/reference/react/useMemo'

def vol_of(i, state):
    p = i['path']
    if i['part'] == 'learn':
        if i['navSection'] == 'GET STARTED': return 1
        ch = LEARN_CH.get(p) or LEARN_CH.get(i['navParent'])
        return ch
    sec = i['navSection']
    if sec == 'react@19.3':
        if p in ('/reference/react', '/reference/react/hooks') or i['navParent'] == '/reference/react/hooks':
            if p == HOOKS_II_FROM: state['hooks2'] = True
            return 6 if state.get('hooks2') else 5
        return 7
    if sec.startswith('react-dom'): return 8
    return 9

VOLS = {
    1: ('Get Started · Describing the UI', 'Learn: Quick Start, Installation, Setup, React Compiler; Learn React: Describing the UI'),
    2: ('Adding Interactivity', 'Learn React: Adding Interactivity'),
    3: ('Managing State', 'Learn React: Managing State'),
    4: ('Escape Hatches', 'Learn React: Escape Hatches'),
    5: ('react — Hooks I', 'Reference: react overview, Hooks (useActionState to useLayoutEffect)'),
    6: ('react — Hooks II', 'Reference: Hooks (useMemo to useTransition)'),
    7: ('react — Components and APIs', 'Reference: react components and APIs'),
    8: ('react-dom', 'Reference: react-dom hooks, components, APIs, client, server and static APIs'),
    9: ('Compiler, Tools, Rules, RSC, Legacy', 'Reference: React Compiler, React DevTools, eslint-plugin-react-hooks, Rules of React, React Server Components, Legacy APIs'),
}
state = {}
arts = {k: [] for k in VOLS}
for i in inv:
    v = vol_of(i, state)
    if v is None: raise SystemExit('no volume for ' + i['path'])
    arts[v].append(i['path'])
f = os.path.join(ROOT, 'src', 'volumes.json')
cfg = json.load(open(f, encoding='utf-8'))
keep = [v for v in cfg['volumes'] if v.get('proof') and v['id'] != 'plan']
cfg['volumes'] = keep + [{'id': f'vol{k}', 'label': f'Volume {k}', 'short': f'Vol. {k}', 'number': k, 'title': t, 'subtitle': s,
                          'output': f'React-Print-Edition-Vol{k}', 'articles': arts[k]} for k, (t, s) in VOLS.items()]
json.dump(cfg, open(f, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
order = [p for k in VOLS for p in arts[k]]
assert order == [i['path'] for i in inv], 'volumes must follow the navigation order'
for k in VOLS: print(f'vol{k}: {len(arts[k]):3d} articles  {VOLS[k][0]}')
print('total', sum(len(a) for a in arts.values()))
