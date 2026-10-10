/* Iron Ledger — Units, backup and import */
import { S, U, esc, fmtDL, storageOk, todayISO } from '../core.js';
import { V } from '../state.js';
import { alertsPanelHTML } from '../features/alerts.js';

/* ---------- DATA ---------- */
function backupDue(){ const n=S.sessions.length-(S.settings.lastBackupN||0); return S.sessions.length>=3&&n>=5?n:0; }
function viewData(){
  const lb=S.settings.lastBackupDate; const due=backupDue();
  let h=alertsPanelHTML()+'<section class="panel"><h2>Back up and restore</h2>'+(due?'<div class="note warn">'+due+' workouts since your last backup'+(lb?' ('+fmtDL(lb)+')':'')+'. Download one now.</div>':lb?'<p class="small muted">Last backup: '+fmtDL(lb)+'.</p>':'')+'<p>Your log lives in this browser on this device. The backup file holds everything: equipment, plans and every workout. Import it on another device or browser to carry on there.</p>';
  h+='<div class="row"><button class="primary" data-act="export">Download backup file</button></div><p class="small muted">Saves iron-ledger-'+todayISO()+'.json. You’ll be asked to confirm the download.</p>'+(V.exportText?'<div class="note warn">Downloads aren’t available in this view, so here is the backup as text. Copy it into a file named iron-ledger-'+todayISO()+'.json.</div><div><button data-act="copyExport">Copy to clipboard</button></div><textarea id="export-text" readonly>'+esc(V.exportText)+'</textarea>':'')+'</section>';
  h+='<section class="panel"><h3>Units</h3><p class="small">Your log is in <b>'+(U()==='kg'?'kilograms':'pounds')+'</b>.</p><div class="row"><button data-act="unitSwitch" data-u="'+(U()==='kg'?'lb':'kg')+'">Switch to '+(U()==='kg'?'pounds (lb)':'kilograms (kg)')+'</button><button class="ghost" data-act="rerunSetup">Run first-time setup again</button></div><p class="small muted">Switching converts every stored weight. Running setup again replaces your equipment but keeps your workouts.</p></section>';
  h+='<section class="panel"><h3>Import</h3><p class="small muted">Pick the iron-ledger .json backup you downloaded. Importing replaces everything currently in this browser. You can also paste the file’s text below.</p><div class="drop" id="drop"><label class="btn primary" for="import-file" style="display:inline-flex;align-items:center">Choose backup file</label><input type="file" id="import-file" data-ch="importFile" style="position:absolute;width:1px;height:1px;opacity:0"><span class="small muted">or drag the file here</span></div><p class="small muted" id="import-status"></p><textarea id="import-text" data-in="importText" placeholder="Paste export text here">'+esc(V.importText)+'</textarea><div><button data-act="import">Import and replace</button></div></section>';
  h+='<section class="panel"><h3>Sample data</h3><p class="small muted">Preview six weeks of made-up GZCLP workouts to see how history and projections look. Your own log is set aside, not changed.</p><div>'+(S.demo?'<button data-act="exitDemo">Back to my log</button>':'<button data-act="demo">Preview sample data</button>')+'</div></section>';
  h+='<section class="panel"><h3>Erase everything</h3><p class="small muted">Deletes all workouts, plans and equipment changes from this browser and restores the defaults. Export first if you want a copy.</p><div><button class="danger" data-act="reset">Erase all data</button></div><p class="small muted">'+(storageOk?'Saving to this browser is working.':'Saving to this browser is blocked right now.')+' '+S.sessions.length+' workouts stored.</p></section>';
  return h;
}

export { backupDue, viewData };
