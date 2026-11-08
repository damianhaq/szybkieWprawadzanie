// Silnik ciągłego gestu Ping-Pong (Pointer Events, względne przewijanie, strefa martwa, wczesne zakończenie)
import { storage } from './storage.js';
import { feedback } from './audio.js';

export class GestureEngine {
  constructor(options) {
    this.padEl = options.padEl;
    this.topBarEl = options.topBarEl;
    this.drumLeft = options.drumLeft;
    this.drumRight = options.drumRight;
    this.previewEl = options.previewEl;
    this.pointerPuckEl = options.pointerPuckEl;
    this.puckCalloutEl = document.getElementById('puckDistanceCallout');
    this.transitionDistanceBadge = document.getElementById('transitionDistanceBadge');
    this.onTaskSaved = options.onTaskSaved || (() => {});
    this.onTaskCancelled = options.onTaskCancelled || (() => {});

    // Stan maszyny stanów
    this.isDragging = false;
    this.activePointerId = null;
    this.currentStep = 1; // 1: CO (L), 2: SKĄD (P), 3: DOKĄD (L), 4: ILE (P)
    this.currentZoom = 1.0; // Płynny zoom 2D na osi X (0.0: kompaktowy/szybki -> 1.0: duży kafelek/precyzyjny)
    this.lastZoom = 1.0;
    this.isInCancelZone = false;
    this.isTransitionLocked = false; // Blokada korytarza przejścia w bok przed przypadkową zmianą pozycji

    // Kotwice przewijania relatywnego (Relative Scrolling)
    this.anchorY = 0;
    this.anchorIndex = 0;

    // Wersja robocza tworzonego zadania
    this.taskDraft = {
      co: null,
      skad: null,
      dokad: null,
      ile: null
    };

    // Pamięć podręczna baz danych
    this.cachedData = {
      coList: [],
      skadList: [],
      dokadList: [],
      ileList: []
    };

    this.initEvents();
    this.refreshData();
    this.resetToStep1();
  }

  // Odświeżenie danych z bazy (np. po edycji w ustawieniach lub zmianie TOP)
  refreshData() {
    const coData = storage.getCoListWithTop();
    const db = storage.getDatabase();
    const locList = (db.lokalizacje || db.skad || []).map(item => ({ text: item }));

    this.cachedData.coList = coData.items;
    this.cachedData.skadList = locList;
    this.cachedData.dokadList = locList;
    this.cachedData.ileList = (db.ile || []).map(item => ({ text: item }));
  }

  // Przygotowanie widoku do Kroku 1
  resetToStep1() {
    this.currentStep = 1;
    this.currentZoom = 1.0;
    this.lastZoom = 1.0;
    this.isInCancelZone = false;
    this.isTransitionLocked = false;
    this.taskDraft = { co: null, skad: null, dokad: null, ile: null };
    this.floatIndex = 0;
    this.lastClientY = 0;

    this.clearTransitionBadge();
    this.hidePuckCallout();

    // Lewa kolumna: Krok 1 (CO)
    this.drumLeft.setStepData(
      1,
      '1. WYBIERZ TOWAR (CO)',
      'Przesuń góra/dół • W prawo do SKĄD',
      this.cachedData.coList,
      0
    );
    this.drumLeft.setZoom(1.0);
    this.drumLeft.setActive(true);

    // Prawa kolumna: Podgląd Kroku 2 (SKĄD)
    this.drumRight.setStepData(
      2,
      '2. LOKALIZACJA (SKĄD)',
      'Czeka na gest w prawo ->',
      this.cachedData.skadList,
      0
    );
    this.drumRight.setZoom(1.0);
    this.drumRight.setActive(false);

    this.updatePreviewUI();
    this.hidePointerPuck();
  }

  initEvents() {
    // Pointer Events zapewniają pełną unifikację myszy i ekranu dotykowego
    this.padEl.addEventListener('pointerdown', this.handlePointerDown.bind(this), { passive: false });
    window.addEventListener('pointermove', this.handlePointerMove.bind(this), { passive: false });
    window.addEventListener('pointerup', this.handlePointerUp.bind(this), { passive: false });
    window.addEventListener('pointercancel', this.handlePointerCancel.bind(this), { passive: false });

    // Zabezpieczenie przed gestami domyślnymi
    this.padEl.addEventListener('contextmenu', e => e.preventDefault());
  }

  handlePointerDown(e) {
    // Ignoruj dodatkowe palce podczas trwania gestu jednoręcznego
    if (this.isDragging) return;

    // Odblokuj Web Audio API przy pierwszym dotyku
    feedback.unlockAudio();

    this.isDragging = true;
    this.activePointerId = e.pointerId;
    try {
      this.padEl.setPointerCapture(e.pointerId);
    } catch (err) {}

    // Oblicz wymiary okna
    const width = window.innerWidth;
    const clientX = e.clientX;
    const clientY = e.clientY;
    const leftThreshold = width * 0.47;

    // Start zawsze w Kroku 1 (CO)
    this.currentStep = 1;
    this.taskDraft = { co: null, skad: null, dokad: null, ile: null };
    this.hasBeenInLeftZone = clientX <= leftThreshold;

    // Początkowy zoom kafelka na podstawie pozycji X palca
    const initialZoom = Math.max(0, Math.min(1, (clientX - width * 0.04) / (width * 0.30)));
    this.currentZoom = initialZoom;
    this.lastZoom = initialZoom;
    this.drumLeft.setZoom(initialZoom);
    this.drumLeft.setActive(true);
    this.drumRight.setActive(false);

    // Kotwica startowa dla płynnego relatywnego przewijania
    this.floatIndex = this.drumLeft.selectedIndex;
    this.lastClientY = clientY;
    this.drumLeft.setPosition(this.floatIndex);
    this.anchorY = clientY;
    this.anchorIndex = this.drumLeft.selectedIndex;
    this.isTransitionLocked = false;
    this.clearTransitionBadge();

    this.showPointerPuck(clientX, clientY);
    this.updatePreviewUI();

    e.preventDefault();
  }

  handlePointerMove(e) {
    if (!this.isDragging || e.pointerId !== this.activePointerId) return;

    e.preventDefault();

    const clientX = e.clientX;
    const clientY = e.clientY;
    const width = window.innerWidth;

    this.updatePointerPuck(clientX, clientY);

    // 1. Sprawdzenie Strefy Anulowania (Górny Pasek Top Bar)
    const topBarRect = this.topBarEl.getBoundingClientRect();
    const inCancelZone = clientY <= topBarRect.bottom + 8;

    if (inCancelZone) {
      if (!this.isInCancelZone) {
        this.isInCancelZone = true;
        this.topBarEl.classList.add('cancel-zone-active');
        feedback.cancelZoneEntered();
        this.updatePreviewUI(true);
        this.updatePuckCallout('⚠️ ANULUJ ZADANIE', true);
      }
      return; // W strefie anulowania nie przewijamy list
    } else {
      if (this.isInCancelZone) {
        this.isInCancelZone = false;
        this.topBarEl.classList.remove('cancel-zone-active');
        this.updatePreviewUI(false);
        this.anchorY = clientY; // Zapobiega skokowi po opuszczeniu strefy anulowania
      }
    }

    // 2. Obsługa Maszyny Stanów i Przejść Między Kolumnami z Histerezą (47% - 53%)
    const leftThreshold = width * 0.47;
    const rightThreshold = width * 0.53;

    if (this.currentStep === 1 && clientX <= leftThreshold) {
      this.hasBeenInLeftZone = true;
    }

    // A. KROK 1 -> KROK 2 (Z LEWEJ DO PRAWEJ)
    if (this.currentStep === 1 && this.hasBeenInLeftZone && clientX >= rightThreshold) {
      this.isTransitionLocked = false;
      this.clearTransitionBadge();
      const selectedItem = this.drumLeft.getSelectedItem();
      this.taskDraft.co = selectedItem ? selectedItem.text : '';

      this.currentStep = 2;
      this.currentZoom = 1.0;
      this.lastZoom = 1.0;
      feedback.stepCommit(1);

      // Lewa strefa w tle natychmiast podmienia zawartość na KROK 3 (DOKĄD)
      this.drumLeft.setStepData(
        3,
        '3. CEL (DOKĄD)',
        'Czeka na powrót w lewo <-',
        this.cachedData.dokadList,
        0
      );
      this.drumLeft.setZoom(1.0);
      this.drumLeft.setActive(false);

      // Prawa strefa staje się aktywna (KROK 2: SKĄD)
      this.drumRight.setActive(true);
      this.drumRight.setZoom(1.0);
      this.drumRight.resetGauge();
      this.floatIndex = this.drumRight.selectedIndex;
      this.lastClientY = clientY;
      this.drumRight.setPosition(this.floatIndex);
      this.anchorY = clientY;
      this.anchorIndex = this.drumRight.selectedIndex;

      this.updatePreviewUI();
      return;
    }

    // B. KROK 2 -> KROK 3 (Z PRAWEJ DO LEWEJ)
    if (this.currentStep === 2 && clientX <= leftThreshold) {
      this.isTransitionLocked = false;
      this.clearTransitionBadge();
      const selectedItem = this.drumRight.getSelectedItem();
      this.taskDraft.skad = selectedItem ? selectedItem.text : '';

      this.currentStep = 3;
      this.currentZoom = 1.0;
      this.lastZoom = 1.0;
      feedback.stepCommit(2);

      // Prawa strefa w tle natychmiast podmienia zawartość na KROK 4 (ILE)
      this.drumRight.setStepData(
        4,
        '4. ILOŚĆ (ILE)',
        'Czeka na gest w prawo ->',
        this.cachedData.ileList,
        0
      );
      this.drumRight.setZoom(1.0);
      this.drumRight.setActive(false);

      // Lewa strefa staje się aktywna (KROK 3: DOKĄD)
      this.drumLeft.setActive(true);
      this.drumLeft.setZoom(1.0);
      this.drumLeft.resetGauge();
      this.floatIndex = this.drumLeft.selectedIndex;
      this.lastClientY = clientY;
      this.drumLeft.setPosition(this.floatIndex);
      this.anchorY = clientY;
      this.anchorIndex = this.drumLeft.selectedIndex;

      this.updatePreviewUI();
      return;
    }

    // C. KROK 3 -> KROK 4 (Z LEWEJ DO PRAWEJ)
    if (this.currentStep === 3 && clientX >= rightThreshold) {
      this.isTransitionLocked = false;
      this.clearTransitionBadge();
      const selectedItem = this.drumLeft.getSelectedItem();
      this.taskDraft.dokad = selectedItem ? selectedItem.text : '';

      this.currentStep = 4;
      this.currentZoom = 1.0;
      this.lastZoom = 1.0;
      feedback.stepCommit(3);

      // Prawa strefa staje się aktywna (KROK 4: ILE)
      this.drumRight.setActive(true);
      this.drumRight.setZoom(1.0);
      this.drumRight.resetGauge();
      this.drumLeft.setActive(false);
      this.floatIndex = this.drumRight.selectedIndex;
      this.lastClientY = clientY;
      this.drumRight.setPosition(this.floatIndex);
      this.anchorY = clientY;
      this.anchorIndex = this.drumRight.selectedIndex;

      this.updatePreviewUI();
      return;
    }

    // 3. Relatywne przewijanie aktywnej kolumny z kafelkami i dynamicznym zoomem 2D
    if (this.currentStep === 1) {
      // Jeśli palec zmierza w prawo w stronę linii środkowej, natychmiast blokujemy ruch pionowy!
      const isHeadingRight = this.hasBeenInLeftZone && clientX >= width * 0.35;
      if (isHeadingRight) {
        this.isTransitionLocked = true;
        const distToCommitX = Math.max(0, Math.round(rightThreshold - clientX));
        this.drumLeft.setZoom(1.0);
        this.drumLeft.updateGauge(0, 'center', true, distToCommitX, 'SKĄD');
        this.updatePuckCallout(`ZABLOKOWANE (${distToCommitX}px do SKĄD)`, true);
        this.updateTransitionBadge(`➔ ${distToCommitX}px`);
        return;
      }

      if (this.isTransitionLocked) {
        this.isTransitionLocked = false;
        this.clearTransitionBadge();
        this.lastClientY = clientY;
      }

      // Dynamiczny zoom kafelka na osi X: od lewej krawędzi (mini/szybki) do środka (duży kafelek/precyzyjny)
      const minX = width * 0.04;
      const maxX = width * 0.34;
      const currentZoom = Math.max(0, Math.min(1, (clientX - minX) / (maxX - minX)));
      this.currentZoom = currentZoom;
      this.drumLeft.setZoom(currentZoom);

      // Skok w px zależny od zoomu: 18px (szybki) do 42px (duży kafelek)
      const stepPx = Math.round(18 + currentZoom * 24);
      const dy = clientY - this.lastClientY;
      this.lastClientY = clientY;

      const totalItems = this.cachedData.coList.length;
      this.floatIndex -= dy / stepPx;
      this.floatIndex = Math.max(0, Math.min(totalItems - 1, this.floatIndex));

      const changed = this.drumLeft.setPosition(this.floatIndex);
      if (changed) {
        feedback.tick(currentZoom < 0.35);
        this.updatePreviewUI();
      }

      const targetIndex = Math.round(this.floatIndex);
      const diffFromTarget = this.floatIndex - targetIndex;
      const distUnits = 0.5 - Math.abs(diffFromTarget);
      const distPx = Math.max(0, Math.round(distUnits * stepPx));
      const direction = diffFromTarget > 0.08 ? 'up' : (diffFromTarget < -0.08 ? 'down' : 'center');

      this.drumLeft.updateGauge(distPx, direction, false);
      if (currentZoom < 0.35) {
        this.updatePuckCallout(`SZYBKO (${Math.round(currentZoom * 100)}%)`);
      } else if (direction === 'center') {
        this.updatePuckCallout(`PRECYZJA (${distPx}px do zmiany)`);
      } else if (direction === 'up') {
        this.updatePuckCallout(`▲ ${distPx}px do kolejnego`);
      } else {
        this.updatePuckCallout(`▼ ${distPx}px do poprzedniego`);
      }
    } else if (this.currentStep === 2) {
      // Blokada korytarza powrotu w lewo do KROKU 3 (DOKĄD)
      const isHeadingLeft = clientX <= width * 0.65;
      if (isHeadingLeft) {
        this.isTransitionLocked = true;
        const distToCommitX = Math.max(0, Math.round(clientX - leftThreshold));
        this.drumRight.setZoom(1.0);
        this.drumRight.updateGauge(0, 'center', true, distToCommitX, 'DOKĄD');
        this.updatePuckCallout(`ZABLOKOWANE (${distToCommitX}px do DOKĄD)`, true);
        this.updateTransitionBadge(`◀ ${distToCommitX}px`);
        return;
      }

      if (this.isTransitionLocked) {
        this.isTransitionLocked = false;
        this.clearTransitionBadge();
        this.lastClientY = clientY;
      }

      // Prawa strona: od prawej krawędzi (mini) do środka (duży kafelek)
      const minX = width * 0.66;
      const maxX = width * 0.96;
      const currentZoom = Math.max(0, Math.min(1, (maxX - clientX) / (maxX - minX)));
      this.currentZoom = currentZoom;
      this.drumRight.setZoom(currentZoom);

      const stepPx = Math.round(18 + currentZoom * 24);
      const dy = clientY - this.lastClientY;
      this.lastClientY = clientY;

      const totalItems = this.cachedData.skadList.length;
      this.floatIndex -= dy / stepPx;
      this.floatIndex = Math.max(0, Math.min(totalItems - 1, this.floatIndex));

      const changed = this.drumRight.setPosition(this.floatIndex);
      if (changed) {
        feedback.tick(currentZoom < 0.35);
        this.updatePreviewUI();
      }

      const targetIndex = Math.round(this.floatIndex);
      const diffFromTarget = this.floatIndex - targetIndex;
      const distUnits = 0.5 - Math.abs(diffFromTarget);
      const distPx = Math.max(0, Math.round(distUnits * stepPx));
      const direction = diffFromTarget > 0.08 ? 'up' : (diffFromTarget < -0.08 ? 'down' : 'center');

      this.drumRight.updateGauge(distPx, direction, false);
      if (currentZoom < 0.35) {
        this.updatePuckCallout(`SZYBKO (${Math.round(currentZoom * 100)}%)`);
      } else if (direction === 'center') {
        this.updatePuckCallout(`PRECYZJA (${distPx}px do zmiany)`);
      } else if (direction === 'up') {
        this.updatePuckCallout(`▲ ${distPx}px do kolejnego`);
      } else {
        this.updatePuckCallout(`▼ ${distPx}px do poprzedniego`);
      }
    } else if (this.currentStep === 3) {
      // Blokada korytarza przejścia w prawo do KROKU 4 (ILE)
      const isHeadingRight = clientX >= width * 0.35;
      if (isHeadingRight) {
        this.isTransitionLocked = true;
        const distToCommitX = Math.max(0, Math.round(rightThreshold - clientX));
        this.drumLeft.setZoom(1.0);
        this.drumLeft.updateGauge(0, 'center', true, distToCommitX, 'ILE');
        this.updatePuckCallout(`ZABLOKOWANE (${distToCommitX}px do ILE)`, true);
        this.updateTransitionBadge(`➔ ${distToCommitX}px`);
        return;
      }

      if (this.isTransitionLocked) {
        this.isTransitionLocked = false;
        this.clearTransitionBadge();
        this.lastClientY = clientY;
      }

      // Lewa strona: zoom od krawędzi do środka
      const minX = width * 0.04;
      const maxX = width * 0.34;
      const currentZoom = Math.max(0, Math.min(1, (clientX - minX) / (maxX - minX)));
      this.currentZoom = currentZoom;
      this.drumLeft.setZoom(currentZoom);

      const stepPx = Math.round(18 + currentZoom * 24);
      const dy = clientY - this.lastClientY;
      this.lastClientY = clientY;

      const totalItems = this.cachedData.dokadList.length;
      this.floatIndex -= dy / stepPx;
      this.floatIndex = Math.max(0, Math.min(totalItems - 1, this.floatIndex));

      const changed = this.drumLeft.setPosition(this.floatIndex);
      if (changed) {
        feedback.tick(currentZoom < 0.35);
        this.updatePreviewUI();
      }

      const targetIndex = Math.round(this.floatIndex);
      const diffFromTarget = this.floatIndex - targetIndex;
      const distUnits = 0.5 - Math.abs(diffFromTarget);
      const distPx = Math.max(0, Math.round(distUnits * stepPx));
      const direction = diffFromTarget > 0.08 ? 'up' : (diffFromTarget < -0.08 ? 'down' : 'center');

      this.drumLeft.updateGauge(distPx, direction, false);
      if (currentZoom < 0.35) {
        this.updatePuckCallout(`SZYBKO (${Math.round(currentZoom * 100)}%)`);
      } else if (direction === 'center') {
        this.updatePuckCallout(`PRECYZJA (${distPx}px do zmiany)`);
      } else if (direction === 'up') {
        this.updatePuckCallout(`▲ ${distPx}px do kolejnego`);
      } else {
        this.updatePuckCallout(`▼ ${distPx}px do poprzedniego`);
      }
    } else if (this.currentStep === 4) {
      if (this.isTransitionLocked) {
        this.isTransitionLocked = false;
        this.clearTransitionBadge();
        this.lastClientY = clientY;
      }

      // Prawa strona: zoom od krawędzi do środka
      const minX = width * 0.66;
      const maxX = width * 0.96;
      const currentZoom = Math.max(0, Math.min(1, (maxX - clientX) / (maxX - minX)));
      this.currentZoom = currentZoom;
      this.drumRight.setZoom(currentZoom);

      const stepPx = Math.round(18 + currentZoom * 24);
      const dy = clientY - this.lastClientY;
      this.lastClientY = clientY;

      const totalItems = this.cachedData.ileList.length;
      this.floatIndex -= dy / stepPx;
      this.floatIndex = Math.max(0, Math.min(totalItems - 1, this.floatIndex));

      const changed = this.drumRight.setPosition(this.floatIndex);
      if (changed) {
        feedback.tick(currentZoom < 0.35);
        this.updatePreviewUI();
      }

      const targetIndex = Math.round(this.floatIndex);
      const diffFromTarget = this.floatIndex - targetIndex;
      const distUnits = 0.5 - Math.abs(diffFromTarget);
      const distPx = Math.max(0, Math.round(distUnits * stepPx));
      const direction = diffFromTarget > 0.08 ? 'up' : (diffFromTarget < -0.08 ? 'down' : 'center');

      this.drumRight.updateGauge(distPx, direction, false);
      if (currentZoom < 0.35) {
        this.updatePuckCallout(`SZYBKO (${Math.round(currentZoom * 100)}%)`);
      } else if (direction === 'center') {
        this.updatePuckCallout('PRECYZJA (Puść aby zapisać)');
      } else if (direction === 'up') {
        this.updatePuckCallout(`▲ ${distPx}px do kolejnego`);
      } else {
        this.updatePuckCallout(`▼ ${distPx}px do poprzedniego`);
      }
    }
  }

  handlePointerUp(e) {
    if (!this.isDragging || e.pointerId !== this.activePointerId) return;

    try {
      this.padEl.releasePointerCapture(e.pointerId);
    } catch (err) {}

    this.isDragging = false;
    this.activePointerId = null;
    this.isTransitionLocked = false;
    this.clearTransitionBadge();
    this.hidePointerPuck();
    this.drumLeft.resetGauge();
    this.drumRight.resetGauge();
    this.drumLeft.setPosition(this.drumLeft.selectedIndex);
    this.drumRight.setPosition(this.drumRight.selectedIndex);

    // Sprawdzenie strefy anulowania
    if (this.isInCancelZone) {
      this.isInCancelZone = false;
      this.topBarEl.classList.remove('cancel-zone-active');
      feedback.taskCancelled();
      this.onTaskCancelled();
      this.resetToStep1();
      return;
    }

    // ZASADA WCZEŚNIEJSZEGO ZAKOŃCZENIA (EARLY RELEASE)
    // Natychmiast zatwierdzamy aktualnie podświetlony element aktywnego kroku
    if (this.currentStep === 1) {
      const item = this.drumLeft.getSelectedItem();
      if (item) this.taskDraft.co = item.text;
    } else if (this.currentStep === 2) {
      const item = this.drumRight.getSelectedItem();
      if (item) this.taskDraft.skad = item.text;
    } else if (this.currentStep === 3) {
      const item = this.drumLeft.getSelectedItem();
      if (item) this.taskDraft.dokad = item.text;
    } else if (this.currentStep === 4) {
      const item = this.drumRight.getSelectedItem();
      if (item) this.taskDraft.ile = item.text;
    }

    // Zapisujemy zadanie, jeśli chociaż Krok 1 (CO) został wybrany
    if (this.taskDraft.co) {
      const savedTask = storage.addTask(this.taskDraft);
      feedback.taskSaved();

      // Odśwież dane TOP 6, ponieważ licznik użyć wzrósł
      this.refreshData();

      this.onTaskSaved(savedTask);
    }

    // Reset bębnów do pozycji startowej
    this.resetToStep1();
  }

  handlePointerCancel(e) {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.activePointerId = null;
    this.isInCancelZone = false;
    this.isTransitionLocked = false;
    this.clearTransitionBadge();
    this.topBarEl.classList.remove('cancel-zone-active');
    this.hidePointerPuck();
    this.drumLeft.resetGauge();
    this.drumRight.resetGauge();
    this.resetToStep1();
  }

  // Aktualizacja podglądu na żywo w formacie: [CO] -> [SKĄD] -> [DOKĄD] (x[ILE])
  updatePreviewUI(isCancelling = false) {
    if (isCancelling) {
      this.previewEl.innerHTML = `
        <span class="preview-cancel-alert">
          ⚠️ UPUŚĆ PALEC, ABY ANULOWAĆ ZADANIE
        </span>
      `;
      return;
    }

    let co = this.taskDraft.co;
    let skad = this.taskDraft.skad;
    let dokad = this.taskDraft.dokad;
    let ile = this.taskDraft.ile;

    if (this.currentStep === 1) {
      const item = this.drumLeft.getSelectedItem();
      co = item ? item.text : '...';
    } else if (this.currentStep === 2) {
      const item = this.drumRight.getSelectedItem();
      skad = item ? item.text : '...';
    } else if (this.currentStep === 3) {
      const item = this.drumLeft.getSelectedItem();
      dokad = item ? item.text : '...';
    } else if (this.currentStep === 4) {
      const item = this.drumRight.getSelectedItem();
      ile = item ? item.text : '...';
    }

    const coSpan = co
      ? `<span class="preview-part ${this.currentStep === 1 ? 'preview-active' : 'preview-done'}">${this.escape(co)}</span>`
      : `<span class="preview-placeholder">[CO]</span>`;

    const skadSpan = skad
      ? `<span class="preview-part ${this.currentStep === 2 ? 'preview-active' : 'preview-done'}">${this.escape(skad)}</span>`
      : `<span class="preview-placeholder">[SKĄD]</span>`;

    const dokadSpan = dokad
      ? `<span class="preview-part ${this.currentStep === 3 ? 'preview-active' : 'preview-done'}">${this.escape(dokad)}</span>`
      : `<span class="preview-placeholder">[DOKĄD]</span>`;

    const ileSpan = ile
      ? `<span class="preview-part preview-qty ${this.currentStep === 4 ? 'preview-active' : 'preview-done'}">x${this.escape(ile)}</span>`
      : `<span class="preview-placeholder">(x[ILE])</span>`;

    this.previewEl.innerHTML = `
      <div class="preview-chain">
        ${coSpan}
        <span class="preview-arrow">➔</span>
        ${skadSpan}
        <span class="preview-arrow">➔</span>
        ${dokadSpan}
        <span class="preview-qty-wrap">${ileSpan}</span>
      </div>
    `;
  }

  showPointerPuck(x, y) {
    if (!this.pointerPuckEl) return;
    this.pointerPuckEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    this.pointerPuckEl.classList.add('visible');
  }

  updatePointerPuck(x, y) {
    if (!this.pointerPuckEl) return;
    this.pointerPuckEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  hidePointerPuck() {
    if (!this.pointerPuckEl) return;
    this.pointerPuckEl.classList.remove('visible');
    this.hidePuckCallout();
  }

  updatePuckCallout(text, isLocked = false) {
    if (!this.puckCalloutEl) return;
    this.puckCalloutEl.textContent = text;
    if (isLocked) {
      this.puckCalloutEl.classList.add('locked');
    } else {
      this.puckCalloutEl.classList.remove('locked');
    }
  }

  hidePuckCallout() {
    if (!this.puckCalloutEl) return;
    this.puckCalloutEl.textContent = '';
    this.puckCalloutEl.classList.remove('locked');
  }

  updateTransitionBadge(text) {
    if (!this.transitionDistanceBadge) return;
    this.transitionDistanceBadge.textContent = text;
    this.transitionDistanceBadge.classList.add('visible');
  }

  clearTransitionBadge() {
    if (!this.transitionDistanceBadge) return;
    this.transitionDistanceBadge.textContent = '➔';
    this.transitionDistanceBadge.classList.remove('visible');
  }

  escape(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
