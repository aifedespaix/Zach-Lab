import { describe, expect, it } from 'vitest'

// `?raw` rather than `readFileSync`: these tests run under jsdom, where
// `import.meta.url` is an http: URL and cannot be resolved to a path, and a
// cwd-relative path would silently depend on where vitest was launched from.
import cargoToml from '../../src-tauri/Cargo.toml?raw'
import tauriConfig from '../../src-tauri/tauri.conf.json'
import { windowTitleFor } from '../persistence/windowTitle'

/**
 * `productName` is substituted verbatim into NSIS shortcut paths, and several
 * of Tauri's installer macros wrap those paths in a single-quoted COM argument
 * list — e.g. `${IPersistFile::Load} $1 '("${shortcut}", ${STGM_READ})'`. A
 * straight ASCII apostrophe closes that string early, so makensis miscounts the
 * macro arguments and the whole bundle step aborts:
 *
 *   !insertmacro: macro "NSISCOMCALL" requires 4 parameter(s), passed 7!
 *
 * That is exactly what killed the v0.1.0 release: the app compiled, the
 * installer never got built, and the tag ended up with nothing but GitHub's
 * automatic source archives. The typographic apostrophe (U+2019) reads the
 * same, is the correct French one, and is not an NSIS string delimiter.
 */
describe('packaging', () => {
  it('keeps the ASCII apostrophe out of productName so makensis can bundle', () => {
    expect(tauriConfig.productName).not.toContain("'")
  })

  it('spells the app name the same way in the installer and in the app itself', () => {
    expect(windowTitleFor(null)).toBe(tauriConfig.productName)
    expect(tauriConfig.app.windows[0].title).toBe(tauriConfig.productName)
  })
})

/**
 * Card images are served to the webview through `convertFileSrc`, which mints
 * an `asset:` / `http://asset.localhost` URL. Nothing answers on that origin
 * unless BOTH halves are in place, and neither of them fails loudly:
 *
 * - the `protocol-asset` Cargo feature, which is what compiles the protocol
 *   handler in at all (`tauri/src/manager/webview.rs`, `#[cfg(feature = …)]`);
 * - `app.security.assetProtocol`, whose `enable` and `scope` decide whether
 *   the handler serves anything once compiled.
 *
 * With either one missing, the image is written to the sidecar, the block is
 * saved, and the `<img>` simply never resolves — a broken picture, no error,
 * no log. That is exactly how it shipped, and it is not a state a human
 * notices without opening a card. Hence a test rather than a comment.
 */
describe('asset protocol', () => {
  it('is enabled, so card images resolve in the webview', () => {
    expect(tauriConfig.app.security.assetProtocol.enable).toBe(true)
  })

  it('is scoped to the same tree the file plugin can read', () => {
    // Two INDEPENDENT scopes: `fs:scope` governs `readFile`, this one governs
    // what the protocol will serve. Granting only one is the shape the bug
    // took, and it looks correct at a glance.
    const fsScope = tauriConfig.app.security.assetProtocol.scope
    expect(fsScope).toContain('$HOME/**')
  })

  it('compiles the protocol handler in, via the Cargo feature', () => {
    const tauriDependency = cargoToml
      .split('\n')
      .find(line => line.startsWith('tauri = '))
    expect(tauriDependency).toBeDefined()
    expect(tauriDependency).toContain('protocol-asset')
  })
})

/**
 * The app checks for updates against `plugins.updater.endpoints`, and installs
 * in the field poll whatever THEIR version shipped with. A release built with a
 * wrong endpoint strands every user of that version: they never see another
 * update, and nothing on their screen says so.
 */
describe('updater', () => {
  const updater = tauriConfig.plugins.updater

  it('verifies updates against a public key', () => {
    // An empty key would make the plugin accept nothing — or, worse, depending
    // on the version, skip the check.
    expect(updater.pubkey.length).toBeGreaterThan(40)
  })

  it('only polls over HTTPS', () => {
    expect(updater.endpoints.length).toBeGreaterThan(0)
    for (const endpoint of updater.endpoints) expect(endpoint).toMatch(/^https:\/\//)
  })

  it('produces the signed artifacts the updater needs', () => {
    expect(tauriConfig.bundle.createUpdaterArtifacts).toBe(true)
  })

  it('polls the rolling release first, then the legacy endpoint (docs/RELEASE.md)', () => {
    // Transition release: installs already in the field only know
    // `releases/latest`, which means « the newest release of the WHOLE
    // repository » and works only while Zachar’t Mentale is the one app published
    // as a normal release. The legacy endpoint stays last, and valid, until no old
    // install remains — docs/RELEASE.md, « Migration de l’endpoint ». Change both
    // this test and that document together.
    expect(updater.endpoints).toEqual([
      'https://github.com/aifedespaix/Zachar-t-Mentale/releases/download/updater-zachart/latest.json',
      'https://github.com/aifedespaix/Zachar-t-Mentale/releases/latest/download/latest.json',
    ])
  })
})
