# Capturas de las pantallas principales (móvil y escritorio) contra `npx vite preview --port 4173`
# construido con VITE_CLOUD=off. Uso: CHROME=/ruta/a/chrome python3 tests/shots.py
import os, json, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL', 'http://127.0.0.1:4173/')
OUT = os.path.join(os.path.dirname(__file__), 'shots')
os.makedirs(OUT, exist_ok=True)

# datos de ejemplo realistas: plan + 4 entrenos + pesajes
def seed():
    import datetime
    today = datetime.date.today()
    d = lambda n: (today - datetime.timedelta(days=n)).isoformat()
    bench = 'Barbell_Bench_Press_-_Medium_Grip'
    squat = 'Barbell_Squat'
    ses = lambda id, date, dayId, name, w: {'id': id, 'date': date, 'dayId': dayId, 'dayName': name, 'min': 52,
        'entries': {bench: [{'w': str(w), 'r': '8', 'drops': []}, {'w': str(w), 'r': '8', 'drops': []}, {'w': str(w), 'r': '7', 'drops': []}],
                    squat: [{'w': str(w + 20), 'r': '6', 'drops': []}, {'w': str(w + 20), 'r': '6', 'drops': []}]}}
    return {
        'v': 2, 'setupDone': True,
        'goals': {'kcal': 2300, 'protein': 160, 'steps': 8000},
        'plan': [
            {'id': 'd1', 'name': 'Pecho y tríceps', 'weekday': today.isoweekday() % 7, 'items': [
                {'id': 'i1', 'ex': bench, 'sets': 3, 'reps': '8-10', 'drop': False, 'rir': 2, 'rest': 120},
                {'id': 'i2', 'ex': 'Incline_Dumbbell_Press', 'sets': 3, 'reps': '10', 'drop': False},
                {'id': 'i3', 'ex': 'Triceps_Pushdown', 'sets': 3, 'reps': '12', 'drop': True}]},
            {'id': 'd2', 'name': 'Pierna', 'weekday': (today.isoweekday() + 2) % 7, 'items': [
                {'id': 'i4', 'ex': squat, 'sets': 4, 'reps': '6', 'drop': False},
                {'id': 'i5', 'ex': 'Leg_Press', 'sets': 3, 'reps': '12', 'drop': False}]},
        ],
        'active': None,
        'sessions': [ses('s1', d(21), 'd1', 'Pecho y tríceps', 60), ses('s2', d(14), 'd1', 'Pecho y tríceps', 62), ses('s3', d(7), 'd1', 'Pecho y tríceps', 62), ses('s4', d(2), 'd2', 'Pierna', 65)],
        'food': {}, 'myFoods': [], 'myExercises': [],
        'body': {'weight': [{'date': d(28), 'kg': 80.2}, {'date': d(21), 'kg': 79.8}, {'date': d(14), 'kg': 79.4}, {'date': d(7), 'kg': 79.1}], 'waist': [{'date': d(28), 'cm': 88}, {'date': d(7), 'cm': 87}], 'photos': []},
    }

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    for label, vp in (('m', {'width': 390, 'height': 844}), ('d', {'width': 1280, 'height': 860})):
        ctx = b.new_context(viewport=vp, device_scale_factor=2 if label == 'm' else 1, locale='es-ES', reduced_motion='reduce')
        page = ctx.new_page()
        page.on('console', lambda m: errors.append((m.type, m.text)) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append(('pageerror', str(e))))
        page.goto(URL)
        page.evaluate("s => localStorage.setItem('migym.v1', JSON.stringify(s))", seed())
        page.reload()
        page.wait_for_selector('.tabbar')
        page.wait_for_timeout(600)
        page.screenshot(path=f'{OUT}/{label}_1_inicio.png', full_page=True)
        for i, (tab, name) in enumerate([('Entrenamiento', 'entreno'), ('Rutinas', 'rutinas'), ('Progreso', 'progreso'), ('Perfil', 'perfil')], start=2):
            page.click(f'.tabbar button:has-text("{tab}")')
            page.wait_for_timeout(400)
            page.screenshot(path=f'{OUT}/{label}_{i}_{name}.png', full_page=True)
        # hoja de comenzar
        page.click('.tabbar button:has-text("Inicio")')
        page.click('.cta')
        page.wait_for_selector('.start-opt')
        page.screenshot(path=f'{OUT}/{label}_6_comenzar.png')
        page.click('.start-opt.primary')
        page.wait_for_selector('text=Terminar entreno')
        page.wait_for_timeout(300)
        page.screenshot(path=f'{OUT}/{label}_7_sesion.png', full_page=True)
        ctx.close()
    b.close()
print('errores:', errors)
sys.exit(1 if errors else 0)
