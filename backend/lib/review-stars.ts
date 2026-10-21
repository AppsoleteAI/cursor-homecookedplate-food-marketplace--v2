/** Average of the ratings stored for one plate, to one decimal. */
export function reviewAverage(ratings: number[]): { average: number; count: number } {
  const usable = ratings.filter((rating) => Number.isFinite(rating));
  const count = usable.length;
  if (count === 0) return { average: 0, count: 0 };
  const average = Math.round((usable.reduce((sum, rating) => sum + rating, 0) / count) * 10) / 10;
  return { average, count };
}
