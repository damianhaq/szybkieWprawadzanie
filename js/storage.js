// Zarządzanie stanem i trwałością w localStorage
import { DEFAULT_DATABASE, INITIAL_TASKS, INITIAL_USAGE_STATS } from './data.js';

const STORAGE_KEYS = {
  DB: 'pingpong_warehouse_db_v1',
  TASKS: 'pingpong_warehouse_tasks_v1',
  STATS: 'pingpong_warehouse_stats_v1',
  SETTINGS: 'pingpong_warehouse_settings_v1'
};

// Bezpieczny dostęp do localStorage (także w środowiskach testowych/SSR)
const getStorage = () => {
  if (typeof localStorage !== 'undefined') return localStorage;
  if (!globalThis._mockStorage) {
    let s = {};
    globalThis._mockStorage = {
      getItem: k => s[k] || null,
      setItem: (k, v) => { s[k] = String(v); },
      removeItem: k => { delete s[k]; },
      clear: () => { s = {}; }
    };
  }
  return globalThis._mockStorage;
};

export class StorageManager {
  constructor() {
    this.init();
  }

  init() {
    const store = getStorage();
    if (!store.getItem(STORAGE_KEYS.DB)) {
      store.setItem(STORAGE_KEYS.DB, JSON.stringify(DEFAULT_DATABASE));
    }
    if (!store.getItem(STORAGE_KEYS.TASKS)) {
      store.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
    }
    if (!store.getItem(STORAGE_KEYS.STATS)) {
      store.setItem(STORAGE_KEYS.STATS, JSON.stringify(INITIAL_USAGE_STATS));
    }
    if (!store.getItem(STORAGE_KEYS.SETTINGS)) {
      store.setItem(
        STORAGE_KEYS.SETTINGS,
        JSON.stringify({ sound: true, vibration: true })
      );
    }
  }

  // Baza pozycji (CO, SKĄD, DOKĄD, ILE)
  getDatabase() {
    try {
      const data = getStorage().getItem(STORAGE_KEYS.DB);
      return data ? JSON.parse(data) : { ...DEFAULT_DATABASE };
    } catch (e) {
      console.error('Błąd odczytu bazy:', e);
      return { ...DEFAULT_DATABASE };
    }
  }

  saveDatabase(db) {
    try {
      getStorage().setItem(STORAGE_KEYS.DB, JSON.stringify(db));
    } catch (e) {
      console.error('Błąd zapisu bazy:', e);
    }
  }

  resetDatabaseToDefault() {
    getStorage().setItem(STORAGE_KEYS.DB, JSON.stringify(DEFAULT_DATABASE));
    return { ...DEFAULT_DATABASE };
  }

  // Statystyki użycia pozycji "CO"
  getStats() {
    try {
      const data = getStorage().getItem(STORAGE_KEYS.STATS);
      return data ? JSON.parse(data) : { ...INITIAL_USAGE_STATS };
    } catch (e) {
      console.error('Błąd odczytu statystyk:', e);
      return {};
    }
  }

  recordUsage(itemCo) {
    if (!itemCo) return;
    const stats = this.getStats();
    stats[itemCo] = (stats[itemCo] || 0) + 1;
    try {
      getStorage().setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    } catch (e) {
      console.error('Błąd zapisu statystyk:', e);
    }
  }

  resetStats() {
    getStorage().setItem(STORAGE_KEYS.STATS, JSON.stringify({}));
  }

  // Budowanie listy dla Kroku 1 (CO) z sekcją TOP 6 i listą alfabetyczną
  getCoListWithTop() {
    const db = this.getDatabase();
    const stats = this.getStats();
    const rawList = Array.isArray(db.co) ? [...db.co] : [];

    // Sortowanie alfabetyczne bazy podstawowej
    rawList.sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));

    // Obliczenie TOP 6 najczęściej używanych (z licznikami > 0)
    const ranked = Object.entries(stats)
      .filter(([name, count]) => count > 0 && rawList.includes(name))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({
        text: name,
        isTop: true,
        count: count
      }));

    // Jeśli brak statystyk, bierzemy pierwsze 3-6 z bazy jako fallback
    const topItems = ranked.length > 0 ? ranked : rawList.slice(0, 4).map(name => ({
      text: name,
      isTop: true,
      count: 1
    }));

    const alphabeticalItems = rawList.map(name => ({
      text: name,
      isTop: false,
      count: stats[name] || 0
    }));

    // Zwracamy spójną listę obiektów: najpierw TOP, potem reszta
    return {
      topCount: topItems.length,
      items: [...topItems, ...alphabeticalItems]
    };
  }

  // Zadania
  getTasks() {
    try {
      const data = getStorage().getItem(STORAGE_KEYS.TASKS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Błąd odczytu zadań:', e);
      return [];
    }
  }

  addTask(taskData) {
    const tasks = this.getTasks();
    const newTask = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      co: taskData.co || null,
      skad: taskData.skad || null,
      dokad: taskData.dokad || null,
      ile: taskData.ile || null,
      timestamp: Date.now(),
      completed: false
    };

    tasks.unshift(newTask); // Najnowsze na początku
    try {
      getStorage().setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.error('Błąd zapisu zadania:', e);
    }

    // Zapisz statystykę dla "CO"
    if (newTask.co) {
      this.recordUsage(newTask.co);
    }

    return newTask;
  }

  toggleTaskCompleted(taskId) {
    const tasks = this.getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      getStorage().setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
      return task;
    }
    return null;
  }

  deleteTask(taskId) {
    let tasks = this.getTasks();
    tasks = tasks.filter(t => t.id !== taskId);
    getStorage().setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    return tasks;
  }

  clearTasks() {
    getStorage().setItem(STORAGE_KEYS.TASKS, JSON.stringify([]));
  }

  // Ustawienia
  getSettings() {
    try {
      const data = getStorage().getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : { sound: true, vibration: true };
    } catch (e) {
      return { sound: true, vibration: true };
    }
  }

  saveSettings(settings) {
    try {
      getStorage().setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Błąd zapisu ustawień:', e);
    }
  }
}

export const storage = new StorageManager();
