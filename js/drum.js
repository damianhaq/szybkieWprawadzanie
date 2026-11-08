// Renderer bębnów wyboru (Cylindrical 3D Picker Wheel) z kafelkami i dynamicznym zoomem 2D

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
    this.zoom = 1.0; // 0.0 (kompaktowy/szybki) do 1.0 (duży kafelek/precyzyjny)

    this.headerEl = this.container.querySelector('.column-header');
    this.titleEl = this.container.querySelector('.column-title');
    this.badgeEl = this.container.querySelector('.column-step-badge');
    this.wheelEl = this.container.querySelector('.wheel-track');
    this.targetWindowEl = this.container.querySelector('.target-window');
    this.zoomIndicatorEl = this.container.querySelector('.zoom-indicator');
    this.gaugeEl = this.container.querySelector('.target-gauge-indicator');

    // Zakres widocznych pozycji w bębnie (np. 5 w górę, 5 w dół)
    this.visibleSpan = 5;
    this.itemHeight = 54; // Dynamiczna wysokość slotu w px zależna od zoomu
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

    if (this.titleEl) {
      this.titleEl.textContent = title;
    }
    if (this.badgeEl) {
      this.badgeEl.textContent = `KROK ${stepNumber}`;
    }

    this.updateZoomIndicator();
    this.render(0);
    this.resetGauge();
  }

  setActive(isActive) {
    this.isActive = isActive;
    if (isActive) {
      this.container.classList.add('column-active');
      this.container.classList.remove('column-dimmed');
      this.updateZoomIndicator();
      this.resetGauge();
    } else {
      this.container.classList.remove('column-active');
      this.container.classList.add('column-dimmed');
    }
  }

  // Płynna zmiana powiększenia kafelków na osi X (Zoom Gestem)
  setZoom(zoom) {
    const clamped = Math.max(0, Math.min(1, zoom));
    if (Math.abs(clamped - this.zoom) > 0.015) {
      this.zoom = clamped;
      // Wysokość kafelka skaluje się od 36px (mini) do 58px (duży)
      this.itemHeight = Math.round(36 + this.zoom * 22);

      if (this.targetWindowEl) {
        this.targetWindowEl.style.height = `${this.itemHeight}px`;
      }
      if (this.wheelEl) {
        this.wheelEl.style.height = `${this.itemHeight}px`;
      }

      this.container.classList.toggle('zoom-compact', this.zoom < 0.45);
      this.updateZoomIndicator();
      this.render(this.fraction);
    }
  }

  updateZoomIndicator() {
    if (!this.zoomIndicatorEl) return;
    if (this.zoom >= 0.7) {
      this.zoomIndicatorEl.textContent = '🔍 100% PRECYZJA';
      this.zoomIndicatorEl.className = 'zoom-indicator zoom-precise';
    } else if (this.zoom <= 0.35) {
      this.zoomIndicatorEl.textContent = '⚡ SZYBKI PODGLĄD';
      this.zoomIndicatorEl.className = 'zoom-indicator zoom-fast';
    } else {
      this.zoomIndicatorEl.textContent = `🔍 ZOOM ${Math.round(this.zoom * 100)}%`;
      this.zoomIndicatorEl.className = 'zoom-indicator';
    }
  }

  // Kompatybilność wsteczna
  setLane() {}
  hideLaneIndicator() {}

  setSelectedIndex(index, fraction = 0) {
    const clamped = Math.max(0, Math.min(index, this.items.length - 1));
    const indexChanged = clamped !== this.selectedIndex;
    this.selectedIndex = clamped;
    this.fraction = fraction;
    this.render(fraction);
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
      const info = this.zoom < 0.35 ? 'Szybki podgląd' : `${distancePx}px do zmiany`;
      this.gaugeEl.innerHTML = `
        <span class="gauge-pill gauge-stable">
          <span class="gauge-dot"></span>
          STABILNE (${info})
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
        STABILNE (18px do zmiany)
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
      const baseScale = 0.82 + this.zoom * 0.22;
      const scale = Math.max(0.68, baseScale - Math.abs(visualDiff) * 0.06);
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
        <div class="drum-card ${isTop ? 'card-top' : ''}">
          ${topFlameHtml}
          <div class="card-text-box">
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
