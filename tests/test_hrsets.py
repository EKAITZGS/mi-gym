# Pulso por ejercicio: la hora de cada serie cruzada con la curva del reloj (Inicio → «Ver el pulso del reloj»,
# puntos en la curva y lista por ejercicio; ♥ en la tarjeta del entreno). Además, el entreno guarda la hora de cada serie.
# Requiere `VITE_CLOUD=off npm run build && npx vite preview --port 4173`.
import os, json, datetime
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL', 'http://127.0.0.1:4173/')
OUT = os.path.join(os.path.dirname(__file__), 'shots')
os.makedirs(OUT, exist_ok=True)
B, C, Q = 'Barbell_Bench_Press_-_Medium_Grip', 'Dumbbell_Bicep_Curl', 'Barbell_Squat'
T0 = int(datetime.datetime(2026, 11, 20, 17, 0, tzinfo=datetime.timezone.utc).timestamp() * 1000)  # 18:00 en Madrid
at = lambda m: T0 + int(m * 60000)
v = [100] * 240
for m, hr in [(5, 150), (6.5, 150), (8, 150), (20, 125), (21.5, 125), (23, 125), (35, 165), (36.5, 165), (38, 165)]:
    for s in (-30, -15, 0):
        v[round((m * 60 + s) / 15)] = hr
S = lambda m, **k: {'w': '40', 'r': '10', 'drops': [], 't': at(m), **k}
seed = {
    'v': 2, 'setupDone': True, 'goals': {'kcal': 2200, 'protein': 150},
    'plan': [{'id': 'd1', 'name': 'Cuerpo completo', 'weekday': 5, 'items': [
        {'id': 'i1', 'ex': B, 'sets': 3, 'reps': '8-10'}, {'id': 'i2', 'ex': C, 'sets': 3, 'reps': '10-12'}, {'id': 'i3', 'ex': Q, 'sets': 3, 'reps': '8-10'}]}],
    'active': None,
    'sessions': [{'id': 's1', 'date': '2026-11-20', 'dayId': 'd1', 'dayName': 'Cuerpo completo', 'start': at(0), 'min': 45,
                  'order': [B, C, Q], 'entries': {B: [S(3, warm=True), S(5), S(6.5), S(8)], C: [S(20), S(21.5), S(23)], Q: [S(35), S(36.5), S(38)]}}],
    'polar': {'lastSync': '2026-11-20T19:00:00Z', 'exercises': {'w1': {'id': 'w1', 'date': '2026-11-20', 'time': '18:00', 'start': '2026-11-20T18:00:00', 'off': 60,
              'min': 60, 'kcal': 420, 'hrAvg': 112, 'hrMax': 166, 'sport': 'fuerza', 'hr': {'step': 15, 'v': v}}}, 'days': {}},
    'body': {'weight': [{'date': '2026-11-15', 'kg': 80}]}, 'food': {}, 'myFoods': [], 'myExercises': [],
}
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='es-ES', timezone_id='Europe/Madrid', reduced_motion='reduce')
    ctx.clock.set_fixed_time(datetime.datetime(2026, 11, 20, 19, 30))
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.evaluate("s => localStorage.setItem('migym.v1', JSON.stringify(s))", seed)
    page.reload()
    page.wait_for_selector('.tabbar')
    # Inicio: entreno hecho hoy con el del reloj → «Ver el pulso del reloj»
    page.click('text=Ver el pulso del reloj')
    sheet = page.locator('.sheet').last
    sheet.locator('text=Pulso por ejercicio').wait_for()
    names = [x.inner_text() for x in sheet.locator('.hrx-name').all()]
    assert names == ['Sentadilla con barra', 'Press banca con barra', 'Curl con mancuernas'], names
    vals = [x.inner_text() for x in sheet.locator('.hrx-v b').all()]
    assert vals == ['165', '150', '125'], vals
    assert 'Donde más subes: Sentadilla con barra (165 ppm)' in sheet.inner_text()
    assert sheet.locator('.hr-chart circle').count() == 9  # el calentamiento no sale
    page.screenshot(path=f'{OUT}/hr_1_polar.png')
    sheet.locator('.hrx-row').first.scroll_into_view_if_needed()
    page.screenshot(path=f'{OUT}/hr_2_ejercicios.png')
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)
    # Entrenamiento → día de hoy: ♥ en cada ejercicio de la tarjeta del entreno
    page.click('.tabbar button:has-text("Entrenamiento")')
    page.click('button.wday.today')
    card = page.locator('.sv-card').first
    card.wait_for()
    hx = [x.inner_text() for x in card.locator('.sv-hrx').all()]
    assert hx == ['♥ 150', '♥ 125', '♥ 165'], hx
    page.screenshot(path=f'{OUT}/hr_3_tarjeta.png')
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)

    # el entreno guarda la hora de cada serie y la de empezar
    ctx.clock.set_fixed_time(datetime.datetime(2026, 11, 20, 20, 0))
    page.click('.cta')
    page.click('.start-opt:has-text("Cuerpo completo")')
    page.wait_for_selector('text=Terminar entreno')
    first = page.locator('.ex-card').first
    first.locator('.setrow input[data-b]').first.fill('9')
    page.click('text=Terminar entreno')
    page.click('text=Saltar')
    page.wait_for_selector('text=Entreno guardado')
    page.click('text=Listo')
    d = json.loads(page.evaluate("localStorage.getItem('migym.v1')"))
    s = d['sessions'][-1]
    st = s['entries'][B][0]
    assert isinstance(st.get('t'), int) and st['t'] > 0, st
    assert isinstance(s.get('start'), int), s.keys()
    b.close()
assert not errors, errors
print('hrsets ok')
