#!/usr/bin/env python3
"""Wer kommt, wer klickt auf Kaufen: python3 tools/who_report.py [tage, max 30]. Meta-Prüfbots (US) und Besuche ohne Aktion sind abgezogen."""
import json,sys,subprocess,collections as c
n=sys.argv[1] if len(sys.argv)>1 else '30'
j=json.loads(subprocess.check_output(['curl','-s','-A','Mozilla/5.0',f'https://pedalcraft-stats.pages.dev/journeys?days={n}']))
ev=lambda x:[s[1] for s in x['steps']]
g=lambda x,p:next((e[len(p):] for e in ev(x) if e.startswith(p)),None)
def ok(x):
    f=g(x,'from:') or ''
    return not (x['cc']=='us' and ('meta' in f or 'facebook' in f)) and any(e.startswith(('start:',)) for e in ev(x)) and x['steps'][-1][0]>2
R=[x for x in j if ok(x)]
has=lambda x,*p:any(e.startswith(p) for e in ev(x))
g2=lambda x,p:next((e[len(p):] for e in ev(x) if e.startswith(p) and e[len(p):] not in('shown','closed')),None)
F=[('Besuch',lambda x:True),('Trainer',lambda x:'app:trainer' in ev(x)),('Kaufklick',lambda x:has(x,'buy:')),('Zurück',lambda x:has(x,'buyback:')),('Freigeschaltet',lambda x:'app:unlock-ok' in ev(x))]
print(f'{n} Tage, {len(R)} von {len(j)} Verläufen echt\n')
def tab(t,k):
    G=c.defaultdict(list)
    for x in R: G[k(x) or '-'].append(x)
    print(t);
    for a,v in sorted(G.items(),key=lambda i:-len(i[1]))[:10]: print(f'  {a[:32]:32}','  '.join(f'{m} {sum(map(f,v))}' for m,f in F))
st=lambda i:lambda x:((g(x,'start:') or '').split(':')+['']*4)[i]
tab('Herkunft',lambda x:g(x,'from:'));tab('Anzeige',lambda x:g(x,'ad:'));tab('Zielgruppe',lambda x:g(x,'grp:'));tab('Platzierung',lambda x:g(x,'pl:'));tab('Region',lambda x:g(x,'region:'));tab('Bisherige App',lambda x:g2(x,'ask-app:'));tab('Stunde (lokal)',lambda x:(g(x,'time:') or '').split(':h')[-1]);tab('Land',lambda x:x['cc'])
tab('System',st(0));tab('Einstieg',lambda x:g(x,'page:'));tab('Trainer',lambda x:g(x,'app:tname-') or g2(x,'ask-gear:'))
for t,p in (('Abbruchgrund','ask-stop:'),('Gerät (Frage)','ask-gear:'),('Kaufknopf','buy:'),('Gelesen','read:')):
    print(t,c.Counter(e[len(p):] for x in R for e in set(ev(x)) if e.startswith(p)).most_common(10))
