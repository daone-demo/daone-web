interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export function getBoundingBoxCenter(boxes: readonly BoundingBox[]) {
  const minX = Math.min(...boxes.map((box) => box.x))
  const minY = Math.min(...boxes.map((box) => box.y))
  const maxX = Math.max(...boxes.map((box) => box.x + box.width))
  const maxY = Math.max(...boxes.map((box) => box.y + box.height))

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  }
}
