import { directResultIndex, formatResultShortcut } from './keyboard.ts'

const SESSION_ROW_SELECTOR = '[role="tree"] [role="treeitem"][aria-selected]'
const ROOT_ATTRIBUTE = 'data-dsh-sidebar-shortcuts'
const HINT_ATTRIBUTE = 'data-dsh-sidebar-shortcut'

function fullyVisible(row: HTMLElement, window: Window): boolean {
  const bounds = row.getBoundingClientRect()
  let top = 0
  let bottom = window.innerHeight
  let ancestor = row.parentElement
  while (ancestor !== null && ancestor !== row.ownerDocument.body) {
    const overflow = window.getComputedStyle(ancestor).overflowY
    if (new RegExp('^(?:auto|scroll|hidden|clip)$').test(overflow)) {
      const clip = ancestor.getBoundingClientRect()
      top = Math.max(top, clip.top)
      bottom = Math.min(bottom, clip.bottom)
    }
    ancestor = ancestor.parentElement
  }
  return bounds.top >= top - 0.5 && bounds.bottom <= bottom + 0.5
}

/**
 * Add Codex-style transient shortcut hints to the stock session sidebar.
 * The host owns row rendering and activation; this module only overlays hints
 * and clicks the exact visible row selected by the shared direct shortcut.
 */
export function mountSidebarShortcuts(
  document: Document,
  window: Window,
  applePlatform: boolean,
  isSuppressed: () => boolean,
): () => void {
  let active = false
  let root: HTMLElement | undefined
  let visibleRows: HTMLElement[] = []

  const blocked = (): boolean =>
    isSuppressed() || document.querySelector('[role="dialog"]') !== null

  const observer = new MutationObserver(() => { refresh() })

  function removeOverlay(): void {
    root?.remove()
    root = undefined
    visibleRows = []
  }

  function refresh(): void {
    observer.disconnect()
    removeOverlay()
    if (!active || blocked()) {
      active = false
      return
    }
    visibleRows = [...document.querySelectorAll<HTMLElement>(SESSION_ROW_SELECTOR)]
      .filter(row => row.getClientRects().length > 0 && fullyVisible(row, window))
      .slice(0, 9)
    const overlay = document.createElement('div')
    overlay.setAttribute(ROOT_ATTRIBUTE, '')
    overlay.setAttribute('aria-hidden', 'true')
    visibleRows.forEach((row, index) => {
      const bounds = row.getBoundingClientRect()
      const hint = document.createElement('kbd')
      hint.setAttribute(HINT_ATTRIBUTE, '')
      hint.textContent = formatResultShortcut(index, applePlatform)
      hint.style.left = `${bounds.right - 8}px`
      hint.style.top = `${(bounds.top + bounds.bottom) / 2}px`
      overlay.appendChild(hint)
    })
    document.body.appendChild(overlay)
    root = overlay
    observer.observe(document.body, { childList: true, subtree: true })
  }

  function show(): void {
    active = true
    refresh()
  }

  function hide(): void {
    active = false
    observer.disconnect()
    removeOverlay()
  }

  const onKeydown = (event: KeyboardEvent): void => {
    // oxlint-disable-next-line typescript/no-deprecated
    if (event.isComposing || event.keyCode === 229 || blocked()) {
      hide()
      return
    }
    if (event.altKey && !event.ctrlKey && !event.metaKey) show()
    const directIndex = directResultIndex(event)
    const row = directIndex === undefined ? undefined : visibleRows[directIndex]
    if (row === undefined) return
    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat) row.click()
  }
  const onKeyup = (event: KeyboardEvent): void => {
    if (event.key === 'Alt' || !event.altKey) hide()
  }
  const onBlur = (): void => { hide() }
  const onVisibilityChange = (): void => {
    if (document.visibilityState !== 'visible') hide()
  }
  const onViewportChange = (): void => {
    if (active) refresh()
  }

  window.addEventListener('keydown', onKeydown, true)
  window.addEventListener('keyup', onKeyup, true)
  window.addEventListener('blur', onBlur)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    window.removeEventListener('keydown', onKeydown, true)
    window.removeEventListener('keyup', onKeyup, true)
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('resize', onViewportChange)
    window.removeEventListener('scroll', onViewportChange, true)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    hide()
  }
}
