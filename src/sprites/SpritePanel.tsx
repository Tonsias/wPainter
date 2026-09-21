import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './SpritePanel.css'
import { writePixels } from '../document/composite.ts'
import {
  UNTURNED,
  flipOrientation,
  rotateOrientation,
  type Orientation,
} from '../document/paint.ts'
import {
  SPRITE_SCALES,
  buildSpriteTree,
  countSprites,
  matchesQuery,
  spriteScaleLabel,
  type Sprite,
  type SpriteNode,
  type SpriteScale,
} from './library.ts'
import { loadSpriteImage, type SpriteFile } from './loadSprites.ts'
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
  skipped: number
  scale: SpriteScale
  orientation: Orientation
  outlined: boolean
  onLoad: (files: SpriteFile[]) => void
  onPick: (sprite: Sprite) => void
  onScale: (scale: SpriteScale) => void
  onOrient: (orientation: Orientation) => void
  onOutline: (outlined: boolean) => void
}

const TURNS = [
  {
    glyph: '↔',
    title: 'Flip the stamp horizontally',
    apply: (current: Orientation) => flipOrientation(current, 'horizontal'),
  },
  {
    glyph: '↕',
    title: 'Flip the stamp vertically',
    apply: (current: Orientation) => flipOrientation(current, 'vertical'),
  },
  { glyph: '⟳', title: 'Turn the stamp a quarter clockwise', apply: rotateOrientation },
] as const

type BranchProps = {
  node: SpriteNode
  activeId: string | null
  isOpen: (path: string) => boolean
  onToggle: (path: string) => void
  onPick: (sprite: Sprite) => void
}

// The row is what triggers its own sprite's decode: nothing outside the viewport is ever read,
// so the size it reports and the thumbnail it draws both arrive only once it has been scrolled to.
function SpriteTile({ sprite }: { sprite: Sprite }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let cancelled = false
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      void loadSpriteImage(sprite).then((image) => {
        if (!image || cancelled) return
        setSize({ width: image.width, height: image.height })
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')
        if (!context) return
        const bitmap = new ImageData(image.width, image.height)
        writePixels(image.pixels, bitmap.data)
        context.putImageData(bitmap, 0, 0)
      })
    })
    observer.observe(canvas)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [sprite])

  return (
    <>
      <canvas className="sprites__thumb" ref={ref} width={1} height={1} />
      <span className="sprites__label">{sprite.name}</span>
      <span className="sprites__count">{size ? `${size.width}×${size.height}` : ''}</span>
    </>
  )
}

function Branch({ node, activeId, isOpen, onToggle, onPick }: BranchProps) {
  return (
    <ul className="sprites__branch">
      {node.folders.map((folder) => {
        const open = isOpen(folder.path)
        return (
          <li key={folder.path} className="sprites__row">
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
        <li key={sprite.id} className="sprites__tile">
          <button
            type="button"
            title={sprite.name}
            className={`sprites__leaf${sprite.id === activeId ? ' sprites__leaf--active' : ''}`}
            onClick={() => onPick(sprite)}
          >
            <SpriteTile sprite={sprite} />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function SpritePanel({
  sprites,
  activeId,
  skipped,
  scale,
  orientation,
  outlined,
  onLoad,
  onPick,
  onScale,
  onOrient,
  onOutline,
}: Props) {
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

  const note =
    sprites.length > 0
      ? `${sprites.length} sprites${skipped > 0 ? ` · ${skipped} non-image file(s) skipped` : ''}`
      : reading
        ? ''
        : 'Pick a folder of .png sprites. Its sub-folders become the tree below.'

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
          disabled={reading}
          onClick={() => (supportsFolderPicker() ? void choose() : pickerRef.current?.click())}
        >
          {reading ? 'Reading…' : 'Choose folder'}
        </button>
        {folder && sprites.length === 0 && !reading && (
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
      {/* Outside the scroller on purpose: the scale a stamp is laid down at has to stay readable
          and reachable however far into the tree the list has been scrolled. */}
      <div className="segment sprites__scale">
        {SPRITE_SCALES.map((option) => (
          <button
            key={option}
            type="button"
            title={`Stamp at ${Math.round(option * 100)}%`}
            className={`segment__option${option === scale ? ' segment__option--active' : ''}`}
            onClick={() => onScale(option)}
          >
            {spriteScaleLabel(option)}
          </button>
        ))}
      </div>
      {/* Actions rather than modes: each press turns or mirrors what the stamp already shows, so
          the three compose and a fourth turn is the way back. The reset only appears once there
          is something to reset, which is also the only sign the panel gives that a stamp is
          turned — the ghost under the cursor is the other one. */}
      <div className="sprites__orient">
        {TURNS.map(({ glyph, title, apply }) => (
          <button
            key={glyph}
            type="button"
            className="btn sprites__turn"
            title={title}
            onClick={() => onOrient(apply(orientation))}
          >
            {glyph}
          </button>
        ))}
        {(orientation.turns !== 0 || orientation.mirrored) && (
          <button
            type="button"
            className="btn sprites__turn sprites__turn--reset"
            title="Stamp the sprite the way it is on disk"
            onClick={() => onOrient(UNTURNED)}
          >
            Reset
          </button>
        )}
      </div>
      {/* The ring is drawn after the scale, so it stays one template pixel thick however far the
          sprite is blown up. Its colours are the palette's Edge slot — the same set the outline
          brush rings a stroke with, so a template keeps one edge colour across both tools. */}
      <label className="app__check">
        <input
          type="checkbox"
          checked={outlined}
          onChange={(event) => onOutline(event.target.checked)}
        />
        Outline the stamp
      </label>
      {note && <p className="sprites__note">{note}</p>}
      <div className="sprites__tree">
        {sprites.length > 0 && (
          <Branch node={tree} activeId={activeId} isOpen={isOpen} onToggle={toggle} onPick={onPick} />
        )}
      </div>
    </div>
  )
}
