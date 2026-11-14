import os
import json, math, random
from playwright.sync_api import sync_playwright
random.seed(1)
W='https://mi-gym-polar.ekaitzmartinezm.workers.dev'
hr=[]
for t in range(72*60):
    c=t%150; base=95+ (35 if c<40 else max(0,35-(c-40)*0.5)); hr.append(int(base+random.uniform(-3,3)))
ex=[{"id":222,"start_time":"2026-11-06T17:05:00","duration":"PT1H12M","calories":412,"heart_rate":{"average":118,"maximum":152},"sport":"STRENGTH_TRAINING",
 "samples":[{"recording_rate":1,"sample_type":"DISTANCE","data":",".join(str(i*2) for i in range(4320))},{"recording_rate":1,"sample_type":"HEART_RATE","data":",".join(map(str,hr))},{"recording_rate":1,"sample_type":"SPEED","data":",".join("0" for i in range(4320))}],
 "heart_rate_zones":[{"index":1,"lower_limit":100,"upper_limit":120,"in_zone":"PT31M10S"},{"index":2,"lower_limit":120,"upper_limit":140,"in_zone":"PT22M5S"},{"index":3,"lower_limit":140,"upper_limit":160,"in_zone":"PT9M40S"},{"index":4,"lower_limit":160,"upper_limit":180,"in_zone":"PT0S"},{"index":5,"lower_limit":180,"upper_limit":200,"in_zone":"PT0S"}]}]
seen=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    def h(r): seen.append(r.request.url); r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps(ex[0]))
    lite=[{k:v for k,v in ex[0].items() if k not in ('samples','heart_rate_zones')}]
    pg.route(W+'/exercises*',lambda r:(seen.append(r.request.url), r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps(lite))))
    pg.route(W+'/exercise?*',h)
    pg.route(W+'/activities*',lambda r:r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body='[]'))
    pg.goto('http://127.0.0.1:4173/'); pg.wait_for_selector('.tabbar')
    pg.evaluate("localStorage.setItem('migym.polar',JSON.stringify({token:'t',user:1}))")
    pg.reload(); pg.wait_for_timeout(2500)
    print('urls:', seen)
    pg.wait_for_timeout(2000); d=json.loads(pg.evaluate("localStorage.getItem('migym.v1')")); e=d['polar']['exercises']['222']; print({k:(v if k!='hr' else len(v['v'])) for k,v in e.items()})
    print('puntos hr:', len(e['hr']['v']), 'step', e['hr']['step'], 'zonas', [(z['i'],z['s']) for z in e['zones']])
    pg.click('button.polar-ex'); pg.wait_for_selector('.hr-chart'); pg.wait_for_timeout(500)
    print(pg.locator('.sheet').inner_text().replace('\n',' | ')[:700])
    pg.locator('.sheet').screenshot(path='tests/shots/hr.png')
    print('ERR',errs)
