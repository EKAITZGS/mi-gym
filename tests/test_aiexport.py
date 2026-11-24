# «Claude o ChatGPT»: copiar los datos desde Rutinas, pegar la respuesta con la rutina y aplicarla;
# «Analizar con Claude o ChatGPT» en Progreso. Contra `VITE_CLOUD=off npm run build` + preview.
import os, json, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('URL', 'http://127.0.0.1:4173/')
SHOTS = os.path.join(os.path.dirname(__file__), 'shots')
B = 'Barbell_Bench_Press_-_Medium_Grip'
seed = {
    'v': 2, 'setupDone': True, 'goals': {'kcal': 2200, 'protein': 150},
    'plan': [{'id': 'd1', 'name': 'Pecho', 'weekday': 1, 'items': [{'id': 'i1', 'ex': B, 'sets': 3, 'reps': '8-10', 'drop': False}]}],
    'active': None,
    'sessions': [{'id': 's1', 'date': '2026-11-20', 'dayId': 'd1', 'dayName': 'Pecho', 'entries': {B: [{'w': '60', 'r': '10'}, {'w': '60', 'r': '9'}]}}],
    'food': {}, 'myFoods': [], 'myExercises': [],
}
reply = 'Te propongo:\n```json\n' + json.dumps({'resumen': 'Más volumen', 'dias': [
    {'ref': 'd1', 'nombre': 'Pecho', 'dia': 1, 'ejercicios': [{'ref': 'd1e1', 'id': B, 'series': 4, 'reps': '6-8', 'rir': 2}, {'ref': None, 'id': 'Incline_Dumbbell_Press', 'series': 3, 'reps': '10-12'}]},
]}) + '\n```'
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, locale='es-ES', reduced_motion='reduce', service_workers='block', permissions=['clipboard-read', 'clipboard-write'])
    ctx.route('**/workers.dev/**', lambda r: r.abort())
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    page.goto(URL)
    page.evaluate("s => localStorage.setItem('migym.v1', JSON.stringify(s))", seed)
    page.reload()
    page.wait_for_selector('.tabbar')
    data = lambda: json.loads(page.evaluate("localStorage.getItem('migym.v1')"))

    page.click('.tabbar button:has-text("Rutinas")')
    page.click('text=Plan con Claude o ChatGPT')
    page.wait_for_selector('.sheet:has-text("Claude o ChatGPT")')
    assert page.locator('.sheet .seg [role=radio][aria-checked=true]').first.inner_text() == 'Un plan'
    page.fill('textarea[placeholder^="Ej.: quiero"]', 'quiero 4 días')
    page.click('.ax-prev summary')
    txt = page.locator('.ax-prev pre').inner_text()
    assert 'd1 · lunes · Pecho' in txt and 'Lo que quiero: quiero 4 días' in txt and '```json' in txt, txt[:400]
    os.makedirs(SHOTS, exist_ok=True)
    page.screenshot(path=os.path.join(SHOTS, 'aiexport.png'))
    page.click('button:has-text("Copiar texto")')
    page.wait_for_selector('button:has-text("Copiado")')
    clip = page.evaluate('navigator.clipboard.readText()')
    assert clip.strip() == txt.strip(), (len(clip), len(txt))
    assert page.locator('a.btn[href="https://chatgpt.com/"]').count() == 1
    assert page.locator('a.btn[href="https://claude.ai/new"]').count() == 1

    # respuesta de la otra IA → cambios → Aplicar
    page.fill('textarea[aria-label="Respuesta de Claude o ChatGPT"]', reply)
    page.click('button:has-text("Ver cambios")')
    page.wait_for_selector('.ai-prop')
    page.locator('.ax-open').screenshot(path=os.path.join(SHOTS, 'aiexport-open.png'))
    page.locator('.ai-prop').screenshot(path=os.path.join(SHOTS, 'aiexport-prop.png'))
    page.click('.ai-prop button:has-text("Aplicar")')
    page.wait_for_selector('text=Aplicado')
    page.wait_for_timeout(300)
    items = data()['plan'][0]['items']
    assert [(i['ex'], i['sets'], i['reps']) for i in items] == [(B, 4, '6-8'), ('Incline_Dumbbell_Press', 3, '10-12')], items
    # sin formato → aviso
    page.fill('textarea[aria-label="Respuesta de Claude o ChatGPT"]', 'Haz más series de pecho.')
    page.click('button:has-text("Ver cambios")')
    page.wait_for_selector('text=No encuentro la rutina')
    page.click('.sheet button[aria-label="Cerrar"]')

    # Progreso → «Cómo voy»
    page.click('.tabbar button:has-text("Progreso")')
    page.click('text=Analizar con Claude o ChatGPT')
    page.wait_for_selector('.sheet:has-text("Claude o ChatGPT")')
    assert page.locator('.sheet .seg [role=radio][aria-checked=true]').first.inner_text() == 'Cómo voy'
    assert page.locator('textarea[aria-label="Respuesta de Claude o ChatGPT"]').count() == 0
    page.click('.sheet .seg [role=radio]:has-text("Último entreno")')
    page.click('.ax-prev summary')
    assert '## Último entreno' in page.locator('.ax-prev pre').inner_text()
    ctx.close()
    b.close()
print('aiexport ok · errores:', errors)
sys.exit(1 if errors else 0)
