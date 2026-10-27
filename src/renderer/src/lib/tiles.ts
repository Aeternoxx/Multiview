/**
 * Tile geometry shared by the grid CSS, the resize grip and the storage
 * validation. A tile has a fixed default width so enlarging the main window
 * reflows the grid instead of zooming the videos, and a manual resize is frozen
 * until the user drags the grip again.
 */
export const DEFAULT_TILE_WIDTH = 440
export const MIN_TILE_WIDTH = 280
export const MIN_TILE_HEIGHT = 200
