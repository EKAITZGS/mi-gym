import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.goto('http://127.0.0.1:4173/'); pg.wait_for_selector('.tabbar')
    pg.click('.tabbar button:has-text("Entreno")'); pg.wait_for_timeout(300)
    pg.locator('.daycard').first.locator('button[aria-label="Editar"]').click(); pg.wait_for_selector('text=Editar día')
    inp=pg.locator('label:has-text("Series") input').first
    inp.click(); inp.press('Backspace'); print('vacío:', repr(inp.input_value()))
    inp.type('4'); print('tras escribir 4:', inp.input_value())
    inp.fill(''); inp.type('5'); pg.locator('h2').click(); print('5 y salir:', inp.input_value())
    inp.fill(''); pg.locator('h2').click(); print('vacío y salir:', inp.input_value())
    inp.fill('6'); pg.click('.savebar button'); pg.wait_for_timeout(300)
    print('guardado:', json.loads(pg.evaluate("localStorage.getItem('migym.v1')"))['plan'][0]['items'][0]['sets'])
    print('ERR',errs)
