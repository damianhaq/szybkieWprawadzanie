// Renderer bębnów wyboru (Cylindrical 3D Picker Wheel) dla lewej i prawej kolumny

export class DrumColumn {
  constructor(containerEl, side = 'left') {
    this.container = containerEl;
    this.side = side; // 'left' | 'right'
    this.items = []; // Array of { text, isTop?, count?, id? }
    this.selectedIndex = 0;
    this.stepNumber = 1;
    this.stepTitle = '';
    this.stepSubtitle = '';
    this.isActive = false;
    this.lane = 'precision'; // 'precision' | 'turbo'

    this.headerEl = this.container.querySelector('.column-header');
    this.titleEl = this.container.querySelector('.column-title');
    this.badgeEl = this.container.querySelector('.column-step-badge');
    this.wheelEl = this.container.querySelector('.wheel-track');
    this.targetWindowEl = this.container.querySelector('.target-window');
    this.laneIndicatorEl = this.container.querySelector('.lane-indicator');

    // Zakres widocznych pozycji w bębnie (np. 5 w górę, 5 w dół)
    this.visibleSpan = 5;
    this.itemHeight = 44; // Bazowa wysokość slotu w px
  }

  // Ustawienie zawartości kolumny
  setStepData(stepNumber, title, subtitle, items, initialIndex = 0) {
    this.stepNumber = stepNumber;
    this.stepTitle = title;
    this.stepSubtitle = subtitle;
    this.items = items || [];
    this.selectedIndex = Math.max(0, Math.min(initialIndex, this.items.length - 1));

    if (this.targetWindowEl && this.targetWindowEl.offsetHeight > 0) {
      this.itemHeight = this.targetWindowEl.offsetHeight;
    }

    if (this.titleEl) {
      this.titleEl.textContent = title;
    }
    if (this.badgeEl) {
      this.badgeEl.textContent = `KROK ${stepNumber}`;
    }

    this.render();
  }

  setActive(isActive) {
    this.isActive = isActive;
    if (isActive) {
      this.container.classList.add('column-active');
      this.container.classList.remove('column-dimmed');
    } else {
      this.container.classList.remove('column-active');
      this.container.classList.add('column-dimmed');
    }
  }

  setLane(lane) {
    this.lane = lane;
    if (this.laneIndicatorEl) {
      if (lane === 'turbo') {
        const item = this.getSelectedItem();
        const text = typeof item === 'object' ? item.text : (item || '');
        const letter = text ? text.charAt(0).toUpperCase() : '';
        const letterBadge = letter ? ` [${letter}]` : '';
        this.laneIndicatorEl.textContent = `⚡ TRYB SZYBKI (x8)${letterBadge}`;
        this.laneIndicatorEl.className = 'lane-indicator lane-turbo active';
        this.container.classList.add('in-turbo-lane');
      } else {
        this.laneIndicatorEl.textContent = '🎯 PRECYZJA (x1)';
        this.laneIndicatorEl.className = 'lane-indicator lane-precision active';
        this.container.classList.remove('in-turbo-lane');
      }
    }
  }

  hideLaneIndicator() {
    if (this.laneIndicatorEl) {
      this.laneIndicatorEl.className = 'lane-indicator hidden';
      this.container.classList.remove('in-turbo-lane');
    }
  }

  setSelectedIndex(index) {
    const clamped = Math.max(0, Math.min(index, this.items.length - 1));
    if (clamped !== this.selectedIndex) {
      this.selectedIndex = clamped;
      this.render();
      if (this.lane === 'turbo' && this.laneIndicatorEl) {
        const item = this.getSelectedItem();
        const text = typeof item === 'object' ? item.text : (item || '');
        const letter = text ? text.charAt(0).toUpperCase() : '';
        const letterBadge = letter ? ` [${letter}]` : '';
        this.laneIndicatorEl.textContent = `⚡ TRYB SZYBKI (x8)${letterBadge}`;
      }
      return true; // index changed
    }
    return false;
  }

  getSelectedItem() {
    return this.items[this.selectedIndex] || null;
  }

  // Renderowanie elementów w oknie bębna z efektem walca 3D
  render() {
    if (!this.wheelEl) return;
    const total = this.items.length;
    if (total === 0) {
      this.wheelEl.innerHTML = '<div class="wheel-empty">Brak danych</div>';
      return;
    }

    const current = this.selectedIndex;
    const start = Math.max(0, current - this.visibleSpan);
    const end = Math.min(total - 1, current + this.visibleSpan);

    // Budujemy elementy tylko dla okna widocznego wokół wybranego
    const fragment = document.createDocumentFragment();

    for (let i = start; i <= end; i++) {
      const item = this.items[i];
      const diff = i - current; // 0 to wybrany, ujemne to wyżej, dodatnie niżej

      const itemDiv = document.createElement('div');
      itemDiv.className = 'wheel-item';
      itemDiv.dataset.index = i;

      const isSelected = diff === 0;
      if (isSelected) {
        itemDiv.classList.add('selected');
      }

      // Precyzyjne wyrównanie i 3D transformacja bębna:
      if (isSelected) {
        // Element wybrany pokrywa się w 100% z oknem docelowym (target-window)
        itemDiv.style.transform = 'translate3d(0px, 0px, 0px) rotateX(0deg) scale(1)';
        itemDiv.style.opacity = '1';
        itemDiv.style.zIndex = '50';
      } else {
        const angle = diff * 14; // łagodny kąt obrotu walca
        const translateY = diff * this.itemHeight;
        const translateZ = -Math.abs(diff) * 16;
        const scale = Math.max(0.72, 1 - Math.abs(diff) * 0.07);
        const opacity = Math.max(0.12, 0.82 - Math.abs(diff) * 0.22);

        itemDiv.style.transform = `translate3d(0px, ${translateY}px, ${translateZ}px) rotateX(${-angle}deg) scale(${scale})`;
        itemDiv.style.opacity = `${opacity}`;
        itemDiv.style.zIndex = `${40 - Math.abs(diff)}`;
      }

      // Zawartość pozycji
      const itemText = typeof item === 'object' ? item.text : item;
      const isTop = typeof item === 'object' && item.isTop;
      const count = typeof item === 'object' && item.count;

      let badgeHtml = '';
      if (isTop) {
        badgeHtml = `<span class="top-badge" title="Najczęściej wybierane (${count}x)">🔥 TOP</span>`;
      }

      itemDiv.innerHTML = `
        <div class="item-content ${isTop ? 'has-top-badge' : ''}">
          ${badgeHtml}
          <span class="item-text">${this.escapeHtml(itemText)}</span>
        </div>
      `;

      fragment.appendChild(itemDiv);
    }

    this.wheelEl.replaceChildren(fragment);
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
