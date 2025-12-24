import { BubbleColor, ItemType } from './constants';

export interface Point {
  x: number;
  y: number;
}

export interface Bubble {
  id: string;
  r: number; // grid row
  c: number; // grid col
  x: number; // pixel x
  y: number; // pixel y
  color: BubbleColor;
  active: boolean; // false if popping/falling
  scale: number; // for animations
  popping?: boolean;
  itemType?: ItemType; // Does this bubble hold a collectible item?
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
  vy: number;
  opacity: number;
}

export interface LaserBeam {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  life: number; // For fading animation
}