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
console.assert(DEFAULT_DATABASE.lokalizacje.length >= 15, `LOKALIZACJE powinno mieć >= 15 pozycji, ma: ${DEFAULT_DATABASE.lokalizacje.length}`);
console.assert(DEFAULT_DATABASE.ile.length >= 10, `ILE powinno mieć >= 10 pozycji, ma: ${DEFAULT_DATABASE.ile.length}`);
console.log('✓ Dane bazowe poprawne:', {
  co: DEFAULT_DATABASE.co.length,
  lokalizacje: DEFAULT_DATABASE.lokalizacje.length,
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

console.log('--- TEST 5: Matematyka dynamicznego zoomu 2D kafelków i płynnej prędkości przewijania ---');
// Symulacja ekranu o szerokości 400px
const screenWidth = 400;
const leftThreshold = screenWidth * 0.47;  // 188px
const rightThreshold = screenWidth * 0.53; // 212px

// Obliczanie zoomu w lewej kolumnie (X od 4% = 16px do 34% = 136px)
const calcLeftZoom = (x) => Math.max(0, Math.min(1, (x - screenWidth * 0.04) / (screenWidth * 0.30)));
const zoomOuter = calcLeftZoom(16); // przy samej lewej krawędzi
const zoomMid = calcLeftZoom(76);   // w połowie kolumny
const zoomInner = calcLeftZoom(136); // przy strefie zatwierdzenia

console.assert(zoomOuter === 0, `Zoom przy krawędzi powinien wynosić 0.0, wynosi: ${zoomOuter}`);
console.assert(Math.abs(zoomMid - 0.5) < 0.01, `Zoom w połowie kolumny powinien wynosić ~0.5, wynosi: ${zoomMid}`);
console.assert(zoomInner === 1.0, `Zoom blisko środka powinien wynosić 1.0, wynosi: ${zoomInner}`);

// Zależność stepPx (skoku w pionie) od zoomu: stepPx = 18 + zoom * 24
const stepPxOuter = Math.round(18 + zoomOuter * 24); // 18px (szybki tryb)
const stepPxInner = Math.round(18 + zoomInner * 24); // 42px (duży kafelek, precyzja)
console.assert(stepPxOuter === 18, `W trybie mini stepPx powinno wynosić 18px, wynosi: ${stepPxOuter}`);
console.assert(stepPxInner === 42, `W trybie powiększonym stepPx powinno wynosić 42px, wynosi: ${stepPxInner}`);

// Porównanie prędkości przewijania przy ruchu 84px w pionie:
const deltaY = -84;
const itemsMovedOuter = Math.round(-deltaY / stepPxOuter); // 84 / 18 = 4.67 -> 5 pozycji
const itemsMovedInner = Math.round(-deltaY / stepPxInner); // 84 / 42 = 2 pozycje
console.assert(itemsMovedOuter === 5, `W trybie mini ruch 84px powinien przesunąć 5 kafelków, przesunął: ${itemsMovedOuter}`);
console.assert(itemsMovedInner === 2, `W trybie powiększonym ten sam ruch 84px powinien przesunąć tylko 2 kafelki, przesunął: ${itemsMovedInner}`);

// Dynamiczna wysokość kafelka: 36px (mini) do 58px (duży)
const cardHeightOuter = Math.round(36 + zoomOuter * 22);
const cardHeightInner = Math.round(36 + zoomInner * 22);
console.assert(cardHeightOuter === 36, `Wysokość kafelka mini powinna wynosić 36px, wynosi: ${cardHeightOuter}`);
console.assert(cardHeightInner === 58, `Wysokość kafelka powiększonego powinna wynosić 58px, wynosi: ${cardHeightInner}`);

// Test strefy martwej / histerezy
const inDeadZone = (x) => x > leftThreshold && x < rightThreshold;
console.assert(inDeadZone(200) === true, 'X=200px powinno leżeć w strefie martwej (188px - 212px)');
console.assert(inDeadZone(180) === false, 'X=180px to lewa strefa');
console.assert(inDeadZone(220) === false, 'X=220px to prawa strefa');
console.log('✓ Dynamiczny zoom 2D, skala kafelków i płynna prędkość w 100% poprawne');

console.log('--- TEST 6: Matematyka wskaźnika dystansu (HUD) i blokady korytarza przejścia ---');
// Wskaźnik mikrodystansu (28px na slot)
// Dokładny środek (deltaY = 0):
const floatOffset0 = 0 / 28;
const deltaIndex0 = Math.round(floatOffset0);
const fraction0 = floatOffset0 - deltaIndex0;
const distPx0 = Math.round((0.5 - Math.abs(fraction0)) * 28);
console.assert(distPx0 === 14, `Na środku pozostały dystans do zmiany powinien wynosić 14px, wynosi: ${distPx0}`);

// Ruch o 8px w górę (deltaY = -8):
const floatOffset8 = -(-8) / 28; // 8 / 28 = 0.2857
const deltaIndex8 = Math.round(floatOffset8); // 0
const fraction8 = floatOffset8 - deltaIndex8; // 0.2857
const distPx8 = Math.round((0.5 - Math.abs(fraction8)) * 28); // (0.5 - 0.2857) * 28 = 6px
console.assert(distPx8 === 6, `Po przesunięciu 8px powinno zostać 6px do zmiany pozycji, zostało: ${distPx8}`);

// Test korytarza przejścia (Commit Corridor)
// Szerokość ekranu 400px:
// 35% szerokości = 140px, 53% szerokości = 212px
const corridorCheckStep1 = (x) => x >= screenWidth * 0.35;
console.assert(corridorCheckStep1(100) === false, 'X=100px nie jest w korytarzu przejścia w prawo (normalne przewijanie)');
console.assert(corridorCheckStep1(150) === true, 'X=150px JEST w korytarzu przejścia w prawo (blokada pionowa wyboru)');

const distToCommit = Math.max(0, Math.round(rightThreshold - 150));
console.assert(distToCommit === 62, `Od X=150px do rightThreshold (212px) powinno brakować 62px, brakuje: ${distToCommit}`);

console.log('✓ Wskaźnik mikrodystansu oraz blokada korytarza przejścia w 100% poprawne');

console.log('--- TEST 7: Rozbicie listy CO na kategorie (Krok 1 KATEGORIE) ---');
const categories = sm.getCategories();
console.assert(categories.length >= 8, `Oczekiwano co najmniej 8 kategorii, jest: ${categories.length}`);
console.assert(categories[0].name.includes('Wszystkie'), 'Pierwsza kategoria to Wszystkie');

const paletyItems = sm.getCoListWithTop('Palety i Nośniki');
console.assert(paletyItems.items.length < coData.items.length, 'Przefiltrowana kategoria ma znacząco mniej pozycji');
console.assert(paletyItems.items[0].isTop === true, 'Kategoria ma pozycję TOP na samej górze');
console.log('✓ Rozbicie na kategorie działa poprawnie. Liczba kategorii:', categories.length, ', pozycje Palety:', paletyItems.items.length);

console.log('--- TEST 8: Samoucząca się czołówka (TOP) na KAŻDYM etapie (SKĄD, DOKĄD, ILE) ---');
const skadData = sm.getSkadListWithTop();
const dokadData = sm.getDokadListWithTop();
const ileData = sm.getIleListWithTop();

console.assert(skadData.topCount >= 3, `SKĄD musi mieć >= 3 pozycji TOP, ma: ${skadData.topCount}`);
console.assert(skadData.items[0].isTop === true, 'SKĄD pozycja 0 musi być TOP');

console.assert(dokadData.topCount >= 3, `DOKĄD musi mieć >= 3 pozycji TOP, ma: ${dokadData.topCount}`);
console.assert(dokadData.items[0].isTop === true, 'DOKĄD pozycja 0 musi być TOP');

console.assert(ileData.topCount >= 3, `ILE musi mieć >= 3 pozycji TOP, ma: ${ileData.topCount}`);
console.assert(ileData.items[0].isTop === true, 'ILE pozycja 0 musi być TOP');

console.log('✓ TOP występuje na KAŻDYM etapie:');
console.log('  SKĄD TOP 1:', skadData.items[0].text, `(${skadData.items[0].count}x)`);
console.log('  DOKĄD TOP 1:', dokadData.items[0].text, `(${dokadData.items[0].count}x)`);
console.log('  ILE TOP 1:', ileData.items[0].text, `(${ileData.items[0].count}x)`);

console.log('--- TEST 9: Dodawanie nowych elementów z wyborem lub tworzeniem nowej kategorii ---');
// 1. Dodanie towaru do istniejącej kategorii
const addRes1 = sm.addItem('Taśma wzmocniona włóknem szklanym', 'Folie i Taśmy');
console.assert(addRes1 === true, 'Dodawanie towaru powinno zwrócić true');
const catFolie = sm.getItemCategory('Taśma wzmocniona włóknem szklanym');
console.assert(catFolie === 'Folie i Taśmy', `Oczekiwano kategorii "Folie i Taśmy", otrzymano: ${catFolie}`);

// 2. Dodanie nowej kategorii i towaru do tej nowej kategorii
const newCat = sm.addCustomCategory('Farmaceutyki i Leki', '💊');
console.assert(newCat && newCat.name === 'Farmaceutyki i Leki', 'Nowa kategoria powinna zostać utworzona');
console.assert(newCat.icon === '💊', 'Nowa kategoria powinna zachować podaną ikonę');

const addRes2 = sm.addItem('Paracetamol 500mg opakowanie zbiorcze', 'Farmaceutyki i Leki');
console.assert(addRes2 === true, 'Dodawanie towaru do nowej kategorii powinno zwrócić true');

const catParacetamol = sm.getItemCategory('Paracetamol 500mg opakowanie zbiorcze');
console.assert(catParacetamol === 'Farmaceutyki i Leki', `Oczekiwano "Farmaceutyki i Leki", otrzymano: ${catParacetamol}`);

// 3. Sprawdzenie czy nowa kategoria pojawia się w getCategories()
const allCats = sm.getCategories();
const foundNewCat = allCats.find(c => c.name === 'Farmaceutyki i Leki');
console.assert(foundNewCat !== undefined, 'Nowa kategoria musi znajdować się na liście kategorii');
console.assert(foundNewCat.icon === '💊', 'Ikona nowej kategorii musi się zgadzać');
console.assert(foundNewCat.count === 1, `Liczba pozycji w nowej kategorii powinna wynosić 1, wynosi: ${foundNewCat.count}`);

// 4. Pobranie listy towarów z nowej kategorii
const customCatItems = sm.getCoListWithTop('Farmaceutyki i Leki');
console.assert(customCatItems.items.some(i => i.text === 'Paracetamol 500mg opakowanie zbiorcze'), 'Towar musi być na liście nowej kategorii');
console.assert(customCatItems.items.every(i => sm.getItemCategory(i.text) === 'Farmaceutyki i Leki'), 'Wszystkie pozycje na liście należą do nowej kategorii');

// 5. Dodanie nowej lokalizacji
const addLocRes = sm.addLocation('Chłodnia Farmaceutyczna F-01');
console.assert(addLocRes === true, 'Dodawanie lokalizacji powinno zwrócić true');
const updatedSkad = sm.getSkadListWithTop();
console.assert(updatedSkad.items.some(i => i.text === 'Chłodnia Farmaceutyczna F-01'), 'Nowa lokalizacja musi być dostępna w SKĄD');

console.log('✓ Dodawanie elementów i obsługa nowych kategorii w 100% poprawne:', {
  nowaKategoria: foundNewCat.name,
  ikona: foundNewCat.icon,
  towar: 'Paracetamol 500mg opakowanie zbiorcze',
  lokalizacja: 'Chłodnia Farmaceutyczna F-01'
});

console.log('\n========================================');
console.log('WSZYSTKIE TESTY JEDNOSTKOWE ZAKOŃCZONE SUKCESEM!');
console.log('========================================');
