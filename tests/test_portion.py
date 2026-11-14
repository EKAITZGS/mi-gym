import os
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,permissions=[]); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    sent={}
    def groq(route):
        if route.request.method=='OPTIONS': return route.fulfill(status=204,headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'})
        body=json.loads(route.request.post_data); sent['prompt']=body['messages'][0]['content'][0]['text']
        content=json.dumps({"alimentos":[{"nombre":"Pipas con sal (sin cáscara)","total_g":100,"comido_g":40,"kcal":232,"proteina_g":8.4,"carbos_g":8,"grasa_g":20},{"nombre":"Lata de Coca-Cola","total_g":330,"comido_g":330,"kcal":139,"proteina_g":0,"carbos_g":35,"grasa_g":0}],"total_kcal":371,"supuestos":"Falta algo menos de la mitad del paquete; peso comestible sin cáscara.","confianza":"media"})
        route.fulfill(status=200,headers={'access-control-allow-origin':'*'},content_type='application/json',body=json.dumps({"choices":[{"message":{"content":content}}]}))
    pg.route('https://api.groq.com/**',groq)
    pg.route('https://world.openfoodfacts.org/**',lambda r:r.fulfill(status=200,headers={'access-control-allow-origin':'*'},content_type='application/json',body=json.dumps({"status":1,"product":{"product_name":"Pipas G","brands":"Grefusa","product_quantity":"160","serving_quantity":"25","nutriments":{"energy-kcal_100g":580,"proteins_100g":21,"carbohydrates_100g":15,"fat_100g":48}}})))
    pg.goto('http://127.0.0.1:4173/'); pg.wait_for_selector('.tabbar')
    pg.evaluate("localStorage.setItem('migym.groqkey','gsk_x')")
    D=lambda: json.loads(pg.evaluate("localStorage.getItem('migym.v1')"))
    # FOTO
    pg.click('.tabbar button:has-text("Dieta")'); pg.click('button[aria-label="Añadir a Merienda"]')
    with pg.expect_file_chooser() as fc: pg.click('.qa:has-text("Foto")')
    fc.value.set_files('tests/shots/barcode.jpg'); pg.wait_for_selector('text=¿Cuánto te has comido?')
    pg.fill('.sheet input.inp','me comí 40 g de pipas y la lata entera'); pg.click('.sheet button:has-text("Analizar")')
    pg.wait_for_selector('text=Lo que te has comido'); pg.wait_for_timeout(300)
    print('porción en prompt:', 'PORCIÓN: me comí 40 g' in sent['prompt'])
    print(pg.locator('.sheet').inner_text().replace('\n',' | ')[:400])
    pg.locator('.sheet').screenshot(path='tests/shots/ai_review.png')
    pg.locator('.ai-row input').nth(0).fill('50'); pg.wait_for_timeout(100)
    print('tras 50 g:', pg.locator('.ai-item').nth(0).inner_text().replace('\n',' '))
    pg.locator('.ai-item input[type=checkbox]').nth(1).uncheck()
    pg.click('.sheet button:has-text("Añadir a")'); pg.wait_for_timeout(200)
    e=[x for x in D()['food'][list(D()['food'].keys())[0]]]; print('guardado:', [(x['name'],x['grams'],round(x['kcal']),x['meal']) for x in e])
    # CÓDIGO
    pg.click('button[aria-label="Añadir a Cena"]'); pg.click('.qa:has-text("Escanear")'); pg.wait_for_timeout(300)
    pg.fill('input[placeholder="8410000000000"]','8410199011111'); pg.click('button:has-text("Buscar")'); pg.wait_for_selector('text=¿Cuánto del paquete?')
    print(pg.locator('.pkg-box').inner_text().replace('\n',' | '))
    pg.click('.pkg-box .chip:has-text("La mitad")'); pg.wait_for_timeout(100); print('cantidad:', pg.locator('.qty input').input_value(), '|', pg.locator('.sum').inner_text())
    pg.locator('.sheet').screenshot(path='tests/shots/pkg.png')
    print('ERR',errs)
