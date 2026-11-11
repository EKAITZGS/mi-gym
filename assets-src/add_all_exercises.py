# Añade el resto de free-exercise-db (dominio público) a src/data/exercises.js sin tocar los existentes.
# Cada ejercicio nuevo lleva `more: true` (el generador de planes no lo usa), `track` si no se mide por reps
# ('time' segundos, 'dist' metros, 'cardio' km + min) y `kind` si no es fuerza normal.
# Uso: python assets-src/add_all_exercises.py  (desde la raíz; necesita internet a raw.githubusercontent.com)
import json, io, os, re, sys, urllib.request
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from names_es import N

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(ROOT, 'src/data/exercises.js')
IMG = os.path.join(ROOT, 'public/ex')
DB = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main'
MUS = {'chest': 'Pecho', 'shoulders': 'Hombros', 'triceps': 'Tríceps', 'biceps': 'Bíceps', 'lats': 'Dorsales', 'middle back': 'Espalda media',
       'lower back': 'Lumbar', 'traps': 'Trapecio', 'forearms': 'Antebrazo', 'quadriceps': 'Cuádriceps', 'hamstrings': 'Femorales',
       'glutes': 'Glúteos', 'calves': 'Gemelos', 'abdominals': 'Abdominales', 'adductors': 'Aductores', 'abductors': 'Abductores', 'neck': 'Cuello'}
EQ = {'barbell': 'Barra', 'dumbbell': 'Mancuernas', 'machine': 'Máquina', 'cable': 'Polea', 'body only': 'Peso corporal', 'e-z curl bar': 'Barra Z',
      'kettlebells': 'Kettlebell', 'bands': 'Bandas', 'medicine ball': 'Otro', 'exercise ball': 'Otro', 'foam roll': 'Otro', 'other': 'Otro'}
GROUP_OF = {'chest': 'Pecho', 'lats': 'Espalda', 'middle back': 'Espalda', 'lower back': 'Espalda', 'traps': 'Espalda', 'shoulders': 'Hombro',
            'neck': 'Hombro', 'biceps': 'Bíceps', 'triceps': 'Tríceps', 'quadriceps': 'Pierna', 'hamstrings': 'Pierna', 'glutes': 'Pierna',
            'calves': 'Pierna', 'adductors': 'Pierna', 'abductors': 'Pierna', 'abdominals': 'Core', 'forearms': 'Antebrazo'}
KIND = {'stretching': 'Estiramiento', 'plyometrics': 'Pliometría', 'olympic weightlifting': 'Halterofilia', 'strongman': 'Strongman',
        'cardio': 'Cardio', 'powerlifting': 'Powerlifting'}
TIME = re.compile(r'Isometric|Hang$|Balance_Board|Battling_Ropes|Crucifix|Stomach_Vacuum|Plate_Pinch|Hand_Squeeze')
DIST = re.compile(r'Walk|Sled|Drag|Carry|Yoke|Crawl|Prowler|Power_Stairs|Lunge_Sprint')


def track_of(e):
    if e['category'] == 'cardio':
        return 'cardio'
    if e['category'] == 'stretching' or TIME.search(e['id']):
        return 'time'
    if DIST.search(e['id']):
        return 'dist'
    return 'reps'


src = open(JS, encoding='utf-8').read()
head = src[:src.index('export const EXERCISES = ')]  # comentario + GROUPS
tail = src[src.index('export const EX_BY_ID'):].split('\n', 1)[1]  # ejercicios propios
cur = json.loads(re.search(r'export const EXERCISES = (\[.*?\]);\nexport const EX_BY_ID', src, re.S).group(1))
have = {e['id'] for e in cur}
db = json.load(urllib.request.urlopen(DB + '/dist/exercises.json'))
added = 0
for d in db:
    eid = d['id']
    if eid in have or not d.get('images') or eid not in N:
        continue
    imgs = []
    for i, rel in enumerate(d['images'][:2]):
        os.makedirs(os.path.join(IMG, eid), exist_ok=True)
        out = os.path.join(IMG, eid, f'{i}.webp')
        if not os.path.exists(out):
            raw = urllib.request.urlopen(f'{DB}/exercises/{rel}').read()
            im = Image.open(io.BytesIO(raw)).convert('RGB')
            if im.width > 640:
                im = im.resize((640, round(im.height * 640 / im.width)), Image.LANCZOS)
            im.save(out, 'WEBP', quality=72, method=6)
        imgs.append(f'ex/{eid}/{i}.webp')
    cat = d['category']
    prim = d.get('primaryMuscles') or ['abdominals']
    group = 'Cardio' if cat == 'cardio' else 'Estiramientos' if cat == 'stretching' else GROUP_OF.get(prim[0], 'Core')
    main = [MUS.get(m, m) for m in prim]
    rec = {
        'id': eid, 'name': N[eid], 'group': group, 'main': main,
        'sec': [MUS.get(m, m) for m in d.get('secondaryMuscles', []) if MUS.get(m, m) not in main],
        'equip': EQ.get(d.get('equipment') or 'body only', 'Otro'), 'imgs': imgs, 'more': True,
    }
    t = track_of(d)
    if t != 'reps':
        rec['track'] = t
    if cat in KIND:
        rec['kind'] = KIND[cat]
    cur.append(rec)
    added += 1

with open(JS, 'w', encoding='utf-8') as f:
    f.write(head)
    f.write('export const EXERCISES = ' + json.dumps(cur, ensure_ascii=False, indent=1) + ';\n')
    f.write('export const EX_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));\n')
    f.write(tail)
print('añadidos', added, 'total', len(cur))
