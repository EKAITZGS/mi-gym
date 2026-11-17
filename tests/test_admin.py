# Panel de administración (admin.html) con Supabase simulado: lista, filtros, ficha, pestañas y "no admin".
# Requiere `npm run build && npx vite preview --port 4173` (build normal, con nube).
import os, json, sys, time, datetime
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL', 'http://127.0.0.1:4173/admin.html')
OUT = os.path.join(os.path.dirname(__file__), 'shots')
os.makedirs(OUT, exist_ok=True)
today = datetime.date.today()
d = lambda n: (today - datetime.timedelta(days=n)).isoformat()
ME = '11111111-1111-1111-1111-111111111111'
ANA = '22222222-2222-2222-2222-222222222222'
session = {
    'access_token': 'x.y.z', 'token_type': 'bearer', 'expires_in': 3600, 'expires_at': int(time.time()) + 3600 * 24,
    'refresh_token': 'r', 'user': {'id': ME, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'admin@ejemplo.com', 'app_metadata': {}, 'user_metadata': {}},
}
users = [
    {'id': ME, 'email': 'admin@ejemplo.com', 'name': 'Admin', 'role': 'user', 'created_at': d(60) + 'T10:00:00Z', 'last_sign_in_at': d(0) + 'T09:00:00Z', 'updated_at': d(0) + 'T09:00:00Z', 'sessions': 12, 'last_session': d(1), 'sessions_30d': 6, 'plan_days': 4, 'has_polar': True, 'admin': True},
    {'id': ANA, 'email': 'ana@ejemplo.com', 'name': 'Ana López', 'role': 'trainer', 'created_at': d(20) + 'T10:00:00Z', 'last_sign_in_at': d(3) + 'T09:00:00Z', 'updated_at': d(3) + 'T09:00:00Z', 'sessions': 3, 'last_session': d(3), 'sessions_30d': 3, 'plan_days': 3, 'has_polar': False, 'admin': False},
    {'id': '33333333-3333-3333-3333-333333333333', 'email': 'luis@ejemplo.com', 'name': 'Luis', 'role': 'user', 'created_at': d(90) + 'T10:00:00Z', 'last_sign_in_at': d(50) + 'T09:00:00Z', 'updated_at': d(50) + 'T09:00:00Z', 'sessions': 0, 'last_session': None, 'sessions_30d': 0, 'plan_days': 0, 'has_polar': False, 'admin': False},
]
B = 'Barbell_Bench_Press_-_Medium_Grip'
ana_data = {'data': {
    'plan': [{'id': 'p1', 'name': 'Torso', 'weekday': 1, 'items': [{'id': 'i1', 'ex': B, 'sets': 3, 'reps': '8-10'}]}],
    'sessions': [{'id': f's{k}', 'date': d(10 - 3 * k), 'dayName': 'Torso', 'min': 50, 'entries': {B: [{'w': str(50 + 2.5 * k), 'r': '8', 'drops': []}]}} for k in range(4)],
    'body': {'weight': [{'date': d(7), 'kg': 61.2}], 'waist': [{'date': d(7), 'cm': 70}]},
}, 'updated_at': d(3) + 'T09:00:00Z'}

state = {'admin': True}
cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'}
def handle(route):
    req = route.request
    if req.method == 'OPTIONS':
        return route.fulfill(status=204, headers=cors)
    name = req.url.split('/rpc/')[-1].split('?')[0]
    body = {'is_admin': state['admin'], 'admin_users': users if state['admin'] else [], 'admin_user_data': [ana_data] if state['admin'] else []}.get(name)
    if name == 'admin_user_data' and json.loads(req.post_data or '{}').get('uid') != ANA:
        body = []
    route.fulfill(status=200, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(body))

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    for label, vp in (('d', {'width': 1440, 'height': 900}), ('m', {'width': 390, 'height': 844})):
        ctx = b.new_context(viewport=vp, device_scale_factor=1 if label == 'd' else 2, locale='es-ES', reduced_motion='reduce')
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/rest/v1/rpc/**', handle)
        page.route('**/auth/v1/**', lambda r: r.fulfill(status=401, headers=cors, body='{}'))
        page.goto(URL)
        page.evaluate("s => localStorage.setItem('migym.sb', JSON.stringify(s))", session)
        page.reload()
        page.wait_for_selector('text=Usuarios')
        page.wait_for_selector('.adm-table tbody tr')
        assert page.locator('.adm-table tbody tr').count() == 3
        assert '3' in page.locator('.stat.accent .st-v').inner_text()
        page.screenshot(path=f'{OUT}/admin_{label}_1_lista.png')
        # buscar y filtrar
        page.fill('.adm-tools .inp >> nth=0', 'luis')
        assert page.locator('.adm-table tbody tr').count() == 1
        page.fill('.adm-tools .inp >> nth=0', '')
        page.click('.chip:has-text("Entrenadores")')
        assert page.locator('.adm-table tbody tr').count() == 1
        page.click('.chip:has-text("Todos")')
        # ficha de Ana
        page.click('.adm-table tbody tr:has-text("Ana López")')
        page.wait_for_selector('.adm-detail .sv-card')
        assert page.locator('.adm-detail .sv-card').count() == 4
        assert '61,2 kg' in page.locator('.adm-facts').inner_text()
        page.screenshot(path=f'{OUT}/admin_{label}_2_ficha.png')
        page.click('.adm-tabs button:has-text("Ejercicios")')
        page.wait_for_selector('.adm-detail .prog-kind')
        page.click('.adm-tabs button:has-text("Rutina")')
        page.wait_for_selector('.adm-detail .sv-row')
        page.screenshot(path=f'{OUT}/admin_{label}_3_rutina.png')
        page.click('button[aria-label="Cerrar ficha"]')
        assert page.locator('.adm-detail').count() == 0
        ctx.close()
    # cuenta sin permiso
    state['admin'] = False
    ctx = b.new_context(viewport={'width': 1280, 'height': 800}, locale='es-ES')
    page = ctx.new_page()
    page.route('**/rest/v1/rpc/**', handle)
    page.route('**/auth/v1/**', lambda r: r.fulfill(status=401, headers=cors, body='{}'))
    page.goto(URL)
    page.evaluate("s => localStorage.setItem('migym.sb', JSON.stringify(s))", session)
    page.reload()
    page.wait_for_selector('text=Tu cuenta no es administradora')
    # sin sesión: formulario de entrada
    page.evaluate("localStorage.removeItem('migym.sb')")
    page.reload()
    page.wait_for_selector('.adm-login')
    ctx.close()
    b.close()
print('admin ok · errores:', errors)
sys.exit(1 if errors else 0)
