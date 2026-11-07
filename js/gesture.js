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
    this.turboStripeEl = document.getElementById('turboLaneStripe');
    this.onTaskSaved = options.onTaskSaved || (() => {});
    this.onTaskCancelled = options.onTaskCancelled || (() => {});

    // Stan maszyny stanów
    this.isDragging = false;
    this.activePointerId = null;
    this.currentStep = 1; // 1: CO (L), 2: SKĄD (P), 3: DOKĄD (L), 4: ILE (P)
    this.currentLane = 'precision'; // 'precision' | 'turbo' (dla Kroku 1)
    this.isInCancelZone = false;

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
    this.currentLane = 'precision';
    this.isInCancelZone = false;
    this.taskDraft = { co: null, skad: null, dokad: null, ile: null };

    // Pas Turbo widoczny w Kroku 1
    if (this.turboStripeEl) {
      this.turboStripeEl.classList.remove('hidden');
    }

    // Lewa kolumna: Krok 1 (CO)
    this.drumLeft.setStepData(
      1,
      '1. WYBIERZ TOWAR (CO)',
      'Przesuń góra/dół • W prawo do SKĄD',
      this.cachedData.coList,
      0
    );
    this.drumLeft.setActive(true);
    this.drumLeft.hideLaneIndicator();

    // Prawa kolumna: Podgląd Kroku 2 (SKĄD)
    this.drumRight.setStepData(
      2,
      '2. LOKALIZACJA (SKĄD)',
      'Czeka na gest w prawo ->',
      this.cachedData.skadList,
      0
    );
    this.drumRight.setActive(false);
    this.drumRight.hideLaneIndicator();

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

    // Wyznaczenie pasa ruchu w lewej kolumnie (Pas Szybki: 0 - 16% szerokości)
    const isTurbo = clientX <= width * 0.16;
    this.currentLane = isTurbo ? 'turbo' : 'precision';
    this.drumLeft.setLane(this.currentLane);
    this.drumLeft.setActive(true);
    this.drumRight.setActive(false);

    // Kotwica startowa dla relatywnego przewijania
    this.anchorY = clientY;
    this.anchorIndex = this.drumLeft.selectedIndex;

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
      }
      return; // W strefie anulowania nie przewijamy list
    } else {
      if (this.isInCancelZone) {
        this.isInCancelZone = false;
        this.topBarEl.classList.remove('cancel-zone-active');
        this.updatePreviewUI(false);
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
      const selectedItem = this.drumLeft.getSelectedItem();
      this.taskDraft.co = selectedItem ? selectedItem.text : '';

      this.currentStep = 2;
      feedback.stepCommit(1);

      // Ukryj pasek turbo (aktywny tylko w Kroku 1)
      if (this.turboStripeEl) {
        this.turboStripeEl.classList.add('hidden');
      }

      // Lewa strefa w tle natychmiast podmienia zawartość na KROK 3 (DOKĄD)
      this.drumLeft.setStepData(
        3,
        '3. CEL (DOKĄD)',
        'Czeka na powrót w lewo <-',
        this.cachedData.dokadList,
        0
      );
      this.drumLeft.setActive(false);
      this.drumLeft.hideLaneIndicator();

      // Prawa strefa staje się aktywna (KROK 2: SKĄD)
      this.drumRight.setActive(true);
      this.anchorY = clientY;
      this.anchorIndex = this.drumRight.selectedIndex;

      this.updatePreviewUI();
      return;
    }

    // B. KROK 2 -> KROK 3 (Z PRAWEJ DO LEWEJ)
    if (this.currentStep === 2 && clientX <= leftThreshold) {
      const selectedItem = this.drumRight.getSelectedItem();
      this.taskDraft.skad = selectedItem ? selectedItem.text : '';

      this.currentStep = 3;
      feedback.stepCommit(2);

      // Prawa strefa w tle natychmiast podmienia zawartość na KROK 4 (ILE)
      this.drumRight.setStepData(
        4,
        '4. ILOŚĆ (ILE)',
        'Czeka na gest w prawo ->',
        this.cachedData.ileList,
        0
      );
      this.drumRight.setActive(false);

      // Lewa strefa staje się aktywna (KROK 3: DOKĄD)
      this.drumLeft.setActive(true);
      this.drumLeft.hideLaneIndicator();
      this.anchorY = clientY;
      this.anchorIndex = this.drumLeft.selectedIndex;

      this.updatePreviewUI();
      return;
    }

    // C. KROK 3 -> KROK 4 (Z LEWEJ DO PRAWEJ)
    if (this.currentStep === 3 && clientX >= rightThreshold) {
      const selectedItem = this.drumLeft.getSelectedItem();
      this.taskDraft.dokad = selectedItem ? selectedItem.text : '';

      this.currentStep = 4;
      feedback.stepCommit(3);

      // Prawa strefa staje się aktywna (KROK 4: ILE)
      this.drumRight.setActive(true);
      this.drumLeft.setActive(false);
      this.anchorY = clientY;
      this.anchorIndex = this.drumRight.selectedIndex;

      this.updatePreviewUI();
      return;
    }

    // 3. Relatywne przewijanie aktywnej kolumny (Relative Scrolling)
    if (this.currentStep === 1) {
      // Dwubiegowa lewa kolumna: Pas Szybki (0 - 16%) i Pas Precyzyjny (16% - 47%)
      const newLane = clientX <= width * 0.16 ? 'turbo' : 'precision';

      // KRYTYCZNY DETAL: Płynne przejście między biegami bez przeskoku
      if (newLane !== this.currentLane) {
        this.currentLane = newLane;
        this.anchorY = clientY;
        this.anchorIndex = this.drumLeft.selectedIndex;
        this.drumLeft.setLane(newLane);
      }

      const deltaY = clientY - this.anchorY;

      let deltaIndex = 0;
      if (this.currentLane === 'turbo') {
        // Pas Szybki: 1 krok co 20px przesuwa o 8 pozycji naraz
        deltaIndex = Math.round(-deltaY / 20) * 8;
      } else {
        // Pas Precyzyjny: 1 krok co 28px przesuwa dokładnie o 1 pozycję
        deltaIndex = Math.round(-deltaY / 28);
      }

      let targetIndex = this.anchorIndex + deltaIndex;
      const totalItems = this.cachedData.coList.length;

      // Zapobieganie opóźnieniu przy nawrocie po uderzeniu w krawędź listy
      if (targetIndex < 0) {
        targetIndex = 0;
        this.anchorIndex = 0;
        this.anchorY = clientY;
      } else if (targetIndex >= totalItems) {
        targetIndex = totalItems - 1;
        this.anchorIndex = targetIndex;
        this.anchorY = clientY;
      }

      const changed = this.drumLeft.setSelectedIndex(targetIndex);
      if (changed) {
        feedback.tick(this.currentLane === 'turbo');
        this.updatePreviewUI();
      }
    } else if (this.currentStep === 2) {
      // Krok 2 (SKĄD - Prawa kolumna, 28px / krok)
      const deltaY = clientY - this.anchorY;
      let deltaIndex = Math.round(-deltaY / 28);
      let targetIndex = this.anchorIndex + deltaIndex;
      const totalItems = this.cachedData.skadList.length;

      if (targetIndex < 0) {
        targetIndex = 0;
        this.anchorIndex = 0;
        this.anchorY = clientY;
      } else if (targetIndex >= totalItems) {
        targetIndex = totalItems - 1;
        this.anchorIndex = targetIndex;
        this.anchorY = clientY;
      }

      const changed = this.drumRight.setSelectedIndex(targetIndex);
      if (changed) {
        feedback.tick(false);
        this.updatePreviewUI();
      }
    } else if (this.currentStep === 3) {
      // Krok 3 (DOKĄD - Lewa kolumna, 28px / krok)
      const deltaY = clientY - this.anchorY;
      let deltaIndex = Math.round(-deltaY / 28);
      let targetIndex = this.anchorIndex + deltaIndex;
      const totalItems = this.cachedData.dokadList.length;

      if (targetIndex < 0) {
        targetIndex = 0;
        this.anchorIndex = 0;
        this.anchorY = clientY;
      } else if (targetIndex >= totalItems) {
        targetIndex = totalItems - 1;
        this.anchorIndex = targetIndex;
        this.anchorY = clientY;
      }

      const changed = this.drumLeft.setSelectedIndex(targetIndex);
      if (changed) {
        feedback.tick(false);
        this.updatePreviewUI();
      }
    } else if (this.currentStep === 4) {
      // Krok 4 (ILE - Prawa kolumna, 28px / krok)
      const deltaY = clientY - this.anchorY;
      let deltaIndex = Math.round(-deltaY / 28);
      let targetIndex = this.anchorIndex + deltaIndex;
      const totalItems = this.cachedData.ileList.length;

      if (targetIndex < 0) {
        targetIndex = 0;
        this.anchorIndex = 0;
        this.anchorY = clientY;
      } else if (targetIndex >= totalItems) {
        targetIndex = totalItems - 1;
        this.anchorIndex = targetIndex;
        this.anchorY = clientY;
      }

      const changed = this.drumRight.setSelectedIndex(targetIndex);
      if (changed) {
        feedback.tick(false);
        this.updatePreviewUI();
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
    this.hidePointerPuck();

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
    this.topBarEl.classList.remove('cancel-zone-active');
    this.hidePointerPuck();
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
  }

  escape(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
