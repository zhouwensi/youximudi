/**
 * 从 Stop Killing Games Wiki 的 Dead game list 拉取数据并合并到 data/games.json
 * 仅导入 State 为 Dead、Fan-Resurrected 的条目（排除 At Risk / Fan-Preserved / Dev-Preserved）。
 * 许可：wiki.gg 内容通常为 CC BY-SA，请在展示中保留来源说明（已写入 description）。
 *
 * 用法：node scripts/import-skg-dead-games.mjs
 * 需在 youximudi 目录下执行（或设置 cwd）。
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const GAMES_PATH = path.join(ROOT, 'data', 'games.json');
const API =
  'https://stopkillinggames.wiki.gg/api.php?action=parse&page=Dead_game_list&prop=wikitext&format=json';

const IMPORT_STATES = new Set(['Dead', 'Fan-Resurrected']);

function stripWiki(s) {
  if (!s) return '';
  return s
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, (_, x) => {
      const parts = x.split('|');
      return parts[parts.length - 1];
    })
    .replace(/''+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\{\{[^}]+\}\}/g, '')
    .trim();
}

function parseRowCells(segment) {
  const lines = segment.split('\n');
  const cells = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('|')) {
      cells.push(line.slice(1));
    } else if (cells.length) {
      cells[cells.length - 1] += '\n' + line;
    }
  }
  return cells.map((c) => stripWiki(c));
}

function extractMainTable(wikitext) {
  const start = wikitext.indexOf('id="dead-game-table"');
  if (start === -1) throw new Error('dead-game-table not found');
  const sub = wikitext.slice(start);
  const end = sub.indexOf('\n|}');
  if (end === -1) throw new Error('table end not found');
  return sub.slice(0, end);
}

function normDate(raw) {
  if (!raw) return null;
  const t = String(raw).trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (/^\d{4}-\d{2}-\?\?$/.test(t)) return t.slice(0, 7) + '-01';
  if (/^\d{4}-\?\?-\?\?$/.test(t)) return t.slice(0, 4) + '-01-01';
  if (/^\d{4}$/.test(t)) return t + '-01-01';
  return t;
}

function stableId(game, publisher, release, death) {
  const h = crypto
    .createHash('sha1')
    .update([game, publisher || '', release || '', death || ''].join('\0'))
    .digest('hex')
    .slice(0, 10);
  const slug = game
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return 'skg-' + (slug || 'game') + '-' + h;
}

function mapStatus(state) {
  if (state === 'Dead') return '已停服';
  if (state === 'Fan-Resurrected') return '被遗忘的佳作';
  return null;
}

function genreFromRow(subscription, platform) {
  const p = (platform || '').toLowerCase();
  if (/web|browser|flash/i.test(p)) return '网页/在线';
  if (/android|ios|iphone|mobile/i.test(p)) return '手游';
  if (/ps|xbox|switch|wii|3ds|stadia/i.test(p)) return '主机/跨平台';
  if (subscription === 'Yes') return '订阅制在线';
  return '在线/多人';
}

async function fetchWikitext() {
  const r = await fetch(API, { headers: { 'User-Agent': 'youximudi-importer/1.0 (educational; contact: local)' } });
  if (!r.ok) throw new Error('API HTTP ' + r.status);
  const j = await r.json();
  const w = j?.parse?.wikitext?.['*'];
  if (!w) throw new Error('Unexpected API JSON');
  return w;
}

function parseImportedRows(wikitext) {
  const table = extractMainTable(wikitext);
  const chunks = table.split(/\n\|-\n/);
  const out = [];
  const skipped = { wrongState: 0, badCells: 0, noName: 0 };

  for (let i = 1; i < chunks.length; i++) {
    const cells = parseRowCells(chunks[i]);
    if (cells.length < 10) {
      skipped.badCells++;
      continue;
    }
    const state = cells[0];
    if (!IMPORT_STATES.has(state)) {
      skipped.wrongState++;
      continue;
    }
    const name = cells[3];
    if (!name) {
      skipped.noName++;
      continue;
    }
    const publisher = cells[4] || '';
    const platform = cells[5] || '';
    const release = normDate(cells[6]);
    const death = normDate(cells[7]);
    const home = cells[8] || '';
    const notes = cells[9] || '';

    const status = mapStatus(state);
    if (!status) continue;

    let description = '';
    if (notes) description += notes + ' ';
    if (home) description += '主页/存档链接：' + home + ' ';
    description +=
      '数据摘录自 Stop Killing Games Wiki「Dead game list」（https://stopkillinggames.wiki.gg/wiki/Dead_game_list），以 CC BY-SA 等维基许可为准。';
    description = description.trim();

    let epitaph = notes ? notes.replace(/\s+/g, ' ').trim() : '';
    if (epitaph.length > 120) epitaph = epitaph.slice(0, 117) + '…';
    if (!epitaph) epitaph = 'Officially gone; remembered on the list.';

    out.push({
      id: stableId(name, publisher, cells[6], cells[7]),
      name,
      status,
      platform: platform || '未知',
      genre: genreFromRow(cells[2], platform),
      developer: '',
      publisher: publisher || '',
      born: release,
      died: death,
      description,
      epitaph,
      _skgState: state
    });
  }

  return { rows: out, skipped };
}

function normNameKey(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
    .trim();
}

function main() {
  return fetchWikitext()
    .then((wikitext) => parseImportedRows(wikitext))
    .then(({ rows, skipped }) => {
      const existing = JSON.parse(fs.readFileSync(GAMES_PATH, 'utf8'));
      if (!Array.isArray(existing)) throw new Error('games.json must be an array');

      const handcrafted = existing.filter((g) => !String(g.id || '').startsWith('skg-'));
      const nameKeys = new Set();
      handcrafted.forEach((g) => {
        if (g.name) nameKeys.add(normNameKey(g.name));
      });

      const imported = [];
      for (const r of rows) {
        if (nameKeys.has(normNameKey(r.name))) continue;
        const { _skgState, ...rest } = r;
        imported.push(rest);
        nameKeys.add(normNameKey(r.name));
      }

      imported.sort((a, b) => {
        const da = String(a.died || '');
        const db = String(b.died || '');
        if (da !== db) return db.localeCompare(da);
        return String(a.name).localeCompare(String(b.name));
      });

      const all = handcrafted.concat(imported);

      fs.writeFileSync(GAMES_PATH, JSON.stringify(all, null, 2) + '\n', 'utf8');

      console.log('SKG import done.');
      console.log('Parsed importable rows:', rows.length);
      console.log('Skipped:', skipped);
      console.log('Imported (after name-dedup vs handcrafted):', imported.length);
      console.log('Handcrafted kept:', handcrafted.length, '→ Total:', all.length);
    });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
