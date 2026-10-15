// Turns raw input (touch joystick, keyboard) into a screen-space push vector in the range of a unit disc.

export interface Push {
  x: number;
  y: number;
  mag: number;
}

const DEAD_ZONE = 0.12;

/** `dx`/`dy` is the knob offset from the centre in pixels, `radius` the travel of the knob. */
export function joystickVector(dx: number, dy: number, radius: number): Push {
  const len = Math.hypot(dx, dy);
  const mag = Math.min(1, len / radius);
  if (mag < DEAD_ZONE || len === 0) return { x: 0, y: 0, mag: 0 };
  return { x: dx / len, y: dy / len, mag };
}

const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];

export function keyboardVector(keys: ReadonlySet<string>): { x: number; y: number } {
  const has = (codes: string[]) => codes.some((c) => keys.has(c));
  const x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
  const y = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
  const len = Math.hypot(x, y);
  return len === 0 ? { x: 0, y: 0 } : { x: x / len, y: y / len };
}

/** Tracks held keys on a window. */
export class Keys {
  readonly down = new Set<string>();
  private target: Window | null = null;
  private readonly onDown = (e: KeyboardEvent) => {
    this.down.add(e.code);
  };
  private readonly onUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };
  private readonly onBlur = () => {
    this.down.clear();
  };

  attach(target: Window): void {
    this.target = target;
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    this.target?.removeEventListener('keydown', this.onDown);
    this.target?.removeEventListener('keyup', this.onUp);
    this.target?.removeEventListener('blur', this.onBlur);
    this.target = null;
    this.down.clear();
  }

  vector(): { x: number; y: number } {
    return keyboardVector(this.down);
  }
}
