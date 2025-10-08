import type {
  FieldPath,
  FieldPathSegment,
  Comment,
  PathKey as PathKeyType,
} from './types.js';
import { PathKey } from './types.js';
import {
  DocumentPresentation,
  FieldComments,
  Comment as ProtoComment,
} from './generated/config/presentation.js';

/**
 * Manages presentation data (comments, styling) for protobuf documents
 * Handles loading, saving, and CRUD operations on comments
 */
export class PresentationManager {
  private presentation: DocumentPresentation;
  private commentsByPath: Array<{ path: FieldPath; comments: Comment[] }> = [];
  private dirty: boolean = false;

  constructor() {
    this.presentation = {
      version: 1,
      fieldComments: [],
    };
  }

  /**
   * Load presentation data from protobuf bytes
   */
  load(bytes: Uint8Array): void {
    this.presentation = DocumentPresentation.decode(bytes);
    this.rebuildIndex();
    this.dirty = false;
  }

  /**
   * Save presentation data to protobuf bytes
   */
  save(): Uint8Array {
    // Rebuild fieldComments from the index
    this.presentation.fieldComments = this.commentsByPath.map(
      ({ path, comments }) => ({
        path,
        comments,
      })
    );

    const bytes = DocumentPresentation.encode(this.presentation).finish();
    this.dirty = false;
    return bytes;
  }

  /**
   * Check if presentation has unsaved changes
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Rebuild the path→comments index from presentation data
   */
  private rebuildIndex(): void {
    this.commentsByPath = [];

    for (const fieldComment of this.presentation.fieldComments) {
      if (fieldComment.path) {
        this.commentsByPath.push({
          path: fieldComment.path,
          comments: fieldComment.comments,
        });
      }
    }
  }

  // ===== Comment CRUD Operations =====

  /**
   * Get all comments for a specific field path
   */
  getComments(path: FieldPath): Comment[] {
    const entry = this.commentsByPath.find((e) =>
      PathKey.equals(e.path, path)
    );
    return entry ? entry.comments : [];
  }

  /**
   * Add a new comment to a field
   */
  addComment(
    path: FieldPath,
    text: string,
    options: {
      author?: string;
      color?: string;
      background?: string;
      fontFamily?: string;
      fontSize?: number;
    } = {}
  ): Comment {
    const newComment: Comment = {
      uuid: this.generateUUID(),
      text,
      author: options.author || '',
      timestamp: Date.now(),
      color: options.color || '',
      background: options.background || '',
      fontFamily: options.fontFamily || '',
      fontSize: options.fontSize || 0,
    };

    const entry = this.commentsByPath.find((e) =>
      PathKey.equals(e.path, path)
    );
    if (entry) {
      entry.comments.push(newComment);
    } else {
      this.commentsByPath.push({
        path: PathKey.clone(path),
        comments: [newComment],
      });
    }

    this.dirty = true;
    return newComment;
  }

  /**
   * Update an existing comment
   */
  updateComment(
    uuid: string,
    updates: {
      text?: string;
      color?: string;
      background?: string;
      fontFamily?: string;
      fontSize?: number;
    }
  ): boolean {
    for (const entry of this.commentsByPath) {
      const comment = entry.comments.find((c) => c.uuid === uuid);
      if (comment) {
        if (updates.text !== undefined) comment.text = updates.text;
        if (updates.color !== undefined) comment.color = updates.color;
        if (updates.background !== undefined)
          comment.background = updates.background;
        if (updates.fontFamily !== undefined)
          comment.fontFamily = updates.fontFamily;
        if (updates.fontSize !== undefined) comment.fontSize = updates.fontSize;

        this.dirty = true;
        return true;
      }
    }
    return false;
  }

  /**
   * Delete a comment by UUID
   */
  deleteComment(uuid: string): boolean {
    for (let i = 0; i < this.commentsByPath.length; i++) {
      const entry = this.commentsByPath[i];
      const index = entry.comments.findIndex((c) => c.uuid === uuid);
      if (index >= 0) {
        entry.comments.splice(index, 1);

        // Remove path entry if no comments left
        if (entry.comments.length === 0) {
          this.commentsByPath.splice(i, 1);
        }

        this.dirty = true;
        return true;
      }
    }
    return false;
  }

  // ===== Mutation Handling =====

  /**
   * Handle deletion of an array item - remove comments and update indices
   */
  handleArrayItemDeleted(
    fieldPath: FieldPath,
    deletedIndex: number
  ): void {
    const indicesToDelete: number[] = [];
    const matchingSegmentIndex = fieldPath.segments.length - 1;

    for (let i = 0; i < this.commentsByPath.length; i++) {
      const entry = this.commentsByPath[i];

      // Check if this path starts with the array field path
      if (!PathKey.startsWith(entry.path, fieldPath)) continue;

      // Get the segment that contains the array index
      const segment = entry.path.segments[matchingSegmentIndex];
      if (!segment) continue;

      if (segment.arrayIndex === deletedIndex) {
        // This comment is for the deleted item - mark for deletion
        indicesToDelete.push(i);
      } else if (segment.arrayIndex > deletedIndex) {
        // This comment is for an item after the deleted one - decrement index
        segment.arrayIndex = segment.arrayIndex - 1;
        this.dirty = true;
      }
    }

    // Delete entries in reverse order to maintain indices
    for (let i = indicesToDelete.length - 1; i >= 0; i--) {
      this.commentsByPath.splice(indicesToDelete[i], 1);
    }

    if (indicesToDelete.length > 0) {
      this.dirty = true;
    }
  }

  /**
   * Handle reordering of array items - update indices
   */
  handleArrayItemMoved(
    fieldPath: FieldPath,
    fromIndex: number,
    toIndex: number
  ): void {
    const matchingSegmentIndex = fieldPath.segments.length - 1;
    let hasChanges = false;

    for (const entry of this.commentsByPath) {
      if (!PathKey.startsWith(entry.path, fieldPath)) continue;

      const segment = entry.path.segments[matchingSegmentIndex];
      if (!segment) continue;

      let newIndex = segment.arrayIndex;

      if (segment.arrayIndex === fromIndex) {
        newIndex = toIndex;
      } else if (
        fromIndex < toIndex &&
        segment.arrayIndex > fromIndex &&
        segment.arrayIndex <= toIndex
      ) {
        newIndex = segment.arrayIndex - 1;
      } else if (
        fromIndex > toIndex &&
        segment.arrayIndex < fromIndex &&
        segment.arrayIndex >= toIndex
      ) {
        newIndex = segment.arrayIndex + 1;
      }

      if (newIndex !== segment.arrayIndex) {
        segment.arrayIndex = newIndex;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.dirty = true;
    }
  }

  // ===== Utility Methods =====

  /**
   * Generate a UUID for comments
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  /**
   * Get all paths that have comments
   */
  getAllCommentPaths(): FieldPath[] {
    return this.commentsByPath.map((entry) => entry.path);
  }

  /**
   * Get total number of comments across all paths
   */
  getTotalCommentCount(): number {
    let count = 0;
    for (const entry of this.commentsByPath) {
      count += entry.comments.length;
    }
    return count;
  }

  /**
   * Clear all presentation data
   */
  clear(): void {
    this.presentation = {
      version: 1,
      fieldComments: [],
    };
    this.commentsByPath = [];
    this.dirty = false;
  }
}
