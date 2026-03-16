import fs from 'node:fs';
import path from 'node:path';

import { TRUST_FLOWS } from '@/app/navigation/flows';

describe('tab icon mapping', () => {
  it('maps every TRUST_FLOWS symbol to a Material icon fallback for Android/web', () => {
    const iconSymbolPath = path.resolve(__dirname, '../../components/ui/icon-symbol.tsx');
    const source = fs.readFileSync(iconSymbolPath, 'utf8');

    const configuredSymbols = new Set(
      [...source.matchAll(/\s+'([^']+)'\s*:/g)].map((match) => match[1])
    );

    for (const flow of TRUST_FLOWS) {
      expect(configuredSymbols.has(flow.icon)).toBe(true);
    }
  });
});
