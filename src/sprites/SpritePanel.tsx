import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './SpritePanel.css'
import { writePixels } from '../document/composite.ts'
import {
  buildSpriteTree,
  countSprites,
  matchesQuery,
  type Sprite,
  type SpriteNode,
} from './library.ts'
import type { SpriteFile } from './loadSprites.ts'
import {
  askFolderAccess,
  forgetFolder,
  hasFolderAccess,
  pickFolder,
  readFolder,
  recallFolder,
  rememberFolder,
  supportsFolderPicker,
} from './spriteFolder.ts'

type Props = {
  sprites: readonly Sprite[]
  activeId: string | null
  loading: boolean
  skipped: number
  onLoad: (files: SpriteFile[]) => void
  onPick: (sprite: Sprite) => void
}

type BranchProps = {
  node: SpriteNode
  activeId: string | null
  isOpen: (path: string) => boolean
  onToggle: (path: string) => void
  onPick: (sprite: Sprite) => void
}

function Thumbnail({ sprite }: { sprite: Sprite }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    // A filter can match thousands of sprites at once, and drawing every one of them costs far
    // more than the handful the panel actually shows: each waits until it is scrolled into view.
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
  return (
    <canvas className="sprites__thumb" ref={ref} width={sprite.width} height={sprite.height} />
  )
}

function Branch({ node, activeId, isOpen, onToggle, onPick }: BranchProps) {
  return (
    <ul className="sprites__branch">
      {node.folders.map((folder) => {
        const open = isOpen(folder.path)
        return (
          <li key={folder.path}>
            <button
              type="button"
              className="sprites__folder"
              aria-expanded={open}
              onClick={() => onToggle(folder.path)}
            >
              <span className="sprites__caret" aria-hidden="true">
                {open ? '▾' : '▸'}
              </span>
              <span className="sprites__label">{folder.name}</span>
              <span className="sprites__count">{countSprites(folder)}</span>
            </button>
            {open && (
              <Branch
                node={folder}
                activeId={activeId}
                isOpen={isOpen}
                onToggle={onToggle}
                onPick={onPick}
              />
            )}
          </li>
        )
      })}
      {node.sprites.map((sprite) => (
        <li key={sprite.id}>
          <button
            type="button"
            title={`${sprite.name} · ${sprite.width}×${sprite.height}`}
            className={`sprites__leaf${sprite.id === activeId ? ' sprites__leaf--active' : ''}`}
            onClick={() => onPick(sprite)}
          >
            <Thumbnail sprite={sprite} />
            <span className="sprites__label">{sprite.name}</span>
            <span className="sprites__count">
              {sprite.width}×{sprite.height}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function SpritePanel({ sprites, activeId, loading, skipped, onLoad, onPick }: Props) {
  const [query, setQuery] = useState('')
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const [folder, setFolder] = useState<FileSystemDirectoryHandle | null>(null)
  const [reading, setReading] = useState(false)
  const pickerRef = useRef<HTMLInputElement | null>(null)
  // The parent hands this down as an inline lambda, so it cannot be a dependency of the recall
  // effect without re-running it on every render.
  const loadRef = useRef(onLoad)
  loadRef.current = onLoad

  const readInto = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setReading(true)
    try {
      loadRef.current(await readFolder(handle))
    } catch {
      // The folder was moved, renamed or deleted between sessions — keeping the handle would
      // only offer a button that fails again.
      setFolder(null)
      await forgetFolder()
    } finally {
      setReading(false)
    }
  }, [])

  // A folder picked in an earlier session reopens by itself only while its permission still
  // stands; otherwise it waits as a button, because re-asking needs a user gesture.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const handle = await recallFolder()
      if (!handle || cancelled) return
      setFolder(handle)
      if (await hasFolderAccess(handle)) await readInto(handle)
    })()
    return () => {
      cancelled = true
    }
  }, [readInto])

  const choose = async () => {
    const handle = await pickFolder()
    if (!handle) return
    setFolder(handle)
    await rememberFolder(handle)
    await readInto(handle)
  }

  const tree = useMemo(
    () => buildSpriteTree(sprites.filter((sprite) => matchesQuery(sprite, query))),
    [sprites, query],
  )

  const busy = loading || reading
  const filtering = query.trim() !== ''
  // Folders start closed — a library of a few thousand sprites would otherwise mount a thumbnail
  // canvas for every one of them at once. A filtered tree is already the answer to a question,
  // so that one opens.
  const isOpen = (path: string) => filtering || opened.has(path)
  const toggle = (path: string) =>
    setOpened((current) => {
      const next = new Set(current)
      if (!next.delete(path)) next.add(path)
      return next
    })

  return (
    <div className="sprites">
      <input
        className="sprites__picker"
        type="file"
        multiple
        // `webkitdirectory` has no typed JSX counterpart, and it is what turns this input into a
        // whole-folder picker in every browser that supports one at all.
        ref={(node) => {
          pickerRef.current = node
          node?.setAttribute('webkitdirectory', '')
        }}
        onChange={(event) => {
          onLoad(
            [...(event.target.files ?? [])].map((file) => ({
              file,
              path: file.webkitRelativePath || file.name,
            })),
          )
          event.target.value = ''
        }}
      />
      <div className="sprites__bar">
        <button
          type="button"
          className="btn sprites__load"
          disabled={busy}
          onClick={() => (supportsFolderPicker() ? void choose() : pickerRef.current?.click())}
        >
          {busy ? 'Reading…' : 'Choose folder'}
        </button>
        {folder && sprites.length === 0 && !busy && (
          <button
            type="button"
            className="btn sprites__load"
            title={folder.name}
            onClick={() =>
              void askFolderAccess(folder).then(async (granted) => {
                if (granted) await readInto(folder)
              })
            }
          >
            Reopen <span className="sprites__label">{folder.name}</span>
          </button>
        )}
        {sprites.length > 0 && (
          <input
            className="sprites__search"
            type="search"
            placeholder="Filter"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
      </div>
      {sprites.length > 0 && (
        <p className="sprites__note">
          {sprites.length} sprites{skipped > 0 ? ` · ${skipped} file(s) skipped` : ''}
        </p>
      )}
      {sprites.length === 0 && !busy && (
        <p className="sprites__note">
          Pick a folder of .png sprites. Its sub-folders become the tree below.
        </p>
      )}
      {sprites.length > 0 && (
        <Branch
          node={tree}
          activeId={activeId}
          isOpen={isOpen}
          onToggle={toggle}
          onPick={onPick}
        />
      )}
    </div>
  )
}
