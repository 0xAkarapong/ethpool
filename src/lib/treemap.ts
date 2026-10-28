export type TreemapRect = { x: number; y: number; w: number; h: number }

function worst(areas: Array<number>, side: number): number {
  let sum = 0
  let max = 0
  let min = Infinity
  for (const area of areas) {
    sum += area
    if (area > max) max = area
    if (area < min) min = area
  }
  const sum2 = sum * sum
  const side2 = side * side
  return Math.max((side2 * max) / sum2, sum2 / (side2 * min))
}

export function treemap<T extends { value: number }>(
  items: Array<T>,
  width: number,
  height: number,
): Array<T & TreemapRect> {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0)
  if (total <= 0 || width <= 0 || height <= 0) {
    return items.map((item) => ({ ...item, x: 0, y: 0, w: 0, h: 0 }))
  }

  const nodes = items
    .map((item) => ({
      item,
      area: (Math.max(0, item.value) / total) * width * height,
    }))
    .filter((node) => node.area > 0)
    .sort((a, b) => b.area - a.area)

  const placed: Array<T & TreemapRect> = []
  let x = 0
  let y = 0
  let w = width
  let h = height
  let index = 0

  while (index < nodes.length) {
    const vertical = w <= h
    const side = vertical ? h : w
    const row = [nodes[index]]
    index += 1
    while (index < nodes.length) {
      const current = row.map((node) => node.area)
      const candidate = [...current, nodes[index].area]
      if (worst(current, side) < worst(candidate, side)) break
      row.push(nodes[index])
      index += 1
    }

    const sum = row.reduce((area, node) => area + node.area, 0)
    const thickness = sum / side
    let offset = 0
    for (const node of row) {
      const extent = node.area / thickness
      placed.push(
        vertical
          ? { ...node.item, x, y: y + offset, w: thickness, h: extent }
          : { ...node.item, x: x + offset, y, w: extent, h: thickness },
      )
      offset += extent
    }
    if (vertical) {
      x += thickness
      w -= thickness
    } else {
      y += thickness
      h -= thickness
    }
  }

  return placed
}
