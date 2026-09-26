import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTablesFromTextItems } from '../../src/lib/pdf-to-excel/table-extraction.ts';

const item = (str, x, y, width = 40) => ({ str, transform: [1, 0, 0, 10, x, y], width, height: 10 });

test('PDF table extraction recovers recurring rows and columns with typed values', () => {
  const tables = extractTablesFromTextItems([
    item('Item', 40, 700), item('Qty', 220, 700), item('Amount', 310, 700),
    item('Paper', 40, 680), item('2', 220, 680), item('$1,250.50', 310, 680),
    item('Ink', 40, 660), item('4', 220, 660), item('25%', 310, 660),
  ]);

  assert.equal(tables.length, 1);
  assert.equal(tables[0].columnCount, 3);
  assert.deepEqual(tables[0].rows[0], ['Item', 'Qty', 'Amount']);
  assert.deepEqual(tables[0].rows[1], ['Paper', 2, 1250.5]);
  assert.deepEqual(tables[0].rows[2], ['Ink', 4, 0.25]);
});

test('PDF table extraction separates distant table regions', () => {
  const tables = extractTablesFromTextItems([
    item('A', 40, 700), item('B', 180, 700),
    item('1', 40, 680), item('2', 180, 680),
    item('C', 40, 420), item('D', 180, 420),
    item('3', 40, 400), item('4', 180, 400),
  ]);

  assert.equal(tables.length, 2);
  assert.deepEqual(tables.map((table) => table.rows.length), [2, 2]);
});

test('plain paragraph lines are not mislabeled as a table', () => {
  const tables = extractTablesFromTextItems([
    item('A single paragraph line', 40, 700, 240),
    item('Another paragraph line', 40, 680, 220),
  ]);
  assert.deepEqual(tables, []);
});
test('text preservation keeps identifiers, dates and formula-like cells literal',()=>{
 const tables=extractTablesFromTextItems([item('ID',40,700),item('Value',220,700),item('00123',40,680),item('=1+1',220,680),item('2026-02-31',40,660),item('$1,250.50',220,660)],{preserveText:true});
 assert.deepEqual(tables[0].rows,[['ID','Value'],['00123','=1+1'],['2026-02-31','$1,250.50']]);
});
