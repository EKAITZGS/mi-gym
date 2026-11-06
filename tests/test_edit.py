import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    dialogs=[]; pg.on('dialog',lambda d:(dialogs.append(d.message), d.dismiss() if 'sin guardar' in d.message and len(dialogs)==1 else d.accept()))
    pg.goto('http://127.0.0.1:4173/'); pg.wait_for_selector('.tabbar')
    plan=lambda: json.loads(pg.evaluate("localStorage.getItem('migym.v1')"))['plan']
    pg.click('.tabbar button:has-text("Entreno")'); pg.wait_for_timeout(300)
    n0=len(plan()); name0=plan()[0]['name']; items0=len(plan()[0]['items'])
    # 1) editar día, quitar ejercicio y salir -> pide confirmación; salir sin guardar no cambia nada
    pg.locator('.daycard').first.locator('button[aria-label="Editar"]').click(); pg.wait_for_selector('text=Editar día')
    pg.locator('button[aria-label="Quitar"]').first.click()
    pg.fill('.page input.inp >> nth=0','Pecho cambiado')
    print('savebar visible:', pg.locator('.savebar').count())
    print('plan sin cambios aún:', plan()[0]['name']==name0, len(plan()[0]['items'])==items0)
    pg.screenshot(path='/home/claude/shots/edit_dirty.png')
    pg.click('text=Volver'); pg.wait_for_selector('text=¿Guardar los cambios?')
    pg.wait_for_timeout(700); pg.screenshot(path='/home/claude/shots/edit_ask.png')
    pg.click('text=Seguir editando'); print('sigue en editor:', pg.locator('text=Editar día').count())
    # tab bar con cambios -> confirm (1º dismiss = quedarse)
    pg.click('.tabbar button:has-text("Hoy")'); print('tras cancelar tab, sigue:', pg.locator('text=Editar día').count())
    pg.click('text=Volver'); pg.click('text=Salir sin guardar'); pg.wait_for_timeout(300)
    print('descartado ok:', plan()[0]['name']==name0, len(plan()[0]['items'])==items0)
    # 2) editar y guardar
    pg.locator('.daycard').first.locator('button[aria-label="Editar"]').click(); pg.wait_for_selector('text=Editar día')
    pg.fill('.page input.inp >> nth=0','Pecho guardado'); pg.locator('.uni-l input').first.check()
    pg.click('.savebar button'); pg.wait_for_timeout(300)
    print('guardado:', plan()[0]['name'], plan()[0]['items'][0].get('uni'), '| aviso:', pg.locator('.notice').inner_text() if pg.locator('.notice').count() else None)
    # 3) nuevo día: no aparece hasta guardar
    pg.click('text=Añadir día') if pg.locator('text=Añadir día').count() else pg.click('text=Nuevo día')
    pg.wait_for_selector('h2:has-text("Nuevo día")')
    print('plan tras abrir nuevo:', len(plan())==n0)
    pg.click('text=Volver'); pg.wait_for_timeout(300); print('sin cambios sale directo:', pg.locator('text=Tu rutina').count(), len(plan())==n0)
    pg.click('text=Añadir día') if pg.locator('text=Añadir día').count() else pg.click('text=Nuevo día')
    pg.fill('.page input.inp >> nth=0','Pierna nueva'); pg.click('.savebar button'); pg.wait_for_timeout(300)
    print('nuevo guardado:', len(plan())==n0+1, plan()[-1]['name'])
    print('dialogs', dialogs, 'ERR', errs)
