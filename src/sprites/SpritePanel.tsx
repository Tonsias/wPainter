import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './SpritePanel.css'
import { writePixels } from '../document/composite.ts'
import { buildSpriteTree, countSprites, matchesQuery, type Sprite, type SpriteNode } from './library.ts'
import type { SpriteFile } from './loadSprites.ts'
import { askFolderAccess, forgetFolder, hasFolderAccess, pickFolder, readFolder, recallFolder, rememberFolder, supportsFolderPicker } from './spriteFolder.ts'

type Props = {
  sprites: readonly Sprite[]
  activeId: string | null
  loading: boolean
  processed: number
  total: number
  skipped: number
  issues: readonly string[]
  scale: number
  onScale: (scale: number) => void
  onLoad: (files: SpriteFile[]) => void
  onPick: (sprite: Sprite) => void
}

type BranchProps = { node: SpriteNode; activeId: string | null; isOpen: (path: string) => boolean; onToggle: (path: string) => void; onPick: (sprite: Sprite) => void }

function Thumbnail({ sprite }: { sprite: Sprite }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      const context = canvas.getContext('2d')
      if (!context) return
      const image = new ImageData(sprite.width, sprite.height)
      writePixels(sprite.pixels, image.data)
      context.putImageData(image, 0, 0)
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [sprite])
  return <canvas className="sprites__thumb" ref={ref} width={sprite.width} height={sprite.height} />
}

function Branch({ node, activeId, isOpen, onToggle, onPick }: BranchProps) {
  return <ul className="sprites__branch">
    {node.folders.map((folder) => {
      const open = isOpen(folder.path)
      return <li key={folder.path}><button type="button" className="sprites__folder" aria-expanded={open} onClick={() => onToggle(folder.path)}><span className="sprites__caret" aria-hidden="true">{open ? '▾' : '▸'}</span><span className="sprites__label">{folder.name}</span><span className="sprites__count">{countSprites(folder)}</span></button>{open && <Branch node={folder} activeId={activeId} isOpen={isOpen} onToggle={onToggle} onPick={onPick} />}</li>
    })}
    {node.sprites.map((sprite) => <li key={sprite.id}><button type="button" title={`${sprite.name} · ${sprite.width}×${sprite.height}`} className={`sprites__leaf${sprite.id === activeId ? ' sprites__leaf--active' : ''}`} onClick={() => onPick(sprite)}><Thumbnail sprite={sprite} /><span className="sprites__label">{sprite.name}</span><span className="sprites__count">{sprite.width}×{sprite.height}</span></button></li>)}
  </ul>
}

export function SpritePanel({ sprites, activeId, loading, processed, total, skipped, issues, scale, onScale, onLoad, onPick }: Props) {
  const [query, setQuery] = useState('')
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const [folder, setFolder] = useState<FileSystemDirectoryHandle | null>(null)
  const [reading, setReading] = useState(false)
  const pickerRef = useRef<HTMLInputElement | null>(null)
  const loadRef = useRef(onLoad)
  loadRef.current = onLoad
  const readInto = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setReading(true)
    try { loadRef.current(await readFolder(handle)) } catch { setFolder(null); await forgetFolder() } finally { setReading(false) }
  }, [])
  useEffect(() => {
    let cancelled = false
    void (async () => { const handle = await recallFolder(); if (!handle || cancelled) return; setFolder(handle); if (await hasFolderAccess(handle)) await readInto(handle) })()
    return () => { cancelled = true }
  }, [readInto])
  const choose = async () => { const handle = await pickFolder(); if (!handle) return; setFolder(handle); await rememberFolder(handle); await readInto(handle) }
  const tree = useMemo(() => buildSpriteTree(sprites.filter((sprite) => matchesQuery(sprite, query))), [sprites, query])
  const busy = loading || reading
  const filtering = query.trim() !== ''
  const isOpen = (path: string) => filtering || opened.has(path)
  const toggle = (path: string) => setOpened((current) => { const next = new Set(current); if (!next.delete(path)) next.add(path); return next })
  const selected = sprites.some((sprite) => sprite.id === activeId)
  return <div className="sprites">
    <input className="sprites__picker" type="file" multiple ref={(node) => { pickerRef.current = node; node?.setAttribute('webkitdirectory', '') }} onChange={(event) => { onLoad([...(event.target.files ?? [])].map((file) => ({ file, path: file.webkitRelativePath || file.name }))); event.target.value = '' }} />
    <div className="sprites__bar"><button type="button" className="btn sprites__load" disabled={busy} onClick={() => (supportsFolderPicker() ? void choose() : pickerRef.current?.click())}>{busy ? (loading ? `Loading ${processed}/${total}…` : 'Reading…') : 'Choose folder'}</button>{folder && sprites.length === 0 && !busy && <button type="button" className="btn sprites__load" title={folder.name} onClick={() => void askFolderAccess(folder).then(async (granted) => { if (granted) await readInto(folder) })}>Reopen <span className="sprites__label">{folder.name}</span></button>}{sprites.length > 0 && <input className="sprites__search" type="search" placeholder="Filter" value={query} onChange={(event) => setQuery(event.target.value)} />}</div>
    {selected && <div className="sprites__scale"><label htmlFor="sprite-scale">Scale: <strong>{Math.round(scale * 100)}%</strong></label><input id="sprite-scale" type="range" min="10" max="800" step="10" value={Math.round(scale * 100)} onChange={(event) => onScale(Number(event.target.value) / 100)} /><input className="sprites__scale-value" type="number" min="10" max="800" step="10" value={Math.round(scale * 100)} aria-label="Sprite scale percent" onChange={(event) => onScale(Math.max(0.1, Math.min(8, Number(event.target.value) / 100 || 1)))} /></div>}
    {loading && <p className="sprites__note" aria-live="polite">{processed} / {total} sprites loaded · {sprites.length} available</p>}
    {(sprites.length > 0 || skipped > 0) && <p className="sprites__note">{sprites.length} sprites{skipped > 0 ? ` · ${skipped} file(s) skipped` : ''}</p>}
    {issues.length > 0 && <details className="sprites__issues"><summary>Warum Dateien übersprungen wurden ({issues.length})</summary><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></details>}
    {sprites.length === 0 && !busy && issues.length === 0 && <p className="sprites__note">Pick a folder of .png sprites. Its sub-folders become the tree below.</p>}
    {sprites.length > 0 && <Branch node={tree} activeId={activeId} isOpen={isOpen} onToggle={toggle} onPick={onPick} />}
  </div>
}
