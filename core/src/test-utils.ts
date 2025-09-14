import * as fs from 'fs';
import * as path from 'path';

/**
 * Test utility functions for MessageValue testing
 */

/**
 * Load binary protobuf descriptor from file
 */
export function loadDescriptor(filename: string): Uint8Array {
  // Try multiple possible paths
  const possiblePaths = [
    path.resolve(__dirname, '../../../web-app/public', filename),
    path.resolve(__dirname, '../../../../web-app/public', filename),
    path.resolve(process.cwd(), '../web-app/public', filename),
    path.resolve(process.cwd(), 'web-app/public', filename),
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return new Uint8Array(fs.readFileSync(filePath));
    }
  }

  throw new Error(`Descriptor file not found. Tried paths:\n${possiblePaths.join('\n')}`);
}

/**
 * Load binary protobuf data from file
 */
export function loadBinaryData(filename: string): Uint8Array {
  // Try multiple possible paths
  const possiblePaths = [
    path.resolve(__dirname, '../../../web-app/public', filename),
    path.resolve(__dirname, '../../../../web-app/public', filename),
    path.resolve(process.cwd(), '../web-app/public', filename),
    path.resolve(process.cwd(), 'web-app/public', filename),
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return new Uint8Array(fs.readFileSync(filePath));
    }
  }

  throw new Error(`Data file not found. Tried paths:\n${possiblePaths.join('\n')}`);
}

/**
 * Create a comprehensive test Person object with all field types
 */
export function createTestPersonData() {
  return {
    name: 'John Doe',
    id: 12345,
    is_verified: true,
    eye_color: 1, // BLUE
    address: {
      street: '123 Test Street',
      city: 'Test City',
      zip_code: '12345'
    },
    phones: [
      { number: '555-1234', type: 1 }, // MOBILE
      { number: '555-5678', type: 2 }, // HOME
      { number: '555-9999', type: 3 }  // WORK
    ],
    articles: [
      {
        title: 'First Article',
        content: 'This is the first test article',
        url: 'https://example.com/article1',
        tags: ['tech', 'programming', 'test'],
        published_at: 1609459200 // 2021-01-01 00:00:00 UTC
      },
      {
        title: 'Second Article',
        content: 'This is the second test article',
        url: 'https://example.com/article2',
        tags: ['tutorial', 'guide'],
        published_at: 1609545600 // 2021-01-02 00:00:00 UTC
      }
    ]
  };
}

/**
 * Compare two values for deep equality, handling MessageValue objects
 */
export function deepEqual(actual: any, expected: any): boolean {
  // Handle null/undefined
  if (actual === expected) return true;
  if (actual == null || expected == null) return false;

  // Handle primitive types
  if (typeof actual !== 'object' || typeof expected !== 'object') {
    return actual === expected;
  }

  // Handle arrays
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return false;
    return actual.every((val, idx) => deepEqual(val, expected[idx]));
  }

  // Handle MessageValue objects (they have a toObject method)
  if (actual.toObject && typeof actual.toObject === 'function') {
    return deepEqual(actual.toObject(), expected);
  }

  // Handle regular objects
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);

  if (actualKeys.length !== expectedKeys.length) return false;

  return actualKeys.every(key => deepEqual(actual[key], expected[key]));
}

/**
 * Assert that a MessageValue has the expected field values
 */
export function assertMessageValue(
  messageValue: any,
  expectedFields: Record<number, any>
): void {
  for (const [fieldNum, expectedValue] of Object.entries(expectedFields)) {
    const fieldNumber = parseInt(fieldNum);
    const actualValue = messageValue.getField(fieldNumber);

    if (!deepEqual(actualValue, expectedValue)) {
      throw new Error(
        `Field ${fieldNumber} mismatch: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
      );
    }
  }
}