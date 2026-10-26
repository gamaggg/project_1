import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRIVACY_DOCS } from '@/lib/data/privacy.ts'
import { LANDING_DOCS } from '@/lib/data/landing.ts'

// The three languages of the privacy policy and of the landing page must keep the same
// shape: a paragraph added to one and not the others is how translations drift apart.

test('the privacy policy has the same sections and list lengths in every language', () => {
  const shape = (doc) => doc.sections.map((s) => s.blocks.map((b) => (Array.isArray(b) ? b.length : 0)).join('.'))
  assert.deepEqual(shape(PRIVACY_DOCS.en), shape(PRIVACY_DOCS.ru))
  assert.deepEqual(shape(PRIVACY_DOCS.ka), shape(PRIVACY_DOCS.ru))
})

test('the landing page has the same steps, features, cities and questions in every language', () => {
  for (const lang of ['en', 'ka']) {
    const a = LANDING_DOCS.ru
    const b = LANDING_DOCS[lang]
    assert.equal(b.steps.length, a.steps.length)
    assert.equal(b.features.length, a.features.length)
    assert.equal(b.cities.length, a.cities.length)
    assert.equal(b.faq.length, a.faq.length)
  }
})

test('no text is empty', () => {
  for (const doc of Object.values(LANDING_DOCS)) {
    for (const v of [doc.h1, doc.lead, doc.metaTitle, doc.metaDescription, ...doc.steps.flatMap((s) => [s.title, s.text]), ...doc.faq.flatMap((f) => [f.q, f.a])]) {
      assert.ok(v.trim().length > 0)
    }
  }
  for (const doc of Object.values(PRIVACY_DOCS)) assert.ok(doc.sections.every((s) => s.title.trim() && s.blocks.length > 0))
})
