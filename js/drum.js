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
    this.gaugeEl = this.container.querySelector('.target-gauge-indicator');

    // Zakres widocznych pozycji w bębnie (np. 5 w górę, 5 w dół)
    this.visibleSpan = 5;
    this.itemHeight = 52; // Bazowa wysokość slotu w px (zgodna z --slot-height: 52px)
    this.fraction = 0;
  }

  // Ustawienie zawartości kolumny
  setStepData(stepNumber, title, subtitle, items, initialIndex = 0) {
    this.stepNumber = stepNumber;
    this.stepTitle = title;
    this.stepSubtitle = subtitle;
    this.items = items || [];
    this.selectedIndex = Math.max(0, Math.min(initialIndex, this.items.length - 1));
    this.fraction = 0;

    if (this.targetWindowEl && this.targetWindowEl.offsetHeight > 0) {
      this.itemHeight = this.targetWindowEl.offsetHeight;
    }

    if (this.titleEl) {
      this.titleEl.textContent = title;
    }
    if (this.badgeEl) {
      this.badgeEl.textContent = `KROK ${stepNumber}`;
    }

    this.render(0);
    this.resetGauge();
  }

  setActive(isActive) {
    this.isActive = isActive;
    if (isActive) {
      this.container.classList.add('column-active');
      this.container.classList.remove('column-dimmed');
      this.resetGauge();
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

  setSelectedIndex(index, fraction = 0) {
    const clamped = Math.max(0, Math.min(index, this.items.length - 1));
    const indexChanged = clamped !== this.selectedIndex;
    this.selectedIndex = clamped;
    this.fraction = fraction;
    this.render(fraction);
    if (this.lane === 'turbo' && this.laneIndicatorEl) {
      const item = this.getSelectedItem();
      const text = typeof item === 'object' ? item.text : (item || '');
      const letter = text ? text.charAt(0).toUpperCase() : '';
      const letterBadge = letter ? ` [${letter}]` : '';
      this.laneIndicatorEl.textContent = `⚡ TRYB SZYBKI (x8)${letterBadge}`;
    }
    return indexChanged;
  }

  // Wskaźnik stabilności i dystansu do następnego wyboru
  updateGauge(distancePx, direction, isLocked, distToCommitX = 0, nextStepName = '') {
    if (!this.gaugeEl) {
      this.gaugeEl = this.container.querySelector('.target-gauge-indicator');
    }
    if (!this.gaugeEl) return;

    if (isLocked) {
      const arrow = this.stepNumber % 2 === 1 ? '➔' : '◀';
      const commitTxt = distToCommitX > 0 ? `${distToCommitX}px do ${nextStepName}` : 'PRZEJDŹ';
      this.gaugeEl.innerHTML = `
        <span class="gauge-pill gauge-locked">
          <span class="gauge-lock-icon">🔒</span>
          WYBÓR ZATWIERDZONY • ${commitTxt} ${arrow}
        </span>
      `;
      this.container.classList.add('transition-locked');
      return;
    }

    this.container.classList.remove('transition-locked');

    if (direction === 'center') {
      this.gaugeEl.innerHTML = `
        <span class="gauge-pill gauge-stable">
          <span class="gauge-dot"></span>
          STABILNE (${distancePx}px do zmiany)
        </span>
      `;
    } else if (direction === 'up') {
      this.gaugeEl.innerHTML = `
        <span class="gauge-pill gauge-drift">
          <span class="gauge-arrow">▲</span>
          ${distancePx}px do kolejnego
        </span>
      `;
    } else {
      this.gaugeEl.innerHTML = `
        <span class="gauge-pill gauge-drift">
          <span class="gauge-arrow">▼</span>
          ${distancePx}px do poprzedniego
        </span>
      `;
    }
  }

  resetGauge() {
    if (!this.gaugeEl) {
      this.gaugeEl = this.container.querySelector('.target-gauge-indicator');
    }
    if (!this.gaugeEl) return;
    this.gaugeEl.innerHTML = `
      <span class="gauge-pill gauge-stable">
        <span class="gauge-dot"></span>
        STABILNE (14px do zmiany)
      </span>
    `;
    this.container.classList.remove('transition-locked');
  }

  getSelectedItem() {
    return this.items[this.selectedIndex] || null;
  }

  // Renderowanie elementów w oknie bębna z efektem walca 3D
  render(fraction = 0) {
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

      // Wyrównanie i 3D transformacja bębna z fizycznym mikroruchem (sub-pixel parallax)
      const visualDiff = diff + fraction;
      const angle = visualDiff * 14; // łagodny kąt obrotu walca
      const translateY = visualDiff * this.itemHeight;
      const translateZ = -Math.abs(visualDiff) * 16;
      const scale = Math.max(0.72, 1 - Math.abs(visualDiff) * 0.07);
      const opacity = isSelected && fraction === 0 ? 1 : Math.max(0.12, 0.90 - Math.abs(visualDiff) * 0.25);

      itemDiv.style.transform = `translate3d(0px, ${translateY}px, ${translateZ}px) rotateX(${-angle}deg) scale(${scale})`;
      itemDiv.style.opacity = `${opacity}`;
      itemDiv.style.zIndex = `${50 - Math.round(Math.abs(visualDiff) * 10)}`;

      // Zawartość pozycji - czytelne formatowanie dla długich nazw
      const itemText = typeof item === 'object' ? item.text : item;
      const isTop = typeof item === 'object' && item.isTop;
      const count = typeof item === 'object' && item.count;

      let categoryHtml = '';
      let titleHtml = '';

      // Sprawdzamy czy towar posiada prefiks kategorii (np. "Chemia - Płyn...")
      const dashIdx = typeof itemText === 'string' ? itemText.indexOf(' - ') : -1;
      if (dashIdx !== -1) {
        const cat = itemText.substring(0, dashIdx).trim();
        const name = itemText.substring(dashIdx + 3).trim();
        categoryHtml = `<span class="item-cat">${this.escapeHtml(cat)}</span>`;
        titleHtml = `<span class="item-title">${this.escapeHtml(name)}</span>`;
      } else {
        titleHtml = `<span class="item-title">${this.escapeHtml(itemText)}</span>`;
      }

      const topFlameHtml = isTop ? `<span class="top-flame-icon" title="Czołówka TOP (${count}x)">🔥</span>` : '';

      itemDiv.innerHTML = `
        <div class="item-content ${isTop ? 'has-top-badge' : ''}">
          ${topFlameHtml}
          <div class="item-text-box">
            ${categoryHtml}
            ${titleHtml}
          </div>
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
