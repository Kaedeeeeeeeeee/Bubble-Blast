import { BUBBLE_RADIUS, CANVAS_WIDTH, COLORS, GRID_COLS, BubbleColor } from '../constants';
import { Bubble, Point } from '../types';

// --- Grid Math ---

export const getGridPosition = (r: number, c: number): Point => {
  const isEvenRow = r % 2 === 0;
  // Offset for hexagonal grid
  const offsetX = isEvenRow ? 0 : BUBBLE_RADIUS;
  const x = c * (BUBBLE_RADIUS * 2) + BUBBLE_RADIUS + offsetX;
  const y = r * (BUBBLE_RADIUS * Math.sqrt(3)) + BUBBLE_RADIUS;
  return { x, y };
};

// Convert pixel coordinate to approximate grid coordinate (requires refinement)
export const getGridCoords = (x: number, y: number) => {
  const rowHeight = BUBBLE_RADIUS * Math.sqrt(3);
  const r = Math.round((y - BUBBLE_RADIUS) / rowHeight);
  
  const isEvenRow = r % 2 === 0;
  const offsetX = isEvenRow ? 0 : BUBBLE_RADIUS;
  
  const c = Math.round((x - BUBBLE_RADIUS - offsetX) / (BUBBLE_RADIUS * 2));
  return { r, c };
};

// --- Game Logic ---

export const createLevel = (rows: number): Bubble[] => {
  const bubbles: Bubble[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < (r % 2 === 0 ? GRID_COLS : GRID_COLS - 1); c++) {
      const { x, y } = getGridPosition(r, c);
      
      // 1% Chance to hold a LASER item
      const hasLaser = Math.random() < 0.01;

      bubbles.push({
        id: `${r}-${c}`,
        r,
        c,
        x,
        y,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        active: true,
        scale: 1,
        itemType: hasLaser ? 'LASER' : undefined
      });
    }
  }
  return bubbles;
};

export const checkCollision = (projectile: Point, bubble: Bubble): boolean => {
  const dx = projectile.x - bubble.x;
  const dy = projectile.y - bubble.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (BUBBLE_RADIUS * 2 - 4); // -4 for a bit of forgiveness/overlap
};

export const findSnapPosition = (x: number, y: number, existingBubbles: Bubble[]): { r: number, c: number } | null => {
  const { r, c } = getGridCoords(x, y);
  
  // Basic bounds check
  if (c < 0) return { r, c: 0 };
  const maxCols = r % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
  if (c >= maxCols) return { r, c: maxCols - 1 };

  // Check if occupied
  const occupied = existingBubbles.some(b => b.r === r && b.c === c && b.active);
  if (!occupied) return { r, c };

  // If occupied, find nearest empty neighbor (simple fallback, could be more robust)
  // In a real robust engine, we raycast or check all neighbors for smallest distance.
  // For this version, we assume the pre-collision physics stopped us 'near' an empty spot.
  return null; 
};

// Get neighbors for a specific grid coordinate
export const getNeighbors = (r: number, c: number): { r: number, c: number }[] => {
  const neighbors = [];
  const isEven = r % 2 === 0;
  
  // Directions: [dr, dc]
  // Even row offsets differ from odd row offsets
  const directions = isEven ? 
    [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]] :
    [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];

  for (const [dr, dc] of directions) {
    const nr = r + dr;
    const nc = c + dc;
    
    // Check bounds
    const maxCols = nr % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
    if (nr >= 0 && nc >= 0 && nc < maxCols) {
      neighbors.push({ r: nr, c: nc });
    }
  }
  return neighbors;
};

// Find matching color cluster
export const findCluster = (startBubble: Bubble, allBubbles: Bubble[]): Bubble[] => {
  const cluster: Bubble[] = [startBubble];
  const queue: Bubble[] = [startBubble];
  const visited = new Set<string>();
  visited.add(startBubble.id);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = getNeighbors(current.r, current.c);

    for (const n of neighbors) {
      const neighborBubble = allBubbles.find(b => b.r === n.r && b.c === n.c && b.active && !visited.has(b.id));
      if (neighborBubble && neighborBubble.color === startBubble.color) {
        visited.add(neighborBubble.id);
        cluster.push(neighborBubble);
        queue.push(neighborBubble);
      }
    }
  }

  return cluster;
};

// Find floating clusters (disconnected from ceiling)
export const findFloatingBubbles = (allBubbles: Bubble[]): Bubble[] => {
  const visited = new Set<string>();
  const queue: Bubble[] = [];

  // 1. Add all ceiling bubbles (row 0) to queue
  const ceilingBubbles = allBubbles.filter(b => b.r === 0 && b.active);
  ceilingBubbles.forEach(b => {
    visited.add(b.id);
    queue.push(b);
  });

  // 2. Traverse down from ceiling
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = getNeighbors(current.r, current.c);
    
    for (const n of neighbors) {
      const neighbor = allBubbles.find(b => b.r === n.r && b.c === n.c && b.active && !visited.has(b.id));
      if (neighbor) {
        visited.add(neighbor.id);
        queue.push(neighbor);
      }
    }
  }

  // 3. Any active bubble not visited is floating
  return allBubbles.filter(b => b.active && !visited.has(b.id));
};