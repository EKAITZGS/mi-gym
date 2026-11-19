# Mejoras de entreno: objetivo por serie, serie que supera a la de la otra vez, orden real guardado,
# comparación serie a serie con fatiga ("Con fatiga" en vez de peor) y sexo en Ajustes.
# Requiere `VITE_CLOUD=off npm run build && npx vite preview --port 4173`.
import os, json
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL', 'http://127.0.0.1:4173/')
OUT = os.path.join(os.path.dirname(__file__), 'shots')
os.makedirs(OUT, exist_ok=True)
B = 'Barbell_Bench_Press_-_Medium_Grip'
I = 'Incline_Dumbbell_Press'
P = 'Triceps_Pushdown'
S = lambda w, r: {'w': str(w), 'r': str(r), 'drops': []}
seed = {
    'v': 2, 'setupDone': True, 'goals': {'kcal': 2200, 'protein': 150},
    'plan': [{'id': 'd1', 'name': 'Pecho', 'weekday': None, 'items': [
        {'id': 'i1', 'ex': B, 'sets': 3, 'reps': '8-10', 'drop': False},
        {'id': 'i2', 'ex': I, 'sets': 3, 'reps': '10-12', 'drop': False},
        {'id': 'i3', 'ex': P, 'sets': 2, 'reps': '10-12', 'drop': False},
    ]}],
    'active': None,
    'sessions': [{'id': 's1', 'date': '2026-11-01', 'dayId': 'd1', 'dayName': 'Pecho', 'order': [B, I, P], 'entries': {
        B: [S(60, 8), S(60, 8), S(60, 7)], I: [S(20, 10), S(20, 10), S(20, 10)], P: [S(25, 12), S(25, 11)],
    }}],
    'body': {'weight': [{'date': '2026-11-01', 'kg': 80}]},
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

    # --- Ajustes → Entreno: sexo ---
    page.click('.tabbar button:has-text("Perfil")')
    page.click('text=Ajustes')
    page.click('.list-row:has-text("Entreno")')
    page.select_option('select[aria-label="Sexo"]', 'f')
    page.wait_for_timeout(300)
    assert json.loads(page.evaluate("localStorage.getItem('migym.v1')"))['prefs']['sex'] == 'f'
    page.select_option('select[aria-label="Sexo"]', '')
    page.wait_for_timeout(300)
    assert 'sex' not in json.loads(page.evaluate("localStorage.getItem('migym.v1')")).get('prefs', {})

    # --- entreno: objetivo por serie ---
    page.click('.tabbar button:has-text("Entrenamiento")')
    page.click('.cta')
    page.click('.start-opt:has-text("Pecho")')
    page.wait_for_selector('text=Terminar entreno')
    cards = page.locator('.ex-card')
    bench, incl, push = cards.nth(0), cards.nth(1), cards.nth(2)
    assert 'Objetivo hoy: 9 · 9 · 8 reps con 60 kg' in bench.inner_text(), bench.inner_text()
    assert bench.locator('.setrow input[data-b]').first.get_attribute('placeholder') == '9'
    assert 'más trabajo de esos músculos' not in bench.inner_text()

    # empieza por el inclinado (3 series) → la banca ya va con más fatiga que la otra vez: el objetivo es igualar
    for k in range(3):
        incl.locator('.setrow input[data-b]').nth(k).fill('10')
    page.wait_for_timeout(200)
    t = bench.inner_text()
    assert 'igualar 8 · 8 · 7 reps con 60 kg' in t, t
    assert 'después de más trabajo de esos músculos' in t, t
    page.screenshot(path=f'{OUT}/prog_1_fatiga.png', full_page=True)

    # banca peor (6,6,6) y tríceps con una rep más en la 1.ª serie → esa serie se marca
    for k in range(3):
        bench.locator('.setrow input[data-b]').nth(k).fill('6')
    push.locator('.setrow input[data-b]').nth(0).fill('13')
    push.locator('.setrow input[data-b]').nth(1).fill('11')
    page.wait_for_timeout(200)
    assert push.locator('.setrow button.setn.beat').count() == 1, push.locator('.setrow button.setn.beat').count()
    assert bench.locator('.setrow button.setn.beat').count() == 0

    page.click('text=Terminar entreno')
    page.click('text=Saltar')
    page.wait_for_selector('text=Entreno guardado')
    page.screenshot(path=f'{OUT}/prog_2_resumen.png', full_page=True)
    rows = page.locator('.sheet .cmp')
    txt = page.locator('.sheet').inner_text()
    names = [rows.nth(k).locator('b').first.inner_text() for k in range(rows.count())]
    # en el orden en que se hicieron
    assert names[0].startswith('Press inclinado'), names
    rb = page.locator('.sheet .cmp', has_text='Press banca con barra').inner_text()
    assert 'Con fatiga' in rb and 'no es un retroceso' in rb, rb
    assert page.locator('.sheet .cmp', has_text='Press banca con barra').locator('.down').count() == 0
    ri = rows.nth(0).inner_text()
    assert 'Igual' in ri, ri
    rp = page.locator('.sheet .cmp', has_text=names[2]).inner_text()
    assert '+1 rep' in rp and '1 rep más con el mismo peso' in rp, rp
    assert 'Se compara serie a serie' in txt
    page.click('text=Listo')
    data = json.loads(page.evaluate("localStorage.getItem('migym.v1')"))
    s = data['sessions'][-1]
    assert s['order'] == [I, B, P], s.get('order')
    assert data['active'] is None

    # --- generador con foco en glúteo: pierna → "Glúteo y pierna" y el cuerpo completo empieza por glúteo ---
    page.click('.tabbar button:has-text("Rutinas")')
    page.click('text=Generar plan')
    page.click('.row.opt:has-text("Hazlo tú por mí")')
    page.wait_for_selector('text=¿Qué buscas?')
    page.click('.row.opt:has-text("Hipertrofia")')
    page.click('.row.opt:has-text("Intermedio")')
    page.click('.wizard-nav .btn.primary')  # días
    page.click('.wizard-nav .btn.primary')  # reparto
    page.click('.wizard-nav .btn.primary')  # material
    page.click('.chip:has-text("Glúteo")')
    assert 'los días de pierna se centran en glúteo' in page.locator('.sheet').last.inner_text()
    page.click('text=Crear rutina')
    page.wait_for_selector('text=Análisis de la semana')
    page.screenshot(path=f'{OUT}/prog_3_gluteo.png', full_page=True)
    page.click('text=Guardar rutina')
    page.wait_for_timeout(300)
    data = json.loads(page.evaluate("localStorage.getItem('migym.v1')"))
    assert data['prefs']['gen']['focus'] == 'Glúteo'
    GLU = {'Barbell_Hip_Thrust', 'Barbell_Glute_Bridge', 'Pull_Through', 'One-Legged_Cable_Kickback', 'Butt_Lift_Bridge', 'Single_Leg_Glute_Bridge', 'Glute_Kickback'}
    week = [d for d in data['plan'] if d.get('weekday') is not None]
    legs = [d for d in week if d['name'] in ('Cuerpo completo', 'Glúteo y pierna')]
    assert legs and all(d['items'][0]['ex'] in GLU for d in legs), [(d['name'], d['items'][0]['ex']) for d in week]
    b.close()
assert not errors, errors
print('progression ok')
