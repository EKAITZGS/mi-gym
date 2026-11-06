import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    dl=[]; pg.on('dialog',lambda d:(dl.append(d.message), d.accept('Desayuno de siempre') if d.type=='prompt' else d.accept()))
    pg.clock.set_fixed_time('2026-11-06T20:30:00')
    pg.goto('http://127.0.0.1:4173/'); pg.wait_for_selector('.tabbar')
    pg.evaluate("""()=>{const d=JSON.parse(localStorage.getItem('migym.v1')); d.setupDone=true;
      const e=(meal,name,grams,kcal,pp,c,f)=>({id:Math.random().toString(36).slice(2),meal,name,grams,kcal,p:pp,c,f});
      d.food={'2026-11-06':[e('Desayuno','Croissant',100,404,5.3,40,20),e('Comida','Pasta con carne',450,160,6.5,20,5)],
              '2026-11-05':[e('Desayuno','Tostada con aceite',60,350,8,40,15),e('Desayuno','Leche',250,46,3.4,4.8,1.6)]};
      d.sessions=[{id:'a',date:'2026-11-06',dayId:'free',dayName:'Brazo',entries:{Preacher_Curl:[{w:'7',r:'10'},{w:'7',r:'10'},{w:'7',r:'9'}],Hammer_Curls:[{w:'8',r:'10'},{w:'8',r:'10'}],'Barbell_Bench_Press_-_Medium_Grip':Array(12).fill({w:'40',r:'8'})}}];
      d.polar={lastSync:'2026-11-06T19:00:00Z',exercises:{},days:{'2026-11-06':{kcal:1800,active:200,steps:4210}}};
      d.body={waist:[{date:'2026-10-23',cm:96},{date:'2026-10-30',cm:95.5}],photos:[]};
      localStorage.setItem('migym.v1',JSON.stringify(d))}""")
    pg.reload(); pg.wait_for_timeout(1500)
    t=pg.locator('body').inner_text()
    for k in ['Te faltan','pasos hoy','Series por músculo','Tu cuerpo','Toca medir']: print(k, k in t)
    pg.screenshot(path='/home/claude/shots/x_home1.png', full_page=True)
    # proteína: añadir primera sugerencia
    before=pg.evaluate("JSON.parse(localStorage.getItem('migym.v1')).food['2026-11-06'].length")
    pg.locator('.prot-tip button:has-text("Añadir")').first.click(); pg.wait_for_timeout(200)
    fd=pg.evaluate("JSON.parse(localStorage.getItem('migym.v1')).food['2026-11-06']")
    print('añadido proteína:', len(fd)==before+1, fd[-1]['name'], fd[-1]['meal'])
    # cintura
    pg.click('.body-card button:has-text("Toca medir")'); pg.fill('.sheet input','94,5'); pg.click('.sheet button:has-text("Guardar")'); pg.wait_for_timeout(300)
    print('cintura:', pg.locator('.body-card').inner_text().replace('\n',' | ')[:120])
    # foto
    pg.click('.body-card button:has-text("foto")'); pg.set_input_files('.sheet input[type=file][capture]','/tmp/foto.jpg'); pg.wait_for_timeout(1500)
    pg.set_input_files('.sheet input[type=file][multiple]',['/tmp/foto.jpg','/tmp/foto.jpg']); pg.wait_for_timeout(2000)
    print('fotos:', pg.locator('.sheet .ph-grid img').count(), 'comparar:', pg.locator('.ph-compare img').count())
    pg.locator('.sheet').screenshot(path='/home/claude/shots/x_photos.png')
    pg.click('.sheet .icon-btn >> nth=0') if False else pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.reload(); pg.wait_for_timeout(1200)
    # Dieta
    pg.click('.tabbar button:has-text("Dieta")'); pg.wait_for_timeout(500)
    t=pg.locator('body').inner_text(); print('dieta tip:', 'Te faltan' in t, '| repetir:', 'Repetir de ayer' in t)
    pg.click('button.fav-save >> nth=0'); pg.wait_for_timeout(200)
    print('favs:', pg.evaluate("JSON.parse(localStorage.getItem('migym.v1')).favMeals.map(f=>f.name)"))
    pg.click('.datenav .icon-btn >> nth=1'); pg.wait_for_timeout(300)  # mañana
    t=pg.locator('body').inner_text(); print('mañana chips:', 'Repetir de ayer' in t, 'Desayuno de siempre' in t)
    pg.locator('.meal-quick .chip:has-text("Repetir de ayer")').first.click(); pg.wait_for_timeout(200)
    print('copiado mañana:', pg.evaluate("(JSON.parse(localStorage.getItem('migym.v1')).food['2026-11-07']||[]).map(e=>e.meal+':'+e.name)"))
    pg.screenshot(path='/home/claude/shots/x_diet.png', full_page=True)
    print('ERR', errs)
