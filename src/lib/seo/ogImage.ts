/**
 * Build-time OG image template (spec Phase 6 C3): 1200x630, monochrome,
 * Satori + resvg. Fonts are read as .woff (Satori can't read .woff2).
 */
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { wrapOgTitle } from './ogTitle';

const WIDTH = 1200;
const HEIGHT = 630;

const COLORS = {
  obsidian900: '#0b0c0e',
  ice50: '#f1f4f7',
  red500: '#e10600',
  steel400: '#8b939d',
};

interface SatoriFont {
  name: string;
  data: Buffer;
  weight: 400 | 700 | 900;
  style: 'normal';
}

let fontsCache: SatoriFont[] | null = null;

function loadFonts(): SatoriFont[] {
  if (fontsCache) return fontsCache;
  fontsCache = [
    {
      name: 'Archivo',
      data: readFileSync('node_modules/@fontsource/archivo/files/archivo-latin-900-normal.woff'),
      weight: 900,
      style: 'normal',
    },
    {
      name: 'IBM Plex Mono',
      data: readFileSync(
        'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff',
      ),
      weight: 400,
      style: 'normal',
    },
    {
      name: 'IBM Plex Mono',
      data: readFileSync(
        'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff',
      ),
      weight: 700,
      style: 'normal',
    },
  ];
  return fontsCache;
}

export interface OgImageInput {
  /** Short section label, e.g. "ARTICLE", "TOOL", "REEL", "HOME". */
  eyebrow: string;
  title: string;
}

export async function renderOgImage(input: OgImageInput): Promise<Buffer> {
  const { lines, fontSize } = wrapOgTitle(input.title);

  const markup = {
    type: 'div',
    props: {
      style: {
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: COLORS.obsidian900,
        padding: '64px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', gap: '12px' },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: '14px',
                    height: '14px',
                    backgroundColor: COLORS.red500,
                  },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'Archivo',
                    fontWeight: 900,
                    fontSize: '30px',
                    letterSpacing: '0.01em',
                    color: COLORS.ice50,
                  },
                  children: 'EIDOLON',
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', gap: '20px' },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: '32px',
                    height: '4px',
                    backgroundColor: COLORS.red500,
                  },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'IBM Plex Mono',
                    fontWeight: 700,
                    fontSize: '20px',
                    letterSpacing: '0.1em',
                    color: COLORS.red500,
                  },
                  children: input.eyebrow.toUpperCase(),
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    fontFamily: 'Archivo',
                    fontWeight: 900,
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.08,
                    letterSpacing: '-0.01em',
                    color: COLORS.ice50,
                  },
                  children: lines.map((line) => ({
                    type: 'div',
                    props: { children: line },
                  })),
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontFamily: 'IBM Plex Mono',
              fontSize: '18px',
              color: COLORS.steel400,
            },
            children: 'eidolon.cloud',
          },
        },
      ],
    },
  };

  const svg = await satori(markup, { width: WIDTH, height: HEIGHT, fonts: loadFonts() });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } });
  return Buffer.from(resvg.render().asPng());
}
