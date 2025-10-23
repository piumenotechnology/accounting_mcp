export async function countTool({ start, end }) {
  console.error(`🔢 Counting from ${start} to ${end}`);
  
  // Validate input
  if (typeof start !== 'number' || typeof end !== 'number') {
    throw new Error('start and end must be numbers');
  }
  
  if (start > end) {
    throw new Error('start must be less than or equal to end');
  }
  
  if (end - start > 1000) {
    throw new Error('Range too large (max 1000)');
  }
  
  // Count
  const numbers = [];
  for (let i = start; i <= end; i++) {
    numbers.push(i);
  }
  
  return {
    numbers: numbers,
    count: numbers.length,
    range: `${start}-${end}`
  };
}