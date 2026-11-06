import json
from playwright.sync_api import sync_playwright
W='https://mi-gym-polar.ekaitzmartinezm.workers.dev'
INIT="""
Object.defineProperty(navigator,'standalone',{get:()=>true});
window.Notification=window.Notification||function(){}; Notification.requestPermission=async()=>'granted';
const fakeSub={endpoint:'https://web.push.apple.com/xyz',toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'a',auth:'b'}}},unsubscribe:async()=>true};
let subd=null;
const pm={getSubscription:async()=>subd,subscribe:async(o)=>{window.__appKey=o.applicationServerKey.length;subd=fakeSub;return subd}};
window.PushManager=window.PushManager||function(){};
Object.defineProperty(navigator,'serviceWorker',{get:()=>({ready:Promise.resolve({pushManager:pm}),register:async()=>({}),addEventListener(){},getRegistration:async()=>null})});
"""
calls=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2); ctx.add_init_script(INIT)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    def h(r):
        u=r.request.url; calls.append((u.replace(W,''), r.request.post_data and json.loads(r.request.post_data)))
        body={'key':'BPB3n8pYEXAMPLEKEY_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'} if '/push/key' in u else {'ok':True}
        r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps(body))
    pg.route(W+'/push/**',h)
    pg.clock.set_fixed_time('2026-11-06T20:00:00')
    pg.goto('http://127.0.0.1:4173/'); pg.wait_for_selector('.tabbar')
    pg.evaluate("""()=>{const d=JSON.parse(localStorage.getItem('migym.v1')); d.setupDone=true; d.plan[0].weekday=6; d.food={'2026-11-06':[{id:'1',meal:'Comida',name:'Pasta',grams:300,kcal:160,p:6,c:30,f:2}]}; localStorage.setItem('migym.v1',JSON.stringify(d))}""")
    pg.reload(); pg.wait_for_selector('.tabbar')
    pg.click('.tabbar button:has-text("Ajustes")'); pg.wait_for_timeout(400)
    pg.click('button:has-text("Activar avisos")'); pg.wait_for_timeout(1500)
    card=pg.locator('.card:has(.push-opt)')
    print('mensaje:', pg.locator('.toast').first.inner_text() if pg.locator('.toast').count() else None)
    print('llamadas:', [c[0] for c in calls])
    sync=[c for c in calls if c[0]=='/push/sync'][0][1]
    for it in sync['items'][:6]: print('  ', it['k'], json.dumps(it['title'],ensure_ascii=False))
    card.scroll_into_view_if_needed(); pg.wait_for_timeout(300); card.screenshot(path='/home/claude/shots/push.png')
    n=len(calls)
    pg.locator('.push-opt input[type=checkbox]').nth(1).uncheck(); pg.wait_for_timeout(3800)
    last=[c for c in calls[n:] if c[0]=='/push/sync']
    print('resync al cambiar prefs:', len(last), 'sin prot:', all(not i['k'].startswith('prot') for i in last[-1][1]['items']) if last else None)
    print('ERR',errs)
