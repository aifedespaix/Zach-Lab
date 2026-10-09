#!/usr/bin/env node
// Spike S2 — captures de référence d'une app, sans Tauri : Vite + Chromium préinstallé,
// avec un faux `__TAURI_INTERNALS__` injecté avant le chargement (le disque répond « rien »).
//
// Usage : node scripts/baseline-shots.mjs <app> [dossier-de-sortie]   (app = base | zachart-maths | zachart-mentale)
// Les captures vont par défaut dans `chantier/captures/<app>/` (ignoré par git).
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire('/opt/node-tools/node_modules/')
const { chromium } = require('playwright')

const PORTS = { base: 1440, 'zachart-maths': 1450, 'zachart-mentale': 1420 }
const app = process.argv[2] ?? 'base'
const port = PORTS[app]
if (!port) throw new Error(`App inconnue : ${app}`)
const out = resolve(process.argv[3] ?? `chantier/captures/${app}`)
mkdirSync(out, { recursive: true })

// Les plugins Tauri passent tous par `invoke` : on répond « absent / vide ».
const FAKE_TAURI = () => {
  let callbacks = 0
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} }
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main', windowLabel: 'main' } },
    transformCallback: () => ++callbacks,
    unregisterCallback: () => {},
    convertFileSrc: p => p,
    invoke: async cmd => {
      if (cmd.includes('event')) return 0
      if (cmd.includes('exists')) return false
      if (cmd.includes('read_dir')) return []
      if (cmd.includes('app_config_dir') || cmd.includes('resolve_directory')) return '/config'
      if (cmd.includes('check')) return null
      return null
    },
  }
}

const vite = spawn('bunx', ['vite', '--port', String(port), '--strictPort'], { cwd: resolve('apps', app), stdio: 'pipe' })
const ready = new Promise((ok, ko) => {
  vite.stdout.on('data', d => /Local:/.test(String(d)) && ok())
  vite.on('exit', code => ko(new Error(`vite a quitté (${code})`)))
  setTimeout(() => ko(new Error('vite trop long à démarrer')), 60_000)
})

try {
  await ready
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } })
  await page.addInitScript(FAKE_TAURI)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(`http://localhost:${port}/`)
  await page.waitForTimeout(1500)
  const shot = name => page.screenshot({ path: `${out}/${name}.png` })
  await shot('1-accueil')
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(400)
  await shot('2-palette')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Paramètres/ }).first().click()
  await page.waitForTimeout(500)
  await shot('3-reglages')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(400)
  await shot('4-panneau-replie')
  await page.mouse.click(700, 400, { button: 'right' })
  await page.waitForTimeout(300)
  await shot('5-menu-contextuel')
  await page.keyboard.press('Escape')
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(300)
  await shot('6-sombre')
  await browser.close()
  console.log(`6 captures dans ${out}${errors.length ? ` — erreurs de page : ${errors.slice(0, 3).join(' | ')}` : ''}`)
} finally {
  vite.kill()
}
