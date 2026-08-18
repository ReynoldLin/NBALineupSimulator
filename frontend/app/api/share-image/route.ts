// app/api/share-image/route.ts
//
// Renders the user's lineup (record + starters + bench) as a PNG image
// server-side using @napi-rs/canvas, mirroring the SlotCard.tsx layout.
//
// IMPORTANT: this route MUST run on the Node.js runtime, not Edge —
// @napi-rs/canvas is a native binding and will not work on Edge.

import { NextRequest, NextResponse } from "next/server";
import { createCanvas, loadImage, GlobalFonts, type Image } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Types — mirror lib/api.ts and your SlotKey convention ("starter-PG", etc.)
// ---------------------------------------------------------------------------

type Player = {
  player_id: number;
  team_id: number;
  decade: number;
  full_name: string;
  positions: string;
  headshot_url: string | null;
  // other stat fields aren't needed for the image
};

type SlotKey = string;

type SharePayload = {
  record: string | null;
  lineup: Record<SlotKey, Player | null>;
};

// ---------------------------------------------------------------------------
// Copied from lib/positions.ts / lib/teams.ts so this route has no runtime
// dependency on client-only modules. Keep these in sync if you edit either file.
// ---------------------------------------------------------------------------

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

const POSITION_COLORS: Record<string, string> = {
  PG: "#D1336F",
  SG: "#E68A42",
  SF: "#19CAA1",
  PF: "#21B8D6",
  C: "#A872D0",
};

const TEAM_COLORS: Record<number, string> = {
  1610612737: "#E03A3E", // Atlanta Hawks
  1610612738: "#007A33", // Boston Celtics
  1610612787: "#000000", // Brooklyn Nets
  1610612770: "#1D1160", // Charlotte Hornets
  1610612741: "#CE1141", // Chicago Bulls
  1610612739: "#860038", // Cleveland Cavaliers
  1610612742: "#00538C", // Dallas Mavericks
  1610612743: "#0E2240", // Denver Nuggets
  1610612765: "#C8102E", // Detroit Pistons
  1610612744: "#1d428a", // Golden State Warriors
  1610612745: "#CE1141", // Houston Rockets
  1610612754: "#002D62", // Indiana Pacers
  1610612746: "#C8102E", // LA Clippers
  1610612747: "#552583", // Los Angeles Lakers
  1610612763: "#5D76A9", // Memphis Grizzlies
  1610612748: "#98002E", // Miami Heat
  1610612749: "#00471B", // Milwaukee Bucks
  1610612750: "#0C2340", // Minnesota Timberwolves
  1610612740: "#0C2340", // New Orleans Pelicans
  1610612752: "#006BB6", // New York Knicks
  1610612760: "#007AC1", // Oklahoma City Thunder
  1610612753: "#0077C0", // Orlando Magic
  1610612755: "#006BB6", // Philadelphia 76ers
  1610612767: "#E56020", // Phoenix Suns
  1610612757: "#E03A3E", // Portland Trail Blazers
  1610612758: "#5A2D81", // Sacramento Kings
  1610612759: "#000000", // San Antonio Spurs
  1610612761: "#CE1141", // Toronto Raptors
  1610612762: "#002B5C", // Utah Jazz
  1610612764: "#002B5C", // Washington Wizards
};

// ---------------------------------------------------------------------------
// Layout constants (1200x630 = OG-image ratio, wide enough for a 5-wide grid)
// ---------------------------------------------------------------------------

const CANVAS_W = 1200;
const CANVAS_H = 800;
const MARGIN = 40;
const CARD_GAP = 16;
const ROW_GAP = 24;
const HEADER_H = 50;
const LABEL_H = 26;

const CONTENT_W = CANVAS_W - MARGIN * 2;
const CARD_W = (CONTENT_W - CARD_GAP * (POSITIONS.length - 1)) / POSITIONS.length;
const CARD_ASPECT_RATIO = 7/5;
const CARD_H = CARD_W * CARD_ASPECT_RATIO;
const BANNER_H = 26;

// ---------------------------------------------------------------------------
// Fonts — the server has no system fonts installed by default, so bundle
// your own and register them. Drop .ttf files at the paths below (any
// weight/family is fine, just update the names + paths to match).
// ---------------------------------------------------------------------------

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  const regularPath = path.join(process.cwd(), "public", "fonts", "AtkinsonHyperlegible-Regular.ttf");
  const boldPath = path.join(process.cwd(), "public", "fonts", "AtkinsonHyperlegible-Bold.ttf");
  const monoPath = path.join(process.cwd(), "public", "fonts", "AtkinsonHyperlegibleMono-Regular.ttf");
  const monoBoldPath = path.join(process.cwd(), "public", "fonts", "AtkinsonHyperlegibleMono-Bold.ttf");

  if (fs.existsSync(regularPath)) {
    GlobalFonts.registerFromPath(regularPath, "Atkinson Hyperlegible");
  } else {
    console.warn("Missing font file:", regularPath);
  }

  if (fs.existsSync(boldPath)) {
    GlobalFonts.registerFromPath(boldPath, "Atkinson Hyperlegible Bold");
  } else {
    console.warn("Missing font file:", boldPath);
  }

  if (fs.existsSync(monoPath)) {
    GlobalFonts.registerFromPath(monoPath, "Atkinson Hyperlegible Mono");
  } else {
    console.warn("Missing font file:", monoPath);
  }

  if (fs.existsSync(monoBoldPath)) {
    GlobalFonts.registerFromPath(monoBoldPath, "Atkinson Hyperlegible Mono Bold");
  } else {
    console.warn("Missing font file:", monoBoldPath);
  }

  fontsRegistered = true;
}

// ---------------------------------------------------------------------------
// Image loading helpers
// ---------------------------------------------------------------------------

const logoCache = new Map<number, Image | null>();

async function loadLogo(teamId: number): Promise<Image | null> {
  if (logoCache.has(teamId)) return logoCache.get(teamId)!;
  try {
    const logoPath = path.join(process.cwd(), "public", "logos", `${teamId}.svg`);
    if (!fs.existsSync(logoPath)) {
      logoCache.set(teamId, null);
      return null;
    }
    // NOTE: @napi-rs/canvas can rasterize SVGs directly via loadImage(),
    // but if you hit issues with a particular icon set, pre-convert your
    // /public/logos/*.svg files to PNG and point this at *.png instead —
    // that sidesteps any SVG-feature-support gaps entirely.
    const img = await loadImage(logoPath);
    logoCache.set(teamId, img);
    return img;
  } catch (err) {
    console.warn(`Failed to load logo for team ${teamId}`, err);
    logoCache.set(teamId, null);
    return null;
  }
}

const PLACEHOLDER_HEADSHOT_URL = "https://placehold.net/avatar.png";

async function loadHeadshot(url: string | null): Promise<Image | null> {
  const targetUrl = url ?? PLACEHOLDER_HEADSHOT_URL;
  try {
    return await loadImage(targetUrl);
  } catch (err) {
    console.warn(`Failed to load headshot: ${targetUrl}`, err);
    if (targetUrl !== PLACEHOLDER_HEADSHOT_URL) {
      // original URL failed — try the placeholder as a last resort
      try {
        return await loadImage(PLACEHOLDER_HEADSHOT_URL);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function roundedRectPath(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncateToWidth(ctx: any, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(truncated + "…").width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.trimEnd() + "…";
}

async function drawCard(ctx: any, x: number, y: number, position: string, player: Player | null) {
  ctx.save();
  roundedRectPath(ctx, x, y, CARD_W, CARD_H, 8);
  ctx.clip();

  if (player) {
    const teamColor = TEAM_COLORS[player.team_id] ?? "#111111";

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x, y, CARD_W, CARD_H);

    // Banner: team color background, decade text
    ctx.fillStyle = teamColor;
    ctx.fillRect(x, y, CARD_W, BANNER_H);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "11px 'Atkinson Hyperlegible Mono Bold'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${player.decade}s`, x + CARD_W / 2, y + BANNER_H / 2 + 1);

    // Headshot
    const headshot = await loadHeadshot(player.headshot_url);

    if (headshot) {
      const REFERENCE_CARD_W = 176;
      const REFERENCE_HEADSHOT_H = 144;
      const REFERENCE_PADDING = 16; // p-4 in SlotCard's photo container

      const scaleFactor = CARD_W / REFERENCE_CARD_W;
      const dh = REFERENCE_HEADSHOT_H * scaleFactor;
      const dw = headshot.width * (dh / headshot.height);
      const padding = REFERENCE_PADDING * scaleFactor;

      const footerH = 48;
      const photoAreaTop = y + BANNER_H + padding;
      const photoAreaBottom = y + CARD_H - footerH - padding;
      const photoAreaHeight = photoAreaBottom - photoAreaTop;
      const photoTop = photoAreaTop + (photoAreaHeight - dh) / 2;

      ctx.drawImage(headshot, x + (CARD_W - dw) / 2, photoTop, dw, dh);
    }

    // Footer: position | name | logo
    const footerY = y + CARD_H - 30;

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = POSITION_COLORS[position] ?? "#AAAAAA";
    ctx.font = "10px 'Atkinson Hyperlegible Bold'";
    ctx.fillText(position, x + 8, footerY + 14);

    const logo = await loadLogo(player.team_id);
    const logoSize = 18;
    const nameMaxWidth = CARD_W - 8 - 20 /* pos */ - (logo ? logoSize + 8 : 8) - 8;

    ctx.fillStyle = "#111111";
    ctx.font = "12px 'Atkinson Hyperlegible Bold'";
    const name = truncateToWidth(ctx, player.full_name, nameMaxWidth);
    ctx.textAlign = "center";
    ctx.fillText(name, x + 28 + nameMaxWidth / 2, footerY + 14);

    if (logo) {
      const logoScale = Math.min(logoSize / logo.width, logoSize / logo.height);
      const logoDw = logo.width * logoScale;
      const logoDh = logo.height * logoScale;
      const logoBoxX = x + CARD_W - logoSize - 8;
      const logoBoxY = footerY + 14 - logoSize;
      ctx.drawImage(
        logo,
        logoBoxX + (logoSize - logoDw) / 2,
        logoBoxY + (logoSize - logoDh) / 2,
        logoDw,
        logoDh
      );
    }
  } else {
    // Empty slot
    ctx.fillStyle = "#F5F5F5";
    ctx.fillRect(x, y, CARD_W, CARD_H);
    ctx.fillStyle = POSITION_COLORS[position] ?? "#AAAAAA";
    ctx.font = "11px 'Atkinson Hyperlegible Bold'";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(position, x + 8, y + CARD_H - 12);
  }

  ctx.restore();

  // Border, drawn outside the clip so corners stay crisp
  roundedRectPath(ctx, x, y, CARD_W, CARD_H, 8);
  ctx.strokeStyle = "#E5E5E5";
  ctx.lineWidth = 1;
  ctx.stroke();
}

async function drawRow(ctx: any, rowY: number, rowPrefix: string, lineup: Record<string, Player | null>) {
  for (let i = 0; i < POSITIONS.length; i++) {
    const pos = POSITIONS[i];
    const slotKey = `${rowPrefix}-${pos}`;
    const cardX = MARGIN + i * (CARD_W + CARD_GAP);
    await drawCard(ctx, cardX, rowY, pos, lineup[slotKey] ?? null);
  }
}

function drawSectionLabel(ctx: any, text: string, y: number) {
  ctx.fillStyle = "#888888";
  ctx.font = "12px 'Atkinson Hyperlegible Bold'";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  // letter-spacing isn't native to canvas; fake it for the all-caps labels
  let cursorX = MARGIN;
  for (const char of text) {
    ctx.fillText(char, cursorX, y);
    cursorX += ctx.measureText(char).width + 1.5;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body: SharePayload = await req.json();
    const { record, lineup } = body;

    if (!lineup) {
      return NextResponse.json({ error: "Missing lineup" }, { status: 400 });
    }

    ensureFonts();

    const canvas = createCanvas(CANVAS_W, CANVAS_H);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#FAFAFA";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Website
    ctx.fillStyle = "#21B8D6";
    ctx.font = "18px 'Atkinson Hyperlegible Bold'";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("10man82-0.com", MARGIN, MARGIN + 12);

    // Record
    ctx.fillStyle = "#111111";
    ctx.font = "36px 'Atkinson Hyperlegible Bold'";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(record ?? "", MARGIN, MARGIN + 54);

    let cursorY = MARGIN + HEADER_H + 12;

    drawSectionLabel(ctx, "STARTERS", cursorY + 16);
    cursorY += LABEL_H;
    await drawRow(ctx, cursorY, "starter", lineup);
    cursorY += CARD_H + ROW_GAP;

    drawSectionLabel(ctx, "BENCH", cursorY + 16);
    cursorY += LABEL_H;
    await drawRow(ctx, cursorY, "bench", lineup);

    const buffer = await canvas.encode("png");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("share-image generation failed:", err);
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
  }
}