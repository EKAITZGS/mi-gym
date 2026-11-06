import json, re, sys
from playwright.sync_api import sync_playwright

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 800}, device_scale_factor=2, locale='es-ES')
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(('console', m.type, m.text)) if m.type in ('error',) else None)
    page.on('pageerror', lambda e: errors.append(('pageerror', str(e))))
    page.goto('http://127.0.0.1:4173/')
    page.wait_for_selector('.tabbar')
    page.screenshot(path='/home/claude/shots/1_home.png')

    # Entreno
    page.click('.tabbar button:has-text("Entreno")')
    page.wait_for_selector('text=Mis días')
    page.screenshot(path='/home/claude/shots/2_train.png')

    # Empezar Pecho y tríceps (primer botón Empezar)
    page.click('button:has-text("Empezar") >> nth=0')
    page.wait_for_selector('text=Terminar entreno')
    # Ejercicio 3 (drop): primera serie
    cards = page.locator('.card')
    c3 = cards.nth(2)
    inputs = c3.locator('input.inp')
    print('inputs en ejercicio 3:', inputs.count())
    inputs.nth(0).fill('10'); inputs.nth(1).fill('8')   # serie 1: 10kg x 8
    inputs.nth(2).fill('5');  inputs.nth(3).fill('6')   # drop 5kg x 6
    c3.locator('.chk').first.click()
    # añadir otro drop
    c3.locator('text=+ drop').first.click()
    print('drops tras añadir:', c3.locator('.setrow.drop').count())
    page.screenshot(path='/home/claude/shots/3_session.png', full_page=False)
    # marcar done en ejercicio 1 serie 1 sin escribir
    cards.nth(0).locator('.chk').first.click()
    page.click('text=Terminar entreno'); page.click('text=Saltar')
    page.click('text=Listo')
    page.wait_for_selector('text=Mis días')
    data = json.loads(page.evaluate("localStorage.getItem('migym.v1')"))
    print('sesiones guardadas:', len(data['sessions']), 'active:', data['active'])
    s = data['sessions'][0]
    print('entries keys:', list(s['entries'].keys()))
    print('drop set guardado:', s['entries']['Leverage_Incline_Chest_Press'][0])

    # Segunda sesión: ver placeholders "última vez"
    page.click('button:has-text("Empezar") >> nth=0')
    page.wait_for_selector('text=Última vez')
    print('placeholder drop:', page.locator('.card').nth(2).locator('input.inp').nth(2).get_attribute('placeholder'))
    page.screenshot(path='/home/claude/shots/4_session2.png')
    page.click('text=Salir')

    # Dieta
    page.click('.tabbar button:has-text("Dieta")')
    page.click('button[aria-label="Añadir a Desayuno"]')
    page.fill('input[placeholder="Buscar alimento…"]', 'huevo')
    page.click('.row:has-text("Huevo")')
    page.wait_for_selector('text=Cantidad')
    page.fill('.qty input', '2')
    page.screenshot(path='/home/claude/shots/5_qty.png')
    page.click('button:has-text("Añadir a desayuno")')
    page.wait_for_selector('text=kcal restantes')
    print('resumen dieta:', page.locator('.ring-num').first.inner_text().replace('\n', ' '))
    page.screenshot(path='/home/claude/shots/6_diet.png')

    # Generador 6 y 7 días
    page.click('.tabbar button:has-text("Entreno")')
    page.click('text=Plan automático')
    page.click('.sheet .chip:has-text("7 días")')
    page.click('button:has-text("Crear plan de 7 días")')
    page.wait_for_selector('text=Día suave')
    data = json.loads(page.evaluate("localStorage.getItem('migym.v1')"))
    print('plan tras generar 7:', len(data['plan']), [d['weekday'] for d in data['plan']])
    page.screenshot(path='/home/claude/shots/7_week.png', full_page=True)

    # Ejercicio propio
    page.click('[aria-label="Biblioteca"]')
    page.click('text=+ Crear ejercicio propio')
    page.fill('input[placeholder^="Ej:"]', 'Press Smith')
    page.get_by_role('button', name='Crear', exact=True).click()
    page.fill('input[placeholder="Buscar ejercicio…"]', 'Smith')
    print('ejercicio propio visible:', page.locator('.row:has-text("Press Smith")').count())
    page.screenshot(path='/home/claude/shots/8_library.png')

    # Persistencia
    page.reload(); page.wait_for_selector('.tabbar')
    data = json.loads(page.evaluate("localStorage.getItem('migym.v1')"))
    print('tras recargar: sesiones', len(data['sessions']), 'comida hoy', sum(len(v) for v in data['food'].values()), 'plan', len(data['plan']))
    b.close()
print('ERRORES:', errors)
