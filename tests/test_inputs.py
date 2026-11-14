import os
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.goto('http://127.0.0.1:4173/'); pg.wait_for_selector('.tabbar')
    D=lambda: json.loads(pg.evaluate("localStorage.getItem('migym.v1')"))
    # series 40
    pg.click('.tabbar button:has-text("Entreno")'); pg.wait_for_timeout(300)
    pg.locator('.daycard').first.locator('button[aria-label="Editar"]').click(); pg.wait_for_selector('text=Editar día')
    inp=pg.locator('label:has-text("Series") input').first; inp.click(); inp.type('40'); pg.locator('h2').click()
    print('series 40:', inp.input_value()); inp.fill(''); inp.type('99'); pg.locator('h2').click(); print('series 99 ->', inp.input_value())
    inp.fill(''); inp.type('40'); pg.click('.savebar button'); pg.wait_for_timeout(300)
    print('guardado sets:', D()['plan'][0]['items'][0]['sets'])
    # sesión: letras en reps, coma en peso, quitar serie
    pg.locator('.daycard').first.locator('.dayfoot .btn.primary').click(); pg.wait_for_selector('text=Terminar entreno')
    c=pg.locator('.card').nth(0); rows=c.locator('.setrow:not(.drop):not(.uni-head)')
    print('filas sesión:', rows.count())
    w=rows.first.locator('input').nth(0); r=rows.first.locator('input').nth(1)
    w.type('7,5kg'); r.type('1o2'); print('peso:', w.input_value(), 'reps:', r.input_value())
    n=rows.count(); c.locator('button:has-text("Quitar serie")').nth(1).click(); pg.wait_for_timeout(200); print('tras quitar:', n, '->', rows.count())
    pg.click('text=Terminar entreno'); pg.click('text=Saltar'); pg.click('text=Listo')
    # objetivos
    pg.click('.tabbar button:has-text("Ajustes")'); pg.wait_for_timeout(300)
    k=pg.locator('label:has-text("Calorías") + input, .lbl:has-text("Calorías") + input').first
    k.click(); k.press('Control+a'); k.press('Backspace'); print('kcal vacío:', repr(k.input_value()))
    k.type('2400'); pg.locator('h4').first.click(); pg.wait_for_timeout(200); print('kcal guardado:', D()['goals']['kcal'])
    k.click(); k.press('Control+a'); k.press('Backspace'); pg.locator('h4').first.click(); pg.wait_for_timeout(200); print('vacío y salir:', k.input_value(), D()['goals']['kcal'])
    print('ERR',errs)
