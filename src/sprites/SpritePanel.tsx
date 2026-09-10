import { useEffect, useMemo, useRef, useState } from 'react'
import './SpritePanel.css'
import { writePixels } from '../document/composite.ts'
import { groupByFolder, matchesQuery, type Sprite } from './library.ts'

type Props = {
  sprites: readonly Sprite[]
  activeId: string | null
  loading: boolean
  skipped: number
  onLoad: (files: File[]) => void
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

export function SpritePanel({ sprites, activeId, loading, skipped, onLoad, onPick }: Props) {
  const [query, setQuery] = useState('')
  const pickerRef = useRef<HTMLInputElement | null>(null)
  const groups = useMemo(
    () => groupByFolder(sprites.filter((sprite) => matchesQuery(sprite, query))),
    [sprites, query],
  )

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
          Pick a folder of .png sprites. Sub-folders become the groups below.
        </p>
      )}
      {groups.map((group) => (
        <section key={group.folder} className="sprites__group">
          <p className="sprites__folder">{group.folder || '/'}</p>
          <div className="sprites__grid">
            {group.sprites.map((sprite) => (
              <button
                key={sprite.id}
                type="button"
                title={`${sprite.name} · ${sprite.width}×${sprite.height}`}
                className={`sprites__item${sprite.id === activeId ? ' sprites__item--active' : ''}`}
                onClick={() => onPick(sprite)}
              >
                <Thumbnail sprite={sprite} />
                <span className="sprites__label">{sprite.name}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
