// Główny plik startowy aplikacji Ping-Pong Magazyn
import { DrumColumn } from './drum.js';
import { GestureEngine } from './gesture.js';
import { UIManager } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicjalizacja kolumn bębnów
  const columnLeftEl = document.getElementById('columnLeft');
  const columnRightEl = document.getElementById('columnRight');

  const drumLeft = new DrumColumn(columnLeftEl, 'left');
  const drumRight = new DrumColumn(columnRightEl, 'right');

  // 2. Inicjalizacja menedżera interfejsu
  const uiManager = new UIManager();

  // 3. Inicjalizacja silnika gestów Ping-Pong
  const gestureEngine = new GestureEngine({
    padEl: document.getElementById('gesturePad'),
    topBarEl: document.getElementById('topBar'),
    drumLeft: drumLeft,
    drumRight: drumRight,
    previewEl: document.getElementById('livePreviewBox'),
    pointerPuckEl: document.getElementById('pointerPuck'),
    onTaskSaved: (task) => {
      uiManager.renderTasks();
      const coText = task.co || 'Zadanie';
      const ileText = task.ile ? ` (x${task.ile})` : '';
      uiManager.showToast(`✔ Zapisano: ${coText}${ileText}`, 'success');
    },
    onTaskCancelled: () => {
      uiManager.showToast('🛑 Wprowadzanie anulowane', 'error');
    }
  });

  // Połączenie powrotne dla UI (np. odświeżanie po edycji w ustawieniach)
  uiManager.setGestureEngine(gestureEngine);

  // 4. Rejestracja Service Workera (PWA)
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('PWA ServiceWorker zarejestrowany:', reg.scope);
      })
      .catch(err => {
        console.log('PWA ServiceWorker rejestracja pominięta:', err);
      });
  }
});
