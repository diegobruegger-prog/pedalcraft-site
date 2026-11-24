#!/usr/bin/env python3
"""Pinterest-Besuche: python3 tools/pin_report.py [tage]. Zählt Links mit ?pc=pin und Pinterest-Referrer."""
import json,sys,subprocess,collections as c,datetime as d
n=sys.argv[1] if len(sys.argv)>1 else '30'
j=json.loads(subprocess.check_output(['curl','-s','-A','Mozilla/5.0',f'https://pedalcraft-stats.pages.dev/journeys?days={n}']))
j=j if isinstance(j,list) else j['journeys']
ev=lambda x:[s[1] for s in x['steps']]
P=[x for x in j if any(e.startswith('from:') and 'pinterest' in e for e in ev(x))]
real=[x for x in P if x['steps'][-1][0]>0 or any(e.startswith(('tap:','scroll','leave','buy')) for e in ev(x))]
f=lambda p:sum(any(e.startswith(p) for e in ev(x)) for x in real)
print(f'Pinterest {n} Tage: {len(P)} Besuche, {len(real)} echt (mit Aktion/Dauer)')
print('Länder',dict(c.Counter(x.get('cc') for x in real)),'| Seiten',dict(c.Counter(next((e for e in ev(x) if e.startswith('page:')),'?') for x in real)))
print({k:f(k) for k in ('page:/ride','app:demo','app:connect-tap','app:trainer','app:trial-pick','app:trial-done','buy:')})
