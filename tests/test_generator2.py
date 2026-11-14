# Generador 2.0: objetivo, exclusiones, resumen editable y guardado con preferencias.
import os, json, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL', 'http://127.0.0.1:4173/')
OUT = os.path.join(os.path.dirname(__file__), 'shots')
os.makedirs(OUT, exist_ok=True)
seed = {'v': 2, 'setupDone': True, 'goals': {'kcal': 2200, 'protein': 150}, 'plan': [], 'active': None, 'sessions': [], 'food': {}, 'myFoods': [], 'myExercises': [], 'favEx': ['Hammer_Curls']}
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='es-ES', reduced_motion='reduce')
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.evaluate("s => localStorage.setItem('migym.v1', JSON.stringify(s))", seed)
    page.reload()
    page.wait_for_selector('.tabbar')
    page.click('.tabbar button:has-text("Rutinas")')
    page.click('text=Generar plan')
    page.click('.row.opt:has-text("Hazlo tú por mí")')
    page.wait_for_selector('text=¿Qué buscas?')
    page.click('.row.opt:has-text("Fuerza")')
    page.click('.row.opt:has-text("Intermedio")')
    page.screenshot(path=f'{OUT}/g_1_objetivo.png', full_page=True)
    page.click('.wizard-nav .btn.primary')  # días
    page.click('.wizard-nav .btn.primary')  # reparto
    page.click('.wizard-nav .btn.primary')  # material
    page.click('.chip:has-text("Rodilla")')
    page.click('.chip:has-text("+ Añadir")')
    page.fill('.sheet .sheet input.inp, .overlay:last-of-type input.inp', 'press banca con barra')
    page.click('.overlay:last-of-type .row:has-text("Press banca con barra")')
    page.click('.overlay:last-of-type .btn.primary:has-text("Evitar este ejercicio")')
    page.wait_for_selector('.chip:has-text("Press banca con barra ×")')
    page.screenshot(path=f'{OUT}/g_2_prefs.png', full_page=True)
    page.click('text=Crear rutina')
    page.wait_for_selector('text=Análisis de la semana')
    page.screenshot(path=f'{OUT}/g_3_resultado.png', full_page=True)
    # una serie más en el primer ejercicio
    first = page.locator('.gen-item').first
    before = first.locator('.muted.small').inner_text()
    first.locator('button[aria-label="Una serie más"]').click()
    after = first.locator('.muted.small').inner_text()
    assert before != after, (before, after)
    page.click('text=Guardar rutina')
    page.wait_for_timeout(300)
    data = json.loads(page.evaluate("localStorage.getItem('migym.v1')"))
    assert data['prefs']['gen']['goal'] == 'strength'
    assert 'Rodilla' in data['prefs']['gen']['zones']
    assert 'Barbell_Bench_Press_-_Medium_Grip' in data['prefs']['gen']['exclude']
    ids = [i['ex'] for d in data['plan'] for i in d['items']]
    assert 'Barbell_Bench_Press_-_Medium_Grip' not in ids
    assert len(data['plan']) >= 3
    # fuerza: algún multiarticular con 3-6
    assert any(i['reps'] == '3-6' for d in data['plan'] for i in d['items']), ids
    print('generator ok:', len(data['plan']), 'días', len(ids), 'ejercicios')
    ctx.close(); b.close()
print('errores:', errors)
sys.exit(1 if errors else 0)
