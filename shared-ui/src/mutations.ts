/**
 * Mutation-based data flow system for the protobuf editor
 *
 * This module defines all possible mutations that can be applied to the data structure,
 * providing a unidirectional data flow where UI events generate mutations that are
 * applied at the top level to update state.
 */

import type { MessageValue } from '@lintx/core'

/**
 * Valid primitive values that can be stored in protobuf fields
 */
export type PrimitiveValue = string | number | boolean | Uint8Array

/**
 * Valid values that can be stored in any protobuf field
 */
export type FieldValue = PrimitiveValue | MessageValue | null | undefined

/**
 * A path segment identifies a field and optionally an index within that field.
 * - fieldNumber: The protobuf field number
 * - index: Array index for repeated fields, always 0 for singular fields
 */
export interface PathSegment {
  fieldNumber: number
  index: number
}

/**
 * A path identifies a specific field (and position) in the nested message structure.
 * Each segment represents a field number and index in the protobuf schema.
 *
 * Examples:
 * - [{fieldNumber: 1, index: 0}] = root field 1 (singular)
 * - [{fieldNumber: 1, index: 2}] = root field 1, 3rd item (repeated)
 * - [{fieldNumber: 1, index: 0}, {fieldNumber: 2, index: 0}] = field 2 inside singular field 1
 * - [{fieldNumber: 1, index: 2}, {fieldNumber: 2, index: 1}] = field 2 (2nd item) inside field 1 (3rd item)
 */
export type FieldPath = PathSegment[]

/**
 * Base mutation interface - all mutations extend this
 */
export interface BaseMutation {
  /** Unique identifier for this mutation */
  id: string
  /** Timestamp when mutation was created */
  timestamp: number
  /** Path to the field being mutated */
  path: FieldPath
  /** Human-readable description of the mutation */
  description: string
}

/**
 * Set a field value (works for both singular and specific repeated field items)
 */
export interface SetFieldMutation extends BaseMutation {
  type: 'SET_FIELD'
  value: FieldValue
}

/**
 * Clear a field (set to null/undefined)
 */
export interface ClearFieldMutation extends BaseMutation {
  type: 'CLEAR_FIELD'
}

/**
 * Add an item to a repeated field
 */
export interface AddRepeatedFieldMutation extends BaseMutation {
  type: 'ADD_REPEATED_FIELD'
  value: FieldValue
  /** Index to insert at (undefined = append to end) */
  insertIndex?: number
}

/**
 * Remove an item from a repeated field
 */
export interface RemoveRepeatedFieldMutation extends BaseMutation {
  type: 'REMOVE_REPEATED_FIELD'
  /** Index of the item to remove */
  targetIndex: number
}

/**
 * Move an item within a repeated field
 */
export interface MoveRepeatedFieldMutation extends BaseMutation {
  type: 'MOVE_REPEATED_FIELD'
  fromIndex: number
  toIndex: number
}

/**
 * Union type of all possible field mutations
 */
export type FieldMutation =
  | SetFieldMutation
  | ClearFieldMutation
  | AddRepeatedFieldMutation
  | RemoveRepeatedFieldMutation
  | MoveRepeatedFieldMutation

/**
 * Utility functions for working with mutations
 */
export class MutationUtils {
  private static mutationCounter = 0

  /**
   * Generate a unique mutation ID
   */
  static generateId(): string {
    return `mutation_${Date.now()}_${++this.mutationCounter}`
  }

  /**
   * Create a path string for display purposes
   */
  static pathToString(path: FieldPath): string {
    return path
      .map((segment) =>
        segment.index === 0
          ? segment.fieldNumber.toString()
          : `${segment.fieldNumber}[${segment.index}]`
      )
      .join('.')
  }

  /**
   * Create a simple field path for singular fields
   */
  static createSingularPath(fieldNumbers: number[]): FieldPath {
    return fieldNumbers.map((fieldNumber) => ({ fieldNumber, index: 0 }))
  }

  /**
   * Create a path that points to a specific index in the last field
   */
  static createRepeatedPath(
    fieldNumbers: number[],
    finalIndex: number
  ): FieldPath {
    const segments = fieldNumbers.map((fieldNumber) => ({
      fieldNumber,
      index: 0,
    }))
    if (segments.length > 0) {
      segments[segments.length - 1].index = finalIndex
    }
    return segments
  }

  /**
   * Get the parent path (all segments except the last)
   */
  static getParentPath(path: FieldPath): FieldPath {
    return path.slice(0, -1)
  }

  /**
   * Get the last segment of a path
   */
  static getLastSegment(path: FieldPath): PathSegment | undefined {
    return path[path.length - 1]
  }

  /**
   * Serialize a field value for display in descriptions
   */
  static serializeValue(value: FieldValue): string {
    if (value === null || value === undefined) {
      return 'null'
    }
    if (value instanceof Uint8Array) {
      return `<${value.length} bytes>`
    }
    if (typeof value === 'object' && 'type' in value) {
      // MessageValue
      return `<${value.type?.fullName || 'Message'}>`
    }
    return JSON.stringify(value)
  }

  /**
   * Create a human-readable description of a mutation
   */
  static createDescription(
    mutation: Omit<FieldMutation, 'id' | 'timestamp' | 'description'>
  ): string {
    const pathStr = this.pathToString(mutation.path)

    switch (mutation.type) {
      case 'SET_FIELD':
        return `Set field ${pathStr} = ${this.serializeValue(mutation.value)}`
      case 'CLEAR_FIELD':
        return `Clear field ${pathStr}`
      case 'ADD_REPEATED_FIELD':
        const indexStr =
          mutation.insertIndex !== undefined
            ? ` at index ${mutation.insertIndex}`
            : ' at end'
        return `Add item to field ${pathStr}${indexStr}: ${this.serializeValue(mutation.value)}`
      case 'REMOVE_REPEATED_FIELD':
        return `Remove item from field ${pathStr} at index ${mutation.targetIndex}`
      case 'MOVE_REPEATED_FIELD':
        return `Move item in field ${pathStr} from index ${mutation.fromIndex} to ${mutation.toIndex}`
      default:
        return `Unknown mutation on field ${pathStr}`
    }
  }

  /**
   * Create a complete mutation object
   */
  static createMutation<T extends FieldMutation>(
    mutationData: Omit<T, 'id' | 'timestamp' | 'description'>
  ): T {
    return {
      ...mutationData,
      id: this.generateId(),
      timestamp: Date.now(),
      description: this.createDescription(mutationData),
    } as T
  }
}

/**
 * Event interface for mutation dispatch
 */
export interface MutationEvent {
  mutation: FieldMutation
}

/**
 * Type guard to check if an object is a mutation event
 */
export function isMutationEvent(obj: any): obj is MutationEvent {
  return obj && typeof obj === 'object' && 'mutation' in obj
}

/**
 * Mutation applicator - applies mutations to MessageValue objects
 */
export class MutationApplicator {
  /**
   * Apply a mutation to a MessageValue
   */
  static applyMutation(
    rootMessage: MessageValue,
    mutation: FieldMutation
  ): void {
    console.log('[MutationApplicator] Applying mutation:', mutation.description)

    try {
      switch (mutation.type) {
        case 'SET_FIELD':
          this.applySetField(rootMessage, mutation)
          break
        case 'CLEAR_FIELD':
          this.applyClearField(rootMessage, mutation)
          break
        case 'ADD_REPEATED_FIELD':
          this.applyAddRepeatedField(rootMessage, mutation)
          break
        case 'REMOVE_REPEATED_FIELD':
          this.applyRemoveRepeatedField(rootMessage, mutation)
          break
        case 'MOVE_REPEATED_FIELD':
          this.applyMoveRepeatedField(rootMessage, mutation)
          break
        default:
          console.error(
            '[MutationApplicator] Unknown mutation type:',
            (mutation as any).type
          )
      }
    } catch (error) {
      console.error(
        '[MutationApplicator] Error applying mutation:',
        error,
        mutation
      )
    }
  }

  /**
   * Navigate to the target field and parent using a path
   */
  private static navigateToField(
    rootMessage: MessageValue,
    path: FieldPath
  ): {
    parent: MessageValue
    fieldNumber: number
    index: number
  } {
    let current = rootMessage

    // Navigate through all but the last segment
    for (let i = 0; i < path.length - 1; i++) {
      const segment = path[i]

      if (segment.index === 0) {
        // Singular field
        current = current.getField(segment.fieldNumber) as MessageValue
      } else {
        // Repeated field item
        const items = current.getRepeatedField(
          segment.fieldNumber
        ) as MessageValue[]
        current = items[segment.index]
      }

      if (!current) {
        throw new Error(
          `Navigation failed at path segment ${i}: field ${segment.fieldNumber}, index ${segment.index}`
        )
      }
    }

    // Return the parent and the final field info
    const finalSegment = path[path.length - 1]
    return {
      parent: current,
      fieldNumber: finalSegment.fieldNumber,
      index: finalSegment.index,
    }
  }

  private static applySetField(
    rootMessage: MessageValue,
    mutation: SetFieldMutation
  ): void {
    const { parent, fieldNumber, index } = this.navigateToField(
      rootMessage,
      mutation.path
    )

    if (index === 0) {
      // Setting singular field
      parent.setField(fieldNumber, mutation.value)
    } else {
      // Setting specific item in repeated field
      const items = parent.getRepeatedField(fieldNumber) || []
      const newItems = [...items]
      newItems[index] = mutation.value
      parent.clearField(fieldNumber)
      newItems.forEach((item) => parent.addRepeatedField(fieldNumber, item))
    }
  }

  private static applyClearField(
    rootMessage: MessageValue,
    mutation: ClearFieldMutation
  ): void {
    const { parent, fieldNumber } = this.navigateToField(
      rootMessage,
      mutation.path
    )
    parent.clearField(fieldNumber)
  }

  private static applyAddRepeatedField(
    rootMessage: MessageValue,
    mutation: AddRepeatedFieldMutation
  ): void {
    const { parent, fieldNumber } = this.navigateToField(
      rootMessage,
      mutation.path
    )

    if (mutation.insertIndex === undefined) {
      // Add to end
      parent.addRepeatedField(fieldNumber, mutation.value)
    } else {
      // Insert at specific index
      const items = parent.getRepeatedField(fieldNumber) || []
      const newItems = [...items]
      newItems.splice(mutation.insertIndex, 0, mutation.value)
      parent.clearField(fieldNumber)
      newItems.forEach((item) => parent.addRepeatedField(fieldNumber, item))
    }
  }

  private static applyRemoveRepeatedField(
    rootMessage: MessageValue,
    mutation: RemoveRepeatedFieldMutation
  ): void {
    const { parent, fieldNumber } = this.navigateToField(
      rootMessage,
      mutation.path
    )

    const items = parent.getRepeatedField(fieldNumber) || []
    const newItems = items.filter((_, i) => i !== mutation.targetIndex)
    parent.clearField(fieldNumber)
    newItems.forEach((item) => parent.addRepeatedField(fieldNumber, item))
  }

  private static applyMoveRepeatedField(
    rootMessage: MessageValue,
    mutation: MoveRepeatedFieldMutation
  ): void {
    const { parent, fieldNumber } = this.navigateToField(
      rootMessage,
      mutation.path
    )

    const items = parent.getRepeatedField(fieldNumber) || []
    if (
      mutation.fromIndex < 0 ||
      mutation.fromIndex >= items.length ||
      mutation.toIndex < 0 ||
      mutation.toIndex >= items.length
    ) {
      throw new Error(
        `Invalid move indices: ${mutation.fromIndex} -> ${mutation.toIndex}, array length: ${items.length}`
      )
    }

    const newItems = [...items]
    ;[newItems[mutation.fromIndex], newItems[mutation.toIndex]] = [
      newItems[mutation.toIndex],
      newItems[mutation.fromIndex],
    ]
    parent.clearField(fieldNumber)
    newItems.forEach((item) => parent.addRepeatedField(fieldNumber, item))
  }
}

/**
 * Mutation dispatcher utility class
 * Helps components create and dispatch field mutations
 */
export class MutationDispatcher {
  constructor(
    private basePath: FieldPath,
    private dispatch: (event: MutationEvent) => void
  ) {}

  /**
   * Create a path by appending to the base path
   */
  private createPath(fieldNumber: number, index: number = 0): FieldPath {
    return [...this.basePath, { fieldNumber, index }]
  }

  /**
   * Dispatch a SET_FIELD mutation
   */
  setField(fieldNumber: number, value: FieldValue, index: number = 0): void {
    const mutation = MutationUtils.createMutation<SetFieldMutation>({
      type: 'SET_FIELD',
      path: this.createPath(fieldNumber, index),
      value,
    })
    this.dispatch({ mutation })
  }

  /**
   * Dispatch a CLEAR_FIELD mutation
   */
  clearField(fieldNumber: number, index: number = 0): void {
    const mutation = MutationUtils.createMutation<ClearFieldMutation>({
      type: 'CLEAR_FIELD',
      path: this.createPath(fieldNumber, index),
    })
    this.dispatch({ mutation })
  }

  /**
   * Dispatch an ADD_REPEATED_FIELD mutation
   */
  addRepeatedField(
    fieldNumber: number,
    value: FieldValue,
    insertIndex?: number
  ): void {
    const mutation = MutationUtils.createMutation<AddRepeatedFieldMutation>({
      type: 'ADD_REPEATED_FIELD',
      path: this.createPath(fieldNumber, 0), // Parent field path
      value,
      insertIndex,
    })
    this.dispatch({ mutation })
  }

  /**
   * Dispatch a REMOVE_REPEATED_FIELD mutation
   */
  removeRepeatedField(fieldNumber: number, targetIndex: number): void {
    const mutation = MutationUtils.createMutation<RemoveRepeatedFieldMutation>({
      type: 'REMOVE_REPEATED_FIELD',
      path: this.createPath(fieldNumber, 0), // Parent field path
      targetIndex,
    })
    this.dispatch({ mutation })
  }

  /**
   * Dispatch a MOVE_REPEATED_FIELD mutation
   */
  moveRepeatedField(
    fieldNumber: number,
    fromIndex: number,
    toIndex: number
  ): void {
    const mutation = MutationUtils.createMutation<MoveRepeatedFieldMutation>({
      type: 'MOVE_REPEATED_FIELD',
      path: this.createPath(fieldNumber, 0), // Parent field path
      fromIndex,
      toIndex,
    })
    this.dispatch({ mutation })
  }

  /**
   * Dispatch a SET_FIELD mutation to the current path (for self-mutations)
   */
  setSelf(value: FieldValue): void {
    const mutation = MutationUtils.createMutation<SetFieldMutation>({
      type: 'SET_FIELD',
      path: this.basePath,
      value,
    })
    this.dispatch({ mutation })
  }

  /**
   * Create a child dispatcher for nested fields
   */
  createChild(fieldNumber: number, index: number = 0): MutationDispatcher {
    return new MutationDispatcher(
      this.createPath(fieldNumber, index),
      this.dispatch
    )
  }
}
