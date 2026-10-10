/* Iron Ledger — Helpers, units, constants, exercise library, default plans, storage and migration */
import { renderBanner } from './state.js';

const KEY='ironledger.v1';
const DAY=864e5;
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10);
const r2=x=>Math.round(x*100)/100;
const U=()=>S.settings.unit==='kg'?'kg':'lb';
const UF=()=>U()==='kg'?0.45359237:1;
const fromLb=x=>x*UF(), toLb=x=>x/UF();
const ST=()=>U()==='kg'?2.5:5;
const fmtW=w=>(w==null||w===''||isNaN(w))?'—':String(Math.round(w*100)/100);
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const todayISO=()=>iso(new Date());
const parseISO=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,(m||1)-1,d||1);};
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fmtD=d=>MON[d.getMonth()]+' '+d.getDate();
const fmtDL=s=>{const d=parseISO(s);return WD[d.getDay()]+' '+fmtD(d);};

const PAT={squat:'Squat',hinge:'Hinge',hpush:'Horizontal push',vpush:'Vertical push',hpull:'Horizontal pull',vpull:'Vertical pull',lunge:'Lunge',arms:'Arms',shoulders:'Shoulders',core:'Core',power:'Power'};
const LOADS={barbell:'Barbell',dumbbell:'Dumbbells (pair)',dumbbell1:'Single dumbbell',cable:'Cable (plate-loaded)',bodyweight:'Bodyweight'};
const GZ={T1:[{s:5,r:3},{s:6,r:2},{s:10,r:1}],T2:[{s:3,r:10},{s:3,r:8},{s:3,r:6}],T3:[{s:3,r:15}]};
const W531=[[[.65,5],[.75,5],[.85,5,1]],[[.70,3],[.80,3],[.90,3,1]],[[.75,5],[.85,3],[.95,1,1]],[[.40,5],[.50,5],[.60,5]]];
const WEEK_NAME=['5s week','3s week','5/3/1 week','Deload week'];
const REST={T1:180,T2:120,T3:90,L:180,G:150,W:180,D:90,F:120,B:90,TV:150,TR:120};
const DERIVED={F:1,B:1,TV:1,TR:1};
const FSL_PCT=[.65,.70,.75,.40];
const REP_PCT={1:.9,2:.87,3:.85,4:.82,5:.8,6:.77,7:.75,8:.72,9:.7,10:.67,11:.65,12:.63,13:.61,14:.59,15:.57};
const repPct=r=>REP_PCT[r]||(r>15?Math.max(.4,.57-(r-15)*.015):.9);
const TYPES={
  gzclp:{label:'GZCLP',schemes:['T1','T2','T3'],desc:'Three tiers. T1 5×3+ → 6×2+ → 10×1+. T2 3×10 → 3×8 → 3×6. T3 3×15+, adding weight once the last set reaches 25. Missed reps move a lift to its next stage at the same weight.'},
  linear:{label:'Linear progression',schemes:['L','D'],desc:'Same sets and reps every workout. Hit them all and the weight goes up next time. Miss three workouts in a row at one weight and it drops 10%.'},
  gslp:{label:'Greyskull LP',schemes:['G','D'],desc:'Two sets of 5, then a last set for as many reps as you can. 5+ on that set adds weight, 10+ adds double. Fall short and the weight drops 10%.'},
  w531:{label:'5/3/1',schemes:['W','F','B','D'],desc:'Weights come from a training max (90% of your 1-rep max). Each lift cycles through 5s, 3s, 5/3/1 and a deload week. After a full cycle the training max goes up if every last-set target was hit.'},
  texas:{label:'Texas Method',schemes:['L','TV','TR','D'],desc:'Three days a week. Intensity day: one heavy set of 5, going up each week when you hit it. Volume day: 5×5 at 90% of your intensity weight. Recovery day: 2×5 at 80% of volume day. Other lifts use plain sets × reps.'},
  double:{label:'Double progression',schemes:['D'],desc:'Work within a rep range. Hit the top of the range on every set and the weight goes up.'}
};
const SCHEME_NAME={T1:'T1',T2:'T2',T3:'T3',L:'Sets × reps',G:'Last set AMRAP',W:'5/3/1 main lift',F:'First set last 5×5',B:'Boring But Big 5×10',TV:'Volume 5×5 (90%)',TR:'Recovery 2×5 (72%)',D:'Rep range'};

const LIB=[
 ['squat','Back squat','barbell',['rack'],'squat',10],
 ['bench','Bench press','barbell',['rack','bench'],'hpush',5],
 ['ohp','Overhead press','barbell',['rack'],'vpush',5],
 ['deadlift','Deadlift','barbell',[],'hinge',10],
 ['powerclean','Power clean','barbell',[],'power',5],
 ['fsquat','Front squat','barbell',['rack'],'squat',10],
 ['rdl','Romanian deadlift','barbell',[],'hinge',10],
 ['incbench','Incline bench press','barbell',['rack','incline'],'hpush',5],
 ['bbrow','Barbell row','barbell',[],'hpull',5],
 ['latpd','Lat pulldown','cable',['rack','cable'],'vpull',5],
 ['cablerow','Seated cable row','cable',['rack','cable'],'hpull',5],
 ['facepull','Face pull','cable',['rack','cable'],'shoulders',5],
 ['pushdown','Triceps pushdown','cable',['rack','cable'],'arms',5],
 ['pullup','Pull-up','bodyweight',['pullup'],'vpull',0],
 ['chinup','Chin-up','bodyweight',['pullup'],'vpull',0],
 ['pushup','Push-up','bodyweight',[],'hpush',0],
 ['dbrow','One-arm dumbbell row','dumbbell1',['bench'],'hpull',5],
 ['dbbench','Dumbbell bench press','dumbbell',['bench'],'hpush',5],
 ['dbincline','Incline dumbbell press','dumbbell',['incline'],'hpush',5],
 ['dbohp','Seated dumbbell press','dumbbell',['incline'],'vpush',5],
 ['goblet','Goblet squat','dumbbell1',[],'squat',5],
 ['dblunge','Dumbbell lunge','dumbbell',[],'lunge',5],
 ['dbrdl','Dumbbell RDL','dumbbell',[],'hinge',5],
 ['dbcurl','Dumbbell curl','dumbbell',[],'arms',5],
 ['latraise','Lateral raise','dumbbell',[],'shoulders',5]
];
// Suggested 1RM estimates: set so 85% lands at ~60% of the 2023 GZCL T1 weights

const sl=(exId,scheme,o)=>Object.assign({id:uid(),exId,scheme},o||{});
const day=(name,slots)=>({id:uid(),name,slots});
function mkPlan(id,name,type,days){ return {id,name,type,mode:'progress',runId:null,start:{},startedAt:null,days}; }
function defaultPlans(){
  const gz=(n,a,b,c)=>day(n,[sl(a,'T1'),sl(b,'T2'),sl(c,'T3')]);
  const L=(ex,s,r)=>sl(ex,'L',{sets:s,reps:r}), D=(ex,s,a,b)=>sl(ex,'D',{sets:s,repMin:a,repMax:b}), G=(ex,s)=>sl(ex,'G',{sets:s});
  return [
    mkPlan('gzclp','GZCLP 4-day rotation','gzclp',[gz('A1','squat','bench','latpd'),gz('B1','ohp','deadlift','dbrow'),gz('A2','bench','squat','latpd'),gz('B2','deadlift','ohp','dbrow')]),
    mkPlan('ss','Starting Strength 3×5','linear',[day('A',[L('squat',3,5),L('ohp',3,5),L('deadlift',1,5)]),day('B',[L('squat',3,5),L('bench',3,5),L('powerclean',5,3)])]),
    mkPlan('sl5','StrongLifts 5×5','linear',[day('A',[L('squat',5,5),L('bench',5,5),L('bbrow',5,5)]),day('B',[L('squat',5,5),L('ohp',5,5),L('deadlift',1,5)])]),
    mkPlan('gslp','Greyskull LP','gslp',[day('A',[G('bench',3),G('squat',3),D('chinup',3,5,10)]),day('B',[G('ohp',3),G('deadlift',1),D('bbrow',3,8,12)])]),
    mkPlan('w531','5/3/1 four-lift rotation','w531',[day('Press',[sl('ohp','W'),D('chinup',5,5,10)]),day('Deadlift',[sl('deadlift','W'),D('dblunge',3,8,12)]),day('Bench',[sl('bench','W'),D('dbrow',5,8,12)]),day('Squat',[sl('squat','W'),D('latpd',3,10,15)])]),
    mkPlan('phrak','Phrak’s GSLP','gslp',[day('A',[G('ohp',3),G('chinup',3),G('squat',3)]),day('B',[G('bench',3),G('bbrow',3),G('deadlift',1)])]),
    mkPlan('bbr','Reddit Basic Beginner Routine','gslp',[day('A',[G('bbrow',3),G('bench',3),G('squat',3)]),day('B',[G('chinup',3),G('ohp',3),G('deadlift',1)])]),
    mkPlan('dbonly','Dumbbell-only full body','double',[day('A',[D('dbbench',3,8,12),D('goblet',3,10,15),D('dbrow',3,8,12),D('dbohp',3,8,12),D('latraise',2,12,15)]),day('B',[D('dbincline',3,8,12),D('dbrdl',3,8,12),D('dblunge',3,8,12),D('dbcurl',2,10,15),D('pushup',2,10,20)])]),
    Object.assign(mkPlan('w531b','5/3/1 for Beginners','w531',[day('1',[sl('squat','W'),sl('squat','F'),sl('bench','W'),sl('bench','F'),D('chinup',5,5,10)]),day('2',[sl('deadlift','W'),sl('deadlift','F'),sl('ohp','W'),sl('ohp','F'),D('dbrow',5,8,12)]),day('3',[sl('bench','W'),sl('bench','F'),sl('squat','W'),sl('squat','F'),D('dblunge',3,10,15)])]),{weekLen:3,deload:false}),
    Object.assign(mkPlan('w5312','5/3/1 two-day','w531',[day('A',[sl('squat','W'),sl('bench','W'),D('chinup',5,5,10)]),day('B',[sl('deadlift','W'),sl('ohp','W'),D('dbrow',5,8,12)])]),{weekLen:2,deload:true}),
    Object.assign(mkPlan('bbb','5/3/1 Boring But Big','w531',[day('Press',[sl('ohp','W'),sl('ohp','B'),D('chinup',5,5,10)]),day('Deadlift',[sl('deadlift','W'),sl('deadlift','B'),D('facepull',5,12,20)]),day('Bench',[sl('bench','W'),sl('bench','B'),D('dbrow',5,10,12)]),day('Squat',[sl('squat','W'),sl('squat','B'),D('latpd',5,10,12)])]),{weekLen:4,deload:true,bbbPct:0.5}),
    mkPlan('texas','Texas Method','texas',[day('Volume',[sl('squat','TV'),sl('bench','TV'),Object.assign(L('deadlift',1,5),{inc:5})]),day('Recovery',[sl('squat','TR'),L('ohp',3,5),D('chinup',3,5,10)]),day('Intensity',[Object.assign(L('squat',1,5),{inc:5}),Object.assign(L('bench',1,5),{inc:5}),L('powerclean',5,3)])]),
    mkPlan('dbl','Dumbbell + cable upper/lower','double',[day('Upper',[D('dbbench',3,8,12),D('cablerow',3,10,15),D('dbohp',3,8,12),D('dbcurl',2,10,15),D('pushdown',2,10,15)]),day('Lower',[D('goblet',3,10,15),D('dbrdl',3,8,12),D('dblunge',2,8,12),D('facepull',2,12,20)])])
  ];
}
const STATIONS=()=>[{id:'rack',name:'Squat rack',on:true},{id:'bench',name:'Flat bench',on:true},{id:'incline',name:'Incline / upright bench',on:true},{id:'pullup',name:'Pull-up bar',on:true},{id:'cable',name:'Cable pulley (plate-loaded)',on:true}];
const STD_PLATES={lb:[45,35,25,15,10,5,2.5],kg:[25,20,15,10,5,2.5,1.25]};
const TYPICAL_PLATES={lb:{45:4,35:0,25:2,15:0,10:4,5:2,2.5:2},kg:{25:0,20:4,15:2,10:2,5:2,2.5:2,1.25:2}};
function defaultEquipment(unit){ const kg=unit==='kg'; const tp=TYPICAL_PLATES[kg?'kg':'lb'];
  return {bars:[{id:'bar1',name:'Olympic barbell',kind:'barbell',weight:kg?20:45,qty:1}],
    plates:Object.entries(tp).filter(([w,q])=>q>0).map(([w,q])=>({id:uid(),weight:+w,qty:q})).sort((a,b)=>b.weight-a.weight),
    fixed:[],stations:STATIONS()}; }
function defaultState(){
  return {v:3,settings:{unit:'lb',setupDone:false},deletedDefaults:[],
    equipment:defaultEquipment('lb'),
    exercises:LIB.map(([id,name,load,req,pattern,inc])=>({id,name,load,req:req.slice(),pattern,inc})),
    plans:defaultPlans(),activePlanId:'gzclp',sessions:[],bodyweights:[],cardio:[],current:null,lastResult:null};
}
function fixEntry(e){
  const t=e.target; if(!t||t.rows) return;
  const n=+t.sets||e.sets.length||3;
  e.target={kind:e.scheme,w:t.w,stage:t.stage||0,week:0,params:{sets:n,reps:t.reps,repMin:t.reps,repMax:t.repMax},rows:Array.from({length:n},(_,i)=>({w:t.w,r:t.reps,amrap:!!t.amrap&&i===n-1}))};
}
function migrate(o){
  const d=defaultState(); if(!o||typeof o!=='object') return d;
  const out=Object.assign({},d,o);
  out.settings=Object.assign({},d.settings,o.settings||{});
  if(!o.settings||o.settings.setupDone===undefined) out.settings.setupDone=Array.isArray(o.sessions)&&o.sessions.length>0||Array.isArray(o.plans)&&o.plans.some(p=>p.runId);
  if(!out.settings.unit) out.settings.unit='lb';
  out.equipment=Object.assign({},d.equipment,o.equipment||{});
  ['bars','plates','fixed','stations'].forEach(k=>{if(!Array.isArray(out.equipment[k])) out.equipment[k]=d.equipment[k];});
  ['exercises','plans'].forEach(k=>{if(!Array.isArray(out[k])) out[k]=d[k];});
  if(!Array.isArray(out.sessions)) out.sessions=[];
  if(!Array.isArray(out.deletedDefaults)) out.deletedDefaults=[];
  if(!Array.isArray(out.bodyweights)) out.bodyweights=[];
  if(!Array.isArray(out.cardio)) out.cardio=[];
  { const m=new Map(); for(const p of out.equipment.plates){ const w=+p.weight; if(m.has(w)) m.get(w).qty=(+m.get(w).qty||0)+(+p.qty||0); else m.set(w,{id:p.id,weight:w,qty:+p.qty||0}); } out.equipment.plates=[...m.values()]; delete out.settings.includeVinyl; }
  out.plans.forEach(p=>{ p.days.forEach(dd=>dd.slots.forEach(s=>{ if(!s.scheme) s.scheme=p.type==='gzclp'?(s.tier||'T1'):'D'; })); });
  out.sessions.forEach(s=>s.entries.forEach(fixEntry)); if(out.current) out.current.entries.forEach(fixEntry);
  for(const dp of d.plans) if(!out.plans.some(p=>p.id===dp.id)&&!out.deletedDefaults.includes(dp.id)) out.plans.push(dp);
  for(const e of d.exercises) if(!out.exercises.some(x=>x.id===e.id)) out.exercises.push(e);
  out.v=3; delete out.demo; return out;
}

let storageOk=true, S, realBackup=null;
function load(){ try{ const raw=localStorage.getItem(KEY); if(raw) return migrate(JSON.parse(raw)); }catch(e){ storageOk=false; } return defaultState(); }
let dataVer=0; const memo=new Map();
function touch(){ dataVer++; memo.clear(); }
function memoize(k,f){ if(memo.has(k)) return memo.get(k); const v=f(); memo.set(k,v); return v; }
function save(){ touch(); if(S.demo) return; try{ localStorage.setItem(KEY,JSON.stringify(S)); storageOk=true; }catch(e){ storageOk=false; } renderBanner(); }
let saveT=null; function saveSoon(){ touch(); clearTimeout(saveT); saveT=setTimeout(save,300); }
S=load();

export function setS(v){ S=v; }
export function setRealBackup(v){ realBackup=v; }
export { $, DAY, DERIVED, FSL_PCT, GZ, LOADS, PAT, REST, S, SCHEME_NAME, ST, STATIONS, STD_PLATES, TYPES, TYPICAL_PLATES, U, W531, WEEK_NAME, day, defaultPlans, defaultState, esc, fmtD, fmtDL, fmtW, fromLb, iso, load, memoize, migrate, mkPlan, parseISO, r2, realBackup, repPct, save, saveSoon, storageOk, toLb, todayISO, touch, uid };
