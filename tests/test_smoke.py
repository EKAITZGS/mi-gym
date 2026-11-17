# Prueba de humo de las pantallas de entreno: editar un día, crear un ejercicio propio, entreno libre,
# check-in y todas las pestañas, sin errores de JavaScript. Contra `VITE_CLOUD=off npm run build` + preview.
import os, json, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL', 'http://127.0.0.1:4173/')
B = 'Barbell_Bench_Press_-_Medium_Grip'
seed = {
    'v': 2, 'setupDone': True, 'goals': {'kcal': 2200, 'protein': 150},
    'plan': [{'id': 'd1', 'name': 'Pecho', 'weekday': 1, 'items': [{'id': 'i1', 'ex': B, 'sets': 3, 'reps': '8-10', 'drop': False}]}],
    'active': None,
    'sessions': [{'id': 's1', 'date': '2026-10-01', 'dayId': 'd1', 'dayName': 'Pecho', 'entries': {B: [{'w': '60', 'r': '10', 'drops': []}]}}],
    'food': {}, 'myFoods': [], 'myExercises': [],
}
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, locale='es-ES', reduced_motion='reduce', service_workers='block')
    ctx.route('**/workers.dev/**', lambda r: r.abort())
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    page.on('dialog', lambda d: d.accept())
    page.goto(URL)
    page.evaluate("s => localStorage.setItem('migym.v1', JSON.stringify(s))", seed)
    page.reload()
    page.wait_for_selector('.tabbar')
    data = lambda: json.loads(page.evaluate("localStorage.getItem('migym.v1')"))

    # todas las pestañas
    for t in ('Entrenamiento', 'Rutinas', 'Progreso', 'Perfil', 'Inicio'):
        page.click(f'.tabbar button:has-text("{t}")')
        page.wait_for_timeout(250)

    # editar un día: cambiar el nombre y guardar
    page.click('.tabbar button:has-text("Rutinas")')
    page.click('button[aria-label="Editar"] >> nth=0')
    page.fill('input[aria-label="Nombre del día"]', 'Pecho y hombro')
    page.click('.savebar button:has-text("Guardar")')
    page.wait_for_timeout(300)
    assert data()['plan'][0]['name'] == 'Pecho y hombro'

    # biblioteca: crear un ejercicio propio
    page.click('button[aria-label="Biblioteca de ejercicios"]')
    page.click('text=+ Crear ejercicio propio')
    page.fill('.sheet input.inp', 'Remo casero MG')
    page.click('.sheet button:has-text("Crear")')
    page.wait_for_timeout(300)
    assert any(x['name'] == 'Remo casero MG' for x in data()['myExercises'])

    # entreno libre: añadir el ejercicio propio, una serie, terminar con check-in
    page.click('.tabbar button:has-text("Entrenamiento")')
    page.click('.cta')
    page.click('.start-opt:has-text("Entreno libre")')
    page.wait_for_selector('text=Terminar entreno')
    page.click('button:has-text("Añadir ejercicio")')
    page.fill('.sheet input.inp >> nth=0', 'casero mg')
    page.wait_for_timeout(300)
    page.click('.sheet .row:has-text("Remo casero MG")')
    page.click('.sheet button.btn.primary')
    page.wait_for_selector('.setrow')
    inp = page.locator('.card').first.locator('.setrow input.inp')
    inp.nth(0).fill('40')
    inp.nth(1).fill('10')
    page.locator('.card').first.locator('.chk').first.click()
    if page.locator('button[aria-label="Omitir descanso"]').count():
        page.click('button[aria-label="Omitir descanso"]')
    page.click('text=Terminar entreno')
    page.wait_for_selector('.sheet')
    page.click('.feel >> nth=1') if page.locator('.feel').count() else None
    if page.locator('text=Guardar y ver consejos').count() and page.locator('text=Guardar y ver consejos').is_enabled():
        page.click('text=Guardar y ver consejos')
    else:
        page.click('text=Saltar')
    page.wait_for_selector('text=Entreno guardado')
    page.click('text=Listo')
    page.wait_for_timeout(300)
    d = data()
    assert d['active'] is None and len(d['sessions']) == 2, len(d['sessions'])
    last = d['sessions'][-1]
    cid = next(x['id'] for x in d['myExercises'] if x['name'] == 'Remo casero MG')
    assert last['entries'][cid][0]['r'] == '10'
    # su ficha en Progreso
    page.click('.tabbar button:has-text("Progreso")')
    page.wait_for_timeout(300)
    ctx.close()
    b.close()
print('smoke ok · errores:', errors)
sys.exit(1 if errors else 0)
