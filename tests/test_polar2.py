import json
from playwright.sync_api import sync_playwright
W='https://mi-gym-polar.ekaitzmartinezm.workers.dev'
ex=[{"id":111,"start_time":"2026-11-06T17:05:00","duration":"PT1H12M","calories":480,"heart_rate":{"average":126,"maximum":168},"sport":"STRENGTH_TRAINING"}]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':390,'height':844})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route(W+'/exercise?*',lambda r:r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body='{}'))
    pg.route(W+'/exercises*',lambda r:r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps(ex)))
    pg.route(W+'/activities*',lambda r:r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps([{"date":"2026-11-06","calories":2600,"active_calories":700,"steps":8000}])))
    pg.goto('http://127.0.0.1:4173/'); pg.wait_for_timeout(1500)
    pg.evaluate("""()=>{const d=JSON.parse(localStorage.getItem('migym.v1')||'{}'); d.polar={lastSync:new Date(Date.now()-3600e3).toISOString(),exercises:{},days:{}}; localStorage.setItem('migym.v1',JSON.stringify(d)); localStorage.setItem('migym.polar',JSON.stringify({token:'t',user:1}))}""")
    pg.reload(); pg.wait_for_timeout(2500)
    n=pg.locator('.notice'); print('aviso:', n.inner_text() if n.count() else None)
    print('home:', pg.locator('.polar-card').inner_text().replace('\n',' | ') if pg.locator('.polar-card').count() else None)
    print('ERR',errs)
