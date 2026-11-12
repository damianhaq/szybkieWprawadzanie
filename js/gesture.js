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

    // Stan maszyny stanów:
    // 1: KATEGORIA (L), 2: TOWAR (P), 3: SKĄD (L), 4: DOKĄD (P), 5: ILE (L)
    this.isDragging = false;
    this.activePointerId = null;
    this.currentStep = 1;
    this.currentZoom = 1.0;
    this.lastZoom = 1.0;
    this.isInCancelZone = false;
    this.isTransitionLocked = false;
    this.selectedCategory = null;

    // Pozycjonowanie zmiennoprzecinkowe
    this.floatIndex = 0;
    this.lastClientY = 0;

    // Wersja robocza tworzonego zadania
    this.taskDraft = {
      category: null,
      co: null,
      skad: null,
      dokad: null,
      ile: null
    };

    // Pamięć podręczna baz danych
    this.cachedData = {
      categories: [],
      coList: [],
      skadList: [],
      dokadList: [],
      ileList: []
    };

    this.initEvents();
    this.refreshData();
    this.resetToStep1();
  }

  // Odświeżenie danych z bazy (TOP na każdym etapie)
  refreshData() {
    this.cachedData.categories = storage.getCategories().map(c => ({
      text: c.name,
      name: c.name,
      id: c.id,
      icon: c.icon,
      count: c.count
    }));

    const coData = storage.getCoListWithTop(this.selectedCategory);
    this.cachedData.coList = coData.items;

    // Najczęstsze na KAŻDYM etapie
    this.cachedData.skadList = storage.getSkadListWithTop().items;
    this.cachedData.dokadList = storage.getDokadListWithTop().items;
    this.cachedData.ileList = storage.getIleListWithTop().items;
  }

  // Ustawienie aktywnej kategorii z paska szybkiego wyboru
  setCategoryFilter(catId, catName) {
    this.selectedCategory = (catId === 'all') ? null : catName;
    this.refreshData();
    if (!this.isDragging) {
      this.resetToStep1();
    }
  }

  // Przygotowanie widoku do Kroku 1 (KATEGORIA)
  resetToStep1() {
    this.currentStep = 1;
    this.currentZoom = 1.0;
    this.lastZoom = 1.0;
    this.isInCancelZone = false;
    this.isTransitionLocked = false;
    this.taskDraft = { category: null, co: null, skad: null, dokad: null, ile: null };
    this.floatIndex = 0;
    this.lastClientY = 0;

    this.clearTransitionBadge();
    this.hidePuckCallout();

    // Wyznaczenie początkowego indeksu kategorii
    let initialCatIndex = 0;
    if (this.selectedCategory) {
      const idx = this.cachedData.categories.findIndex(c => c.name === this.selectedCategory);
      if (idx !== -1) initialCatIndex = idx;
    }

    // Lewa kolumna: Krok 1 (KATEGORIA)
    this.drumLeft.setStepData(
      1,
      '1. KATEGORIA',
      'Przesuń góra/dół • W prawo do TOWAR',
      this.cachedData.categories,
      initialCatIndex
    );
    this.drumLeft.setZoom(1.0);
    this.drumLeft.setActive(true);

    // Prawa kolumna: Podgląd Kroku 2 (TOWARY z wybranej kategorii)
    const activeCat = this.cachedData.categories[initialCatIndex];
    const catName = activeCat ? activeCat.name : null;
    this.cachedData.coList = storage.getCoListWithTop(catName).items;

    this.drumRight.setStepData(
      2,
      `2. TOWAR (${activeCat?.icon || '📦'} ${catName || 'Wszystkie'})`,
      'Czeka na gest w prawo ➔',
      this.cachedData.coList,
      0
    );
    this.drumRight.setZoom(1.0);
    this.drumRight.setActive(false);

    this.updatePreviewUI();
    this.hidePointerPuck();
  }

  initEvents() {
    this.padEl.addEventListener('pointerdown', this.handlePointerDown.bind(this), { passive: false });
    window.addEventListener('pointermove', this.handlePointerMove.bind(this), { passive: false });
    window.addEventListener('pointerup', this.handlePointerUp.bind(this), { passive: false });
    window.addEventListener('pointercancel', this.handlePointerCancel.bind(this), { passive: false });
    this.padEl.addEventListener('contextmenu', e => e.preventDefault());
  }

  handlePointerDown(e) {
    if (this.isDragging) return;
    feedback.unlockAudio();

    this.isDragging = true;
    this.activePointerId = e.pointerId;
    try {
      this.padEl.setPointerCapture(e.pointerId);
    } catch (err) {}

    const width = window.innerWidth;
    const clientX = e.clientX;
    const clientY = e.clientY;
    const leftThreshold = width * 0.47;

    // Start zawsze w Kroku 1 (KATEGORIA)
    this.currentStep = 1;
    this.taskDraft = { category: null, co: null, skad: null, dokad: null, ile: null };
    this.hasBeenInLeftZone = clientX <= leftThreshold;

    const initialZoom = Math.max(0, Math.min(1, (clientX - width * 0.04) / (width * 0.30)));
    this.currentZoom = initialZoom;
    this.lastZoom = initialZoom;
    this.drumLeft.setZoom(initialZoom);
    this.drumLeft.setActive(true);
    this.drumRight.setActive(false);

    this.floatIndex = this.drumLeft.selectedIndex;
    this.lastClientY = clientY;
    this.drumLeft.setPosition(this.floatIndex);
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
      return;
    } else {
      if (this.isInCancelZone) {
        this.isInCancelZone = false;
        this.topBarEl.classList.remove('cancel-zone-active');
        this.updatePreviewUI(false);
        this.lastClientY = clientY;
      }
    }

    // 2. Obsługa Maszyny Stanów (47% - 53%)
    const leftThreshold = width * 0.47;
    const rightThreshold = width * 0.53;

    if (this.currentStep === 1 && clientX <= leftThreshold) {
      this.hasBeenInLeftZone = true;
    }

    // A. KROK 1 -> KROK 2 (KATEGORIA -> TOWAR, z LEWEJ do PRAWEJ)
    if (this.currentStep === 1 && this.hasBeenInLeftZone && clientX >= rightThreshold) {
      this.isTransitionLocked = false;
      this.clearTransitionBadge();

      const selectedCat = this.drumLeft.getSelectedItem();
      const catName = selectedCat ? (selectedCat.name || selectedCat.text) : null;
      this.taskDraft.category = catName;

      this.currentStep = 2;
      this.currentZoom = 1.0;
      this.lastZoom = 1.0;
      feedback.stepCommit(1);

      // Prawa kolumna staje się aktywna (KROK 2: TOWAR)
      const coData = storage.getCoListWithTop(catName);
      this.cachedData.coList = coData.items;

      this.drumRight.setStepData(
        2,
        `2. TOWAR (${selectedCat?.icon || '📦'} ${catName || 'Wszystkie'})`,
        'Przesuń góra/dół • W lewo do SKĄD',
        this.cachedData.coList,
        0
      );
      this.drumRight.setActive(true);
      this.drumRight.setZoom(1.0);
      this.drumRight.resetGauge();

      // Lewa kolumna w tle przygotowuje KROK 3 (SKĄD)
      this.drumLeft.setStepData(
        3,
        '3. LOKALIZACJA (SKĄD)',
        'Czeka na powrót w lewo ◀',
        this.cachedData.skadList,
        0
      );
      this.drumLeft.setZoom(1.0);
      this.drumLeft.setActive(false);

      this.floatIndex = this.drumRight.selectedIndex;
      this.lastClientY = clientY;
      this.drumRight.setPosition(this.floatIndex);

      this.updatePreviewUI();
      return;
    }

    // B. KROK 2 -> KROK 3 (TOWAR -> SKĄD, z PRAWEJ do LEWEJ)
    if (this.currentStep === 2 && clientX <= leftThreshold) {
      this.isTransitionLocked = false;
      this.clearTransitionBadge();

      const selectedCo = this.drumRight.getSelectedItem();
      this.taskDraft.co = selectedCo ? selectedCo.text : '';

      this.currentStep = 3;
      this.currentZoom = 1.0;
      this.lastZoom = 1.0;
      feedback.stepCommit(2);

      // Prawa kolumna w tle przygotowuje KROK 4 (DOKĄD)
      this.drumRight.setStepData(
        4,
        '4. CEL (DOKĄD)',
        'Czeka na gest w prawo ➔',
        this.cachedData.dokadList,
        0
      );
      this.drumRight.setZoom(1.0);
      this.drumRight.setActive(false);

      // Lewa kolumna staje się aktywna (KROK 3: SKĄD)
      this.drumLeft.setActive(true);
      this.drumLeft.setZoom(1.0);
      this.drumLeft.resetGauge();

      this.floatIndex = this.drumLeft.selectedIndex;
      this.lastClientY = clientY;
      this.drumLeft.setPosition(this.floatIndex);

      this.updatePreviewUI();
      return;
    }

    // C. KROK 3 -> KROK 4 (SKĄD -> DOKĄD, z LEWEJ do PRAWEJ)
    if (this.currentStep === 3 && clientX >= rightThreshold) {
      this.isTransitionLocked = false;
      this.clearTransitionBadge();

      const selectedSkad = this.drumLeft.getSelectedItem();
      this.taskDraft.skad = selectedSkad ? selectedSkad.text : '';

      this.currentStep = 4;
      this.currentZoom = 1.0;
      this.lastZoom = 1.0;
      feedback.stepCommit(3);

      // Lewa kolumna w tle przygotowuje KROK 5 (ILE)
      this.drumLeft.setStepData(
        5,
        '5. ILOŚĆ (ILE)',
        'Czeka na powrót w lewo ◀',
        this.cachedData.ileList,
        0
      );
      this.drumLeft.setZoom(1.0);
      this.drumLeft.setActive(false);

      // Prawa kolumna staje się aktywna (KROK 4: DOKĄD)
      this.drumRight.setActive(true);
      this.drumRight.setZoom(1.0);
      this.drumRight.resetGauge();

      this.floatIndex = this.drumRight.selectedIndex;
      this.lastClientY = clientY;
      this.drumRight.setPosition(this.floatIndex);

      this.updatePreviewUI();
      return;
    }

    // D. KROK 4 -> KROK 5 (DOKĄD -> ILE, z PRAWEJ do LEWEJ)
    if (this.currentStep === 4 && clientX <= leftThreshold) {
      this.isTransitionLocked = false;
      this.clearTransitionBadge();

      const selectedDokad = this.drumRight.getSelectedItem();
      this.taskDraft.dokad = selectedDokad ? selectedDokad.text : '';

      this.currentStep = 5;
      this.currentZoom = 1.0;
      this.lastZoom = 1.0;
      feedback.stepCommit(4);

      this.drumRight.setActive(false);

      // Lewa kolumna staje się aktywna (KROK 5: ILE)
      this.drumLeft.setActive(true);
      this.drumLeft.setZoom(1.0);
      this.drumLeft.resetGauge();

      this.floatIndex = this.drumLeft.selectedIndex;
      this.lastClientY = clientY;
      this.drumLeft.setPosition(this.floatIndex);

      this.updatePreviewUI();
      return;
    }

    // 3. Relatywne przewijanie aktywnej kolumny
    if (this.currentStep === 1) {
      // KROK 1: KATEGORIA (Lewa kolumna)
      const isHeadingRight = this.hasBeenInLeftZone && clientX >= width * 0.35;
      if (isHeadingRight) {
        this.isTransitionLocked = true;
        this.drumLeft.setZoom(1.0);
        this.drumLeft.updateGauge(0, 'center', true, 0, 'TOWAR');
        this.updatePuckCallout('PRZEJDŹ DO: TOWAR ➔', true);
        this.updateTransitionBadge('➔');
        return;
      }

      if (this.isTransitionLocked) {
        this.isTransitionLocked = false;
        this.clearTransitionBadge();
        this.lastClientY = clientY;
      }

      const minX = width * 0.04;
      const maxX = width * 0.34;
      const currentZoom = Math.max(0, Math.min(1, (clientX - minX) / (maxX - minX)));
      this.currentZoom = currentZoom;
      this.drumLeft.setZoom(currentZoom);

      const stepPx = Math.round(18 + currentZoom * 24);
      const dy = clientY - this.lastClientY;
      this.lastClientY = clientY;

      const totalItems = this.cachedData.categories.length;
      this.floatIndex -= dy / stepPx;
      this.floatIndex = Math.max(0, Math.min(totalItems - 1, this.floatIndex));

      const changed = this.drumLeft.setPosition(this.floatIndex);
      if (changed) {
        feedback.tick(currentZoom < 0.35);
        const cat = this.drumLeft.getSelectedItem();
        if (cat) {
          const catName = cat.name || cat.text;
          this.cachedData.coList = storage.getCoListWithTop(catName).items;
          this.drumRight.setStepData(
            2,
            `2. TOWAR (${cat.icon || '📦'} ${catName})`,
            'Czeka na gest w prawo ➔',
            this.cachedData.coList,
            0
          );
        }
        this.updatePreviewUI();
      }

      const targetIndex = Math.round(this.floatIndex);
      const diffFromTarget = this.floatIndex - targetIndex;
      const distUnits = 0.5 - Math.abs(diffFromTarget);
      const distPx = Math.max(0, Math.round(distUnits * stepPx));
      const direction = diffFromTarget > 0.08 ? 'up' : (diffFromTarget < -0.08 ? 'down' : 'center');

      this.drumLeft.updateGauge(distPx, direction, false);
      if (currentZoom < 0.35) {
        this.updatePuckCallout('SZYBKO');
      } else if (direction === 'center') {
        this.updatePuckCallout('KATEGORIA');
      } else if (direction === 'up') {
        this.updatePuckCallout('▲ KOLEJNA');
      } else {
        this.updatePuckCallout('▼ POPRZEDNIA');
      }
    } else if (this.currentStep === 2) {
      // KROK 2: TOWAR (Prawa kolumna)
      const isHeadingLeft = clientX <= width * 0.65;
      if (isHeadingLeft) {
        this.isTransitionLocked = true;
        this.drumRight.setZoom(1.0);
        this.drumRight.updateGauge(0, 'center', true, 0, 'SKĄD');
        this.updatePuckCallout('◀ PRZEJDŹ DO: SKĄD', true);
        this.updateTransitionBadge('◀');
        return;
      }

      if (this.isTransitionLocked) {
        this.isTransitionLocked = false;
        this.clearTransitionBadge();
        this.lastClientY = clientY;
      }

      const minX = width * 0.66;
      const maxX = width * 0.96;
      const currentZoom = Math.max(0, Math.min(1, (maxX - clientX) / (maxX - minX)));
      this.currentZoom = currentZoom;
      this.drumRight.setZoom(currentZoom);

      const stepPx = Math.round(18 + currentZoom * 24);
      const dy = clientY - this.lastClientY;
      this.lastClientY = clientY;

      const totalItems = this.cachedData.coList.length;
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
        this.updatePuckCallout('SZYBKO');
      } else if (direction === 'center') {
        this.updatePuckCallout('TOWAR');
      } else if (direction === 'up') {
        this.updatePuckCallout('▲ KOLEJNY');
      } else {
        this.updatePuckCallout('▼ POPRZEDNI');
      }
    } else if (this.currentStep === 3) {
      // KROK 3: SKĄD (Lewa kolumna)
      const isHeadingRight = clientX >= width * 0.35;
      if (isHeadingRight) {
        this.isTransitionLocked = true;
        this.drumLeft.setZoom(1.0);
        this.drumLeft.updateGauge(0, 'center', true, 0, 'DOKĄD');
        this.updatePuckCallout('PRZEJDŹ DO: DOKĄD ➔', true);
        this.updateTransitionBadge('➔');
        return;
      }

      if (this.isTransitionLocked) {
        this.isTransitionLocked = false;
        this.clearTransitionBadge();
        this.lastClientY = clientY;
      }

      const minX = width * 0.04;
      const maxX = width * 0.34;
      const currentZoom = Math.max(0, Math.min(1, (clientX - minX) / (maxX - minX)));
      this.currentZoom = currentZoom;
      this.drumLeft.setZoom(currentZoom);

      const stepPx = Math.round(18 + currentZoom * 24);
      const dy = clientY - this.lastClientY;
      this.lastClientY = clientY;

      const totalItems = this.cachedData.skadList.length;
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
        this.updatePuckCallout('SZYBKO');
      } else if (direction === 'center') {
        this.updatePuckCallout('SKĄD');
      } else if (direction === 'up') {
        this.updatePuckCallout('▲ KOLEJNY');
      } else {
        this.updatePuckCallout('▼ POPRZEDNI');
      }
    } else if (this.currentStep === 4) {
      // KROK 4: DOKĄD (Prawa kolumna)
      const isHeadingLeft = clientX <= width * 0.65;
      if (isHeadingLeft) {
        this.isTransitionLocked = true;
        this.drumRight.setZoom(1.0);
        this.drumRight.updateGauge(0, 'center', true, 0, 'ILE');
        this.updatePuckCallout('◀ PRZEJDŹ DO: ILE', true);
        this.updateTransitionBadge('◀');
        return;
      }

      if (this.isTransitionLocked) {
        this.isTransitionLocked = false;
        this.clearTransitionBadge();
        this.lastClientY = clientY;
      }

      const minX = width * 0.66;
      const maxX = width * 0.96;
      const currentZoom = Math.max(0, Math.min(1, (maxX - clientX) / (maxX - minX)));
      this.currentZoom = currentZoom;
      this.drumRight.setZoom(currentZoom);

      const stepPx = Math.round(18 + currentZoom * 24);
      const dy = clientY - this.lastClientY;
      this.lastClientY = clientY;

      const totalItems = this.cachedData.dokadList.length;
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
        this.updatePuckCallout('SZYBKO');
      } else if (direction === 'center') {
        this.updatePuckCallout('DOKĄD');
      } else if (direction === 'up') {
        this.updatePuckCallout('▲ KOLEJNY');
      } else {
        this.updatePuckCallout('▼ POPRZEDNI');
      }
    } else if (this.currentStep === 5) {
      // KROK 5: ILE (Lewa kolumna)
      if (this.isTransitionLocked) {
        this.isTransitionLocked = false;
        this.clearTransitionBadge();
        this.lastClientY = clientY;
      }

      const minX = width * 0.04;
      const maxX = width * 0.34;
      const currentZoom = Math.max(0, Math.min(1, (clientX - minX) / (maxX - minX)));
      this.currentZoom = currentZoom;
      this.drumLeft.setZoom(currentZoom);

      const stepPx = Math.round(18 + currentZoom * 24);
      const dy = clientY - this.lastClientY;
      this.lastClientY = clientY;

      const totalItems = this.cachedData.ileList.length;
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
        this.updatePuckCallout('SZYBKO');
      } else if (direction === 'center') {
        this.updatePuckCallout('PUŚĆ ABY ZAPISAĆ');
      } else if (direction === 'up') {
        this.updatePuckCallout('▲ KOLEJNY');
      } else {
        this.updatePuckCallout('▼ POPRZEDNI');
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
    if (this.currentStep === 1) {
      const catItem = this.drumLeft.getSelectedItem();
      if (catItem) {
        this.taskDraft.category = catItem.name || catItem.text;
        const firstCo = this.cachedData.coList[0];
        if (firstCo) this.taskDraft.co = firstCo.text;
      }
    } else if (this.currentStep === 2) {
      const item = this.drumRight.getSelectedItem();
      if (item) this.taskDraft.co = item.text;
    } else if (this.currentStep === 3) {
      const item = this.drumLeft.getSelectedItem();
      if (item) this.taskDraft.skad = item.text;
    } else if (this.currentStep === 4) {
      const item = this.drumRight.getSelectedItem();
      if (item) this.taskDraft.dokad = item.text;
    } else if (this.currentStep === 5) {
      const item = this.drumLeft.getSelectedItem();
      if (item) this.taskDraft.ile = item.text;
    }

    // Zapisujemy zadanie, jeśli chociaż towar został ustalony
    if (this.taskDraft.co) {
      const savedTask = storage.addTask(this.taskDraft);
      feedback.taskSaved();

      // Odśwież dane TOP na każdym etapie
      this.refreshData();
      this.onTaskSaved(savedTask);
    }

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

    let cat = this.taskDraft.category;
    let co = this.taskDraft.co;
    let skad = this.taskDraft.skad;
    let dokad = this.taskDraft.dokad;
    let ile = this.taskDraft.ile;

    if (this.currentStep === 1) {
      const item = this.drumLeft.getSelectedItem();
      cat = item ? (item.name || item.text) : '...';
    } else if (this.currentStep === 2) {
      const item = this.drumRight.getSelectedItem();
      co = item ? item.text : '...';
    } else if (this.currentStep === 3) {
      const item = this.drumLeft.getSelectedItem();
      skad = item ? item.text : '...';
    } else if (this.currentStep === 4) {
      const item = this.drumRight.getSelectedItem();
      dokad = item ? item.text : '...';
    } else if (this.currentStep === 5) {
      const item = this.drumLeft.getSelectedItem();
      ile = item ? item.text : '...';
    }

    const coDisplay = co ? co : (cat ? `[${cat}]` : '[TOWAR]');

    const coSpan = co || cat
      ? `<span class="preview-part ${this.currentStep <= 2 ? 'preview-active' : 'preview-done'}">${this.escape(coDisplay)}</span>`
      : `<span class="preview-placeholder">[TOWAR]</span>`;

    const skadSpan = skad
      ? `<span class="preview-part ${this.currentStep === 3 ? 'preview-active' : 'preview-done'}">${this.escape(skad)}</span>`
      : `<span class="preview-placeholder">[SKĄD]</span>`;

    const dokadSpan = dokad
      ? `<span class="preview-part ${this.currentStep === 4 ? 'preview-active' : 'preview-done'}">${this.escape(dokad)}</span>`
      : `<span class="preview-placeholder">[DOKĄD]</span>`;

    const ileSpan = ile
      ? `<span class="preview-part preview-qty ${this.currentStep === 5 ? 'preview-active' : 'preview-done'}">x${this.escape(ile)}</span>`
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
    this.pointerPuckEl.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    this.pointerPuckEl.classList.add('visible');
  }

  updatePointerPuck(x, y) {
    if (!this.pointerPuckEl) return;
    this.pointerPuckEl.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
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