# Entreno activo 2.0: peso de referencia con reps vacías, descanso con pausa/omitir, calentamiento y resumen.
# Requiere `VITE_CLOUD=off npm run build && npx vite preview --port 4173`.
import os, json, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL', 'http://127.0.0.1:4173/')
OUT = os.path.join(os.path.dirname(__file__), 'shots')
os.makedirs(OUT, exist_ok=True)
B = 'Barbell_Bench_Press_-_Medium_Grip'
seed = {
    'v': 2, 'setupDone': True, 'goals': {'kcal': 2200, 'protein': 150},
    'plan': [{'id': 'd1', 'name': 'Pecho', 'weekday': None, 'items': [{'id': 'i1', 'ex': B, 'sets': 2, 'reps': '8-10', 'drop': False, 'rest': 60}]}],
    'active': None,
    'sessions': [{'id': 's1', 'date': '2026-10-01', 'dayId': 'd1', 'dayName': 'Pecho', 'entries': {B: [{'w': '60', 'r': '10', 'drops': []}, {'w': '60', 'r': '9', 'drops': []}]}}],
    'food': {}, 'myFoods': [], 'myExercises': [],
}
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='es-ES', reduced_motion='reduce')
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('dialog', lambda d: d.accept())
    page.goto(URL)
    page.evaluate("s => localStorage.setItem('migym.v1', JSON.stringify(s))", seed)
    page.reload()
    page.wait_for_selector('.tabbar')
    page.click('.cta')
    page.click('.start-opt:has-text("Pecho")')
    page.wait_for_selector('text=Terminar entreno')
    # regla crítica: peso de referencia puesto, reps vacías
    card = page.locator('.card').first
    inputs = card.locator('.setrow input.inp')
    assert inputs.nth(0).input_value() == '60', inputs.nth(0).input_value()
    assert inputs.nth(1).input_value() == '', 'las reps deben empezar vacías'
    assert inputs.nth(1).get_attribute('placeholder') == 'reps'
    # cabecera: 0/2 series
    assert '0/2' in page.locator('.ses-stats').inner_text().replace('\n', '')
    # marcar sin reps: no se marca, enfoca reps
    card.locator('.chk').first.click()
    assert card.locator('.chk.on').count() == 0
    # calentamiento en la serie 1, reps y marcar → descanso del ejercicio (60 s)
    card.locator('text=Calentamiento').first.click()
    assert card.locator('.setrow.warm').count() == 1
    inputs.nth(1).fill('10')
    card.locator('.chk').first.click()
    page.wait_for_selector('.restbar')
    t0 = page.locator('.rest-t').inner_text()
    assert t0.startswith('0:') or t0.startswith('1:'), t0
    # pausar / reanudar
    page.click('.restbar button[aria-label="Pausar descanso"]')
    page.wait_for_selector('text=en pausa')
    page.wait_for_timeout(1200)
    assert page.locator('.restbar.paused').count() == 1
    page.click('.restbar button[aria-label="Reanudar descanso"]')
    assert page.locator('.restbar.paused').count() == 0
    page.click('.restbar button[aria-label="Añadir 15 segundos"]')
    page.screenshot(path=f'{OUT}/s_1_descanso.png')
    # omitir
    page.click('.restbar button[aria-label="Omitir descanso"]')
    assert page.locator('.restbar').count() == 0
    # serie 2 de trabajo: 62,5 × 9 → récord (1RM 81,25 > 80)
    inputs.nth(2).fill('62,5')
    inputs.nth(3).fill('9')
    card.locator('.chk').nth(1).click()
    page.click('.restbar button[aria-label="Omitir descanso"]')
    page.click('text=Terminar entreno')
    page.click('text=Saltar')
    page.wait_for_selector('text=Entreno guardado')
    page.screenshot(path=f'{OUT}/s_2_resumen.png', full_page=True)
    txt = page.locator('.sheet').inner_text()
    assert 'récords nuevos' in txt.lower(), txt
    assert '1 serie de calentamiento' in txt, txt
    page.click('text=Listo')
    data = json.loads(page.evaluate("localStorage.getItem('migym.v1')"))
    s = data['sessions'][-1]
    sets = s['entries'][B]
    assert sets[0].get('warm') is True and sets[0]['w'] == '60' and sets[0]['r'] == '10', sets
    assert sets[1]['w'] == '62,5' and sets[1]['r'] == '9' and 'warm' not in sets[1], sets
    assert data['active'] is None
    print('session ok:', sets)
    ctx.close()
    b.close()
print('errores:', errors)
sys.exit(1 if errors else 0)
