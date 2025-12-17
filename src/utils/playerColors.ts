/**
 * Player color utilities
 */

export const PLAYER_COLORS = [
  '#2196F3', // Blue - Player 1 (Amuse Labs primary blue)
  '#FF9800', // Orange - Player 2 (Amuse Labs secondary orange)
  '#4CAF50', // Green - Player 3
  '#9C27B0', // Purple - Player 4
  '#F44336', // Red - Player 5
  '#00BCD4', // Cyan - Player 6
];

export function getPlayerColor(playerId: number): string {
  return PLAYER_COLORS[playerId] || '#999999';
}

export function getPlayerColorLight(playerId: number): string {
  const color = getPlayerColor(playerId);
  // Convert hex to rgba with opacity
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.2)`;
}

