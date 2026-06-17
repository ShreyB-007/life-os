import { test, expect } from '@playwright/test'

const ALLOWED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '.supabase.co',
  '.supabase.in',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
]

function isAllowed(hostname) {
  return ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith(d))
}

test.describe('network', () => {
  test('net-01 no requests to unexpected domains', async ({ page }) => {
    const offenders = []
    page.on('request', req => {
      try {
        const url = new URL(req.url())
        if (!isAllowed(url.hostname)) offenders.push(url.href)
      } catch {}
    })
    await page.goto('/')
    await page.waitForTimeout(1500)
    expect(offenders, `Unexpected domains contacted: ${offenders.join(', ')}`).toEqual([])
  })

  test('net-02 no response triggers a file download (Content-Disposition: attachment)', async ({ page }) => {
    const downloads = []
    page.on('response', async res => {
      const headers = res.headers()
      const disposition = headers['content-disposition']
      if (disposition && disposition.toLowerCase().includes('attachment')) {
        downloads.push(`${res.url()} -> ${disposition}`)
      }
    })
    await page.goto('/')
    await page.waitForTimeout(1500)
    expect(downloads, `Spurious download-triggering responses: ${downloads.join(', ')}`).toEqual([])
  })

  test('net-03 no 5xx responses from Supabase', async ({ page }) => {
    const serverErrors = []
    page.on('response', res => {
      if (res.url().includes('supabase') && res.status() >= 500) {
        serverErrors.push(`${res.status()} ${res.url()}`)
      }
    })
    await page.goto('/')
    await page.waitForTimeout(1500)
    expect(serverErrors, `Supabase 5xx errors: ${serverErrors.join(', ')}`).toEqual([])
  })

  test('net-04 no uncaught JS console errors on page load', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    await page.goto('/')
    await page.waitForTimeout(1500)
    expect(errors, `Console errors: ${errors.join(', ')}`).toEqual([])
  })

  test('net-05 no runaway polling after page idle', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    let countAfterIdle = 0
    page.on('request', () => { countAfterIdle++ })
    await page.waitForTimeout(3000)
    expect(countAfterIdle, `${countAfterIdle} requests fired during a 3s idle window with no user interaction`).toBeLessThanOrEqual(2)
  })
})
