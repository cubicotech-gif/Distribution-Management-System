// Code 39 barcode (letters, digits, - . space). Real, scannable bars.
const P: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn", F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn", P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn", Z: "nwwnwnnnn", "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "*": "nwnnwnwnn",
};

export default function Barcode({ value, height = 34, unit = 1.4 }: { value: string; height?: number; unit?: number }) {
  const text = `*${value.toUpperCase().replace(/[^0-9A-Z\-. ]/g, "")}*`;
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const ch of text) {
    const pat = P[ch];
    if (!pat) continue;
    for (let i = 0; i < 9; i++) {
      const w = (pat[i] === "w" ? 3 : 1) * unit;
      if (i % 2 === 0) bars.push({ x, w });
      x += w;
    }
    x += unit; // gap between characters
  }
  return (
    <svg width={x} height={height} viewBox={`0 0 ${x} ${height}`} role="img" aria-label={`Barcode ${value}`} style={{ display: "block" }}>
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="#000" />)}
    </svg>
  );
}
