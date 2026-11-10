# Añade ejercicios de free-exercise-db (dominio público) a src/data/exercises.js sin tocar los existentes.
# Uso: python3 assets-src/add_exercises.py  (desde la raíz del repo; necesita internet a raw.githubusercontent.com)
import json, io, os, re, urllib.request
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(ROOT, 'src/data/exercises.js')
IMG = os.path.join(ROOT, 'public/ex')
DB = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main'
MUS = {'chest':'Pecho','shoulders':'Hombros','triceps':'Tríceps','biceps':'Bíceps','lats':'Dorsales','middle back':'Espalda media','lower back':'Lumbar','traps':'Trapecio','forearms':'Antebrazo','quadriceps':'Cuádriceps','hamstrings':'Femorales','glutes':'Glúteos','calves':'Gemelos','abdominals':'Abdominales','adductors':'Aductores','abductors':'Abductores','neck':'Cuello'}
EQ = {'barbell':'Barra','dumbbell':'Mancuernas','machine':'Máquina','cable':'Polea','body only':'Peso corporal','e-z curl bar':'Barra Z','kettlebells':'Kettlebell','bands':'Bandas','other':'Otro'}
NEW = [
 # Pecho
 ('Smith_Machine_Incline_Bench_Press','Press inclinado en máquina guiada (Smith)','Pecho','Máquina'),
 ('Smith_Machine_Bench_Press','Press banca en máquina guiada (Smith)','Pecho','Máquina'),
 ('Smith_Machine_Decline_Press','Press declinado en máquina guiada (Smith)','Pecho','Máquina'),
 ('Machine_Bench_Press','Press de pecho sentado en máquina','Pecho',None),
 ('Decline_Barbell_Bench_Press','Press declinado con barra','Pecho',None),
 ('Decline_Dumbbell_Bench_Press','Press declinado con mancuernas','Pecho',None),
 ('Hammer_Grip_Incline_DB_Bench_Press','Press inclinado agarre neutro (mancuernas)','Pecho',None),
 ('Cable_Chest_Press','Press de pecho en polea','Pecho',None),
 ('Incline_Cable_Flye','Aperturas inclinadas en polea','Pecho',None),
 ('Flat_Bench_Cable_Flyes','Aperturas en polea (banco plano)','Pecho',None),
 ('Low_Cable_Crossover','Cruce de poleas desde abajo','Pecho',None),
 ('Bent-Arm_Dumbbell_Pullover','Pullover con mancuerna','Pecho',None),
 ('Push-Up_Wide','Flexiones abiertas','Pecho',None),
 ('Incline_Push-Up','Flexiones con manos en banco','Pecho','Peso corporal'),
 ('Decline_Push-Up','Flexiones con pies elevados','Pecho','Peso corporal'),
 # Espalda
 ('Smith_Machine_Bent_Over_Row','Remo en máquina guiada (Smith)','Espalda','Máquina'),
 ('T-Bar_Row_with_Handle','Remo en T','Espalda',None),
 ('Lying_T-Bar_Row','Remo en T con pecho apoyado (máquina)','Espalda',None),
 ('Leverage_Iso_Row','Remo en máquina a una mano','Espalda',None),
 ('Seated_One-arm_Cable_Pulley_Rows','Remo en polea a una mano','Espalda',None),
 ('Elevated_Cable_Rows','Remo en polea con pies elevados','Espalda',None),
 ('Reverse_Grip_Bent-Over_Rows','Remo con barra agarre supino','Espalda',None),
 ('V-Bar_Pulldown','Jalón con triángulo','Espalda',None),
 ('Underhand_Cable_Pulldowns','Jalón al pecho agarre supino','Espalda',None),
 ('Bent-Arm_Barbell_Pullover','Pullover con barra','Espalda',None),
 ('Inverted_Row','Remo invertido (peso corporal)','Espalda','Peso corporal'),
 ('Weighted_Pull_Ups','Dominadas lastradas','Espalda',None),
 ('Stiff_Leg_Barbell_Good_Morning','Buenos días con barra','Espalda',None),
 ('Leverage_Shrug','Encogimientos en máquina','Espalda',None),
 ('Smith_Machine_Behind_the_Back_Shrug','Encogimientos en máquina guiada (Smith)','Espalda','Máquina'),
 # Hombro
 ('Smith_Machine_Overhead_Shoulder_Press','Press militar en máquina guiada (Smith)','Hombro','Máquina'),
 ('Leverage_Shoulder_Press','Press de hombro en máquina de palanca','Hombro',None),
 ('Arnold_Dumbbell_Press','Press Arnold','Hombro',None),
 ('Seated_Cable_Shoulder_Press','Press de hombro en polea','Hombro',None),
 ('Cable_Seated_Lateral_Raise','Elevaciones laterales en polea','Hombro',None),
 ('Front_Cable_Raise','Elevación frontal en polea','Hombro',None),
 ('Cable_Rear_Delt_Fly','Pájaros en polea','Hombro',None),
 ('Seated_Bent-Over_Rear_Delt_Raise','Pájaros sentado con mancuernas','Hombro',None),
 ('Cable_Rope_Rear-Delt_Rows','Remo alto con cuerda (deltoides posterior)','Hombro',None),
 ('Upright_Barbell_Row','Remo al mentón con barra','Hombro',None),
 ('Standing_Dumbbell_Upright_Row','Remo al mentón con mancuernas','Hombro',None),
 ('Smith_Machine_Upright_Row','Remo al mentón en máquina guiada (Smith)','Hombro','Máquina'),
 ('External_Rotation_with_Cable','Rotación externa en polea (manguito rotador)','Hombro',None),
 # Bíceps
 ('Machine_Preacher_Curls','Curl predicador en máquina','Bíceps',None),
 ('Machine_Bicep_Curl','Curl de bíceps en máquina','Bíceps',None),
 ('Cable_Preacher_Curl','Curl predicador en polea','Bíceps',None),
 ('Cable_Hammer_Curls_-_Rope_Attachment','Curl martillo en polea con cuerda','Bíceps',None),
 ('High_Cable_Curls','Curl en polea alta','Bíceps',None),
 ('Spider_Curl','Curl araña','Bíceps',None),
 ('Zottman_Curl','Curl Zottman','Bíceps',None),
 ('Reverse_Cable_Curl','Curl inverso en polea','Bíceps',None),
 # Tríceps
 ('EZ-Bar_Skullcrusher','Press francés con barra Z','Tríceps',None),
 ('Dip_Machine','Fondos en máquina','Tríceps',None),
 ('Smith_Machine_Close-Grip_Bench_Press','Press cerrado en máquina guiada (Smith)','Tríceps','Máquina'),
 ('Tricep_Dumbbell_Kickback','Patada de tríceps con mancuerna','Tríceps',None),
 ('Cable_One_Arm_Tricep_Extension','Extensión de tríceps a una mano en polea','Tríceps',None),
 ('Reverse_Grip_Triceps_Pushdown','Extensión de tríceps en polea agarre supino','Tríceps',None),
 ('Push-Ups_-_Close_Triceps_Position','Flexiones cerradas (diamante)','Tríceps',None),
 # Pierna
 ('Smith_Machine_Squat','Sentadilla en máquina guiada (Smith)','Pierna','Máquina'),
 ('Front_Barbell_Squat','Sentadilla frontal','Pierna',None),
 ('Dumbbell_Squat','Sentadilla con mancuernas','Pierna',None),
 ('Plie_Dumbbell_Squat','Sentadilla sumo con mancuerna','Pierna',None),
 ('Split_Squat_with_Dumbbells','Sentadilla búlgara con mancuernas','Pierna',None),
 ('One_Leg_Barbell_Squat','Sentadilla búlgara con barra','Pierna',None),
 ('Smith_Single-Leg_Split_Squat','Sentadilla búlgara en máquina guiada (Smith)','Pierna','Máquina'),
 ('Barbell_Walking_Lunge','Zancadas caminando con barra','Pierna',None),
 ('Dumbbell_Rear_Lunge','Zancada atrás con mancuernas','Pierna',None),
 ('Dumbbell_Step_Ups','Subidas al banco con mancuernas','Pierna',None),
 ('Sumo_Deadlift','Peso muerto sumo','Pierna',None),
 ('Stiff-Legged_Dumbbell_Deadlift','Peso muerto rumano con mancuernas','Pierna',None),
 ('Smith_Machine_Stiff-Legged_Deadlift','Peso muerto rumano en máquina guiada (Smith)','Pierna','Máquina'),
 ('Standing_Leg_Curl','Curl femoral de pie en máquina','Pierna',None),
 ('Glute_Ham_Raise','Curl nórdico en máquina (glute-ham)','Pierna',None),
 ('Thigh_Abductor','Abductores en máquina (glúteo medio)','Pierna',None),
 ('Thigh_Adductor','Aductores en máquina','Pierna',None),
 ('Smith_Machine_Calf_Raise','Gemelos en máquina guiada (Smith)','Pierna','Máquina'),
 ('Calf_Press_On_The_Leg_Press_Machine','Gemelos en prensa','Pierna',None),
 ('Standing_Dumbbell_Calf_Raise','Gemelos de pie con mancuernas','Pierna',None),
 # Glúteo (grupo Pierna)
 ('Barbell_Glute_Bridge','Puente de glúteo con barra','Pierna',None),
 ('Butt_Lift_Bridge','Puente de glúteo','Pierna','Peso corporal'),
 ('Single_Leg_Glute_Bridge','Puente de glúteo a una pierna','Pierna','Peso corporal'),
 ('Glute_Kickback','Patada de glúteo en cuadrupedia','Pierna','Peso corporal'),
 ('One-Legged_Cable_Kickback','Patada de glúteo en polea','Pierna',None),
 ('Pull_Through','Pull-through en polea (glúteo)','Pierna',None),
 ('Reverse_Hyperextension','Hiperextensión inversa (glúteo)','Pierna',None),
 ('One-Arm_Kettlebell_Swings','Swing con kettlebell','Pierna',None),
 # Core
 ('Ab_Crunch_Machine','Crunch en máquina','Core',None),
 ('Ab_Roller','Rueda abdominal','Core','Otro'),
 ('Reverse_Crunch','Crunch inverso','Core',None),
 ('Decline_Crunch','Crunch declinado','Core','Peso corporal'),
 ('Oblique_Crunches_-_On_The_Floor','Crunch oblicuo','Core',None),
 ('Russian_Twist','Giros rusos','Core',None),
 ('Standing_Cable_Wood_Chop','Leñador en polea','Core',None),
 ('Side_Bridge','Plancha lateral','Core',None),
 ('Dead_Bug','Dead bug','Core',None),
 ('Flat_Bench_Lying_Leg_Raise','Elevación de piernas en banco','Core',None),
 ('Dumbbell_Side_Bend','Inclinación lateral con mancuerna','Core',None),
 ('Mountain_Climbers','Escaladores','Core','Peso corporal'),
 # Antebrazo
 ('Palms-Up_Barbell_Wrist_Curl_Over_A_Bench','Curl de muñeca con barra','Antebrazo',None),
 ('Palms-Down_Wrist_Curl_Over_A_Bench','Curl de muñeca inverso con barra','Antebrazo',None),
 ('Cable_Wrist_Curl','Curl de muñeca en polea','Antebrazo',None),
 ('Farmers_Walk','Paseo del granjero','Antebrazo','Mancuernas'),
 # --- tanda 2 ---
 ('Wide-Grip_Barbell_Bench_Press','Press banca agarre abierto','Pecho',None),
 ('Dumbbell_Bench_Press_with_Neutral_Grip','Press con mancuernas agarre neutro','Pecho',None),
 ('Decline_Dumbbell_Flyes','Aperturas declinadas con mancuernas','Pecho',None),
 ('Incline_Cable_Chest_Press','Press inclinado en polea','Pecho',None),
 ('Leverage_Decline_Chest_Press','Press declinado en máquina','Pecho',None),
 ('One_Arm_Dumbbell_Bench_Press','Press con mancuerna a una mano','Pecho',None),
 ('Single-Arm_Cable_Crossover','Cruce de polea a una mano','Pecho',None),
 ('Standing_Cable_Chest_Press','Press de pecho de pie en polea','Pecho',None),
 ('Straight-Arm_Dumbbell_Pullover','Pullover con brazos estirados','Pecho',None),
 ('Dumbbell_Floor_Press','Press en el suelo con mancuernas','Pecho',None),
 ('Parallel_Bar_Dip','Fondos en paralelas','Pecho','Peso corporal'),
 ('Bent_Over_Two-Dumbbell_Row','Remo inclinado con dos mancuernas','Espalda',None),
 ('Dumbbell_Incline_Row','Remo con pecho apoyado (mancuernas)','Espalda',None),
 ('Bent_Over_One-Arm_Long_Bar_Row','Remo landmine a una mano','Espalda',None),
 ('One_Arm_Lat_Pulldown','Jalón a una mano','Espalda',None),
 ('Rope_Straight-Arm_Pulldown','Pullover en polea con cuerda','Espalda',None),
 ('Kneeling_Single-Arm_High_Pulley_Row','Jalón de rodillas a una mano','Espalda',None),
 ('V-Bar_Pullup','Dominadas con triángulo','Espalda',None),
 ('Wide-Grip_Rear_Pull-Up','Dominadas agarre abierto','Espalda',None),
 ('Mixed_Grip_Chin','Dominadas agarre mixto','Espalda','Peso corporal'),
 ('Band_Assisted_Pull-Up','Dominadas asistidas con goma','Espalda','Bandas'),
 ('Rack_Pulls','Peso muerto desde rack','Espalda',None),
 ('Barbell_Shrug_Behind_The_Back','Encogimientos con barra por detrás','Espalda',None),
 ('Cable_Shrugs','Encogimientos en polea','Espalda',None),
 ('Superman','Superman (lumbar)','Espalda','Peso corporal'),
 ('Seated_Barbell_Military_Press','Press militar sentado con barra','Hombro',None),
 ('Standing_Military_Press','Press militar de pie con barra','Hombro',None),
 ('Standing_Dumbbell_Press','Press de hombro de pie con mancuernas','Hombro',None),
 ('Standing_Palms-In_Dumbbell_Press','Press de hombro agarre neutro','Hombro',None),
 ('Dumbbell_One-Arm_Shoulder_Press','Press de hombro a una mano','Hombro',None),
 ('Seated_Side_Lateral_Raise','Elevaciones laterales sentado','Hombro',None),
 ('One-Arm_Incline_Lateral_Raise','Elevación lateral en banco inclinado','Hombro',None),
 ('One-Arm_Side_Laterals','Elevación lateral a una mano','Hombro',None),
 ('Bent_Over_Low-Pulley_Side_Lateral','Pájaro en polea baja a una mano','Hombro',None),
 ('Standing_Low-Pulley_Deltoid_Raise','Elevación lateral en polea baja','Hombro',None),
 ('Front_Two-Dumbbell_Raise','Elevación frontal con dos mancuernas','Hombro',None),
 ('Standing_Front_Barbell_Raise_Over_Head','Elevación frontal con barra','Hombro',None),
 ('Side_Laterals_to_Front_Raise','Elevación lateral y frontal','Hombro',None),
 ('Dumbbell_Lying_Rear_Lateral_Raise','Pájaros tumbado en banco','Hombro',None),
 ('Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench','Pájaros con la frente apoyada','Hombro',None),
 ('Barbell_Rear_Delt_Row','Remo al cuello con barra (deltoides posterior)','Hombro',None),
 ('Upright_Cable_Row','Remo al mentón en polea','Hombro',None),
 ('Cuban_Press','Press cubano','Hombro',None),
 ('External_Rotation','Rotación externa con mancuerna','Hombro',None),
 ('Cable_Internal_Rotation','Rotación interna en polea','Hombro',None),
 ('Dumbbell_Scaption','Elevación en Y con mancuernas','Hombro',None),
 ('Single-Arm_Linear_Jammer','Press landmine a una mano','Hombro',None),
 ('Band_Pull_Apart','Aperturas con goma','Hombro','Bandas'),
 ('Handstand_Push-Ups','Flexiones en pino','Hombro',None),
 ('Alternate_Hammer_Curl','Curl martillo alterno','Bíceps',None),
 ('Dumbbell_Alternate_Bicep_Curl','Curl alterno con mancuernas','Bíceps',None),
 ('Incline_Dumbbell_Curl','Curl inclinado con mancuernas','Bíceps',None),
 ('Incline_Hammer_Curls','Curl martillo inclinado','Bíceps',None),
 ('Cross_Body_Hammer_Curl','Curl martillo cruzado','Bíceps',None),
 ('Drag_Curl','Curl arrastrado (drag curl)','Bíceps',None),
 ('Close-Grip_EZ_Bar_Curl','Curl cerrado con barra Z','Bíceps','Barra Z'),
 ('Wide-Grip_Standing_Barbell_Curl','Curl con barra agarre abierto','Bíceps',None),
 ('Reverse_Barbell_Curl','Curl inverso con barra','Bíceps',None),
 ('One_Arm_Dumbbell_Preacher_Curl','Curl predicador a una mano','Bíceps',None),
 ('Two-Arm_Dumbbell_Preacher_Curl','Curl predicador con mancuernas','Bíceps',None),
 ('Preacher_Hammer_Dumbbell_Curl','Curl martillo en predicador','Bíceps',None),
 ('Seated_Dumbbell_Curl','Curl sentado con mancuernas','Bíceps',None),
 ('Standing_One-Arm_Cable_Curl','Curl a una mano en polea','Bíceps',None),
 ('Standing_Dumbbell_Reverse_Curl','Curl inverso con mancuernas','Bíceps',None),
 ('Triceps_Pushdown_-_V-Bar_Attachment','Extensión de tríceps en polea con barra V','Tríceps',None),
 ('Cable_Lying_Triceps_Extension','Press francés en polea','Tríceps',None),
 ('Low_Cable_Triceps_Extension','Extensión de tríceps en polea baja','Tríceps',None),
 ('Standing_Overhead_Barbell_Triceps_Extension','Extensión de tríceps sobre la cabeza con barra','Tríceps',None),
 ('Seated_Triceps_Press','Extensión de tríceps sentado con mancuerna','Tríceps',None),
 ('Lying_Dumbbell_Tricep_Extension','Press francés con mancuernas','Tríceps',None),
 ('Decline_EZ_Bar_Triceps_Extension','Press francés declinado','Tríceps','Barra Z'),
 ('JM_Press','Press JM','Tríceps',None),
 ('Tate_Press','Press Tate','Tríceps',None),
 ('Close-Grip_EZ-Bar_Press','Press cerrado con barra Z','Tríceps',None),
 ('Close-Grip_Dumbbell_Press','Press cerrado con mancuernas','Tríceps',None),
 ('Weighted_Bench_Dip','Fondos en banco con peso','Tríceps','Peso corporal'),
 ('Ring_Dips','Fondos en anillas','Tríceps','Peso corporal'),
 ('Barbell_Lunge','Zancadas con barra','Pierna',None),
 ('Barbell_Step_Ups','Subidas al banco con barra','Pierna',None),
 ('Box_Squat','Sentadilla al cajón','Pierna',None),
 ('Wide_Stance_Barbell_Squat','Sentadilla con piernas abiertas','Pierna',None),
 ('Narrow_Stance_Leg_Press','Prensa con pies juntos','Pierna',None),
 ('Bodyweight_Squat','Sentadilla sin peso','Pierna',None),
 ('Zercher_Squats','Sentadilla Zercher','Pierna',None),
 ('Freehand_Jump_Squat','Sentadilla con salto','Pierna',None),
 ('Single-Leg_Leg_Extension','Extensión de cuádriceps a una pierna','Pierna',None),
 ('Stiff-Legged_Barbell_Deadlift','Peso muerto piernas rígidas','Pierna',None),
 ('Natural_Glute_Ham_Raise','Curl nórdico','Pierna',None),
 ('Kettlebell_One-Legged_Deadlift','Peso muerto a una pierna con kettlebell','Pierna',None),
 ('Leverage_Deadlift','Peso muerto en máquina','Pierna',None),
 ('Cable_Hip_Adduction','Aducción en polea','Pierna',None),
 ('Standing_Barbell_Calf_Raise','Gemelos de pie con barra','Pierna',None),
 ('Calf_Press','Gemelos en máquina','Pierna',None),
 ('Front_Box_Jump','Salto al cajón','Pierna','Peso corporal'),
 ('Sit-Up','Abdominales completos (sit-up)','Core',None),
 ('Cross-Body_Crunch','Crunch cruzado','Core',None),
 ('Air_Bike','Bicicleta abdominal','Core',None),
 ('Jackknife_Sit-Up','Abdominal navaja','Core',None),
 ('Flat_Bench_Leg_Pull-In','Encogimientos de piernas en banco','Core',None),
 ('Standing_Rope_Crunch','Crunch de pie en polea','Core',None),
 ('Pallof_Press','Press Pallof','Core',None),
 ('Standing_Cable_Lift','Leñador de abajo arriba en polea','Core',None),
 ('Barbell_Ab_Rollout','Rueda abdominal con barra','Core',None),
 ('Flutter_Kicks','Patadas de tijera','Core',None),
 ('Alternate_Heel_Touchers','Toques de talón alternos','Core',None),
 ('Knee_Hip_Raise_On_Parallel_Bars','Elevación de rodillas en paralelas','Core','Peso corporal'),
 ('One-Arm_Medicine_Ball_Slam','Lanzamiento de balón medicinal al suelo','Core','Otro'),
 ('Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench','Curl de muñeca con mancuernas','Antebrazo',None),
 ('Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench','Curl de muñeca inverso con mancuernas','Antebrazo',None),
 ('Standing_Palms-Up_Barbell_Behind_The_Back_Wrist_Curl','Curl de muñeca por detrás con barra','Antebrazo',None),
]
GROUPS = ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Pierna', 'Core', 'Antebrazo']

src = open(JS, encoding='utf-8').read()
TAIL = src[src.index('export const EX_BY_ID'):].split('\n', 1)[1]  # código que va después (ejercicios propios)
cur = json.loads(re.search(r'export const EXERCISES = (\[.*?\]);\nexport const EX_BY_ID', src, re.S).group(1))
have = {e['id'] for e in cur}
db = {e['id']: e for e in json.load(urllib.request.urlopen(DB + '/dist/exercises.json'))}
added = 0
for eid, name, grp, eq in NEW:
    if eid in have:
        continue
    d = db.get(eid)
    if not d:
        print('NO EXISTE', eid); continue
    imgs = []
    for i, rel in enumerate(d.get('images', [])[:2]):
        os.makedirs(os.path.join(IMG, eid), exist_ok=True)
        raw = urllib.request.urlopen(f'{DB}/exercises/{rel}').read()
        im = Image.open(io.BytesIO(raw)).convert('RGB')
        if im.width > 640:
            im = im.resize((640, round(im.height * 640 / im.width)), Image.LANCZOS)
        im.save(os.path.join(IMG, eid, f'{i}.webp'), 'WEBP', quality=72, method=6)
        imgs.append(f'ex/{eid}/{i}.webp')
    main = [MUS.get(m, m) for m in d.get('primaryMuscles', [])]
    if grp == 'Pierna' and ('glute' in eid.lower() or 'Kickback' in eid or 'Bridge' in eid or 'Pull_Through' in eid):
        main = ['Glúteos'] + [m for m in main if m != 'Glúteos']
    cur.append({
        'id': eid, 'name': name, 'group': grp, 'main': main,
        'sec': [MUS.get(m, m) for m in d.get('secondaryMuscles', []) if MUS.get(m, m) not in main],
        'equip': eq or EQ.get(d.get('equipment') or 'other', 'Otro'), 'imgs': imgs,
    })
    added += 1
with open(JS, 'w', encoding='utf-8') as f:
    f.write('// Generado por scripts/build_exercises.py + assets-src/add_exercises.py. Fotos: free-exercise-db (dominio público).\n')
    f.write('export const GROUPS = ' + json.dumps(GROUPS, ensure_ascii=False) + ';\n')
    f.write('export const EXERCISES = ' + json.dumps(cur, ensure_ascii=False, indent=1) + ';\n')
    f.write('export const EX_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));\n')
    f.write(TAIL)
print('añadidos', added, 'total', len(cur))
