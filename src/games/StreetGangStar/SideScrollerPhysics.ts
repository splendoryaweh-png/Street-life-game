/**
 * Shared side-scroller simulation primitives for Street Gang Star.
 *
 * World X is the horizontal street axis. World Y is reserved for the actor's
 * ground lane; vertical movement is represented by jumpOffset/jumpVelocity.
 * Keep this module free of DOM and rendering dependencies so both game modes
 * use identical movement and camera rules.
 */
export interface SideScrollerBody {
  x: number;
  y: number;
  vx: number;
  jumpOffset: number;
  jumpVelocity: number;
  isJumping: boolean;
}

export interface SideScrollerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
}

export interface SideScrollerBounds {
  minX: number;
  maxX: number;
  groundY: number;
}

export interface SideScrollerCamera {
  x: number;
  targetX: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** Move only along the street axis; jumping is independent of world depth. */
export function stepSideScrollerBody(
  body: SideScrollerBody,
  input: SideScrollerInput,
  bounds: SideScrollerBounds,
  deltaScale = 1,
  walkSpeed = 4.5,
  sprintMultiplier = 1.65,
) {
  const direction = Number(input.right) - Number(input.left);
  const speed = walkSpeed * (input.sprint ? sprintMultiplier : 1);
  body.vx = direction * speed;
  body.x = clamp(body.x + body.vx * deltaScale, bounds.minX, bounds.maxX);
  body.y = bounds.groundY;

  if (input.jump && !body.isJumping) {
    body.isJumping = true;
    body.jumpVelocity = 8.5;
  }
  if (body.isJumping) {
    body.jumpOffset = Math.max(0, body.jumpOffset + body.jumpVelocity * deltaScale);
    body.jumpVelocity -= 0.65 * deltaScale;
    if (body.jumpOffset === 0) {
      body.jumpVelocity = 0;
      body.isJumping = false;
    }
  }
  return body;
}

/** Smooth horizontal follow camera, clamped to the 8,000-unit city world. */
export function stepSideScrollerCamera(
  camera: SideScrollerCamera,
  playerX: number,
  viewportWidth: number,
  worldWidth: number,
  smoothing = 0.16,
) {
  const maxX = Math.max(0, worldWidth - viewportWidth);
  camera.targetX = clamp(playerX - viewportWidth / 2, 0, maxX);
  camera.x += (camera.targetX - camera.x) * smoothing;
  camera.x = clamp(camera.x, 0, maxX);
  return camera.x;
}

/** Keep a world actor on the common street ground plane. */
export function alignToStreetGround<T extends { y: number }>(actor: T, groundY: number): T {
  actor.y = groundY;
  return actor;
}
