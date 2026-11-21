# Diagnóstico de Polar (Ajustes → Reloj Polar) con el Worker simulado: lista en bruto y /polar/check.
# Contra `VITE_CLOUD=off npm run build` + `npx vite preview --port 4173`.
import os, json, sys, re
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL', 'http://127.0.0.1:4173/')
seed = {'v': 2, 'setupDone': True, 'goals': {'kcal': 2200, 'protein': 150}, 'plan': [], 'active': None, 'sessions': [], 'food': {}, 'myFoods': [], 'myExercises': []}
EX = [
    {'id': 'a1', 'start_time': '2026-11-16T17:49:00', 'upload_time': '2026-11-16T18:30:00Z', 'detailed_sport_info': 'STRENGTH_TRAINING', 'duration': 'PT44M29S'},
    {'id': 'a0', 'start_time': '2026-11-14T10:00:00', 'upload_time': '2026-11-14T12:00:00Z', 'detailed_sport_info': 'RUNNING', 'duration': 'PT30M'},
]
CHECK = {'exercises': {'status': 200, 'count': 2, 'rateLimit': {'ratelimit-usage': '3, 10'}}, 'user': {'status': 200, 'registered': True, 'registration-date': '2026-10-01T10:00:00Z'},
         'transaction': {'status': 201, 'meaning': 'hay entrenos pendientes', 'count': 1, 'exercises': [{'status': 200, 'start-time': '2026-11-18T18:06:00', 'upload-time': '2026-11-18T19:00:00Z', 'sport': 'OTHER'}]}}
state = {'check': None}
seen_auth = []
def worker(route):
    u = route.request.url
    seen_auth.append(route.request.headers.get('authorization'))
    cors = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    if '/polar/check' in u:
        return route.fulfill(status=404 if state['check'] is None else 200, headers=cors, body=json.dumps({'error': 'no_encontrado'} if state['check'] is None else state['check']))
    if u.endswith('/exercises') or '/exercises?' in u:
        return route.fulfill(status=200, headers=cors, body=json.dumps(EX))
    return route.fulfill(status=200, headers=cors, body='[]')

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, locale='es-ES', service_workers='block')
    ctx.route(re.compile(r'https://[^/]*workers\.dev/'), worker)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.evaluate("s => { localStorage.setItem('migym.v1', JSON.stringify(s)); localStorage.setItem('migym.polar', JSON.stringify({token: 'tok-secreto', user: '123'})) }", seed)
    page.reload()
    page.wait_for_selector('.tabbar')
    page.click('.tabbar button:has-text("Perfil")')
    page.click('text=Ajustes')
    page.click('text=Reloj Polar')
    page.click('text=Ver lo que devuelve Polar')
    page.wait_for_selector('.diag-row')
    txt = page.locator('.diag').inner_text()
    assert 'Respuesta 200' in txt and '2 entrenos' in txt.replace('\n', ' '), txt
    assert '2026-11-16 17:49' in txt and 'subido 2026-11-16 18:30' in txt and '44 min' in txt, txt
    assert 'aún no está en el servidor' in txt, txt
    assert 'tok-secreto' not in page.content(), 'el token no debe verse'
    state['check'] = CHECK
    page.click('text=Ver lo que devuelve Polar')
    page.wait_for_selector('text=hay entrenos pendientes')
    txt = page.locator('.diag').inner_text()
    assert 'registrado el 2026-10-01' in txt and '2026-11-18 18:06' in txt, txt
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', 'polar_diag.png'), full_page=True)
    assert all(a == 'Bearer tok-secreto' for a in seen_auth if a), 'el token va solo en la cabecera al Worker'
    ctx.close(); b.close()
print('polardiag ok · errores:', errors)
sys.exit(1 if errors else 0)
