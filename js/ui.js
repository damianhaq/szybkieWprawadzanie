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
          <div class="empty-icon">📦</div>
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
            this.showToast('Zadanie zrobione! ✔', 'success');
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
        openDialog(this.dbModal);
      });
    }

    if (btnCloseDb) {
      btnCloseDb.addEventListener('click', () => closeDialog(this.dbModal));
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

  // Edytor bazy danych w modalu
  initDbEditor() {
    const btnSaveDb = document.getElementById('btnSaveDb');
    const btnResetDbDefaults = document.getElementById('btnResetDbDefaults');
    const btnResetStats = document.getElementById('btnResetStats');

    if (btnSaveDb) {
      btnSaveDb.addEventListener('click', () => {
        const coVal = document.getElementById('textareaCo').value;
        const skadVal = document.getElementById('textareaSkad').value;
        const dokadVal = document.getElementById('textareaDokad').value;
        const ileVal = document.getElementById('textareaIle').value;

        const parseLines = (text) =>
          text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const newDb = {
          co: parseLines(coVal),
          skad: parseLines(skadVal),
          dokad: parseLines(dokadVal),
          ile: parseLines(ileVal)
        };

        if (newDb.co.length === 0) {
          alert('Lista CO musi zawierać co najmniej jedną pozycję!');
          return;
        }

        storage.saveDatabase(newDb);
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
        if (confirm('Czy na pewno chcesz przywrócić fabryczną bazę magazynową (ponad 60 towarów)?')) {
          storage.resetDatabaseToDefault();
          this.loadDbToInputs();
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
        if (confirm('Czy zresetować statystyki i wyczyścić czołówkę TOP 6?')) {
          storage.resetStats();
          this.loadTopStatsView();
          if (this.gestureEngine) {
            this.gestureEngine.refreshData();
            this.gestureEngine.resetToStep1();
          }
          this.showToast('Zresetowano statystyki TOP 6', 'info');
        }
      });
    }
  }

  loadDbToInputs() {
    const db = storage.getDatabase();
    const textareaCo = document.getElementById('textareaCo');
    const textareaSkad = document.getElementById('textareaSkad');
    const textareaDokad = document.getElementById('textareaDokad');
    const textareaIle = document.getElementById('textareaIle');

    if (textareaCo) textareaCo.value = (db.co || []).join('\n');
    if (textareaSkad) textareaSkad.value = (db.skad || []).join('\n');
    if (textareaDokad) textareaDokad.value = (db.dokad || []).join('\n');
    if (textareaIle) textareaIle.value = (db.ile || []).join('\n');

    this.loadTopStatsView();
  }

  loadTopStatsView() {
    const statsContainer = document.getElementById('topStatsList');
    if (!statsContainer) return;

    const stats = storage.getStats();
    const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);

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
