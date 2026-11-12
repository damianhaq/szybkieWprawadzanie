// Zarządzanie stanem i trwałością w localStorage
import {
  DEFAULT_DATABASE,
  INITIAL_TASKS,
  INITIAL_USAGE_STATS,
  CATEGORY_DEFINITIONS,
  getCategoryForItem
} from './data.js';

const STORAGE_KEYS = {
  DB: 'pingpong_warehouse_db_v1',
  TASKS: 'pingpong_warehouse_tasks_v1',
  STATS: 'pingpong_warehouse_stats_v1',
  SETTINGS: 'pingpong_warehouse_settings_v1',
  CUSTOM_CATEGORIES: 'pingpong_warehouse_custom_categories_v1',
  ITEM_CATEGORIES: 'pingpong_warehouse_item_categories_v1'
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

  // Baza pozycji (CO, LOKALIZACJE, ILE)
  getDatabase() {
    try {
      const data = getStorage().getItem(STORAGE_KEYS.DB);
      let parsed = data ? JSON.parse(data) : { ...DEFAULT_DATABASE };

      // Automatyczna migracja: jeśli w localStorage były osobne skad/dokad, zunifikuj do lokalizacje
      if (!parsed.lokalizacje || !Array.isArray(parsed.lokalizacje)) {
        const merged = Array.from(new Set([
          ...(parsed.skad || []),
          ...(parsed.dokad || []),
          ...(DEFAULT_DATABASE.lokalizacje || [])
        ])).sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));
        parsed.lokalizacje = merged;
        delete parsed.skad;
        delete parsed.dokad;
        this.saveDatabase(parsed);
      }

      // Kompatybilność wsteczna
      if (!parsed.skad) parsed.skad = parsed.lokalizacje;
      if (!parsed.dokad) parsed.dokad = parsed.lokalizacje;

      return parsed;
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
    getStorage().removeItem(STORAGE_KEYS.CUSTOM_CATEGORIES);
    getStorage().removeItem(STORAGE_KEYS.ITEM_CATEGORIES);
    return { ...DEFAULT_DATABASE };
  }

  // Własne kategorie użytkownika
  getCustomCategories() {
    try {
      const data = getStorage().getItem(STORAGE_KEYS.CUSTOM_CATEGORIES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Błąd odczytu własnych kategorii:', e);
      return [];
    }
  }

  saveCustomCategories(cats) {
    try {
      getStorage().setItem(STORAGE_KEYS.CUSTOM_CATEGORIES, JSON.stringify(cats));
    } catch (e) {
      console.error('Błąd zapisu własnych kategorii:', e);
    }
  }

  addCustomCategory(name, icon = '🏷️') {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;

    // Sprawdź czy kategoria o takiej nazwie już istnieje w definicjach wbudowanych
    const builtIn = CATEGORY_DEFINITIONS.find(
      c => c.name.toLowerCase() === trimmed.toLowerCase() || c.id === trimmed.toLowerCase()
    );
    if (builtIn) return builtIn;

    const customCats = this.getCustomCategories();
    const existing = customCats.find(
      c => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return existing;

    const cleanIcon = (icon || '🏷️').trim() || '🏷️';
    const newCat = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      icon: cleanIcon
    };
    customCats.push(newCat);
    this.saveCustomCategories(customCats);
    return newCat;
  }

  getItemCategories() {
    try {
      const data = getStorage().getItem(STORAGE_KEYS.ITEM_CATEGORIES);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Błąd odczytu mapowania kategorii:', e);
      return {};
    }
  }

  setItemCategory(itemName, categoryName) {
    const trimmedItem = (itemName || '').trim();
    const trimmedCat = (categoryName || '').trim();
    if (!trimmedItem || !trimmedCat) return;

    const map = this.getItemCategories();
    map[trimmedItem] = trimmedCat;
    try {
      getStorage().setItem(STORAGE_KEYS.ITEM_CATEGORIES, JSON.stringify(map));
    } catch (e) {
      console.error('Błąd zapisu mapowania kategorii:', e);
    }
  }

  getItemCategory(itemText) {
    if (!itemText || typeof itemText !== 'string') return 'Inne towary';
    const trimmed = itemText.trim();
    const map = this.getItemCategories();
    if (map[trimmed]) return map[trimmed];

    // Opcjonalna obsługa formatu "[Kategoria] Towar"
    const bracketMatch = trimmed.match(/^\[(.*?)\]\s*(.*)$/);
    if (bracketMatch) {
      return bracketMatch[1].trim();
    }

    return getCategoryForItem(trimmed);
  }

  // Dodawanie nowego towaru z opcjonalną kategorią
  addItem(itemName, categoryName = null) {
    const trimmed = (itemName || '').trim();
    if (!trimmed) return false;

    const db = this.getDatabase();
    if (!Array.isArray(db.co)) db.co = [];

    // Dodaj towar jeśli jeszcze go nie ma na liście
    if (!db.co.includes(trimmed)) {
      db.co.unshift(trimmed);
      this.saveDatabase(db);
    }

    if (categoryName) {
      this.addCustomCategory(categoryName);
      this.setItemCategory(trimmed, categoryName);
    }

    return true;
  }

  // Dodawanie nowej lokalizacji (wspólnej dla SKĄD i DOKĄD)
  addLocation(locationName) {
    const trimmed = (locationName || '').trim();
    if (!trimmed) return false;

    const db = this.getDatabase();
    if (!Array.isArray(db.lokalizacje)) db.lokalizacje = [];

    if (!db.lokalizacje.includes(trimmed)) {
      db.lokalizacje.unshift(trimmed);
      this.saveDatabase(db);
    }

    return true;
  }

  // Statystyki użycia pozycji (dla każdego etapu)
  getStats() {
    try {
      const data = getStorage().getItem(STORAGE_KEYS.STATS);
      return data ? JSON.parse(data) : { ...INITIAL_USAGE_STATS };
    } catch (e) {
      console.error('Błąd odczytu statystyk:', e);
      return {};
    }
  }

  recordUsage(stageOrItem, maybeItem) {
    let stage = 'co';
    let item = stageOrItem;
    if (maybeItem !== undefined) {
      stage = stageOrItem;
      item = maybeItem;
    }
    if (!item) return;

    const stats = this.getStats();
    if (stage === 'co') {
      stats[item] = (stats[item] || 0) + 1;
    } else {
      const key = `_${stage}`;
      if (!stats[key]) stats[key] = {};
      stats[key][item] = (stats[key][item] || 0) + 1;
    }

    try {
      getStorage().setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    } catch (e) {
      console.error('Błąd zapisu statystyk:', e);
    }
  }

  resetStats() {
    getStorage().setItem(STORAGE_KEYS.STATS, JSON.stringify({}));
  }

  // Uniwersalne budowanie listy z czołówką TOP dla dowolnego etapu
  getListWithTop(rawItems, stage = 'co', topLimit = 4) {
    const stats = this.getStats();
    const list = Array.isArray(rawItems) ? [...rawItems] : [];

    let stageStats = {};
    if (stage === 'co') {
      stageStats = stats;
    } else {
      stageStats = stats[`_${stage}`] || {};
    }

    // Wyłonienie pozycji TOP z najwyższymi licznikami użycia
    const ranked = Object.entries(stageStats)
      .filter(([name, count]) => typeof count === 'number' && count > 0 && list.includes(name))
      .sort((a, b) => b[1] - a[1])
      .slice(0, topLimit)
      .map(([name, count]) => ({
        text: name,
        isTop: true,
        count: count
      }));

    // Fallback: jeśli brak statystyk dla danego etapu, bierzemy pierwsze z listy
    const topItems = ranked.length > 0
      ? ranked
      : list.slice(0, Math.min(topLimit, list.length)).map(name => ({
          text: name,
          isTop: true,
          count: 1
        }));

    const regularItems = list.map(name => ({
      text: name,
      isTop: false,
      count: typeof stageStats[name] === 'number' ? stageStats[name] : 0
    }));

    return {
      topCount: topItems.length,
      items: [...topItems, ...regularItems]
    };
  }

  // Pobranie listy kategorii dla Kroku 1 (wbudowane + własne)
  getCategories(includeEmpty = false) {
    const db = this.getDatabase();
    const coList = Array.isArray(db.co) ? db.co : [];

    const counts = {};
    for (const item of coList) {
      const cat = this.getItemCategory(item);
      counts[cat] = (counts[cat] || 0) + 1;
    }

    const categories = [
      { id: 'all', name: '⭐ Wszystkie (i TOP)', icon: '⭐', count: coList.length }
    ];

    const seenNames = new Set(['⭐ Wszystkie (i TOP)', 'Wszystkie (TOP)', 'Wszystkie', 'all']);

    // 1. Kategorie wbudowane
    for (const def of CATEGORY_DEFINITIONS) {
      if (def.id === 'all') continue;
      const count = counts[def.name] || 0;
      if (includeEmpty || count > 0) {
        categories.push({
          id: def.id,
          name: def.name,
          icon: def.icon,
          count: count
        });
        seenNames.add(def.name);
      }
    }

    // 2. Własne kategorie dodane przez użytkownika
    const customCats = this.getCustomCategories();
    for (const c of customCats) {
      if (seenNames.has(c.name)) continue;
      const count = counts[c.name] || 0;
      if (includeEmpty || count > 0) {
        categories.push({
          id: c.id,
          name: c.name,
          icon: c.icon || '🏷️',
          count: count
        });
        seenNames.add(c.name);
      }
    }

    // 3. Ewentualne kategorie wykryte z pozycji, a nieobecne na powyższych listach
    for (const [catName, count] of Object.entries(counts)) {
      if (!seenNames.has(catName) && count > 0) {
        categories.push({
          id: `cat_${catName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          name: catName,
          icon: '🏷️',
          count: count
        });
        seenNames.add(catName);
      }
    }

    return categories;
  }

  // Budowanie listy dla Kroku 1/2 (CO) z opcjonalnym filtrem kategorii
  getCoListWithTop(categoryName = null) {
    const db = this.getDatabase();
    let rawList = Array.isArray(db.co) ? [...db.co] : [];

    rawList.sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));

    if (categoryName && categoryName !== 'all' && categoryName !== 'Wszystkie' && categoryName !== '⭐ Wszystkie (i TOP)' && categoryName !== 'Wszystkie (TOP)') {
      rawList = rawList.filter(item => this.getItemCategory(item) === categoryName);
    }

    return this.getListWithTop(rawList, 'co', 6);
  }

  // Budowanie listy dla SKĄD z czołówką TOP
  getSkadListWithTop() {
    const db = this.getDatabase();
    let rawList = Array.isArray(db.lokalizacje) ? [...db.lokalizacje] : [];
    rawList.sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));
    return this.getListWithTop(rawList, 'skad', 4);
  }

  // Budowanie listy dla DOKĄD z czołówką TOP
  getDokadListWithTop() {
    const db = this.getDatabase();
    let rawList = Array.isArray(db.lokalizacje) ? [...db.lokalizacje] : [];
    rawList.sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));
    return this.getListWithTop(rawList, 'dokad', 4);
  }

  // Budowanie listy dla ILE z czołówką TOP
  getIleListWithTop() {
    const db = this.getDatabase();
    let rawList = Array.isArray(db.ile) ? [...db.ile] : [];
    return this.getListWithTop(rawList, 'ile', 4);
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

    // Zapisz statystykę dla każdego wypełnionego etapu (CO, SKĄD, DOKĄD, ILE)
    if (newTask.co) this.recordUsage('co', newTask.co);
    if (newTask.skad) this.recordUsage('skad', newTask.skad);
    if (newTask.dokad) this.recordUsage('dokad', newTask.dokad);
    if (newTask.ile) this.recordUsage('ile', newTask.ile);

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
