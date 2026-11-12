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

    // Zakres widocznych pozycji w bębnie (dynamicznie dostosowany do wysokości ekranu)
    this.visibleSpan = 10;
    this.itemHeight = 54; // Dynamiczna wysokość slotu w px zależna od zoomu
    this.fraction = 0;
    this.floatY = 0;
    this.nodeCache = new Map();
  }

  // Ustawienie zawartości kolumny
  setStepData(stepNumber, title, subtitle, items, initialIndex = 0) {
    this.stepNumber = stepNumber;
    this.stepTitle = title;
    this.stepSubtitle = subtitle;
    this.items = items || [];
    this.selectedIndex = Math.max(0, Math.min(initialIndex, this.items.length - 1));
    this.floatY = this.selectedIndex;
    this.fraction = 0;

    if (this.nodeCache) {
      this.nodeCache.clear();
    }
    if (this.wheelEl) {
      this.wheelEl.replaceChildren();
    }

    if (this.titleEl) {
      this.titleEl.textContent = title;
    }
    if (this.badgeEl) {
      this.badgeEl.textContent = `KROK ${stepNumber}`;
    }

    this.updateZoomIndicator();
    this.render();
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

      if (this.container) {
        this.container.style.setProperty('--slot-height', `${this.itemHeight}px`);
      }
      if (this.targetWindowEl) {
        this.targetWindowEl.style.height = `${this.itemHeight}px`;
      }
      if (this.wheelEl) {
        this.wheelEl.style.height = `${this.itemHeight}px`;
      }

      this.container.classList.toggle('zoom-compact', this.zoom < 0.45);
      this.updateZoomIndicator();
      this.render();
    }
  }

  updateZoomIndicator() {
    if (!this.zoomIndicatorEl) return;
    if (this.zoom >= 0.7) {
      this.zoomIndicatorEl.textContent = '100% PRECYZJA';
      this.zoomIndicatorEl.className = 'zoom-indicator zoom-precise';
    } else if (this.zoom <= 0.35) {
      this.zoomIndicatorEl.textContent = 'SZYBKI PODGLĄD';
      this.zoomIndicatorEl.className = 'zoom-indicator zoom-fast';
    } else {
      this.zoomIndicatorEl.textContent = `ZOOM ${Math.round(this.zoom * 100)}%`;
      this.zoomIndicatorEl.className = 'zoom-indicator';
    }
  }

  // Kompatybilność wsteczna
  setLane() {}
  hideLaneIndicator() {}

  // Płynne pozycjonowanie zmiennoprzecinkowe (Continuous Float Scrolling)
  setPosition(floatY) {
    const total = this.items.length;
    if (total === 0) return false;
    const clampedY = Math.max(0, Math.min(total - 1, floatY));
    const targetIndex = Math.round(clampedY);
    const indexChanged = targetIndex !== this.selectedIndex;
    this.selectedIndex = targetIndex;
    this.floatY = clampedY;
    this.fraction = clampedY - targetIndex;
    this.render();
    return indexChanged;
  }

  setSelectedIndex(index, fraction = 0) {
    const total = this.items.length;
    if (total === 0) return false;
    const clamped = Math.max(0, Math.min(total - 1, index));
    const indexChanged = clamped !== this.selectedIndex;
    this.selectedIndex = clamped;
    this.floatY = Math.max(0, Math.min(total - 1, clamped + fraction));
    this.fraction = fraction;
    this.render();
    return indexChanged;
  }

  // Wskaźnik stabilności i kierunku wyboru (minimalistyczny, bez wartości px)
  updateGauge(distancePx, direction, isLocked, distToCommitX = 0, nextStepName = '') {
    if (!this.gaugeEl) {
      this.gaugeEl = this.container.querySelector('.target-gauge-indicator');
    }
    if (!this.gaugeEl) return;

    if (isLocked) {
      const arrow = this.stepNumber % 2 === 1 ? '➔' : '◀';
      const targetTxt = nextStepName ? `PRZEJDŹ DO: ${nextStepName}` : 'PRZEJDŹ';
      this.gaugeEl.innerHTML = `
        <span class="gauge-pill gauge-locked">
          ${targetTxt} ${arrow}
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
          WYBRANO
        </span>
      `;
    } else if (direction === 'up') {
      this.gaugeEl.innerHTML = `
        <span class="gauge-pill gauge-drift">
          <span class="gauge-arrow">▲</span>
          KOLEJNY
        </span>
      `;
    } else {
      this.gaugeEl.innerHTML = `
        <span class="gauge-pill gauge-drift">
          <span class="gauge-arrow">▼</span>
          POPRZEDNI
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
        GOTOWE
      </span>
    `;
    this.container.classList.remove('transition-locked');
  }

  getSelectedItem() {
    return this.items[this.selectedIndex] || null;
  }

  // Renderowanie elementów w oknie bębna z ciągłym pozycjonowaniem i płaskim stylem (Flat Design)
  render() {
    if (!this.wheelEl) return;
    const total = this.items.length;
    if (total === 0) {
      this.wheelEl.innerHTML = '<div class="wheel-empty">Brak danych</div>';
      return;
    }

    const currentFloat = typeof this.floatY === 'number' ? this.floatY : this.selectedIndex;
    const current = this.selectedIndex;

    // Obliczamy dynamicznie visibleSpan, aby wypełnić cały widok i wyjść poza krawędzie
    const containerHeight = this.wheelEl.parentElement?.clientHeight || 450;
    const halfHeight = containerHeight / 2;
    const spanNeeded = Math.ceil(halfHeight / Math.min(32, this.itemHeight)) + 3;
    const visibleSpan = Math.max(10, spanNeeded);

    const start = Math.max(0, Math.floor(currentFloat - visibleSpan));
    const end = Math.min(total - 1, Math.ceil(currentFloat + visibleSpan));

    if (!this.nodeCache) {
      this.nodeCache = new Map();
    }

    const activeIndices = new Set();
    const fragment = document.createDocumentFragment();

    for (let i = start; i <= end; i++) {
      activeIndices.add(i);
      const visualDiff = i - currentFloat;

      let itemDiv = this.nodeCache.get(i);
      if (!itemDiv) {
        itemDiv = this.createItemElement(i);
        this.nodeCache.set(i, itemDiv);
      }

      const isSelected = i === current;
      if (isSelected && !itemDiv.classList.contains('selected')) {
        itemDiv.classList.add('selected');
      } else if (!isSelected && itemDiv.classList.contains('selected')) {
        itemDiv.classList.remove('selected');
      }

      // Czysta, płaska transformacja 2D - bez agresywnych kątów 3D, które składają kafelki
      const translateY = visualDiff * this.itemHeight;
      const baseScale = 0.82 + this.zoom * 0.22;
      const scale = Math.max(0.70, baseScale - Math.abs(visualDiff) * 0.04);
      // Płynna, łagodna krzywa przezroczystości (krawędzie maskuje gradient CSS)
      const opacity = Math.max(0.25, 1.0 - Math.abs(visualDiff) * 0.10);

      itemDiv.style.transform = `translate3d(0px, ${translateY.toFixed(1)}px, 0px) scale(${scale.toFixed(3)})`;
      itemDiv.style.opacity = opacity.toFixed(2);
      itemDiv.style.zIndex = `${50 - Math.min(45, Math.round(Math.abs(visualDiff) * 5))}`;

      if (itemDiv.parentElement !== this.wheelEl) {
        fragment.appendChild(itemDiv);
      }
    }

    if (fragment.childNodes.length > 0) {
      this.wheelEl.appendChild(fragment);
    }

    // Usuwamy elementy z DOM, które wyszły poza widoczny zakres
    for (const [idx, node] of this.nodeCache.entries()) {
      if (!activeIndices.has(idx)) {
        if (node.parentElement === this.wheelEl) {
          this.wheelEl.removeChild(node);
        }
        if (Math.abs(idx - current) > visibleSpan * 2) {
          this.nodeCache.delete(idx);
        }
      }
    }
  }

  createItemElement(i) {
    const item = this.items[i];
    const itemDiv = document.createElement('div');
    itemDiv.className = 'wheel-item';
    itemDiv.dataset.index = i;

    const itemText = typeof item === 'object' ? (item.text || item.name) : item;
    const isTop = typeof item === 'object' && item.isTop;
    const count = typeof item === 'object' && item.count;
    const icon = typeof item === 'object' && item.icon ? item.icon : '';

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
      const iconSpan = icon ? `<span class="item-icon">${icon}</span> ` : '';
      titleHtml = `<span class="item-title">${iconSpan}${this.escapeHtml(itemText)}</span>`;
    }

    // Nowoczesna, minimalistyczna odznaka TOP (flat pill)
    const topBadgeHtml = isTop ? `<span class="badge-top">TOP</span>` : '';
    const countBadgeHtml = (count && !isTop && typeof count === 'number' && count > 1 && icon)
      ? `<span class="item-count-subtle">${count} poz.</span>`
      : '';

    itemDiv.innerHTML = `
      <div class="drum-card ${isTop ? 'card-top' : ''}">
        ${topBadgeHtml}
        <div class="card-text-box">
          ${categoryHtml}
          ${titleHtml}
        </div>
        ${countBadgeHtml}
      </div>
    `;

    return itemDiv;
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
