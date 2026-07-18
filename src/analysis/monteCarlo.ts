export function monteCarlo(
  probability: number,
  simulations = 10000
): number {
  let wins = 0;

  for (let i = 0; i < simulations; i++) {
    if (Math.random() < probability) {
      wins++;
    }
  }

  return wins / simulations;
}