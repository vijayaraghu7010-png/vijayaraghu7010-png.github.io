import test from 'node:test';
import assert from 'node:assert/strict';

import { sortFields, sortGroups, groupLabel } from '../src/admin/contentOrder.js';

/* The order the Site text panel lists things in.

   The rows come back sorted by key, and alphabetical is not the
   order anybody reads a page in: it put `benefit.0.text` above
   `benefit.0.title`, and the home hero came out as ctaPrimary,
   ctaSecondary, eyebrow, text, title - the heading last, the buttons
   first, and every sentence separated from the heading it sits
   under. These pin the order to the way the page actually reads. */

const keys = (rows) => sortFields(rows).map((r) => r.key);
const rows = (...ks) => ks.map((key) => ({ key }));

test('a heading comes before the words under it', () => {
  assert.deepEqual(
    keys(rows('benefit.0.text', 'benefit.0.title')),
    ['benefit.0.title', 'benefit.0.text']
  );
});

test('the home hero reads down the page, not down the alphabet', () => {
  /* Exactly the five the shop has, in the order they appear. */
  assert.deepEqual(
    keys(rows('home.hero.ctaPrimary', 'home.hero.ctaSecondary', 'home.hero.eyebrow',
              'home.hero.text', 'home.hero.title')),
    ['home.hero.eyebrow', 'home.hero.title', 'home.hero.text',
     'home.hero.ctaPrimary', 'home.hero.ctaSecondary']
  );
});

test('a category card reads title, description, button', () => {
  assert.deepEqual(
    keys(rows('category.bouquet.cta', 'category.bouquet.description', 'category.bouquet.title')),
    ['category.bouquet.title', 'category.bouquet.description', 'category.bouquet.cta']
  );
});

test('a page title comes before its subtitle', () => {
  assert.deepEqual(
    keys(rows('bouquets.subtitle', 'bouquets.title')),
    ['bouquets.title', 'bouquets.subtitle']
  );
});

test('each numbered item is kept whole, in number order', () => {
  const out = keys(rows(
    'benefit.1.text', 'benefit.0.title', 'benefit.1.title', 'benefit.0.text'
  ));
  assert.deepEqual(out, [
    'benefit.0.title', 'benefit.0.text', 'benefit.1.title', 'benefit.1.text'
  ]);
});

test('ten comes after two, which a string compare gets wrong', () => {
  assert.deepEqual(
    keys(rows('benefit.10.title', 'benefit.2.title', 'benefit.1.title')),
    ['benefit.1.title', 'benefit.2.title', 'benefit.10.title']
  );
});

test('a field nobody has ranked still appears, after the ranked ones', () => {
  const out = keys(rows('thing.somethingNew', 'thing.title', 'thing.text'));
  assert.deepEqual(out, ['thing.title', 'thing.text', 'thing.somethingNew']);
});

/* ------------------------------------------------------------ groups */

test('the groups run in the order the site is built', () => {
  assert.deepEqual(
    sortGroups(['contact', 'benefits', 'home', 'bouquets', 'brand', 'categories']),
    ['brand', 'home', 'benefits', 'categories', 'bouquets', 'contact']
  );
});

test('a group nobody has placed still shows, after the placed ones', () => {
  const out = sortGroups(['zzz-new', 'home', 'aaa-new', 'brand']);
  assert.deepEqual(out, ['brand', 'home', 'aaa-new', 'zzz-new']);
});

test('groups are named rather than slugged', () => {
  assert.equal(groupLabel('benefits'), 'Why WrappedStudio');
  assert.equal(groupLabel('home'), 'Home page');
  /* and one nobody named */
  assert.equal(groupLabel('shipping_info'), 'Shipping info');
});

test('every row that goes in comes out, once', () => {
  /* A sort that quietly drops a field would hide a string from the
     studio for ever. */
  const all = rows(
    'brand.name', 'brand.tagline', 'brand.footerLine',
    'home.hero.title', 'home.hero.text', 'contact.phone', 'oddity'
  );
  const out = sortFields(all);
  assert.equal(out.length, all.length);
  assert.deepEqual(new Set(out.map((r) => r.key)), new Set(all.map((r) => r.key)));
});
