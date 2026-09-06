import { NextResponse } from "next/server";

function hue(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function size(aspect: string) {
  if (aspect === "9:16") return [720, 1280] as const;
  if (aspect === "1:1") return [1024, 1024] as const;
  if (aspect === "4:3") return [1024, 768] as const;
  if (aspect === "3:4") return [768, 1024] as const;
  return [1280, 720] as const;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const prompt = (url.searchParams.get("prompt") ?? "Untitled").slice(0, 180);
  const aspect = url.searchParams.get("aspect") ?? "16:9";
  const model = url.searchParams.get("model") ?? "mock";
  const [w, h] = size(aspect);
  const a = hue(prompt);
  const b = (a + 48) % 360;
  const lines = escapeXml(prompt)
    .split(/\s+/)
    .reduce<string[]>((acc, word) => {
      const last = acc[acc.length - 1];
      if (!last || `${last} ${word}`.length > 42) acc.push(word);
      else acc[acc.length - 1] = `${last} ${word}`;
      return acc;
    }, [])
    .slice(0, 5);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${a} 42% 38%)"/>
      <stop offset="1" stop-color="hsl(${b} 36% 22%)"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="${w / 2}" y="${h * 0.18}" fill="#f4f1ea" font-family="Georgia, serif" font-size="${Math.round(w / 22)}" text-anchor="middle">Hearth</text>
  ${lines
    .map(
      (line, i) =>
        `<text x="${w / 2}" y="${h * 0.42 + i * Math.round(h / 16)}" fill="#fffdf8" font-family="Georgia, serif" font-size="${Math.round(w / 28)}" text-anchor="middle">${line}</text>`,
    )
    .join("\n  ")}
  <text x="${w / 2}" y="${h * 0.9}" fill="#ffd061" font-family="ui-monospace, monospace" font-size="${Math.round(w / 42)}" text-anchor="middle">${escapeXml(model)} · mock</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
