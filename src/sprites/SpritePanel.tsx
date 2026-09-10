import { useEffect, useMemo, useRef, useState } from 'react'
import './SpritePanel.css'
import { writePixels } from '../document/composite.ts'
import {
  buildSpriteTree,
  countSprites,
  matchesQuery,
  type Sprite,
  type SpriteNode,
} from './library.ts'

type Props = {
  sprites: readonly Sprite[]
  activeId: string | null
  loading: boolean
  skipped: number
  onLoad: (files: File[]) => void
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
    const context = ref.current?.getContext('2d')
    if (!context) return
    const image = new ImageData(sprite.width, sprite.height)
    writePixels(sprite.pixels, image.data)
    context.putImageData(image, 0, 0)
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
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const pickerRef = useRef<HTMLInputElement | null>(null)
  const tree = useMemo(
    () => buildSpriteTree(sprites.filter((sprite) => matchesQuery(sprite, query))),
    [sprites, query],
  )

  const filtering = query.trim() !== ''
  // A filtered tree is already the answer to a question: collapsing it would hide the hits.
  const isOpen = (path: string) => filtering || !closed.has(path)
  const toggle = (path: string) =>
    setClosed((current) => {
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
          onLoad([...(event.target.files ?? [])])
          event.target.value = ''
        }}
      />
      <div className="sprites__bar">
        <button
          type="button"
          className="btn sprites__load"
          disabled={loading}
          onClick={() => pickerRef.current?.click()}
        >
          {loading ? 'Reading…' : 'Choose folder'}
        </button>
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
      {skipped > 0 && <p className="sprites__note">{skipped} file(s) skipped</p>}
      {sprites.length === 0 && !loading && (
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
