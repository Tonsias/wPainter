import { describe, expect, it } from 'vitest'
import { DEFAULT_PANEL_WIDTH, clampPanelWidth } from './panel.ts'

describe('clampPanelWidth', () => {
  it('leaves a width there is room for alone, rounded to whole pixels', () => {
    expect(clampPanelWidth(520.4, 1600)).toBe(520)
  })

  it('holds the panel at its minimum however far the separator is dragged right', () => {
    expect(clampPanelWidth(10, 1600)).toBe(280)
  })

  it('stops the panel before it can squeeze the stage below its minimum', () => {
    expect(clampPanelWidth(1500, 1600)).toBe(1240)
  })

  it('still yields the minimum panel when there is no room for panel and stage both', () => {
    expect(clampPanelWidth(400, 500)).toBe(280)
    expect(clampPanelWidth(100, 320)).toBe(280)
  })

  it('opens at a width every supported layout can hold', () => {
    expect(clampPanelWidth(DEFAULT_PANEL_WIDTH, 1024)).toBe(DEFAULT_PANEL_WIDTH)
  })
})
