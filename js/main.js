/* Iron Ledger — start-up */
import './registry.js';
import './core.js';
import './equipment.js';
import './fun.js';
import './engine.js';
import './state.js';
import './views/today.js';
import './views/history.js';
import './views/trophies.js';
import './views/report.js';
import './views/wizard.js';
import './views/goals.js';
import './views/projection.js';
import './charts.js';
import './views/plans.js';
import './views/equipment.js';
import './views/data.js';
import './sample.js';
import './ui.js';
import './actions.js';
import './features/timing.js';
import './features/alerts.js';
import './features/comeback.js';
import './features/plates.js';
import './features/cardio.js';
import './features/share.js';
import { render } from './state.js';

render();
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
  window.addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}

