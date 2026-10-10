/* Iron Ledger — View state, tabs and top-level render */
import { $, S, storageOk } from './core.js';
import { viewToday } from './views/today.js';
import { viewHistory } from './views/history.js';
import { viewTrophies } from './views/trophies.js';
import { viewReport } from './views/report.js';
import { viewWizard } from './views/wizard.js';
import { viewGoals } from './views/goals.js';
import { viewProjection } from './views/projection.js';
import { drawCharts } from './charts.js';
import { viewPlans } from './views/plans.js';
import { viewEquipment } from './views/equipment.js';
import { backupDue, viewData } from './views/data.js';
import { viewCardio } from './features/cardio.js';

/* ---------- view state ---------- */
let tab='today';
try{ const h=location.hash.replace('#',''); const t=localStorage.getItem('ironledger.tab'); if(['today','progress','plans','setup','goals','history','cardio','report','trophies','projection','equipment','data'].includes(h)) tab=h; else if(t) tab=t; }catch(e){}
const V={pick:null,editPlan:null,histEx:null,histMetric:'w',projKey:null,projSpw:null,showAll:false,calc:{load:'barbell',w:null},exportText:'',importText:'',newType:'linear',year:null,repWeek:null,calMonth:null,openSess:null,muscle:null};
try{ const sb=JSON.parse(localStorage.getItem('ironledger.sub')||'null'); if(sb) V.sub=sb; }catch(e){}
let EDIT=null; const cur=()=>EDIT||S.current;
const TABS=[['today','Today'],['progress','Progress'],['plans','Plans'],['setup','Setup']];
const SUBS={progress:[['report','Report'],['goals','Goals'],['history','History'],['cardio','Cardio'],['trophies','Trophies'],['projection','Projection']],setup:[['equipment','Equipment'],['data','Settings & data']]};
const PARENT={report:'progress',goals:'progress',history:'progress',cardio:'progress',trophies:'progress',projection:'progress',equipment:'setup',data:'setup'};
if(!V.sub) V.sub={progress:'report',setup:'equipment'};
function goTab(t){ if(PARENT[t]){ V.sub[PARENT[t]]=t; tab=PARENT[t]; } else tab=t; if(!TABS.some(x=>x[0]===tab)) tab='today'; }
goTab(tab);

function render(){
  $('#tabs').innerHTML=TABS.map(([k,l])=>'<button data-act="tab" data-tab="'+k+'"'+(k===tab?' aria-current="page"':'')+'>'+l+'</button>').join('');
  const views={goals:viewGoals,today:viewToday,history:viewHistory,trophies:viewTrophies,report:viewReport,projection:viewProjection,plans:viewPlans,cardio:viewCardio,equipment:viewEquipment,data:viewData};
  let pre='', key=tab;
  if(SUBS[tab]){ key=V.sub[tab]; pre='<div class="subtabs" role="tablist">'+SUBS[tab].map(([k,l])=>'<button role="tab" data-act="sub" data-p="'+tab+'" data-s="'+k+'" aria-selected="'+(k===key)+'">'+l+'</button>').join('')+'</div>'; }
  if(!S.settings.setupDone&&tab==='today'&&typeof viewWizard==='function'){ $('#view').innerHTML=viewWizard(); renderBanner(); return; }
  $('#view').innerHTML=pre+views[key]();
  renderBanner(); drawCharts();
}
function renderBanner(){
  let h='';
  if(S.demo) h+='<div class="note info row between" style="margin-top:12px"><span><b>Sample data.</b> Nothing here is saved, and your own log is untouched.</span><button data-act="exitDemo">Back to my log</button></div>';
  if(tab==='today'&&!S.demo&&!S.current&&backupDue()>=8) h+='<div class="note warn row between" style="margin-top:12px"><span>'+backupDue()+' workouts since your last backup.</span><button data-act="export">Download backup</button></div>';
  if(!storageOk) h+='<div class="note bad" style="margin-top:12px">This browser is blocking storage, so workouts won’t be kept after you close the page. Use Setup → Settings &amp; data to download a backup before leaving.</div>';
  $('#banner').innerHTML=h;
}

export function setEDIT(v){ EDIT=v; }
export { EDIT, V, cur, goTab, render, renderBanner, tab };
