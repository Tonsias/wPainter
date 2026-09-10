import { useRef, useState } from 'react'
import './App.css'
import { ZOOMS, zoomStep, type Zoom } from './zoom.ts'

const CANVAS_SIZE = { width: 640, height: 480 } as const

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState<Zoom>(1)

  return (
    <div className="app">
      <header className="app__bar">
        <span className="app__mark">wPainter</span>
        <span className="app__subtitle">a painter in the browser</span>
        <span className="app__spacer" />
        <div className="segment">
          {ZOOMS.map((option) => (
            <button
              key={option}
              type="button"
              className={`segment__option${option === zoom ? ' segment__option--active' : ''}`}
              onClick={() => setZoom(option)}
            >
              {option}x
            </button>
          ))}
        </div>
      </header>

      <main className="app__main">
        <section className="app__stage">
          <div className="app__frame-slot">
            <div className="app__frame-box">
              <div
                className="app__canvas-host"
                onWheel={(event) => {
                  // Ctrl+wheel is the browser's own zoom gesture; claiming it here keeps a plain
                  // wheel free to scroll a canvas larger than its host.
                  if (!event.ctrlKey) return
                  event.preventDefault()
                  setZoom((current) => zoomStep(current, -event.deltaY))
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="app__canvas"
                  width={CANVAS_SIZE.width}
                  height={CANVAS_SIZE.height}
                  style={{
                    width: CANVAS_SIZE.width * zoom,
                    height: CANVAS_SIZE.height * zoom,
                  }}
                />
              </div>
              <span className="app__resolution">
                {CANVAS_SIZE.width}x{CANVAS_SIZE.height}
              </span>
            </div>
          </div>
        </section>

        <aside className="app__panel">
          <h2 className="app__panel-title">Tools</h2>
          <p className="app__placeholder">
            Nothing is wired up yet — this is the deployed shell the first feature lands in.
          </p>
          <button type="button" className="btn btn--primary" disabled>
            Start drawing
          </button>
        </aside>
      </main>
    </div>
  )
}
