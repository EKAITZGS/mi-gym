import os
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.clock.set_fixed_time('2026-11-08T12:00:00')
    pg.goto('http://127.0.0.1:4173/'); pg.wait_for_selector('.tabbar')
    pg.evaluate("""()=>{const d=JSON.parse(localStorage.getItem('migym.v1')); d.setupDone=true;
      d.body={...(d.body||{}),weight:[{date:'2026-11-01',kg:81.5},{date:'2026-11-08',kg:81}]};
      d.sessions=[{id:'a',date:'2026-11-06',dayId:'free',dayName:'Brazo',entries:{
        Preacher_Curl:[{w:'7',r:'10',rl:'10',rr:'9'},{w:'7',r:'9',rl:'10',rr:'9'}],
        Hammer_Curls:[{w:'10',r:'10',rl:'10',rr:'10'}],
        Triceps_Pushdown:[{w:'25',r:'10'}],
        'Barbell_Bench_Press_-_Medium_Grip':[{w:'60',r:'8'}],
        'Wide-Grip_Lat_Pulldown':[{w:'55',r:'10'}],
        Side_Lateral_Raise:[{w:'8',r:'12'}],
        Leg_Press:[{w:'160',r:'10'}],
        Pullups:[{w:'',r:'6'}]}}];
      localStorage.setItem('migym.v1',JSON.stringify(d))}""")
    pg.reload(); pg.wait_for_timeout(1500)
    c=pg.locator('.rank-card'); c.scroll_into_view_if_needed(); pg.wait_for_timeout(400); c.screenshot(path='tests/shots/rank_card.png')
    print(c.inner_text().replace('\n',' | '))
    c.click(); pg.wait_for_timeout(700)
    print(pg.locator('.sheet').inner_text().replace('\n',' | ')[:1500])
    pg.locator('.sheet').screenshot(path='tests/shots/rank_detail.png')
    pg.locator('.sheet .icon-btn').first.click(); pg.wait_for_timeout(500); print('cerrado:', pg.locator('.sheet').count()==0)
    print('ERR',errs)
