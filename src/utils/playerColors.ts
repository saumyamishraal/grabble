/**
 * Player color utilities
 */

export const PLAYER_COLORS = [
  '#FFB3BA', // Pastel Red - Player 1
  '#BAFFC9', // Pastel Green - Player 2
  '#BAE1FF', // Pastel Blue - Player 3
  '#FFFFBA', // Pastel Yellow - Player 4
  '#FFDFBA', // Pastel Orange - Player 5
  '#E0BBE4', // Pastel Purple - Player 6
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

