from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.clock.set_fixed_time('2026-11-08T12:00:00')
    pg.goto('http://127.0.0.1:4173/'); pg.wait_for_selector('.tabbar')
    pg.evaluate("""()=>{const d=JSON.parse(localStorage.getItem('migym.v1')); d.setupDone=true;
      d.sessions=[{id:'a',date:'2026-11-06',dayId:'free',dayName:'Brazo',entries:{Preacher_Curl:[{w:'7',r:'10'},{w:'7',r:'10'}],Hammer_Curls:[{w:'8',r:'10'},{w:'8',r:'10'}],Triceps_Pushdown:[{w:'20',r:'10'}]}},
                  {id:'b',date:'2026-11-07',dayId:'free',dayName:'Pecho',entries:{'Barbell_Bench_Press_-_Medium_Grip':[{w:'50',r:'8'},{w:'50',r:'8'},{w:'50',r:'7'}],Incline_Dumbbell_Press:[{w:'16',r:'10'},{w:'16',r:'9'}]}}];
      localStorage.setItem('migym.v1',JSON.stringify(d))}""")
    pg.reload(); pg.wait_for_timeout(1500)
    ms=pg.locator('.card:has-text("Series por músculo")'); ms.scroll_into_view_if_needed(); print(ms.inner_text().replace('\n',' | '))
    ms.screenshot(path='/home/claude/shots/msets2.png')
    pg.click('.rank-card'); pg.wait_for_timeout(700)
    print(pg.locator('.sheet').inner_text().replace('\n',' | ')[:1300])
    pg.locator('.sheet .mq').screenshot(path='/home/claude/shots/mq_sec.png')
    print('ERR',errs)
