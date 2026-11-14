import os
import json
from playwright.sync_api import sync_playwright
errors=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,locale='es-ES').new_page()
    pg.on('pageerror',lambda e: errors.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto('http://127.0.0.1:4173/'); pg.wait_for_selector('.tabbar')
    pg.click('.tabbar button:has-text("Entreno")')
    for rnd in range(2):
        pg.click('text=Entreno libre'); pg.wait_for_selector('text=Añade los ejercicios')
        pg.click('button:has-text("Añadir ejercicio")')
        pg.fill('.sheet input[placeholder="Buscar ejercicio…"]','Curl predicador')
        pg.click('.sheet .row:has-text("Curl predicador")'); pg.click('.sheet button:has-text("Añadir")')
        c=pg.locator('.card').nth(0)
        if rnd==0:
            c.locator('.uni-tg').click()
            vals=[('7','10','9'),('7','10','8'),('7','9','8')]
            for i,(w,l,r) in enumerate(vals):
                inp=c.locator('.setrow:not(.drop):not(.uni-head)').nth(i).locator('input')
                inp.nth(0).fill(w); inp.nth(1).fill(l); inp.nth(2).fill(r)
            pg.screenshot(path='tests/shots/u1.png')
        else:
            print('uni recordado:', 'on' in c.locator('.uni-tg').get_attribute('class'))
            print('texto:', c.locator('.row').inner_text().replace('\n',' | '))
            ph=[c.locator('.setrow:not(.drop):not(.uni-head)').nth(0).locator('input').nth(k).get_attribute('placeholder') for k in range(3)]
            print('placeholders s1:', ph)
            c.locator('.chk').first.click()
            pg.screenshot(path='tests/shots/u2.png')
        pg.click('text=Terminar entreno'); pg.click('text=Saltar'); pg.click('text=Listo')
        d=json.loads(pg.evaluate("localStorage.getItem('migym.v1')"))
        print('guardado:', d['sessions'][-1]['entries'])
    print('ERR',errors)
