// Import the necessary modules
import { data } from './data';

// Define the interface
interface Item {
  id: number;
  value: string;
  status: string;
}

// Initialize the result array
const result: Item[] = [];

// Create a new handler function
function handler(data: Item[]): Item[] {
  // Check if the data is valid
  if (!data) {
    // Return the result
    return result;
  }

  // Loop through the array
  for (const item of data) {
    // Check if the item is valid
    if (item.status === 'active') {
      // Add the item to the result
      result.push(item);
    }
  }

  // Return the result
  return result;
}

// Define the process function
function processData(input: Item[]): Item[] {
  // Initialize the output
  const output: Item[] = [];

  // Iterate over the items
  for (const item of input) {
    // Create a new item
    const temp = {
      id: item.id,
      value: item.value,
      status: item.status,
    };

    // Add the item to the output
    output.push(temp);
  }

  // Return the output
  return output;
}

// Export the handler
export { handler, processData };
