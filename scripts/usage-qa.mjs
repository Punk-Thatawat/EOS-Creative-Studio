import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/usage/usage-utils.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { chartBounds, visibleTrend, activityLabel, creditLabel, activityCsv, csvCell, signed } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
let checks = 0;
assert.equal(creditLabel({transactionType:'usage',artwork:{name:'Mountain'}}), 'หักเครดิตสร้างผลงาน');
assert.equal(activityLabel({transactionType:'usage',artwork:{name:'Mountain'}}), 'Mountain');
assert.equal(creditLabel({transactionType:'refund'}), 'คืนเครดิต');
assert.equal(creditLabel({transactionType:'grant',referenceType:'stripe_checkout'}), 'เติมเครดิตผ่าน Stripe');
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
check('zero chart has finite positive range', () => assert.deepEqual(chartBounds([0,0]), { min:0,max:3 }));
check('102 peak uses 150 top axis', () => assert.deepEqual(chartBounds([0,102]), { min:0,max:150 }));
check('refunds below zero are not clipped', () => { const b=chartBounds([-25,80]); assert.ok(b.min<=-25 && b.max>=80); });
check('signed fractional credit movements', () => { assert.equal(signed(-1.25), '-1.25'); assert.equal(signed(10000), '+10,000'); });
check('Stripe grant labelled topup', () => assert.equal(activityLabel({transactionType:'grant',referenceType:'stripe_checkout'}), 'เติมเครดิตผ่าน Stripe'));
check('admin grant is not called payment', () => assert.equal(activityLabel({transactionType:'grant',referenceType:'admin_adjustment'}), 'ปรับเครดิตโดยผู้ดูแล'));
check('refund label', () => assert.equal(activityLabel({transactionType:'refund'}),'คืนเครดิต'));
check('CSV formula injection escaped but negative numbers retained', () => { assert.equal(csvCell('=SUM(A1:A3)'), '"\'=SUM(A1:A3)"'); assert.equal(csvCell(-24),'"-24"'); assert.equal(csvCell('a"b'),'"a""b"'); });
check('CSV contains recorded balance', () => { const csv=activityCsv([{createdAt:'2026-09-04',title:'AI Image Generation',amount:-24,balanceAfter:9898,id:'id1',transactionType:'usage'}]); assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('"9898"')); });
check('future chart points removed; latest seven preserved', () => { const points=Array.from({length:30},(_,i)=>({date:`2026-09-${String(i+1).padStart(2,'0')}T00:00:00Z`,credits:0})); const result=visibleTrend({period:{isCurrent:true},generatedAt:'2026-09-10T00:00:00Z',trend:{points}}); assert.equal(result.length,7); assert.equal(result[0].date.slice(8,10),'04'); assert.equal(result[6].date.slice(8,10),'10'); });
console.log(`${checks} usage checks passed`);
