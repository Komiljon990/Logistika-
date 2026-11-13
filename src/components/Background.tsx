/**
 * Fon: nuqtali xarita (Yevropa va Markaziy Osiyo) va sekin suzib yuradigan yumshoq rang to'lqinlari.
 * Xarita juda xira — matn va kartalarga xalaqit bermaydi. Bezak, ekran o'quvchilardan yashirilgan.
 * Nuqtalar serverda bir marta hisoblanadi va bitta yo'lda chiziladi (sahifa yengil qoladi).
 */
const W = 1440;
const H = 900;
const LON0 = 5, LON1 = 85, LAT0 = 33, LAT1 = 65;
const px = (lon: number) => ((lon - LON0) / (LON1 - LON0)) * W;
const py = (lat: number) => ((LAT1 - lat) / (LAT1 - LAT0)) * H;

type LonLat = [number, number];

// Soddalashtirilgan suv havzalari (lon, lat): shu yerlarda nuqta chizilmaydi.
const WATER: LonLat[][] = [
  [[5, 33], [5, 43.4], [9, 44.4], [10.5, 43], [12, 41.5], [15.5, 40], [16, 38], [18.5, 40.2], [19.5, 41.8], [16.5, 43.5], [13.7, 45.7],
   [12.3, 45.4], [13.8, 44], [15.5, 42.5], [18.5, 40], [20.5, 39], [22, 37], [23, 38], [24, 40.5], [26, 40.6], [26.3, 40], [27, 38.5],
   [28, 36.7], [32, 36.2], [36, 36.6], [35.8, 34.5], [35, 33]],
  [[27.6, 42.5], [28, 44], [29.7, 45.3], [30.8, 46.5], [33.5, 46], [35, 45.3], [36.5, 45.4], [38, 47], [39.3, 47], [38, 45.7], [37.5, 44.6],
   [39.5, 43.5], [41.5, 42], [41.5, 41.3], [37, 41.1], [33, 42], [31, 41.2], [29, 41.2]],
  [[47, 44.5], [47.5, 45.5], [49, 46.5], [51, 47], [53, 46.6], [53, 45.5], [51.3, 44.5], [51, 43], [52.7, 42], [53, 40], [54, 38.5],
   [53.9, 37.3], [51, 36.7], [49, 37.6], [49.5, 40.3], [48.6, 41.8], [47.5, 42.9]],
  [[10, 54.4], [12, 54.2], [14, 54], [18, 54.8], [21, 55], [21, 56.7], [21.5, 57.5], [23.5, 57], [24.3, 57.3], [24, 58.4], [23, 59],
   [28, 59.8], [30, 60], [25, 60.2], [22, 60.3], [21, 61], [21.5, 63], [25, 65], [21, 65], [17.5, 62.3], [17, 60.5], [18.5, 59.5],
   [16.5, 57], [14.5, 56], [12.7, 55.5], [10.5, 56.5], [10.6, 57.7], [10, 57.2]],
  [[5, 51.5], [4.5, 53], [8.5, 53.6], [8.2, 55.5], [8.2, 57], [10.5, 57.7], [7, 58], [5, 59]],
  [[5, 58.5], [5, 65], [13, 65], [10, 63.5], [7, 62], [5, 61]],
  [[58.2, 44.2], [58.6, 46.2], [60.5, 46.5], [61.2, 45], [59.5, 43.8]],
  [[73.5, 45.4], [74.5, 46.6], [77, 46.8], [79, 46.5], [78, 45.9], [75.5, 46.1]],
];

function inPolygon([x, y]: LonLat, poly: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const parts: string[] = [];
for (let lat = LAT0 + 0.4; lat < LAT1; lat += 0.9) {
  for (let lon = LON0 + 0.4; lon < LON1; lon += 1.15) {
    if (!WATER.some((w) => inPolygon([lon, lat], w))) parts.push(`M${Math.round(px(lon))} ${Math.round(py(lat))}h0`);
  }
}
const MAP_PATH = parts.join("");

export function Background() {
  return (
    <div className="bg-map-layer" aria-hidden="true">
      <div className="bg-glow one" />
      <div className="bg-glow two" />
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <path d={MAP_PATH} className="bg-map" />
      </svg>
    </div>
  );
}
