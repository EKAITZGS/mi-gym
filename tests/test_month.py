import os
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.clock.set_fixed_time('2026-11-20T12:00:00')
    pg.goto('http://127.0.0.1:4173/'); pg.wait_for_selector('.tabbar')
    pg.evaluate("""()=>{const d=JSON.parse(localStorage.getItem('migym.v1')); d.setupDone=true;
      const e=(meal,name,grams,kcal,pp,c,f,s)=>({id:Math.random().toString(36).slice(2),meal,name,grams,kcal,p:pp,c,f,s:s??1,sf:1});
      d.food={}; for(let i=1;i<=19;i++){const ds='2026-11-'+String(i).padStart(2,'0'); d.food[ds]=[e('Desayuno','Croissant con crema de cacao',100,404,5.3,45,22,25),e('Desayuno','Leche semidesnatada',250,46,3.4,4.8,1.6),e('Comida','Pasta con tomate y carne',450,160,6.5,20,5),e('Cena','Tortilla francesa',150,180,12,1,14)]}
      d.sessions=[]; for(const [i,w] of [[3,7],[6,7],[10,8],[13,8],[17,9]]) d.sessions.push({id:'s'+i,date:'2026-11-'+String(i).padStart(2,'0'),dayId:'free',dayName:'Brazo',entries:{Preacher_Curl:[{w:String(w),r:'10'},{w:String(w),r:'10'}]}});
      d.body={waist:[{date:'2026-11-01',cm:96},{date:'2026-11-08',cm:95.2},{date:'2026-11-15',cm:94.4}],photos:[]};
      d.polar={days:{'2026-11-18':{steps:4100},'2026-11-19':{steps:6200}},exercises:{}};
      localStorage.setItem('migym.v1',JSON.stringify(d))}""")
    pg.reload(); pg.wait_for_timeout(1200)
    pg.click('.month-link'); pg.wait_for_timeout(600)
    print(pg.locator('.sheet').inner_text().replace('\n',' | '))
    pg.locator('.sheet').screenshot(path='tests/shots/month.png')
    pg.keyboard.press('Escape'); pg.locator('.sheet button[aria-label]').first.click() if pg.locator('.sheet').count() else None
    pg.reload(); pg.wait_for_timeout(800)
    pg.click('.tabbar button:has-text("Dieta")'); pg.wait_for_timeout(400)
    pg.click('button:has-text("Día tipo sugerido")'); pg.wait_for_timeout(600)
    print(pg.locator('.sheet').inner_text().replace('\n',' | '))
    pg.locator('.sheet').screenshot(path='tests/shots/dayplan.png')
    pg.click('.sheet button:has-text("Usar mañana")'); pg.wait_for_timeout(200)
    print('mañana:', len(json.loads(pg.evaluate("localStorage.getItem('migym.v1')"))['food'].get('2026-11-21',[])))
    print('ERR',errs)
