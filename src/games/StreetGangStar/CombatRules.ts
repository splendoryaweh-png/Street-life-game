/** Shared, deterministic combat rules for Street Gang Star single-player and multiplayer. */
export const PLAYER_HITS_TO_DOWN = 15;
export const ENEMY_TANK_HEALTH = 20;
export const ORDINARY_TANK_HIT_DAMAGE = 1;
export const TANK_VS_TANK_HIT_DAMAGE = 2;

export function playerHealthAfterHits(hitCount: number): number {
  const hits = Math.max(0, Math.min(PLAYER_HITS_TO_DOWN, Math.floor(hitCount)));
  return Math.max(0, 100 - (hits / PLAYER_HITS_TO_DOWN) * 100);
}

export function tankDamagePerHit(attackerIsTank: boolean, targetIsTank: boolean): number {
  return attackerIsTank && targetIsTank
    ? TANK_VS_TANK_HIT_DAMAGE
    : ORDINARY_TANK_HIT_DAMAGE;
}

export function isPlayerDown(hitCount: number): boolean {
  return hitCount >= PLAYER_HITS_TO_DOWN;
}

export function isTankDestroyed(health: number): boolean {
  return health <= 0;
}
