export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 720;
export const BUBBLE_RADIUS = 20;
export const GRID_COLS = 12; // Fits perfectly: 480 / 40 = 12
export const GRID_ROWS = 20;
export const SHOOTER_Y = CANVAS_HEIGHT - 50;
export const PROJECTILE_SPEED = 12;

export enum BubbleColor {
  RED = '#ff0055',    // Neon Red
  GREEN = '#00ff66',  // Neon Green
  BLUE = '#00ccff',   // Neon Blue
  YELLOW = '#ffcc00', // Neon Yellow
  PURPLE = '#cc00ff', // Neon Purple
  ORANGE = '#ff6600', // Neon Orange
  EXPLOSIVE = 'EXPLOSIVE', // Special Skill Ball (Bomb Projectile)
  LASER = 'LASER' // Special Skill Projectile
}

export type ItemType = 'BOMB' | 'LASER';

// Standard colors for generation (Excludes special types)
export const COLORS = [
  BubbleColor.RED,
  BubbleColor.GREEN,
  BubbleColor.BLUE,
  BubbleColor.YELLOW,
  BubbleColor.PURPLE,
  BubbleColor.ORANGE,
];

export enum GameMode {
  CLASSIC = 'CLASSIC',
  RUSH = 'RUSH'
}

export const GAME_STATES = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
  VICTORY: 'VICTORY',
} as const;

export type GameState = keyof typeof GAME_STATES;