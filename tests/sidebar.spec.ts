// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSidebarShortcuts } from '../src/spotlight/sidebar.ts'
import { installVisibleRects } from './dom.ts'

function keydown(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  window.dispatchEvent(event)
  return event
}

function sessionTree(): HTMLElement[] {
  document.body.innerHTML = `
    <div role="tree">
      <div id="workspace" role="treeitem" aria-expanded="true">Workspace</div>
      <div id="session-a" role="treeitem" aria-selected="false">Alpha</div>
      <div id="session-b" role="treeitem" aria-selected="true">Beta</div>
      <div id="session-c" role="treeitem" aria-selected="false">Charlie</div>
    </div>
  `
  return ['session-a', 'session-b', 'session-c'].map(id => document.getElementById(id)!)
}

beforeEach(() => {
  document.body.innerHTML = ''
  installVisibleRects()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sidebar session shortcuts', () => {
  it('shows hints while Alt is held and removes them on release', () => {
    sessionTree()
    const dispose = mountSidebarShortcuts(document, window, true, () => false)

    keydown('Alt', { altKey: true })
    expect([...document.querySelectorAll('[data-dsh-sidebar-shortcut]')]
      .map(hint => hint.textContent)).toEqual(['⌥⇧1', '⌥⇧2', '⌥⇧3'])

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', bubbles: true }))
    expect(document.querySelector('[data-dsh-sidebar-shortcuts]')).toBeNull()
    dispose()
  })

  it('executes the matching visible session and yields to the palette', () => {
    const rows = sessionTree()
    const clicks = rows.map(row => vi.spyOn(row, 'click'))
    let paletteOpen = false
    const dispose = mountSidebarShortcuts(document, window, false, () => paletteOpen)

    const direct = keydown('@', { code: 'Digit2', altKey: true, shiftKey: true })
    expect(direct.defaultPrevented).toBe(true)
    expect(clicks[1]).toHaveBeenCalledOnce()

    paletteOpen = true
    const suppressed = keydown('!', { code: 'Digit1', altKey: true, shiftKey: true })
    expect(suppressed.defaultPrevented).toBe(false)
    expect(clicks[0]).not.toHaveBeenCalled()
    dispose()
  })

  it('numbers only fully visible session rows in visual order', () => {
    const rows = sessionTree()
    const tree = document.querySelector<HTMLElement>('[role="tree"]')!
    tree.style.overflowY = 'auto'
    const rect = (top: number, bottom: number): DOMRect => ({
      top, bottom, left: 0, right: 300, width: 300, height: bottom - top,
      x: 0, y: top, toJSON: () => ({}),
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this === tree) return rect(0, 100)
      if (this === rows[0]) return rect(-20, 20)
      if (this === rows[1]) return rect(20, 60)
      if (this === rows[2]) return rect(60, 100)
      return rect(0, 0)
    })
    const dispose = mountSidebarShortcuts(document, window, false, () => false)

    keydown('Alt', { altKey: true })
    expect([...document.querySelectorAll('[data-dsh-sidebar-shortcut]')]
      .map(hint => hint.textContent)).toEqual(['Alt+Shift+1', 'Alt+Shift+2'])

    const direct = keydown('!', { code: 'Digit1', altKey: true, shiftKey: true })
    expect(direct.defaultPrevented).toBe(true)
    expect(document.querySelector('[data-dsh-sidebar-shortcuts]')).not.toBeNull()
    dispose()
  })
})
