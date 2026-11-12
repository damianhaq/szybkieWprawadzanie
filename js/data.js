// Baza danych startowych dla aplikacji Ping-Pong Magazyn
export const DEFAULT_DATABASE = {
  co: [
    "AGD - Czajniki bezprzewodowe",
    "AGD - Kuchenki mikrofalowe",
    "AGD - Lodówki slim",
    "AGD - Pralki automatyczne",
    "AGD - Zmywarki 60cm",
    "Akumulatory żelowe 12V 7Ah",
    "Apteczki zakładowe BHP DIN 13157",
    "Automatyka - Czujniki optyczne",
    "Automatyka - Przekaźniki 24V",
    "BHP - Kamizelki odblaskowe żółte",
    "BHP - Okulary ochronne bezbarwne",
    "BHP - Zatyczki do uszu 3M",
    "Chemia - Odtłuszczacz przemysłowy",
    "Chemia - Płyn do myjek posadzkowych",
    "Chemia - Rozpuszczalnik nitro 5L",
    "Części - Łożyska toczne 6204",
    "Części - Paski klinowe B-220",
    "Części - Śruby M10x50 ocynk",
    "Drobiazgi - Uszczelki gumowe fi 40",
    "Elektronarzędzia - Szlifierki kątowe",
    "Elektronarzędzia - Wkrętarki akumulatorowe",
    "Elektronarzędzia - Wiertarki udarowe",
    "Elektronika - Baterie przemysłowe AA",
    "Elektronika - Czytniki kodów Zebra",
    "Elektronika - Kable zasilające 3m",
    "Elektronika - Monitory 24 cale",
    "Elektronika - Terminale wózkowe",
    "Elementy złączne - Nakrętki M8",
    "Elementy złączne - Podkładki sprężyste",
    "Etykiety termiczne 100x150 rolka",
    "Folia bąbelkowa 1.2m x 100m",
    "Folia maszynowa stretch 23um",
    "Folia ręczna stretch czarna",
    "Folia ręczna stretch transparent",
    "Kable sieciowe LAN CAT6 305m",
    "Karton klapowy 200x150x100",
    "Karton klapowy 300x200x150",
    "Karton klapowy 600x400x400",
    "Karton paletowy mega 1200x800",
    "Kask ochronny z nausznikami",
    "Klej na gorąco wkłady 11mm",
    "Komplet zawiasów stalowych",
    "Kosze magazynowe plastikowe",
    "Narzędzia - Klucze nasadowe kpl",
    "Narzędzia - Miary zwijane 5m",
    "Narzędzia - Młotki gumowe 500g",
    "Nożyki bezpieczne tapicerskie",
    "Obuwie robocze S3 rozm. 42",
    "Obuwie robocze S3 rozm. 43",
    "Opaski zaciskowe 300mm czarne",
    "Paleta EURO 1200x800",
    "Paleta jednorazowa 1200x800",
    "Paleta przemysłowa 1200x1000",
    "Płyty MDF 18mm formatki",
    "Pojemnik magazynowy z pokrywą",
    "Pojemnik warsztatowy KLT 400x300",
    "Profile aluminiowe 40x40 2m",
    "Przewody miedziane 3x2.5mm 100m",
    "Płyn do dezynfekcji 5L",
    "Rękawice nitrylowe rozm. L",
    "Rękawice powlekane PU rozm. 10",
    "Skrzyniopaleta z tworzywa",
    "Sortownik pocztowy metalowy",
    "Taśma ostrzegawcza żółto-czarna",
    "Taśma pakowa kauczukowa brąz",
    "Taśma spinająca PET 16mm",
    "Wkręty do drewna 4x50mm 500szt",
    "Worki na odpady 120L grube",
    "Wózki magazynowe 2-kołowe",
    "Zaczepy transportowe 2T",
    "Zawiesia pasowe 3T 4m",
    "Zbiornik IBC 1000L czysty",
    "Zszywki tapicerskie 14mm",
    "Żarówki LED E27 15W neutral"
  ],
  // Wspólna baza lokalizacji magazynowych dla SKĄD i DOKĄD
  lokalizacje: [
    "Antresola Drobnicowa",
    "Chłodnia Magazynowa",
    "Dział Kontroli Jakości",
    "Dział Zwrotów (RMA)",
    "Magazyn Odpadów/Złom",
    "Półki Kompletacji K-1",
    "Rampa 01 (Przyjęcia)",
    "Rampa 02 (Przyjęcia)",
    "Rampa 05 (Wysyłka)",
    "Rampa 06 (Wysyłka)",
    "Regał Średni C-01..08",
    "Regał Wysoki A-01..12",
    "Regał Wysoki B-01..12",
    "Stanowisko Pakowania 1",
    "Stanowisko Pakowania 2",
    "Strefa Buforowa A",
    "Strefa Etykietowania",
    "Strefa Konsolidacji",
    "Strefa Kwarantanny",
    "Strefa Wydawania Kurier",
    "Utylizacja / Zniszczenie",
    "Warsztat / Serwis"
  ],
  ile: [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "8",
    "10",
    "12",
    "15",
    "20",
    "25",
    "30",
    "50",
    "1 Paleta",
    "2 Palety",
    "1 Karton",
    "Pół palety"
  ]
};

// Przykładowe zadania początkowe, żeby lista nie była pusta przy pierwszym uruchomieniu
export const INITIAL_TASKS = [
  {
    id: "task-init-1",
    co: "Paleta EURO 1200x800",
    skad: "Rampa 01 (Przyjęcia)",
    dokad: "Regał Wysoki A-01..12",
    ile: "2 Palety",
    timestamp: Date.now() - 1000 * 60 * 18,
    completed: false
  },
  {
    id: "task-init-2",
    co: "Folia ręczna stretch transparent",
    skad: "Strefa Buforowa A",
    dokad: "Stanowisko Pakowania 1",
    ile: "1 Karton",
    timestamp: Date.now() - 1000 * 60 * 42,
    completed: false
  },
  {
    id: "task-init-3",
    co: "Elektronika - Czytniki kodów Zebra",
    skad: "Dział Zwrotów (RMA)",
    dokad: "Warsztat / Serwis",
    ile: "4",
    timestamp: Date.now() - 1000 * 60 * 75,
    completed: true
  }
];

// Początkowe liczniki dla samouczącej się czołówki (TOP dla każdego etapu)
export const INITIAL_USAGE_STATS = {
  // Towary (CO) - bezpośrednie klucze dla pełnej kompatybilności wstecznej
  "Paleta EURO 1200x800": 34,
  "Folia ręczna stretch transparent": 28,
  "Karton klapowy 600x400x400": 21,
  "Etykiety termiczne 100x150 rolka": 17,
  "Taśma pakowa kauczukowa brąz": 14,
  "Elektronika - Czytniki kodów Zebra": 9,

  // Lokalizacje początkowe (SKĄD)
  "_skad": {
    "Rampa 01 (Przyjęcia)": 32,
    "Strefa Buforowa A": 26,
    "Regał Wysoki A-01..12": 19,
    "Półki Kompletacji K-1": 15
  },

  // Lokalizacje docelowe (DOKĄD)
  "_dokad": {
    "Regał Wysoki A-01..12": 30,
    "Stanowisko Pakowania 1": 24,
    "Rampa 05 (Wysyłka)": 18,
    "Strefa Konsolidacji": 12
  },

  // Ilości (ILE)
  "_ile": {
    "1": 38,
    "1 Paleta": 29,
    "2": 22,
    "1 Karton": 18,
    "2 Palety": 14,
    "5": 11
  }
};

// Definicje i rozpoznawanie kategorii towarów (czysty Flat Design, bez emoji)
export const CATEGORY_DEFINITIONS = [
  { id: 'all', name: 'Wszystkie (TOP)' },
  { id: 'palety', name: 'Palety i Nośniki' },
  { id: 'kartony', name: 'Kartony i Pojemniki' },
  { id: 'folie', name: 'Folie i Taśmy' },
  { id: 'bhp', name: 'BHP i Ochrona' },
  { id: 'chemia', name: 'Chemia i Czystość' },
  { id: 'elektronika', name: 'Elektronika i Kable' },
  { id: 'narzedzia', name: 'Narzędzia i Sprzęt' },
  { id: 'zlacza', name: 'Części i Złącza' },
  { id: 'agd', name: 'AGD i Urządzenia' }
];

export const getCategoryForItem = (itemText) => {
  if (typeof itemText !== 'string') return 'Inne';
  const dashIdx = itemText.indexOf(' - ');
  if (dashIdx !== -1) {
    const prefix = itemText.substring(0, dashIdx).trim();
    if (prefix === 'AGD') return 'AGD i Urządzenia';
    if (prefix === 'BHP') return 'BHP i Ochrona';
    if (prefix === 'Chemia') return 'Chemia i Czystość';
    if (prefix === 'Elektronika' || prefix === 'Automatyka') return 'Elektronika i Kable';
    if (prefix === 'Elektronarzędzia' || prefix === 'Narzędzia') return 'Narzędzia i Sprzęt';
    if (prefix === 'Części' || prefix === 'Elementy złączne' || prefix === 'Drobiazgi') return 'Części i Złącza';
    return prefix;
  }
  const lower = itemText.toLowerCase();
  if (lower.includes('palet') || lower.includes('skrzyniopaleta')) return 'Palety i Nośniki';
  if (lower.includes('karton') || lower.includes('pojemnik') || lower.includes('kosz')) return 'Kartony i Pojemniki';
  if (lower.includes('folia') || lower.includes('taśma') || lower.includes('etykiet')) return 'Folie i Taśmy';
  if (lower.includes('bhp') || lower.includes('rękawic') || lower.includes('obuwie') || lower.includes('kask') || lower.includes('okulary') || lower.includes('apteczk') || lower.includes('kamizelk')) return 'BHP i Ochrona';
  if (lower.includes('chemia') || lower.includes('płyn') || lower.includes('odtłuszczacz') || lower.includes('rozpuszczalnik') || lower.includes('worki')) return 'Chemia i Czystość';
  if (lower.includes('narzędzi') || lower.includes('nożyk') || lower.includes('klucz') || lower.includes('młotek') || lower.includes('wózek')) return 'Narzędzia i Sprzęt';
  if (lower.includes('śrub') || lower.includes('nakrętk') || lower.includes('podkładk') || lower.includes('wkręt') || lower.includes('opaski') || lower.includes('zawias') || lower.includes('łożysk') || lower.includes('paski') || lower.includes('zszywki')) return 'Części i Złącza';
  if (lower.includes('elektron') || lower.includes('kabl') || lower.includes('przewod') || lower.includes('bater') || lower.includes('akumulator') || lower.includes('żarówk')) return 'Elektronika i Kable';
  return 'Inne towary';
};
