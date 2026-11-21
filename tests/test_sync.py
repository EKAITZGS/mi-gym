# Sincronización entre dos dispositivos y entreno sin conexión, contra una nube simulada.
# La "nube" responde como la API de Supabase (PostgREST) que usa la app: select, update condicionado
# por updated_at, insert y upsert. Requiere `npm run build && npx vite preview --port 4173` (build normal).
import os, json, sys, time, datetime, urllib.parse
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL', 'http://127.0.0.1:4173/')
UID = '11111111-1111-1111-1111-111111111111'
B = 'Barbell_Bench_Press_-_Medium_Grip'
today = datetime.date.today().isoformat()
iso = lambda dt: dt.astimezone(datetime.timezone.utc).isoformat(timespec='milliseconds')  # como Postgres: +00:00
parse = lambda s: datetime.datetime.fromisoformat(s.replace('Z', '+00:00'))

D0 = {
    'v': 2, 'setupDone': True, 'goals': {'kcal': 2200, 'protein': 150, 'steps': 7000},
    'plan': [{'id': 'd1', 'name': 'Pecho', 'weekday': None, 'items': [{'id': 'i1', 'ex': B, 'sets': 2, 'reps': '8-10', 'drop': False}]}],
    'active': None,
    'sessions': [{'id': 's0', 'date': '2026-10-01', 'dayId': 'd1', 'dayName': 'Pecho', 'entries': {B: [{'w': '60', 'r': '10', 'drops': []}]}}],
    'food': {}, 'myFoods': [], 'myExercises': [],
}
T0 = iso(datetime.datetime(2026, 11, 1, tzinfo=datetime.timezone.utc))
cloud = {'row': {'data': json.loads(json.dumps(D0)), 'updated_at': T0}, 'writes': 0, 'down': False}
session = {
    'access_token': 'x.y.z', 'token_type': 'bearer', 'expires_in': 3600, 'expires_at': int(time.time()) + 86400,
    'refresh_token': 'r', 'user': {'id': UID, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'test@ejemplo.com', 'app_metadata': {}, 'user_metadata': {}},
}
meta = {'uid': UID, 'email': 'test@ejemplo.com', 'dirty': False, 'name': 'Test', 'role': 'user', 'synced': T0}
cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS', 'Access-Control-Expose-Headers': '*'}

def rest(route):
    req = route.request
    if req.method == 'OPTIONS':
        return route.fulfill(status=204, headers=cors)
    if cloud['down']:
        return route.abort('internetdisconnected')
    u = urllib.parse.urlparse(req.url)
    table = u.path.split('/rest/v1/')[-1]
    qs = urllib.parse.parse_qs(u.query)
    ok = lambda body, status=200: route.fulfill(status=status, headers={**cors, 'Content-Type': 'application/json'}, body=json.dumps(body))
    if table == 'user_data':
        row = cloud['row']
        if req.method == 'GET':
            return ok([{'data': row['data'], 'updated_at': row['updated_at']}] if row else [])
        body = json.loads(req.post_data or '{}')
        if req.method == 'PATCH':
            want = qs.get('updated_at', [''])[0].removeprefix('eq.')
            if row and parse(row['updated_at']) == parse(want):
                cloud['row'] = {'data': body['data'], 'updated_at': iso(parse(body['updated_at']))}
                cloud['writes'] += 1
                return ok([{'updated_at': cloud['row']['updated_at']}])
            return ok([])
        if req.method == 'POST':
            upsert = 'merge-duplicates' in (req.headers.get('prefer') or '')
            if row and not upsert:
                return ok({'code': '23505', 'message': 'duplicate key value violates unique constraint "user_data_pkey"'}, 409)
            cloud['row'] = {'data': body['data'], 'updated_at': iso(parse(body['updated_at']))}
            cloud['writes'] += 1
            return route.fulfill(status=201, headers=cors, body='')
    if table == 'profiles':
        return ok([{'name': 'Test', 'role': 'user'}])
    return ok([])

def device(b, name):
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, locale='es-ES', reduced_motion='reduce', service_workers='block')
    ctx.route('**/rest/v1/**', rest)
    ctx.route('**/auth/v1/**', lambda r: r.fulfill(status=401, headers=cors, body='{}'))
    ctx.route('**/workers.dev/**', lambda r: r.abort())
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
    page.on('dialog', lambda d: d.accept())
    page.goto(URL)
    page.evaluate("""([s, m, d, uid]) => {
        localStorage.setItem('migym.sb', JSON.stringify(s)); localStorage.setItem('migym.cloud', JSON.stringify(m));
        localStorage.setItem('migym.lastUid', uid); localStorage.setItem('migym.v1', JSON.stringify(d)) }""", [session, meta, D0, UID])
    page.reload()
    page.wait_for_selector('.tabbar')
    pages.append(page)
    return ctx, page

local = lambda page: json.loads(page.evaluate("localStorage.getItem('migym.v1')"))
# ojo: en la API síncrona de Playwright las rutas simuladas solo se atienden mientras Playwright espera,
# así que se espera con wait_for_timeout (no con time.sleep)
pages = []
def wait_for(cond, what, secs=15):
    t = time.time()
    while time.time() - t < secs:
        if cond():
            return
        pages[-1].wait_for_timeout(250)
    raise AssertionError('no llegó: ' + what)

def set_goal(page, idx, value):
    page.click('.tabbar button:has-text("Perfil")')
    page.click('text=Ajustes')
    page.click('text=Objetivos diarios')
    inp = page.locator('.page input.inp').nth(idx)
    inp.fill(str(value))
    inp.blur()
    page.wait_for_timeout(200)

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])

    # 1) dos móviles cambian cosas distintas a la vez: no se pierde ninguna
    ca, A = device(b, 'A')
    cb, Bp = device(b, 'B')
    set_goal(A, 0, 2100)                       # A: kcal
    wait_for(lambda: cloud['row']['data']['goals']['kcal'] == 2100, 'subida de A')
    set_goal(Bp, 1, 170)                       # B: proteína, sin saber lo de A (su versión es la antigua)
    wait_for(lambda: cloud['row']['data']['goals'].get('protein') == 170, 'subida de B')
    g = cloud['row']['data']['goals']
    assert g['kcal'] == 2100 and g['protein'] == 170, g   # antes: B pisaba las kcal de A
    A.evaluate("window.dispatchEvent(new Event('online'))")  # A vuelve a mirar la nube
    wait_for(lambda: local(A)['goals'].get('protein') == 170, 'A recibe lo de B')
    assert local(A)['goals']['kcal'] == 2100
    print('1) cambios simultáneos: ok', g)
    # el estado de la sincronización se puede ver en Perfil: lo último que ha hecho
    Bp.click('button.link:has-text("Ajustes")')   # de Objetivos a Ajustes
    Bp.click('button.link:has-text("Perfil")')    # de Ajustes a Perfil
    Bp.click('button[aria-label="Estado de la sincronización"]')
    Bp.wait_for_selector('text=Últimos movimientos')
    log = Bp.locator('.sync-log').inner_text()
    assert 'Juntado' in log and 'Subido' in log, log
    Bp.keyboard.press('Escape')

    # 2) entreno sin conexión en A: series, cerrar la app, reabrir, seguir, terminar
    cloud['down'] = True
    A.click('.tabbar button:has-text("Entrenamiento")')
    A.click('.cta')
    A.click('.start-opt:has-text("Pecho")')
    A.wait_for_selector('text=Terminar entreno')
    inp = A.locator('.card').first.locator('.setrow input.inp')
    assert inp.nth(0).input_value() == '60' and inp.nth(1).input_value() == ''   # peso de referencia, reps vacías
    inp.nth(1).fill('9')
    A.locator('.card').first.locator('.chk').first.click()
    A.wait_for_timeout(300)
    A.close()                                   # se cierra la app a mitad de entreno
    A = ca.new_page()
    pages.append(A)
    A.on('pageerror', lambda e: errors.append(f'A2: {e}'))
    A.on('dialog', lambda d: d.accept())
    A.goto(URL)
    A.wait_for_selector('text=Terminar entreno')  # vuelve sola al entreno en curso
    inp = A.locator('.card').first.locator('.setrow input.inp')
    assert inp.nth(1).input_value() == '9', 'se perdió la serie al cerrar'
    inp.nth(3).fill('8')
    A.locator('.card').first.locator('.chk').nth(1).click()
    for sel in ('button[aria-label="Omitir descanso"]',):
        if A.locator(sel).count():
            A.click(sel)
    A.click('text=Terminar entreno')
    A.click('text=Saltar')
    A.click('text=Listo')
    A.wait_for_timeout(500)
    d = local(A)
    assert d['active'] is None and len(d['sessions']) == 2, len(d['sessions'])
    assert len(cloud['row']['data']['sessions']) == 1   # sin conexión: aún no ha subido
    # vuelve la conexión
    cloud['down'] = False
    A.evaluate("window.dispatchEvent(new Event('online'))")
    wait_for(lambda: len(cloud['row']['data']['sessions']) == 2, 'subida del entreno')
    # repetir la sincronización no duplica
    w = cloud['writes']
    A.reload()
    A.wait_for_selector('.tabbar')
    A.evaluate("window.dispatchEvent(new Event('online'))")
    A.wait_for_timeout(1500)
    assert len(local(A)['sessions']) == 2 and len(cloud['row']['data']['sessions']) == 2
    # el otro dispositivo lo ve, sin duplicados
    Bp.evaluate("window.dispatchEvent(new Event('online'))")
    wait_for(lambda: len(local(Bp)['sessions']) == 2, 'B recibe el entreno')
    s = local(Bp)['sessions'][-1]
    assert [x['r'] for x in s['entries'][B]] == ['9', '8'], s['entries'][B]
    print('2) entreno sin conexión, cierre, reapertura y sincronización: ok · escrituras', cloud['writes'] - w, 'al repetir')

    # 3) un borrado viaja aunque el otro móvil guarde algo a la vez (antes el otro lo resucitaba)
    def fav(page):
        page.click('.tabbar button:has-text("Rutinas")')
        page.click('button[aria-label="Biblioteca de ejercicios"]')
        page.click('.row:has-text("Press banca con barra") >> nth=0')
        page.click('.sheet button:has-text("Favorito")')
        page.keyboard.press('Escape')
        page.wait_for_timeout(200)
    fav(A)                                      # A marca favorito
    wait_for(lambda: B in (cloud['row']['data'].get('favEx') or []), 'favorito subido')
    Bp.evaluate("window.dispatchEvent(new Event('online'))")
    wait_for(lambda: B in (local(Bp).get('favEx') or []), 'B recibe el favorito')
    fav(A)                                      # A lo quita
    wait_for(lambda: B not in (cloud['row']['data'].get('favEx') or []), 'quitado en la nube')
    set_goal(Bp, 2, 8500)                       # B, sin enterarse, guarda otra cosa
    wait_for(lambda: cloud['row']['data']['goals'].get('steps') == 8500, 'subida de B')
    assert B not in (cloud['row']['data'].get('favEx') or []), 'B resucitó el favorito borrado'
    A.evaluate("window.dispatchEvent(new Event('online'))")
    wait_for(lambda: local(A)['goals'].get('steps') == 8500, 'A recibe pasos')
    assert B not in (local(A).get('favEx') or [])
    print('3) borrado que viaja: ok')
    ca.close(); cb.close()

    # 5) iPhone con IndexedDB que no contesta nunca: la subida termina igual y no se queda «Cambios por subir»
    ch, H = device(b, 'H')
    H.close()
    ch.add_init_script("indexedDB.open = () => ({})")   # nunca dispara success ni error
    H = ch.new_page()
    pages.append(H)
    H.on('pageerror', lambda e: errors.append(f'H: {e}'))
    H.goto(URL)
    H.evaluate("([m]) => localStorage.setItem('migym.cloud', JSON.stringify(m))", [{**meta, 'synced': cloud['row']['updated_at']}])
    H.evaluate("([d]) => localStorage.setItem('migym.v1', JSON.stringify(d))", [cloud['row']['data']])
    H.reload()
    H.wait_for_selector('.tabbar')
    set_goal(H, 0, 1999)
    wait_for(lambda: cloud['row']['data']['goals']['kcal'] == 1999, 'subida sin IndexedDB', secs=30)
    wait_for(lambda: json.loads(H.evaluate("localStorage.getItem('migym.cloud')"))['dirty'] is False, 'sin «Cambios por subir»', secs=30)
    print('5) IndexedDB colgado: sube igual y no queda pendiente: ok')
    ch.close()

    # 4) PWA: tras la primera visita, la app abre sin conexión (service worker) con los datos del móvil
    cw = b.new_context(viewport={'width': 390, 'height': 844}, locale='es-ES')
    cw.route('**/rest/v1/**', rest)
    cw.route('**/auth/v1/**', lambda r: r.fulfill(status=401, headers=cors, body='{}'))
    W = cw.new_page()
    pages.append(W)
    W.on('pageerror', lambda e: errors.append(f'W: {e}'))
    W.goto(URL)
    W.evaluate("""([s, m, d, uid]) => {
        localStorage.setItem('migym.sb', JSON.stringify(s)); localStorage.setItem('migym.cloud', JSON.stringify(m));
        localStorage.setItem('migym.lastUid', uid); localStorage.setItem('migym.v1', JSON.stringify(d)) }""", [session, {**meta, 'synced': cloud['row']['updated_at']}, cloud['row']['data'], UID])
    W.evaluate("navigator.serviceWorker.ready.then(() => true)")
    W.reload()
    W.wait_for_function("!!navigator.serviceWorker.controller", timeout=20000)
    cw.set_offline(True)
    W.reload()
    W.wait_for_selector('.tabbar', timeout=15000)
    assert W.locator('.offline-bar').count() == 1, 'sin aviso de "sin conexión"'
    W.click('.tabbar button:has-text("Entrenamiento")')
    W.wait_for_selector('text=Pecho')
    print('4) abre sin conexión con sus datos: ok')
    cw.close()
    b.close()

print('errores:', errors)
sys.exit(1 if errors else 0)
