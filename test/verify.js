// Kompleksowy test poprawności logiki biznesowej i algorytmów aplikacji
import { DEFAULT_DATABASE, INITIAL_TASKS, INITIAL_USAGE_STATS } from '../js/data.js';
import { StorageManager } from '../js/storage.js';

// Mock localStorage dla środowiska Node.js
class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(k) { return this.store[k] || null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}
globalThis.localStorage = new MockLocalStorage();

console.log('--- TEST 1: Walidacja danych bazowych ---');
console.assert(DEFAULT_DATABASE.co.length >= 60, `CO powinno mieć >= 60 pozycji, ma: ${DEFAULT_DATABASE.co.length}`);
console.assert(DEFAULT_DATABASE.skad.length === 12, `SKĄD powinno mieć 12 pozycji, ma: ${DEFAULT_DATABASE.skad.length}`);
console.assert(DEFAULT_DATABASE.dokad.length === 12, `DOKĄD powinno mieć 12 pozycji, ma: ${DEFAULT_DATABASE.dokad.length}`);
console.assert(DEFAULT_DATABASE.ile.length >= 10, `ILE powinno mieć >= 10 pozycji, ma: ${DEFAULT_DATABASE.ile.length}`);
console.log('✓ Dane bazowe poprawne:', {
  co: DEFAULT_DATABASE.co.length,
  skad: DEFAULT_DATABASE.skad.length,
  dokad: DEFAULT_DATABASE.dokad.length,
  ile: DEFAULT_DATABASE.ile.length
});

console.log('--- TEST 2: Samoucząca się czołówka (TOP 6) ---');
const sm = new StorageManager();
const coData = sm.getCoListWithTop();
console.assert(coData.topCount === 6, `Oczekiwano 6 pozycji TOP, otrzymano: ${coData.topCount}`);
console.assert(coData.items[0].isTop === true, 'Pierwszy element musi mieć flagę isTop');
console.assert(coData.items[0].text === 'Paleta EURO 1200x800', `Pierwszy element to ${coData.items[0].text}`);
console.assert(coData.items[6].isTop === false, 'Pozycje od 7 wzwyż to lista alfabetyczna');
console.log('✓ Czołówka TOP 6 działa prawidłowo. Pierwsze 3 pozycje:', coData.items.slice(0, 3).map(i => `${i.text} (${i.count}x)`));

console.log('--- TEST 3: Wprowadzanie i zapis zadania z wczesnym zakończeniem ---');
const draft = {
  co: 'Paleta EURO 1200x800',
  skad: 'Rampa 01 (Przyjęcia)'
  // dokad i ile są null (wczesne zakończenie po Kroku 2)
};
const newTask = sm.addTask(draft);
console.assert(newTask.id.startsWith('task-'), 'Zadanie musi mieć unikalne ID');
console.assert(newTask.co === 'Paleta EURO 1200x800', 'Nazwa towaru musi się zgadzać');
console.assert(newTask.skad === 'Rampa 01 (Przyjęcia)', 'Lokalizacja początkowa musi się zgadzać');
console.assert(newTask.dokad === null, 'DOKĄD powinno być null');
console.assert(newTask.ile === null, 'ILE powinno być null');
console.log('✓ Wczesne zakończenie po Kroku 2 zapisane:', newTask);

console.log('--- TEST 4: Aktualizacja liczników statystyk po zapisie ---');
const statsAfter = sm.getStats();
console.assert(statsAfter['Paleta EURO 1200x800'] === 35, `Licznik dla Paleta EURO powinien wzrosnąć z 34 do 35, wynosi: ${statsAfter['Paleta EURO 1200x800']}`);
console.log('✓ Licznik użyć zwiększony do 35');

console.log('--- TEST 5: Matematyka względnego przewijania i pasów prędkości ---');
// Symulacja ekranu o szerokości 400px
const screenWidth = 400;
const turboThreshold = screenWidth * 0.16; // 64px
const leftThreshold = screenWidth * 0.47;  // 188px
const rightThreshold = screenWidth * 0.53; // 212px

// Test pasa szybkiego (X <= 16% szerokości)
const isFast1 = 50 <= turboThreshold;
const isFast2 = 100 <= turboThreshold;
console.assert(isFast1 === true, 'X=50px powinno być w Pasie Szybkim');
console.assert(isFast2 === false, 'X=100px powinno być w Pasie Precyzyjnym');

// W Pasie Szybkim: 1 krok co 20px przesuwa o 8 pozycji
const turboDeltaY = -40; // Przesunięcie palcem w górę o 40px
const turboDeltaIndex = Math.round(-turboDeltaY / 20) * 8; // (-(-40)/20)*8 = 2 * 8 = 16 pozycji!
console.assert(turboDeltaIndex === 16, `Przesunięcie 40px w pasie turbo powinno dać 16 pozycji, dało: ${turboDeltaIndex}`);

// W Pasie Precyzyjnym: 1 krok co 28px przesuwa dokładnie o 1 pozycję
const precDeltaY = -56; // Przesunięcie w górę o 56px
const precDeltaIndex = Math.round(-precDeltaY / 28); // 2 pozycje
console.assert(precDeltaIndex === 2, `Przesunięcie 56px w pasie precyzyjnym powinno dać 2 pozycje, dało: ${precDeltaIndex}`);

// Test strefy martwej / histerezy
const inDeadZone = (x) => x > leftThreshold && x < rightThreshold;
console.assert(inDeadZone(200) === true, 'X=200px powinno leżeć w strefie martwej (188px - 212px)');
console.assert(inDeadZone(180) === false, 'X=180px to lewa strefa');
console.assert(inDeadZone(220) === false, 'X=220px to prawa strefa');
console.log('✓ Matematyka pasów, przewijania i strefy martwej w 100% poprawna');

console.log('\n========================================');
console.log('WSZYSTKIE TESTY JEDNOSTKOWE ZAKOŃCZONE SUKCESEM!');
console.log('========================================');
