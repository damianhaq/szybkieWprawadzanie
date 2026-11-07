# ⚡ Ping-Pong Magazyn — Szybkie Wprowadzanie Zadań Jedną Ręką

> **Mobile-First Progressive Web App (PWA)** do błyskawicznego rejestrowania zadań logistycznych i magazynowych za pomocą **jednego ciągłego gestu kciukiem bez odrywania palca od ekranu**.

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-10b981.svg)](./manifest.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](./LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-cyan.svg)](#technologie)

---

## 📱 O projekcie

W środowisku magazynowym pracownik często trzyma czytnik kodów lub karton w jednej ręce, mając do dyspozycji wyłącznie jedną dłoń na smartfonie. Tradycyjne formularze wymagają wielokrotnego celowania w małe przyciski i pola tekstowe.

Aplikacja **Ping-Pong Magazyn** rozwiązuje ten problem interfejsem gestowym:
- **Jeden ciągły ruch:** Przyłóż palec -> przewiń -> przejdź na drugą stronę ekranu -> puść, aby zapisać.
- **Wymiana stref (Ping-Pong):** Ekran podzielony jest na lewą i prawą strefę, które na przemian podmieniają swoje listy w miarę postępu wprowadzania.
- **Relatywne przewijanie:** Pozycja na liście zależy od względnego ruchu palca (`deltaY`), a nie bezwzględnego miejsca dotknięcia.
- **Dwubiegowa kolumna:** Przy lewej krawędzi działa pas **Turbo x8** do szybkiego przeskakiwania po alfabecie.

---

## 🎯 Architektura ekranu

Ekran jest zoptymalizowany pod `100dvh` na telefonach komórkowych i dzieli się na 3 kluczowe sekcje:

```
┌────────────────────────────────────────────────────────┐
│ 1. TOP BAR (~12%): Podgląd na żywo & Strefa Anulowania │
│    [CO] ➔ [SKĄD] ➔ [DOKĄD] (x[ILE])                    │
├──────────────────────────┬─────────────────────────────┤
│ 2. LEWA STREFA (0% - 50%)│ PRAWA STREFA (50% - 100%)   │
│                          │                             │
│   PAS SZYBKI (0-16%):    │                             │
│   ⚡ Turbo x8             │                             │
│   (skok po alfabecie)    │                             │
│                          │                             │
│   PAS PRECYZYJNY (16-47%)│                             │
│   🎯 1 poz. / 28px       │                             │
│                          │                             │
│   KROK 1: CO             │ KROK 2: SKĄD                │
│   (lub w tle KROK 3)     │ (lub w tle KROK 4)          │
│                          │                             │
│            STREFA MARTWA (47% - 53% szerokości)        │
├──────────────────────────┴─────────────────────────────┤
│ 3. DOLNY PANEL (DRAWER - ~25%, rozsuwany na 85%):      │
│    Lista zapisanych zadań (1-klik do odhaczenia/CSV)   │
└────────────────────────────────────────────────────────┘
```

---

## 🔄 Cykl gestu "Ping-Pong" (Maszyna stanów)

| Krok | Strefa ekranu | Akcja | Co dzieje się w tle? |
|---|---|---|---|
| **KROK 1** | **LEWA** (0% - 47%) | Wybór towaru z długiej listy (**CO**) | Prawa strefa oczekuje na gest |
| **KROK 2** | **PRAWA** (> 53%) | Wybór lokalizacji początkowej (**SKĄD**) | Przejście w prawo zatwierdza Krok 1. Lewa strefa natychmiast ładuje Krok 3 (**DOKĄD**). |
| **KROK 3** | **LEWA** (< 47%) | Wybór lokalizacji docelowej (**DOKĄD**) | Przejście w lewo zatwierdza Krok 2. Prawa strefa natychmiast ładuje Krok 4 (**ILE**). |
| **KROK 4** | **PRAWA** (> 53%) | Wybór ilości / jednostek (**ILE**) | Ostatni krok konfiguracji zadania. |

### ⚡ Zasada Wcześniejszego Zakończenia (Early Release)
Nie musisz przechodzić wszystkich 4 kroków! Oderwanie palca od ekranu (`pointerup`) w **dowolnym momencie** (np. po samym towarze lub po KROKU 2) natychmiast zatwierdza aktualnie podświetlony element i zapisuje zadanie.

### 🛑 Strefa Anulowania
Jeśli w trakcie gestu zdecydujesz się przerwać wprowadzanie, przeciągnij palec na **Górny Pasek (Top Bar)**. Pasek zmieni kolor na pulsującą czerwień ostrzegawczą — upuszczenie palca w tej strefie anuluje operację bez zapisu.

---

## 🚀 Kluczowe funkcje

- **Samoucząca się czołówka (TOP 6):** Aplikacja automatycznie zlicza częstość wyborów w `localStorage`. Na samej górze listy towarów zawsze przypięte jest do 6 najpopularniejszych pozycji oznaczonych odznaką `🔥 TOP`.
- **Dwubiegowa kolumna z płynną zmianą biegów:** Pomiędzy pasem szybkim (0-16%) a precyzyjnym (16-47%) następuje automatyczne przeliczenie kotwic relatywnych (`anchorY = touchY`, `anchorIndex = currentIndex`), co zapobiega jakimkolwiek przeskokom listy.
- **Cylindryczny bęben 3D:** Realistyczny efekt walca obrotowego z pixel-perfect wyrównaniem do ramki celowniczej.
- **Haptyka i dźwięki:**
  - Przesunięcie o 1 pozycję: wibracja `8ms` + klik audio Web Audio API.
  - Zmiana kroku (przekroczenie środka): wibracja `35ms` + narastający ton syntezatora.
  - Zapis zadania: wibracja `[30, 40, 30]ms` + akord potwierdzenia.
  - Anulowanie: wibracja `80ms` + niski ton błędu.
- **Wbudowany edytor bazy:** Możliwość edycji wszystkich list (CO, SKĄD, DOKĄD, ILE) jako prostych pól tekstowych (1 pozycja na wiersz), przycisk przywracania fabrycznej bazy (ponad 70 artykułów) oraz resetowania statystyk TOP.
- **Eksport zadań:** Kopiowanie listy zadań do schowka w formacie CSV jednym kliknięciem.
- **Obsługa PWA i tryb offline:** Działa w 100% bez połączenia z Internetem, instalacja jako natywna aplikacja na Androidzie i iOS.

---

## 🛠️ Technologie

- **Zero zewnętrznych bibliotek:** Czysty, nowoczesny **HTML5**, **CSS3** i modularny **Vanilla JavaScript (ES Modules)**.
- **Unified Pointer Events:** Pełna obsługa dotyku na smartfonach oraz myszy na komputerach stacjonarnych (`pointerdown`, `pointermove`, `pointerup`).
- **Natywne `<dialog closedby="any">`:** Nowoczesne modale z efektem `backdrop-filter: blur()`.
- **Web Audio API & Vibration API:** Zapewnia sprzężenie zwrotne dla zmysłów słuchu i dotyku.
- **Service Worker (Cache First):** Błyskawiczny start i pełna funkcjonalność offline.

---

## 💻 Uruchomienie lokalne

Ponieważ projekt składa się z czystych plików statycznych, nie wymaga kompilacji ani bundlera.

### Opcja 1: Uruchomienie za pomocą `npm` / `npx`
```bash
# Szybki serwer statyczny:
npm start
# lub bezpośrednio:
npx serve .
```

### Opcja 2: Python
```bash
python -m http.server 8080
```

### Uruchomienie testów automatycznych
```bash
npm test
```

---

## 🌐 Publikacja na GitHub Pages

Projekt jest gotowy do wdrożenia na **GitHub Pages** w 1 krok:
1. W repozytorium GitHub wejdź w **Settings** -> **Pages**.
2. W sekcji **Build and deployment** wybierz gałąź `main` i folder `/ (root)`.
3. Kliknij **Save** — strona będzie od razu dostępna online!

---

## 📄 Licencja

Projekt udostępniany na licencji [MIT](./LICENSE).
