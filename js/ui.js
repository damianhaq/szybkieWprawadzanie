// Obsługa interfejsu użytkownika, dolnego panelu zadań (Drawer) oraz modali ustawień i bazy
import { storage } from './storage.js';
import { feedback } from './audio.js';

export class UIManager {
  constructor(options) {
    this.gestureEngine = null; // Zostanie powiązane po inicjalizacji
    this.taskDrawerEl = document.getElementById('taskDrawer');
    this.drawerListEl = document.getElementById('drawerTaskList');
    this.taskCountBadges = document.querySelectorAll('.task-count-badge');
    this.dbModal = document.getElementById('dbModal');
    this.infoModal = document.getElementById('infoModal');
    this.toastContainer = document.getElementById('toastContainer');

    this.currentFilter = 'all'; // 'all' | 'active' | 'completed'

    this.initDrawer();
    this.initModals();
    this.initDbEditor();
    this.initItemsManager();
    this.renderTasks();
  }

  setGestureEngine(engine) {
    this.gestureEngine = engine;
  }

  // Obsługa dolnego panelu zadań (Bottom Drawer)
  initDrawer() {
    const handleEl = document.getElementById('drawerHandle');
    const toggleExpandBtn = document.getElementById('btnToggleExpandDrawer');
    const btnOpenTasks = document.getElementById('btnOpenTasks');
    const btnClearCompleted = document.getElementById('btnClearCompleted');
    const btnExportTasks = document.getElementById('btnExportTasks');
    const filterButtons = document.querySelectorAll('.drawer-filter-btn');

    const toggleExpand = () => {
      this.taskDrawerEl.classList.toggle('expanded');
      const isExpanded = this.taskDrawerEl.classList.contains('expanded');
      toggleExpandBtn.innerHTML = isExpanded
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`;
    };

    if (handleEl) {
      handleEl.addEventListener('click', toggleExpand);
    }
    if (toggleExpandBtn) {
      toggleExpandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleExpand();
      });
    }
    if (btnOpenTasks) {
      btnOpenTasks.addEventListener('click', () => {
        this.taskDrawerEl.classList.add('expanded');
        toggleExpandBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
      });
    }

    // Filtry zadań w rozwiniętym drawerze
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter || 'all';
        this.renderTasks();
      });
    });

    // Czyszczenie ukończonych
    if (btnClearCompleted) {
      btnClearCompleted.addEventListener('click', () => {
        const tasks = storage.getTasks();
        const remaining = tasks.filter(t => !t.completed);
        localStorage.setItem('pingpong_warehouse_tasks_v1', JSON.stringify(remaining));
        this.renderTasks();
        this.showToast('Wyczyszczono ukończone zadania', 'info');
      });
    }

    // Eksport zadań
    if (btnExportTasks) {
      btnExportTasks.addEventListener('click', () => {
        this.exportTasksToClipboard();
      });
    }
  }

  // Renderowanie listy zadań w dolnym panelu
  renderTasks() {
    const tasks = storage.getTasks();
    const activeTasks = tasks.filter(t => !t.completed);

    // Aktualizacja liczników w odznakach
    this.taskCountBadges.forEach(badge => {
      badge.textContent = activeTasks.length.toString();
      badge.classList.toggle('has-tasks', activeTasks.length > 0);
    });

    const activeCountEl = document.getElementById('drawerActiveCount');
    if (activeCountEl) {
      activeCountEl.textContent = `${activeTasks.length} do zrobienia`;
    }

    // Filtrowanie
    let filteredTasks = tasks;
    if (this.currentFilter === 'active') {
      filteredTasks = tasks.filter(t => !t.completed);
    } else if (this.currentFilter === 'completed') {
      filteredTasks = tasks.filter(t => t.completed);
    }

    if (!this.drawerListEl) return;

    if (filteredTasks.length === 0) {
      this.drawerListEl.innerHTML = `
        <div class="empty-tasks-placeholder">
          <div class="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
            </svg>
          </div>
          <div class="empty-text">Brak zadań w tej kategorii.</div>
          <div class="empty-subtext">Wykonaj gest na bębnie powyżej, aby dodać pierwsze zadanie.</div>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    filteredTasks.forEach(task => {
      const card = document.createElement('div');
      card.className = `task-card ${task.completed ? 'task-completed' : ''}`;
      card.dataset.id = task.id;

      const timeStr = this.formatTime(task.timestamp);

      // Budowanie czytelnego łańcucha
      const coText = task.co || '(brak towaru)';
      const skadText = task.skad ? `➔ <b>${this.escape(task.skad)}</b>` : '';
      const dokadText = task.dokad ? `➔ <b>${this.escape(task.dokad)}</b>` : '';
      const ileText = task.ile ? `<span class="task-qty-badge">x${this.escape(task.ile)}</span>` : '';

      card.innerHTML = `
        <button type="button" class="task-check-btn" title="Oznacz jako wykonane" aria-label="Zmień status zadania">
          <svg class="check-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
        <div class="task-info">
          <div class="task-title-line">
            <span class="task-co-name">${this.escape(coText)}</span>
            ${ileText}
          </div>
          <div class="task-route-line">
            ${skadText} ${dokadText}
          </div>
          <div class="task-meta-line">
            <span class="task-time">${timeStr}</span>
          </div>
        </div>
        <button type="button" class="task-delete-btn" title="Usuń zadanie" aria-label="Usuń zadanie">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
          </svg>
        </button>
      `;

      // Obsługa kliknięcia "zrobione"
      const checkBtn = card.querySelector('.task-check-btn');
      checkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const updated = storage.toggleTaskCompleted(task.id);
        if (updated) {
          card.classList.toggle('task-completed', updated.completed);
          feedback.tick(false);
          this.renderTasks();
          if (updated.completed) {
            this.showToast('Zadanie ukończone', 'success');
          }
        }
      });

      // Obsługa kliknięcia "usuń"
      const deleteBtn = card.querySelector('.task-delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        storage.deleteTask(task.id);
        feedback.vibrate(15);
        this.renderTasks();
        this.showToast('Usunięto zadanie', 'info');
      });

      fragment.appendChild(card);
    });

    this.drawerListEl.replaceChildren(fragment);
  }

  // Obsługa Modali (<dialog> z light-dismiss oraz fallback)
  initModals() {
    const btnOpenSettings = document.getElementById('btnOpenSettings');
    const btnCloseDb = document.getElementById('btnCloseDb');
    const btnCloseDbFooter = document.getElementById('btnCloseDbFooter');
    const btnOpenInfo = document.getElementById('btnOpenInfo');
    const btnCloseInfo = document.getElementById('btnCloseInfo');

    const openDialog = (dialog) => {
      if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal();
      }
    };

    const closeDialog = (dialog) => {
      if (dialog && typeof dialog.close === 'function') {
        dialog.close();
      }
    };

    if (btnOpenSettings) {
      btnOpenSettings.addEventListener('click', () => {
        this.loadDbToInputs();
        this.loadCategorySelectOptions();
        openDialog(this.dbModal);
      });
    }

    if (btnCloseDb) {
      btnCloseDb.addEventListener('click', () => closeDialog(this.dbModal));
    }

    if (btnCloseDbFooter) {
      btnCloseDbFooter.addEventListener('click', () => closeDialog(this.dbModal));
    }

    if (btnOpenInfo) {
      btnOpenInfo.addEventListener('click', () => openDialog(this.infoModal));
    }

    if (btnCloseInfo) {
      btnCloseInfo.addEventListener('click', () => closeDialog(this.infoModal));
    }

    // Standardowy fallback dla przeglądarek bez natywnego <dialog closedby="any">
    [this.dbModal, this.infoModal].forEach(dialog => {
      if (!dialog) return;
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        dialog.addEventListener('click', (event) => {
          if (event.target !== dialog) return;
          const rect = dialog.getBoundingClientRect();
          const isDialogContent = (
            rect.top <= event.clientY &&
            event.clientY <= rect.top + rect.height &&
            rect.left <= event.clientX &&
            event.clientX <= rect.left + rect.width
          );
          if (isDialogContent) return;
          dialog.close();
        });
      }
    });

    // Przełączniki dźwięku i wibracji
    const toggleSound = document.getElementById('toggleSound');
    const toggleVibration = document.getElementById('toggleVibration');
    const settings = storage.getSettings();

    if (toggleSound) {
      toggleSound.checked = !!settings.sound;
      toggleSound.addEventListener('change', () => {
        settings.sound = toggleSound.checked;
        storage.saveSettings(settings);
      });
    }

    if (toggleVibration) {
      toggleVibration.checked = !!settings.vibration;
      toggleVibration.addEventListener('change', () => {
        settings.vibration = toggleVibration.checked;
        storage.saveSettings(settings);
      });
    }
  }

  // Wypełnienie listy wyboru kategorii w formularzu dodawania (bez emoji)
  loadCategorySelectOptions(preferredSelected = null) {
    const select = document.getElementById('selectItemCategory');
    if (!select) return;

    const categories = storage.getCategories(true);
    // Odfiltruj "Wszystkie" do wyboru konkretnej kategorii
    const validCats = categories.filter(c => c.id !== 'all' && !c.name.includes('Wszystkie'));

    let html = validCats.map(c => `
      <option value="${this.escape(c.name)}" ${preferredSelected === c.name ? 'selected' : ''}>
        ${this.escape(c.name)} (${c.count})
      </option>
    `).join('');

    html += `<option value="__new__" ${preferredSelected === '__new__' ? 'selected' : ''}>+ Utwórz nową kategorię...</option>`;
    select.innerHTML = html;
  }

  // Edytor bazy danych w modalu
  initDbEditor() {
    // 1. Szybkie dodawanie towaru z kategorią
    const formAddNewItem = document.getElementById('formAddNewItem');
    const btnSubmitNewItem = document.getElementById('btnSubmitNewItem');
    const inputNewItemName = document.getElementById('inputNewItemName');
    const selectItemCategory = document.getElementById('selectItemCategory');
    const newCatFields = document.getElementById('newCatFields');
    const inputNewCatName = document.getElementById('inputNewCatName');

    if (selectItemCategory) {
      selectItemCategory.addEventListener('change', () => {
        if (selectItemCategory.value === '__new__') {
          if (newCatFields) newCatFields.style.display = 'block';
          if (inputNewCatName) inputNewCatName.focus();
        } else {
          if (newCatFields) newCatFields.style.display = 'none';
        }
      });
    }

    const handleAddItem = (e) => {
      if (e) e.preventDefault();
      const itemName = (inputNewItemName?.value || '').trim();
      if (!itemName) {
        this.showToast('Wpisz nazwę towaru!', 'error');
        if (inputNewItemName) inputNewItemName.focus();
        return;
      }

      let categoryName = selectItemCategory?.value || '';

      if (categoryName === '__new__') {
        const customCatName = (inputNewCatName?.value || '').trim();
        if (!customCatName) {
          this.showToast('Wpisz nazwę nowej kategorii!', 'error');
          if (inputNewCatName) inputNewCatName.focus();
          return;
        }
        const created = storage.addCustomCategory(customCatName);
        categoryName = created ? created.name : customCatName;
      }

      storage.addItem(itemName, categoryName);

      if (inputNewItemName) inputNewItemName.value = '';
      if (inputNewCatName) inputNewCatName.value = '';
      if (newCatFields) newCatFields.style.display = 'none';

      this.loadCategorySelectOptions(categoryName);
      this.renderCategoryFilterOptions();
      this.renderItemsList();
      this.loadDbToInputs();

      if (this.gestureEngine) {
        this.gestureEngine.refreshData();
        this.gestureEngine.resetToStep1();
      }

      this.showToast(`Dodano towar: "${itemName}" [${categoryName}]`, 'success');
    };

    if (formAddNewItem) {
      formAddNewItem.addEventListener('submit', handleAddItem);
    }
    if (btnSubmitNewItem) {
      btnSubmitNewItem.addEventListener('click', handleAddItem);
    }

    // 2. Szybkie dodawanie nowej lokalizacji
    const formAddNewLocation = document.getElementById('formAddNewLocation');
    const btnSubmitNewLocation = document.getElementById('btnSubmitNewLocation');
    const inputNewLocation = document.getElementById('inputNewLocation');

    const handleAddLocation = (e) => {
      if (e) e.preventDefault();
      const locName = (inputNewLocation?.value || '').trim();
      if (!locName) {
        this.showToast('Wpisz nazwę lokalizacji!', 'error');
        if (inputNewLocation) inputNewLocation.focus();
        return;
      }

      storage.addLocation(locName);
      if (inputNewLocation) inputNewLocation.value = '';
      this.loadDbToInputs();

      if (this.gestureEngine) {
        this.gestureEngine.refreshData();
        this.gestureEngine.resetToStep1();
      }

      this.showToast(`Dodano lokalizację: "${locName}"`, 'success');
    };

    if (formAddNewLocation) {
      formAddNewLocation.addEventListener('submit', handleAddLocation);
    }
    if (btnSubmitNewLocation) {
      btnSubmitNewLocation.addEventListener('click', handleAddLocation);
    }

    // 3. Hurtowy zapis z pól tekstowych
    const btnSaveDb = document.getElementById('btnSaveDb');
    const btnResetDbDefaults = document.getElementById('btnResetDbDefaults');
    const btnResetStats = document.getElementById('btnResetStats');

    if (btnSaveDb) {
      btnSaveDb.addEventListener('click', () => {
        const coVal = document.getElementById('textareaCo').value;
        const lokVal = document.getElementById('textareaLokalizacje').value;
        const ileVal = document.getElementById('textareaIle').value;

        const parseLines = (text) =>
          text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const parsedLokalizacje = parseLines(lokVal);
        const parsedCoLines = parseLines(coVal);

        // Opcjonalne wyciąganie kategorii z formatu "[Kategoria] Towar"
        const cleanedCo = [];
        parsedCoLines.forEach(line => {
          const bracketMatch = line.match(/^\[(.*?)\]\s*(.*)$/);
          if (bracketMatch) {
            const cat = bracketMatch[1].trim();
            const item = bracketMatch[2].trim();
            if (cat && item) {
              storage.addCustomCategory(cat);
              storage.setItemCategory(item, cat);
              cleanedCo.push(item);
              return;
            }
          }
          cleanedCo.push(line);
        });

        const newDb = {
          co: cleanedCo,
          lokalizacje: parsedLokalizacje,
          skad: parsedLokalizacje,
          dokad: parsedLokalizacje,
          ile: parseLines(ileVal)
        };

        if (newDb.co.length === 0) {
          alert('Lista CO musi zawierać co najmniej jedną pozycję!');
          return;
        }

        if (newDb.lokalizacje.length === 0) {
          alert('Lista LOKALIZACJE musi zawierać co najmniej jedną pozycję!');
          return;
        }

        storage.saveDatabase(newDb);
        this.loadCategorySelectOptions();
        this.renderCategoryFilterOptions();
        this.renderItemsList();

        if (this.gestureEngine) {
          this.gestureEngine.refreshData();
          this.gestureEngine.resetToStep1();
        }

        this.dbModal.close();
        this.showToast('Baza danych została zaktualizowana!', 'success');
      });
    }

    if (btnResetDbDefaults) {
      btnResetDbDefaults.addEventListener('click', () => {
        if (confirm('Czy na pewno chcesz przywrócić fabryczną bazę magazynową (ponad 70 towarów)?')) {
          storage.resetDatabaseToDefault();
          this.loadDbToInputs();
          this.loadCategorySelectOptions();
          this.renderCategoryFilterOptions();
          this.renderItemsList();

          if (this.gestureEngine) {
            this.gestureEngine.refreshData();
            this.gestureEngine.resetToStep1();
          }
          this.showToast('Przywrócono bazę fabryczną!', 'info');
        }
      });
    }

    if (btnResetStats) {
      btnResetStats.addEventListener('click', () => {
        if (confirm('Czy zresetować statystyki i wyczyścić czołówkę TOP?')) {
          storage.resetStats();
          this.loadTopStatsView();
          if (this.gestureEngine) {
            this.gestureEngine.refreshData();
            this.gestureEngine.resetToStep1();
          }
          this.showToast('Zresetowano statystyki TOP', 'info');
        }
      });
    }
  }

  // Menedżer istniejących towarów - nadawanie i zmiana kategorii
  initItemsManager() {
    this.dbItemsList = document.getElementById('dbItemsList');
    this.inputSearchItems = document.getElementById('inputSearchItems');
    this.filterItemsByCategory = document.getElementById('filterItemsByCategory');
    this.dbItemsCountBadge = document.getElementById('dbItemsCountBadge');

    if (this.inputSearchItems) {
      this.inputSearchItems.addEventListener('input', () => this.renderItemsList());
    }

    if (this.filterItemsByCategory) {
      this.filterItemsByCategory.addEventListener('change', () => this.renderItemsList());
    }

    if (this.dbItemsList) {
      // Zmiana kategorii dla wybranego towaru
      this.dbItemsList.addEventListener('change', (e) => {
        const select = e.target.closest('.item-category-select');
        if (!select) return;

        const itemName = select.dataset.item;
        let newCategory = select.value;

        if (newCategory === '__new__') {
          const customName = prompt('Podaj nazwę nowej kategorii dla tego towaru:');
          if (customName && customName.trim()) {
            const created = storage.addCustomCategory(customName.trim());
            newCategory = created ? created.name : customName.trim();
          } else {
            this.renderItemsList();
            return;
          }
        }

        storage.setItemCategory(itemName, newCategory);
        this.loadCategorySelectOptions();
        this.renderCategoryFilterOptions();
        this.renderItemsList();
        this.loadDbToInputs();

        if (this.gestureEngine) {
          this.gestureEngine.refreshData();
          this.gestureEngine.resetToStep1();
        }

        this.showToast(`Zmieniono kategorię: "${itemName}" ➔ ${newCategory}`, 'success');
      });

      // Usuwanie i zmiana nazwy towaru
      this.dbItemsList.addEventListener('click', (e) => {
        const delBtn = e.target.closest('.btn-item-delete');
        if (delBtn) {
          const itemName = delBtn.dataset.item;
          if (confirm(`Czy na pewno chcesz usunąć towar "${itemName}" z bazy?`)) {
            storage.deleteItem(itemName);
            this.loadCategorySelectOptions();
            this.renderCategoryFilterOptions();
            this.renderItemsList();
            this.loadDbToInputs();

            if (this.gestureEngine) {
              this.gestureEngine.refreshData();
              this.gestureEngine.resetToStep1();
            }

            this.showToast(`Usunięto towar: "${itemName}"`, 'info');
          }
          return;
        }

        const renameBtn = e.target.closest('.btn-item-rename');
        if (renameBtn) {
          const itemName = renameBtn.dataset.item;
          const newName = prompt('Zmień nazwę towaru:', itemName);
          if (newName && newName.trim() && newName.trim() !== itemName) {
            storage.updateItemName(itemName, newName.trim());
            this.renderItemsList();
            this.loadDbToInputs();

            if (this.gestureEngine) {
              this.gestureEngine.refreshData();
              this.gestureEngine.resetToStep1();
            }

            this.showToast(`Zaktualizowano nazwę: "${newName.trim()}"`, 'success');
          }
        }
      });
    }
  }

  renderCategoryFilterOptions() {
    if (!this.filterItemsByCategory) return;
    const currentVal = this.filterItemsByCategory.value || 'all';
    const categories = storage.getCategories(true);
    const validCats = categories.filter(c => c.id !== 'all' && !c.name.includes('Wszystkie'));

    let html = `<option value="all">Wszystkie kategorie</option>`;
    html += validCats.map(c => `
      <option value="${this.escape(c.name)}" ${currentVal === c.name ? 'selected' : ''}>
        ${this.escape(c.name)} (${c.count})
      </option>
    `).join('');

    this.filterItemsByCategory.innerHTML = html;
  }

  renderItemsList() {
    if (!this.dbItemsList) return;

    const db = storage.getDatabase();
    const allItems = Array.isArray(db.co) ? db.co : [];
    const query = (this.inputSearchItems?.value || '').toLowerCase().trim();
    const filterCat = this.filterItemsByCategory?.value || 'all';

    const categories = storage.getCategories(true).filter(c => c.id !== 'all' && !c.name.includes('Wszystkie'));

    const filtered = allItems.filter(item => {
      const itemCat = storage.getItemCategory(item);
      if (filterCat !== 'all' && itemCat !== filterCat) {
        return false;
      }
      if (query && !item.toLowerCase().includes(query) && !itemCat.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });

    if (this.dbItemsCountBadge) {
      this.dbItemsCountBadge.textContent = `${filtered.length} z ${allItems.length} pozycji`;
    }

    if (filtered.length === 0) {
      this.dbItemsList.innerHTML = `<div class="empty-item-manager">Brak towarów spełniających kryteria.</div>`;
      return;
    }

    const html = filtered.map(item => {
      const itemCat = storage.getItemCategory(item);
      return `
        <div class="db-item-row" data-item="${this.escape(item)}">
          <span class="db-item-name" title="${this.escape(item)}">${this.escape(item)}</span>
          <select class="db-select item-category-select" data-item="${this.escape(item)}" title="Zmień kategorię dla tego towaru">
            ${categories.map(c => `
              <option value="${this.escape(c.name)}" ${itemCat === c.name ? 'selected' : ''}>
                ${this.escape(c.name)}
              </option>
            `).join('')}
            <option value="__new__">+ Nowa kategoria...</option>
          </select>
          <div class="item-actions">
            <button type="button" class="btn-item-action btn-item-rename" data-item="${this.escape(item)}" title="Zmień nazwę towaru" aria-label="Zmień nazwę towaru">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button type="button" class="btn-item-action btn-item-delete" data-item="${this.escape(item)}" title="Usuń towar z bazy" aria-label="Usuń towar z bazy">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.dbItemsList.innerHTML = html;
  }

  loadDbToInputs() {
    const db = storage.getDatabase();
    const textareaCo = document.getElementById('textareaCo');
    const textareaLokalizacje = document.getElementById('textareaLokalizacje');
    const textareaIle = document.getElementById('textareaIle');

    if (textareaCo) textareaCo.value = (db.co || []).join('\n');
    if (textareaLokalizacje) {
      const locs = db.lokalizacje || db.skad || [];
      textareaLokalizacje.value = locs.join('\n');
    }
    if (textareaIle) textareaIle.value = (db.ile || []).join('\n');

    this.renderCategoryFilterOptions();
    this.renderItemsList();
    this.loadTopStatsView();
  }

  loadTopStatsView() {
    const statsContainer = document.getElementById('topStatsList');
    if (!statsContainer) return;

    const stats = storage.getStats();
    const entries = Object.entries(stats)
      .filter(([name, count]) => !name.startsWith('_') && typeof count === 'number' && count > 0)
      .sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      statsContainer.innerHTML = '<span class="empty-stats">Brak zarejestrowanych wyborów.</span>';
      return;
    }

    const html = entries.slice(0, 6).map(([name, count], idx) => `
      <div class="top-stat-pill">
        <span class="stat-rank">#${idx + 1}</span>
        <span class="stat-name">${this.escape(name)}</span>
        <span class="stat-count">${count}x</span>
      </div>
    `).join('');

    statsContainer.innerHTML = html;
  }

  // Eksport listy do schowka
  exportTasksToClipboard() {
    const tasks = storage.getTasks();
    if (tasks.length === 0) {
      this.showToast('Brak zadań do wyeksportowania', 'info');
      return;
    }

    const lines = [
      'STATUS;DATA;TOWAR;SKĄD;DOKĄD;ILOŚĆ',
      ...tasks.map(t => {
        const status = t.completed ? 'WYKONANE' : 'DO ZROBIENIA';
        const date = new Date(t.timestamp).toLocaleString('pl-PL');
        return `"${status}";"${date}";"${t.co || ''}";"${t.skad || ''}";"${t.dokad || ''}";"${t.ile || ''}"`;
      })
    ];

    const csvContent = lines.join('\n');
    navigator.clipboard.writeText(csvContent)
      .then(() => this.showToast('Skopiowano zadania (CSV) do schowka!', 'success'))
      .catch(() => this.showToast('Nie udało się skopiować do schowka', 'error'));
  }

  // Wyświetlanie powiadomień Toast
  showToast(message, type = 'info') {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  formatTime(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const diffMin = Math.floor((now - timestamp) / 60000);

    if (diffMin < 1) return 'przed chwilą';
    if (diffMin < 60) return `${diffMin} min temu`;

    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  escape(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
