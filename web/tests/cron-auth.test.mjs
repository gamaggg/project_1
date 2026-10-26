import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isCronRequest } from '@/lib/cronAuth.ts'

const req = (auth) => new Request('https://x.test/api/telegram/send-notifications', { headers: auth ? { authorization: auth } : {} })

test('the right secret passes, a wrong one does not', () => {
  process.env.CRON_SECRET = 's3cret'
  assert.equal(isCronRequest(req('Bearer s3cret')), true)
  assert.equal(isCronRequest(req('Bearer s3creT')), false)
  assert.equal(isCronRequest(req('s3cret')), false)
  assert.equal(isCronRequest(req(null)), false)
})

test('with no secret configured nothing passes, not even «Bearer undefined»', () => {
  delete process.env.CRON_SECRET
  assert.equal(isCronRequest(req('Bearer undefined')), false)
  assert.equal(isCronRequest(req('Bearer ')), false)
  assert.equal(isCronRequest(req(null)), false)
})
