/**
 * Reactive MessageValue implementation using Svelte's reactive collections
 *
 * This provides a drop-in replacement for MessageValue that uses Svelte's
 * SvelteMap for internal storage, enabling fine-grained reactivity for
 * field mutations without requiring global reactivity keys.
 */

import type { MessageValue, MessageType, FieldValue } from '@lintx/core';
import { SvelteMap } from 'svelte/reactivity';

/**
 * Reactive wrapper around MessageValue that uses SvelteMap for internal storage
 */
export class ReactiveMessageValue implements MessageValue {
  public readonly type: MessageType;

  // Use Svelte's reactive Map for field storage
  private fields = new SvelteMap<number, any>();
  private repeatedFields = new SvelteMap<number, any[]>();

  constructor(type: MessageType, originalMessage?: MessageValue) {
    this.type = type;

    // If we have an original message, copy its data
    if (originalMessage) {
      this.copyFromOriginal(originalMessage);
    }
  }

  /**
   * Copy all data from an original MessageValue
   */
  private copyFromOriginal(original: MessageValue): void {
    // Copy all fields from the original message
    for (const fieldDef of this.type.fields.values()) {
      const fieldNumber = fieldDef.number;

      if (fieldDef.label === 3) { // LABEL_REPEATED
        const repeatedData = original.getRepeatedField(fieldNumber);
        if (repeatedData && repeatedData.length > 0) {
          // Deep copy repeated field data
          const copiedArray = repeatedData.map(item => this.deepCopyFieldValue(item));
          this.repeatedFields.set(fieldNumber, copiedArray);
        }
      } else {
        const fieldData = original.getField(fieldNumber);
        if (fieldData !== null && fieldData !== undefined) {
          // Deep copy field data
          this.fields.set(fieldNumber, this.deepCopyFieldValue(fieldData));
        }
      }
    }
  }

  /**
   * Deep copy a field value, wrapping MessageValues in ReactiveMessageValue
   */
  private deepCopyFieldValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // If it's a MessageValue, wrap it in ReactiveMessageValue
    if (value && typeof value === 'object' && 'type' in value && 'getField' in value) {
      return new ReactiveMessageValue(value.type, value);
    }

    // If it's a Uint8Array, create a copy
    if (value instanceof Uint8Array) {
      return new Uint8Array(value);
    }

    // For primitives (string, number, boolean), return as-is
    if (typeof value !== 'object') {
      return value;
    }

    // For arrays, deep copy each element
    if (Array.isArray(value)) {
      return value.map(item => this.deepCopyFieldValue(item));
    }

    // For other objects, create a shallow copy (shouldn't happen in protobuf)
    return { ...value };
  }

  /**
   * Get a singular field value
   */
  getField(fieldNumber: number): any {
    return this.fields.get(fieldNumber) ?? null;
  }

  /**
   * Set a singular field value
   */
  setField(fieldNumber: number, value: any): void {
    if (value === null || value === undefined) {
      this.fields.delete(fieldNumber);
    } else {
      this.fields.set(fieldNumber, this.deepCopyFieldValue(value));
    }
  }

  /**
   * Get a repeated field array
   */
  getRepeatedField(fieldNumber: number): any[] | null {
    return this.repeatedFields.get(fieldNumber) ?? null;
  }

  /**
   * Add an item to a repeated field
   */
  addRepeatedField(fieldNumber: number, value: any): void {
    const existing = this.repeatedFields.get(fieldNumber);
    if (existing) {
      // Create a new array to trigger reactivity
      const newArray = [...existing, this.deepCopyFieldValue(value)];
      this.repeatedFields.set(fieldNumber, newArray);
    } else {
      this.repeatedFields.set(fieldNumber, [this.deepCopyFieldValue(value)]);
    }
  }

  /**
   * Clear a field (singular or repeated)
   */
  clearField(fieldNumber: number): void {
    this.fields.delete(fieldNumber);
    this.repeatedFields.delete(fieldNumber);
  }

  /**
   * Check if a field has been set
   */
  hasField(fieldNumber: number): boolean {
    return this.fields.has(fieldNumber) || this.repeatedFields.has(fieldNumber);
  }

  /**
   * Get all field numbers that have been set
   */
  getSetFieldNumbers(): number[] {
    const fieldNumbers = new Set<number>();
    for (const num of this.fields.keys()) {
      fieldNumbers.add(num);
    }
    for (const num of this.repeatedFields.keys()) {
      fieldNumbers.add(num);
    }
    return Array.from(fieldNumbers).sort();
  }

  /**
   * Convert back to a regular MessageValue for serialization
   * This would be used when we need to encode the message
   */
  toMessageValue(): MessageValue {
    // This would need to create a regular MessageValue and copy data back
    // For now, we'll assume the encoding happens at a higher level
    throw new Error('toMessageValue() not yet implemented - encoding should happen at editor level');
  }

  /**
   * Create a reactive message from a regular MessageValue
   */
  static fromMessageValue(messageValue: MessageValue): ReactiveMessageValue {
    return new ReactiveMessageValue(messageValue.type, messageValue);
  }

  /**
   * Create an empty reactive message of a given type
   */
  static empty(type: MessageType): ReactiveMessageValue {
    return new ReactiveMessageValue(type);
  }
}

/**
 * Utility to convert MessageValue trees to ReactiveMessageValue trees
 */
export function makeReactive(messageValue: MessageValue): ReactiveMessageValue {
  return ReactiveMessageValue.fromMessageValue(messageValue);
}

/**
 * Utility to check if a value is a ReactiveMessageValue
 */
export function isReactive(value: any): value is ReactiveMessageValue {
  return value instanceof ReactiveMessageValue;
}