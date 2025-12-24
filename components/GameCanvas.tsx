import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowUp, RotateCcw, Play, Trophy, RefreshCw, RefreshCcw, Zap, Disc } from 'lucide-react';
import { 
  CANVAS_WIDTH, CANVAS_HEIGHT, BUBBLE_RADIUS, COLORS, 
  PROJECTILE_SPEED, SHOOTER_Y, GAME_STATES, GameState, BubbleColor, GRID_COLS, ItemType
} from '../constants';
import { Bubble, Particle, Point, FloatingText, LaserBeam } from '../types';
import * as Engine from '../utils/engine';

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GAME_STATES.MENU);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  
  // UI State for Danger Meter
  const [missCount, setMissCount] = useState(0);

  // Game State Refs
  const bubblesRef = useRef<Bubble[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const laserBeamsRef = useRef<LaserBeam[]>([]); // New: For visualizing laser shots
  const projectileRef = useRef<{ x: number; y: number; vx: number; vy: number; color: BubbleColor; active: boolean } | null>(null);
  
  const upcomingBubblesRef = useRef<BubbleColor[]>([]);
  
  // Combo System
  const comboRef = useRef<number>(0);
  const comboDisplayTimerRef = useRef<number>(0); // Controls visibility duration of Combo HUD

  // Inventory System (Replaces simple boolean flag)
  // Now holds the TYPE of item available, or null if empty
  const inventoryRef = useRef<ItemType | null>(null);

  const missCountRef = useRef<number>(0);
  const MISS_THRESHOLD = 5;
  
  const shakeRef = useRef<number>(0);

  const DEATH_LINE_Y = SHOOTER_Y - 100;

  const mouseRef = useRef<Point>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
  const animationFrameRef = useRef<number>(0);

  // UI Positions
  const PREVIEW_CENTER_X = CANVAS_WIDTH - 60; 
  const PREVIEW_CENTER_Y = SHOOTER_Y;
  const BOMB_CENTER_X = 60; 
  const UI_BUTTON_RADIUS = 30; 

  const ensureUpcomingBubbles = () => {
    while (upcomingBubblesRef.current.length < 4) {
      upcomingBubblesRef.current.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
    }
  };

  const initGame = useCallback(() => {
    bubblesRef.current = Engine.createLevel(5); 
    particlesRef.current = [];
    floatingTextsRef.current = [];
    laserBeamsRef.current = [];
    projectileRef.current = null;
    comboRef.current = 0;
    comboDisplayTimerRef.current = 0;
    
    missCountRef.current = 0;
    setMissCount(0);

    inventoryRef.current = null;
    shakeRef.current = 0;
    
    upcomingBubblesRef.current = [];
    ensureUpcomingBubbles();
    
    setScore(0);
    setGameState(GAME_STATES.PLAYING);
  }, []);

  const spawnParticles = (x: number, y: number, color: string, count: number = 10, type: 'normal' | 'shockwave' | 'spark' = 'normal') => {
    const isExplosive = color === BubbleColor.EXPLOSIVE;
    
    if (type === 'shockwave') {
         for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20;
            const speed = 8;
            particlesRef.current.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.5,
                color: '#fff',
                size: 3
            });
         }
         return;
    }

    if (type === 'spark') {
        // Laser spark
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 2;
            particlesRef.current.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5,
                color: '#22d3ee', // Cyan sparks
                size: Math.random() * 3 + 1
            });
        }
        return;
    }

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: isExplosive ? (Math.random() > 0.5 ? '#ef4444' : '#f59e0b') : color,
        size: Math.random() * 4 + 2
      });
    }
  };

  const spawnFloatingText = (x: number, y: number, text: string, color: string = 'white') => {
    floatingTextsRef.current.push({
      x,
      y,
      text,
      life: 1.0,
      vy: -1,
      opacity: 1
    });
  };

  const swapBubbles = () => {
      if (gameState !== GAME_STATES.PLAYING || projectileRef.current?.active) return;
      if (upcomingBubblesRef.current.length < 2) ensureUpcomingBubbles();

      const temp = upcomingBubblesRef.current[0];
      upcomingBubblesRef.current[0] = upcomingBubblesRef.current[1];
      upcomingBubblesRef.current[1] = temp;

      spawnFloatingText(PREVIEW_CENTER_X, PREVIEW_CENTER_Y - 40, "SWAP!", '#22d3ee');
      spawnParticles(PREVIEW_CENTER_X, PREVIEW_CENTER_Y, '#22d3ee', 5);
  };

  // Logic to Equip Inventory Item (Bomb or Laser)
  const equipItem = () => {
      if (gameState !== GAME_STATES.PLAYING || projectileRef.current?.active) return;
      if (!inventoryRef.current) return;

      if (inventoryRef.current === 'BOMB') {
          upcomingBubblesRef.current[0] = BubbleColor.EXPLOSIVE;
          spawnFloatingText(BOMB_CENTER_X, SHOOTER_Y - 40, "BOMB EQUIPPED!", '#ef4444');
          spawnParticles(BOMB_CENTER_X, SHOOTER_Y, '#ef4444', 10);
      } else if (inventoryRef.current === 'LASER') {
          upcomingBubblesRef.current[0] = BubbleColor.LASER; // Use LASER marker
          spawnFloatingText(BOMB_CENTER_X, SHOOTER_Y - 40, "LASER READY!", '#22d3ee');
          spawnParticles(BOMB_CENTER_X, SHOOTER_Y, '#22d3ee', 15, 'spark');
      }

      inventoryRef.current = null; // Consume inventory
  };

  const shoot = () => {
    if (gameState !== GAME_STATES.PLAYING || projectileRef.current?.active) return;
    if (upcomingBubblesRef.current.length === 0) ensureUpcomingBubbles();

    const dx = mouseRef.current.x - CANVAS_WIDTH / 2;
    const dy = mouseRef.current.y - SHOOTER_Y;
    const angle = Math.atan2(dy, dx);

    if (angle > -0.2) return; 
    if (angle < -Math.PI + 0.2) return;

    const colorToShoot = upcomingBubblesRef.current[0];

    // --- LASER LOGIC ---
    if (colorToShoot === BubbleColor.LASER) {
        // Instant Raycast Shot
        const endX = CANVAS_WIDTH / 2 + Math.cos(angle) * CANVAS_HEIGHT * 1.5;
        const endY = SHOOTER_Y + Math.sin(angle) * CANVAS_HEIGHT * 1.5;

        // Visual Beam
        laserBeamsRef.current.push({
            startX: CANVAS_WIDTH / 2,
            startY: SHOOTER_Y,
            endX,
            endY,
            life: 1.0
        });

        shakeRef.current = 15;
        spawnParticles(CANVAS_WIDTH / 2, SHOOTER_Y, '#22d3ee', 20, 'spark');

        // Line Collision Math
        // Line equation: P = start + t * (end - start)
        const p1 = { x: CANVAS_WIDTH / 2, y: SHOOTER_Y };
        const p2 = { x: endX, y: endY };
        
        let hitCount = 0;

        bubblesRef.current.forEach(b => {
            if (!b.active) return;
            
            // Distance from point to line segment
            // https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
            const top = Math.abs((p2.x - p1.x) * (p1.y - b.y) - (p1.x - b.x) * (p2.y - p1.y));
            const bot = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            const dist = top / bot;

            // Check if bubble is "in front" of shooter (projection)
            const dot = (b.x - p1.x) * (p2.x - p1.x) + (b.y - p1.y) * (p2.y - p1.y);
            
            if (dist < BUBBLE_RADIUS && dot > 0) {
                b.popping = true;
                spawnParticles(b.x, b.y, b.color, 10, 'spark');
                hitCount++;

                // FIXED: Check for item collection when using laser
                if (b.itemType === 'LASER') {
                    inventoryRef.current = 'LASER';
                    spawnFloatingText(b.x, b.y, "LASER ACQUIRED!", '#22d3ee');
                }
            }
        });

        if (hitCount > 0) {
            setScore(prev => prev + hitCount * 20);
            spawnFloatingText(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, `LASER HIT! +${hitCount * 20}`, '#22d3ee');
        }

        // Consume Laser active state
        upcomingBubblesRef.current.shift();
        upcomingBubblesRef.current.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
        
        handleFallingBubbles();
        return;
    }

    // --- STANDARD PROJECTILE LOGIC ---
    projectileRef.current = {
      x: CANVAS_WIDTH / 2,
      y: SHOOTER_Y,
      vx: Math.cos(angle) * PROJECTILE_SPEED,
      vy: Math.sin(angle) * PROJECTILE_SPEED,
      color: colorToShoot,
      active: true
    };

    upcomingBubblesRef.current.shift();
    upcomingBubblesRef.current.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
  };

  const triggerPenalty = () => {
      bubblesRef.current.forEach(b => {
          b.r += 2;
          const pos = Engine.getGridPosition(b.r, b.c);
          b.x = pos.x;
          b.y = pos.y;
      });

      const newRows = Engine.createLevel(2);
      newRows.forEach(b => b.id = `penalty-${Date.now()}-${b.id}`);
      bubblesRef.current.push(...newRows);

      spawnFloatingText(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 3, "DANGER! +2 ROWS", '#ef4444');
      shakeRef.current = 10;
      
      checkGameOver();
  };

  const checkGameOver = () => {
      const crossedLine = bubblesRef.current.some(b => b.active && (b.y + BUBBLE_RADIUS > DEATH_LINE_Y));
      if (crossedLine) {
          setGameState(GAME_STATES.GAME_OVER);
      }
  };

  const update = () => {
    if (gameState !== GAME_STATES.PLAYING) return;

    if (shakeRef.current > 0) {
        shakeRef.current *= 0.9;
        if (shakeRef.current < 0.5) shakeRef.current = 0;
    }

    // Combo Timer Decay
    if (comboDisplayTimerRef.current > 0) {
        comboDisplayTimerRef.current -= 0.02; // Approx 1s / 60 frames
    }

    // Update Laser Visuals
    laserBeamsRef.current.forEach(beam => beam.life -= 0.1);
    laserBeamsRef.current = laserBeamsRef.current.filter(beam => beam.life > 0);

    const proj = projectileRef.current;
    if (proj && proj.active) {
      proj.x += proj.vx;
      proj.y += proj.vy;

      if (proj.x < BUBBLE_RADIUS || proj.x > CANVAS_WIDTH - BUBBLE_RADIUS) {
        proj.vx *= -1;
        proj.x = Math.max(BUBBLE_RADIUS, Math.min(CANVAS_WIDTH - BUBBLE_RADIUS, proj.x));
      }

      if (proj.y < BUBBLE_RADIUS) {
        handleCollision();
      } else {
        for (const b of bubblesRef.current) {
          if (b.active && Engine.checkCollision(proj, b)) {
            handleCollision();
            break;
          }
        }
      }
    }

    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      p.vy += 0.1;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    floatingTextsRef.current.forEach(t => {
      t.y += t.vy;
      t.life -= 0.015;
      t.opacity = Math.max(0, t.life);
    });
    floatingTextsRef.current = floatingTextsRef.current.filter(t => t.life > 0);

    bubblesRef.current.forEach(b => {
      if (b.popping) {
        b.scale -= 0.1;
        if (b.scale <= 0) b.active = false;
      }
    });
  };

  const handleCollision = () => {
    const proj = projectileRef.current;
    if (!proj) return;

    proj.active = false;
    let successfulClear = false;

    let bestDist = Infinity;
    let bestR = -1;
    let bestC = -1;

    const { r: roughR, c: roughC } = Engine.getGridCoords(proj.x, proj.y);
    
    for (let r = roughR - 1; r <= roughR + 1; r++) {
      if (r < 0) continue;
      const maxCols = r % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
      for (let c = roughC - 1; c <= roughC + 1; c++) {
        if (c < 0 || c >= maxCols) continue;
        
        const occupied = bubblesRef.current.some(b => b.r === r && b.c === c && b.active);
        if (!occupied) {
           const pos = Engine.getGridPosition(r, c);
           const dist = Math.sqrt(Math.pow(pos.x - proj.x, 2) + Math.pow(pos.y - proj.y, 2));
           if (dist < bestDist) {
             bestDist = dist;
             bestR = r;
             bestC = c;
           }
        }
      }
    }

    if (bestR === -1) {
         setGameState(GAME_STATES.GAME_OVER);
         return;
    }

    const newBubblePos = Engine.getGridPosition(bestR, bestC);
    const newBubble: Bubble = {
      id: `${bestR}-${bestC}-${Date.now()}`,
      r: bestR,
      c: bestC,
      x: newBubblePos.x,
      y: newBubblePos.y,
      color: proj.color,
      active: true,
      scale: 1
    };
    bubblesRef.current.push(newBubble);

    if (proj.color === BubbleColor.EXPLOSIVE) {
        successfulClear = true; 
        
        const neighborsRing1 = Engine.getNeighbors(bestR, bestC);
        const neighborsRing2: {r: number, c: number}[] = [];
        
        neighborsRing1.forEach(n1 => {
             const n2s = Engine.getNeighbors(n1.r, n1.c);
             neighborsRing2.push(...n2s);
        });

        const allTargets = [...neighborsRing1, ...neighborsRing2];
        const uniqueTargetIds = new Set(allTargets.map(t => `${t.r},${t.c}`));

        newBubble.popping = true;
        
        spawnParticles(newBubble.x, newBubble.y, BubbleColor.EXPLOSIVE, 20);
        spawnParticles(newBubble.x, newBubble.y, '', 0, 'shockwave');
        shakeRef.current = 20;

        let scoreAdd = 0;
        bubblesRef.current.forEach(b => {
            if (b.active && !b.popping) {
                const isTarget = uniqueTargetIds.has(`${b.r},${b.c}`);
                if (isTarget) {
                    b.popping = true;
                    spawnParticles(b.x, b.y, b.color);
                    scoreAdd += 10;
                    // Check for item collection in blast
                    if (b.itemType === 'LASER') {
                        inventoryRef.current = 'LASER';
                        spawnFloatingText(b.x, b.y, "LASER ACQUIRED!", '#22d3ee');
                    }
                }
            }
        });

        if (scoreAdd > 0) {
            setScore(prev => prev + scoreAdd);
            spawnFloatingText(newBubble.x, newBubble.y, `MEGA BOOM! +${scoreAdd}`, '#ef4444');
        }
        
        comboRef.current = 0; 
        handleFallingBubbles();

    } else {
        const cluster = Engine.findCluster(newBubble, bubblesRef.current);
        
        if (cluster.length >= 3) {
            successfulClear = true;
            comboRef.current += 1; 
            
            // Activate Combo Display
            comboDisplayTimerRef.current = 2.0; // Show for 2 seconds

            let scoreAdd = 0;
            cluster.forEach(b => {
                b.popping = true;
                spawnParticles(b.x, b.y, b.color);
                scoreAdd += 10;
                
                // --- ITEM COLLECTION LOGIC ---
                if (b.itemType === 'LASER') {
                    inventoryRef.current = 'LASER';
                    spawnFloatingText(b.x, b.y, "LASER ACQUIRED!", '#22d3ee');
                }
            });

            if (cluster.length > 5) scoreAdd *= 2;
            
            setScore(prev => prev + scoreAdd);
            spawnFloatingText(newBubble.x, newBubble.y, `+${scoreAdd}`);
            
            if (comboRef.current > 1) {
                 spawnFloatingText(newBubble.x, newBubble.y - 30, `COMBO ${comboRef.current}!`, '#fbbf24');
            }

            if (comboRef.current >= 5) {
                inventoryRef.current = 'BOMB';
                spawnFloatingText(BOMB_CENTER_X, SHOOTER_Y - 40, "BOMB READY!", '#ef4444');
                comboRef.current = 0; 
            }

            handleFallingBubbles(cluster);
        } else {
            successfulClear = false;
            comboRef.current = 0;
            
            checkGameOver();
        }
    }

    if (!successfulClear) {
        missCountRef.current += 1;
        setMissCount(missCountRef.current); 
    }
    
    if (missCountRef.current >= MISS_THRESHOLD) {
        triggerPenalty();
        missCountRef.current = 0; 
        setMissCount(0); 
    }
  };

  const handleFallingBubbles = (excludeCluster: Bubble[] = []) => {
      const activeBubbles = bubblesRef.current.filter(b => b.active && !b.popping);
      const floating = Engine.findFloatingBubbles(activeBubbles);
      floating.forEach(b => {
        const bInRef = bubblesRef.current.find(orig => orig.id === b.id);
        if (bInRef) {
          bInRef.popping = true; 
          spawnParticles(bInRef.x, bInRef.y, bInRef.color, 5);
          setScore(prev => prev + 20);
          
          // Falling items are also collected!
          if (bInRef.itemType === 'LASER') {
             inventoryRef.current = 'LASER';
             spawnFloatingText(bInRef.x, bInRef.y, "LASER ACQUIRED!", '#22d3ee');
          }
        }
      });
      
      if (floating.length > 0) {
        spawnFloatingText(CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 50, "DROP BONUS!");
      }

      setTimeout(() => {
        bubblesRef.current = bubblesRef.current.filter(b => b.active && !b.popping);
        if (bubblesRef.current.length === 0) setGameState(GAME_STATES.VICTORY);
      }, 200);
  };

  const drawAimLine = (ctx: CanvasRenderingContext2D, startX: number, startY: number, angle: number) => {
      // If equipping laser, aim line should be solid and bright cyan
      const isLaser = upcomingBubblesRef.current[0] === BubbleColor.LASER;

      ctx.beginPath();
      
      let currX = startX;
      let currY = startY;
      let dx = Math.cos(angle);
      let dy = Math.sin(angle);
      const step = 6; 
      let bounceCount = 0;
      const maxBounces = isLaser ? 0 : 1; // Lasers don't bounce

      ctx.moveTo(currX, currY);

      for (let i = 0; i < 200; i++) { 
          const nextX = currX + dx * step;
          const nextY = currY + dy * step;

          if ((nextX < BUBBLE_RADIUS && dx < 0) || (nextX > CANVAS_WIDTH - BUBBLE_RADIUS && dx > 0)) {
              if (bounceCount < maxBounces) {
                  dx = -dx;
                  bounceCount++;
                  ctx.lineTo(nextX < BUBBLE_RADIUS ? BUBBLE_RADIUS : CANVAS_WIDTH - BUBBLE_RADIUS, nextY);
                  currX = nextX < BUBBLE_RADIUS ? BUBBLE_RADIUS : CANVAS_WIDTH - BUBBLE_RADIUS;
                  currY = nextY;
                  continue;
              } else {
                  break; 
              }
          }

          if (nextY < BUBBLE_RADIUS) {
              ctx.lineTo(nextX, BUBBLE_RADIUS);
              break;
          }

          let collision = false;
          if (nextY < CANVAS_HEIGHT - 100) {
             for (const b of bubblesRef.current) {
                if (!b.active) continue;
                const distSq = (nextX - b.x) ** 2 + (nextY - b.y) ** 2;
                if (distSq < (BUBBLE_RADIUS * 2.2) ** 2) { 
                    collision = true;
                    break; 
                }
             }
          }

          if (collision) {
              ctx.lineTo(nextX, nextY);
              break;
          }

          currX = nextX;
          currY = nextY;
          ctx.lineTo(currX, currY);
      }

      if (isLaser) {
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
      } else {
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 10]);
          ctx.stroke();
          ctx.setLineDash([]);
      }
      
      ctx.beginPath();
      ctx.arc(currX, currY, 4, 0, Math.PI * 2);
      ctx.fillStyle = isLaser ? '#fff' : 'cyan';
      ctx.fill();
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#0f172a'; 
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    let ambientColor = '#8b5cf6'; 
    
    if (projectileRef.current && projectileRef.current.active) {
        ambientColor = projectileRef.current.color;
    } else if (upcomingBubblesRef.current.length > 0) {
        ambientColor = upcomingBubblesRef.current[0];
    }
    
    if (ambientColor === BubbleColor.EXPLOSIVE) ambientColor = '#ef4444';
    if (ambientColor === BubbleColor.LASER) ambientColor = '#22d3ee';

    ctx.save();
    
    if (shakeRef.current > 0) {
        const dx = (Math.random() - 0.5) * shakeRef.current;
        const dy = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(dx, dy);
    }
    
    const time = Date.now();

    ctx.save();
    const pulse = (Math.sin(time * 0.002) + 1) * 0.5; 
    const glowRadius = CANVAS_WIDTH * 1.2;
    const bgGradient = ctx.createRadialGradient(
        CANVAS_WIDTH / 2, SHOOTER_Y, 0,
        CANVAS_WIDTH / 2, SHOOTER_Y, glowRadius
    );
    bgGradient.addColorStop(0, ambientColor); 
    bgGradient.addColorStop(1, 'rgba(15, 23, 42, 0)'); 

    ctx.globalAlpha = 0.15 + (pulse * 0.05); 
    ctx.fillStyle = bgGradient;
    ctx.fillRect(-50, -50, CANVAS_WIDTH + 100, CANVAS_HEIGHT + 100);
    ctx.restore();

    if (gameState === GAME_STATES.PLAYING) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, DEATH_LINE_Y);
        ctx.lineTo(CANVAS_WIDTH, DEATH_LINE_Y);
        ctx.strokeStyle = '#ef4444'; 
        ctx.lineWidth = 2;
        ctx.setLineDash([15, 15]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 12px Rajdhani';
        ctx.fillText("DEATH LINE", 10, DEATH_LINE_Y - 5);
        ctx.restore();
    }

    if (missCountRef.current >= MISS_THRESHOLD - 1) {
        const opacity = (Math.sin(Date.now() * 0.01) + 1) * 0.1;
        ctx.fillStyle = `rgba(239, 68, 68, ${opacity})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        ctx.strokeStyle = `rgba(239, 68, 68, ${opacity * 4})`;
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Draw Active Laser Beams
    laserBeamsRef.current.forEach(beam => {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(beam.startX, beam.startY);
        ctx.lineTo(beam.endX, beam.endY);
        ctx.strokeStyle = `rgba(34, 211, 238, ${beam.life})`;
        ctx.lineWidth = 15 * beam.life;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 20;
        ctx.stroke();
        
        // White core
        ctx.beginPath();
        ctx.moveTo(beam.startX, beam.startY);
        ctx.lineTo(beam.endX, beam.endY);
        ctx.strokeStyle = `rgba(255, 255, 255, ${beam.life})`;
        ctx.lineWidth = 4 * beam.life;
        ctx.stroke();
        ctx.restore();
    });

    bubblesRef.current.forEach(b => {
      if (!b.active && b.scale <= 0) return;
      
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(b.scale, b.scale);
      
      if (b.color === BubbleColor.EXPLOSIVE) {
          ctx.beginPath();
          ctx.arc(0, 0, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
          ctx.fillStyle = '#1f2937'; 
          ctx.fill();
          const pulse = (Math.sin(time * 0.01) + 1) * 0.5;
          ctx.beginPath();
          ctx.arc(0, 0, 6 + pulse * 6, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 15;
          ctx.fill();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, BUBBLE_RADIUS - 3, 0, Math.PI * 2);
          ctx.stroke();
      } else {
          ctx.beginPath();
          ctx.arc(0, 0, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
          ctx.fillStyle = b.color;
          ctx.shadowColor = b.color;
          ctx.shadowBlur = 15;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(-5, -5, 6, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fill();

          // --- DRAW ITEM ICON INSIDE BUBBLE ---
          if (b.itemType === 'LASER') {
              ctx.fillStyle = '#1e293b'; // Dark background for icon
              ctx.beginPath();
              ctx.arc(0, 0, 10, 0, Math.PI * 2);
              ctx.fill();

              // Draw Zap Icon shape manually for canvas
              ctx.strokeStyle = '#22d3ee';
              ctx.lineWidth = 2;
              ctx.lineJoin = 'round';
              ctx.beginPath();
              ctx.moveTo(1, -5);
              ctx.lineTo(-3, 0);
              ctx.lineTo(2, 0);
              ctx.lineTo(-1, 5);
              ctx.stroke();
          }
      }
      ctx.restore();
    });

    const proj = projectileRef.current;
    if (proj && proj.active) {
      ctx.save();
      ctx.translate(proj.x, proj.y);
      if (proj.color === BubbleColor.EXPLOSIVE) {
          ctx.beginPath();
          ctx.arc(0, 0, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
          ctx.fillStyle = '#1f2937';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 20;
          ctx.fill();
      } else {
          ctx.beginPath();
          ctx.arc(0, 0, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
          ctx.fillStyle = proj.color;
          ctx.shadowColor = proj.color;
          ctx.shadowBlur = 20;
          ctx.fill();
      }
      ctx.restore();
    }

    if (gameState === GAME_STATES.PLAYING) {
        const dx = mouseRef.current.x - CANVAS_WIDTH / 2;
        const dy = mouseRef.current.y - SHOOTER_Y;
        const angle = Math.atan2(dy, dx);
        
        drawAimLine(ctx, CANVAS_WIDTH / 2, SHOOTER_Y, angle);

        if(upcomingBubblesRef.current.length === 0) ensureUpcomingBubbles();

        // 1. CANNON VISUAL
        ctx.save();
        ctx.translate(CANVAS_WIDTH / 2, SHOOTER_Y);
        
        ctx.beginPath();
        ctx.arc(0, 0, 30, Math.PI, 0); 
        ctx.fillStyle = '#e2e8f0'; 
        ctx.fill();
        ctx.strokeStyle = '#94a3b8'; 
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -5, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#cbd5e1'; 
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -5, 6, 0, Math.PI * 2);
        
        let ammoColor = upcomingBubblesRef.current[0] === BubbleColor.EXPLOSIVE ? '#ef4444' : '#22d3ee';
        if (upcomingBubblesRef.current[0] === BubbleColor.LASER) ammoColor = '#22d3ee'; // Laser core is cyan

        ctx.fillStyle = ammoColor;
        ctx.shadowColor = ammoColor;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0; 

        ctx.rotate(angle);

        ctx.fillStyle = '#f8fafc'; 
        ctx.fillRect(0, -18, 50, 36);

        ctx.fillStyle = ammoColor;
        ctx.shadowColor = ammoColor;
        ctx.shadowBlur = 10;
        ctx.fillRect(10, -20, 50, 4);
        ctx.fillRect(10, 16, 50, 4);
        ctx.shadowBlur = 0;

        if (!proj || !proj.active) {
            const currentColor = upcomingBubblesRef.current[0];
            
            // SPECIAL DRAW FOR LASER PROJECTILE
            if (currentColor === BubbleColor.LASER) {
                 // Laser Gun Barrel Look? Or just a glowing Orb?
                 // Let's make it a glowing energy ball
                ctx.beginPath();
                ctx.arc(0, 0, BUBBLE_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = '#fff';
                ctx.shadowColor = '#22d3ee';
                ctx.shadowBlur = 20;
                ctx.fill();
                
                // Ring
                ctx.strokeStyle = '#22d3ee';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, BUBBLE_RADIUS + 2, 0, Math.PI * 2);
                ctx.stroke();
            }
            else if (currentColor === BubbleColor.EXPLOSIVE) {
                ctx.beginPath();
                ctx.arc(0, 0, BUBBLE_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = '#1f2937';
                ctx.fill();
                const pulse = (Math.sin(time * 0.02) + 1) * 0.5; 
                ctx.beginPath();
                ctx.arc(0, 0, 8 + pulse * 4, 0, Math.PI * 2);
                ctx.fillStyle = '#ef4444';
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 20;
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, BUBBLE_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = currentColor;
                ctx.shadowColor = currentColor;
                ctx.shadowBlur = 20;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        ctx.fillStyle = '#94a3b8'; 
        ctx.fillRect(40, -22, 10, 8);
        ctx.fillRect(40, 14, 10, 8);

        ctx.restore();

        // 2. Draw Swap Bubble (Right)
        const nextColor = upcomingBubblesRef.current[1];
        if (nextColor) {
             ctx.save();
             ctx.translate(PREVIEW_CENTER_X, PREVIEW_CENTER_Y);
             
             ctx.beginPath();
             ctx.arc(0, 0, UI_BUTTON_RADIUS, 0, Math.PI * 2);
             ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
             ctx.strokeStyle = '#22d3ee';
             ctx.lineWidth = 1;
             ctx.fill();
             ctx.stroke();

             ctx.scale(0.8, 0.8);
             ctx.beginPath();
             ctx.arc(0, 0, BUBBLE_RADIUS, 0, Math.PI * 2);
             ctx.fillStyle = nextColor;
             ctx.shadowColor = nextColor;
             ctx.shadowBlur = 10;
             ctx.fill();
             
             ctx.restore();
             
             ctx.save();
             ctx.translate(PREVIEW_CENTER_X, PREVIEW_CENTER_Y + 45);
             ctx.fillStyle = '#94a3b8';
             ctx.font = 'bold 10px Rajdhani';
             ctx.textAlign = 'center';
             ctx.fillText('SWAP', 0, 0);
             ctx.restore();
        }

        // 3. Draw Inventory (Left) - Displays Bomb or Laser
        ctx.save();
        ctx.translate(BOMB_CENTER_X, SHOOTER_Y);
        
        ctx.beginPath();
        ctx.arc(0, 0, UI_BUTTON_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
        
        const hasItem = inventoryRef.current !== null;
        
        if (hasItem) {
            const pulse = (Math.sin(time * 0.01) + 1) * 0.5;
            const itemColor = inventoryRef.current === 'LASER' ? '#22d3ee' : '#ef4444';
            ctx.strokeStyle = itemColor;
            ctx.lineWidth = 2 + pulse * 2;
            ctx.shadowColor = itemColor;
            ctx.shadowBlur = 10 * pulse;
        } else {
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1;
        }
        ctx.fill();
        ctx.stroke();

        // Icon
        if (inventoryRef.current === 'BOMB') {
             ctx.beginPath();
             ctx.arc(0, 0, 15, 0, Math.PI * 2);
             ctx.fillStyle = '#ef4444';
             ctx.fill();
             ctx.fillStyle = '#1f2937';
             ctx.font = 'bold 14px Rajdhani';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.fillText('!', 0, 1);
        } else if (inventoryRef.current === 'LASER') {
             ctx.fillStyle = '#22d3ee';
             ctx.strokeStyle = '#22d3ee';
             ctx.lineWidth = 3;
             ctx.lineCap = 'round';
             ctx.lineJoin = 'round';
             // Draw Zap
             ctx.beginPath();
             ctx.moveTo(5, -10);
             ctx.lineTo(-5, 0);
             ctx.lineTo(5, 0);
             ctx.lineTo(-5, 10);
             ctx.stroke();
        } else {
             ctx.fillStyle = '#475569';
             ctx.font = 'bold 12px Rajdhani';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.fillText('EMPTY', 0, 0);
        }

        ctx.restore();
        
        ctx.save();
        ctx.translate(BOMB_CENTER_X, SHOOTER_Y + 45);
        ctx.fillStyle = hasItem ? (inventoryRef.current === 'LASER' ? '#22d3ee' : '#ef4444') : '#475569';
        ctx.font = 'bold 10px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText(inventoryRef.current || 'ITEM', 0, 0);
        ctx.restore();
    }

    // --- COMBO HUD ---
    if (comboRef.current > 0 && gameState === GAME_STATES.PLAYING && comboDisplayTimerRef.current > 0) {
        ctx.save();
        // Fade out based on timer
        ctx.globalAlpha = Math.min(1, comboDisplayTimerRef.current);
        
        ctx.translate(CANVAS_WIDTH / 2, 70); 

        ctx.font = 'italic 900 32px Rajdhani';
        ctx.fillStyle = '#fbbf24'; 
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 15;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`COMBO x${comboRef.current}`, 0, -10);
        
        const boxSize = 20;
        const gap = 8;
        const totalWidth = (5 * boxSize) + (4 * gap);
        const startX = -totalWidth / 2;
        
        for (let i = 0; i < 5; i++) {
            const active = i < comboRef.current;
            ctx.beginPath();
            const x = startX + i * (boxSize + gap);
            const y = 15;
            
            ctx.moveTo(x, y + boxSize);
            ctx.lineTo(x + boxSize, y + boxSize);
            ctx.lineTo(x + boxSize + 4, y); 
            ctx.lineTo(x + 4, y);
            ctx.closePath();
            
            if (active) {
                ctx.fillStyle = '#facc15'; 
                ctx.shadowColor = '#facc15';
                ctx.shadowBlur = 10;
            } else {
                ctx.fillStyle = 'rgba(71, 85, 105, 0.5)'; 
                ctx.shadowBlur = 0;
            }
            ctx.fill();
        }
        
        ctx.font = 'bold 10px Rajdhani';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 0;
        ctx.fillText('BOMB CHARGE', 0, 45);
        
        ctx.restore();
    }

    particlesRef.current.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px Rajdhani';
    floatingTextsRef.current.forEach(t => {
      ctx.fillStyle = t.text.includes('DANGER') || t.text.includes('BOOM') ? `rgba(239, 68, 68, ${t.opacity})` : `rgba(255, 255, 255, ${t.opacity})`;
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.restore();
    
    ctx.restore();
  };

  const loop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    update();
    draw(ctx);
    
    animationFrameRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [gameState]);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    mouseRef.current = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      // 1. Check Swap Button (Right)
      const distSwap = Math.sqrt(Math.pow(x - PREVIEW_CENTER_X, 2) + Math.pow(y - PREVIEW_CENTER_Y, 2));
      if (distSwap < UI_BUTTON_RADIUS + 10) {
          swapBubbles();
          return;
      }

      // 2. Check Bomb Button (Left) -> NOW EQUIPMENT SLOT
      const distBomb = Math.sqrt(Math.pow(x - BOMB_CENTER_X, 2) + Math.pow(y - SHOOTER_Y, 2));
      if (distBomb < UI_BUTTON_RADIUS + 10) {
          equipItem();
          return;
      }

      // 3. Shoot
      mouseRef.current = { x, y };
      shoot();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-900">
      
      {/* Header / HUD */}
      <div className="w-full max-w-[480px] flex justify-between items-center mb-4 px-4 py-3 bg-slate-800/80 rounded-xl border border-slate-700 shadow-lg backdrop-blur-sm z-10">
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 uppercase tracking-widest">Score</span>
          <span className="text-3xl font-bold font-mono text-cyan-400 neon-text">{score.toLocaleString()}</span>
        </div>
        
        {/* Danger Meter */}
        <div className="flex flex-col items-center gap-1">
             <span className="text-[10px] text-red-500 font-bold tracking-widest uppercase">Danger</span>
             <div className="flex gap-1">
                 {[...Array(MISS_THRESHOLD)].map((_, i) => (
                     <div 
                        key={i} 
                        className={`w-2 h-4 rounded-sm transition-all duration-300 ${i < missCount ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-slate-700'}`}
                     />
                 ))}
             </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end">
             <span className="text-xs text-slate-400 uppercase tracking-widest">High</span>
             <span className="text-xl font-bold text-slate-200">{highScore > score ? highScore : score}</span>
           </div>
           
           {/* Restart Button */}
           <button 
             onClick={initGame}
             className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors border border-slate-600 text-cyan-400"
             title="Restart Game"
           >
             <RefreshCcw size={18} />
           </button>
        </div>
      </div>

      {/* Game Container */}
      <div className="relative group shadow-2xl shadow-cyan-900/20 rounded-xl overflow-hidden border-2 border-slate-700">
        
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="bg-slate-900 cursor-crosshair touch-none max-w-full h-auto"
          style={{ width: '100%', maxHeight: '80vh', aspectRatio: '2/3' }}
          onMouseMove={handleMouseMove}
          onTouchMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        />

        {/* Start / Game Over Overlay */}
        {gameState !== GAME_STATES.PLAYING && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in z-20">
            {gameState === GAME_STATES.VICTORY && (
                <div className="mb-6 flex flex-col items-center animate-bounce">
                    <Trophy size={64} className="text-yellow-400 mb-2 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                    <h2 className="text-5xl font-black text-white italic tracking-tighter neon-text">CLEARED!</h2>
                </div>
            )}
            
            {gameState === GAME_STATES.GAME_OVER && (
                 <h2 className="text-5xl font-black text-red-500 mb-8 italic tracking-tighter neon-text drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">GAME OVER</h2>
            )}

            {gameState === GAME_STATES.MENU && (
                <div className="text-center mb-10">
                     <h1 className="text-5xl font-black text-cyan-400 mb-2 italic tracking-tighter neon-text">NEON</h1>
                     <h1 className="text-5xl font-black text-purple-500 italic tracking-tighter neon-text">BUBBLE</h1>
                </div>
            )}

            <button
              onClick={initGame}
              className="group relative px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-full transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(8,145,178,0.6)] flex items-center gap-2"
            >
              {gameState === GAME_STATES.MENU ? <Play size={24} /> : <RotateCcw size={24} />}
              <span className="text-xl tracking-wider">
                {gameState === GAME_STATES.MENU ? 'START GAME' : 'TRY AGAIN'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 text-slate-500 text-sm max-w-md text-center">
        <p className="flex items-center justify-center gap-4">
           <span className="flex items-center gap-1"><ArrowUp size={16} /> Aim & Shoot</span>
           <span className="flex items-center gap-1"><RefreshCw size={14}/> Swap</span>
           <span className="flex items-center gap-1"><Zap size={14}/> Bomb/Laser</span>
        </p>
      </div>

    </div>
  );
};

export default GameCanvas;