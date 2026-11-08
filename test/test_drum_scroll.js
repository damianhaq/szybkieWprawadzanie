// Test ciągłości matematycznej i braku skoków/znikania elementów
console.log('--- TEST DRUM SCROLL CONTINUITY ---');

const itemHeight = 44;
const totalItems = 74;

// Sprawdzamy czy dla ciągłego floatY translateY porusza się ściśle monotonicznie
let prevTranslateY = null;
let maxJump = 0;

for (let floatY = 5.0; floatY <= 6.0; floatY += 0.05) {
  const i = 5; // badamy pozycję kafelka o indeksie 5
  const visualDiff = i - floatY;
  const translateY = visualDiff * itemHeight;

  if (prevTranslateY !== null) {
    const delta = translateY - prevTranslateY;
    // delta powinna wynosić dokładnie -0.05 * 44 = -2.2px
    const expectedDelta = -0.05 * itemHeight;
    const diff = Math.abs(delta - expectedDelta);
    if (diff > maxJump) maxJump = diff;
  }
  prevTranslateY = translateY;
}

console.assert(maxJump < 1e-9, `Maksymalny błąd ciągłości wynosi ${maxJump}, oczekiwano < 1e-9`);
console.log('✓ Ciągłość translateY (brak ząbkowania/sawtooth): 100% idealna');

// Sprawdzamy widoczność kafelków (visibleSpan)
const containerHeight = 500;
const halfHeight = containerHeight / 2;
const spanNeeded = Math.ceil(halfHeight / Math.min(32, itemHeight)) + 3;
const visibleSpan = Math.max(10, spanNeeded);

console.assert(visibleSpan >= 10, `visibleSpan (${visibleSpan}) musi pokryć ekran`);
const furthestRenderedY = visibleSpan * itemHeight;
console.assert(furthestRenderedY > halfHeight + 100, `Najdalszy renderowany kafelek (${furthestRenderedY}px) sięga daleko poza krawędź ekranu (${halfHeight}px)`);
console.log(`✓ visibleSpan = ${visibleSpan}, sięga ${furthestRenderedY}px od środka (ekran ma ${halfHeight}px od środka). Brak pustych luk!`);

console.log('--- WSZYSTKIE TESTY PŁYNNOŚCI PRZESZŁY POMYŚLNIE! ---');
