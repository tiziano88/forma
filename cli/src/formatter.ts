import pc from 'picocolors';
import type {
  MessageValue,
  FieldDef,
  MessageType,
  StructuralEditor,
  Comment,
} from '@lintx/core';
import { FieldType, FieldLabel } from '@lintx/core';

export interface FormatterOptions {
  colors: boolean;
  showFieldNumbers: boolean;
  showComments: boolean;
  compact: boolean;
  showUnsetFields: boolean;
  showTypes: boolean;
  maxDepth?: number;
}

const DEFAULT_OPTIONS: FormatterOptions = {
  colors: true,
  showFieldNumbers: true,
  showComments: true,
  compact: false,
  showUnsetFields: false,
  showTypes: false,
};

/**
 * Pretty-print a protobuf message value to the terminal
 */
export class ProtoFormatter {
  private options: FormatterOptions;
  private editor: StructuralEditor;

  constructor(editor: StructuralEditor, options: Partial<FormatterOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.editor = editor;
  }

  /**
   * Format a message value as a tree
   */
  format(value: MessageValue | null, rootTypeName?: string): string {
    if (!value) {
      return this.dim('(null)');
    }

    const lines: string[] = [];

    // Show root type name
    if (rootTypeName) {
      lines.push(this.blue(rootTypeName));
    }

    // Format all fields
    this.formatMessage(value, lines, '', true, []);

    return lines.join('\n');
  }

  private formatMessage(
    msg: MessageValue,
    lines: string[],
    prefix: string,
    isLast: boolean,
    path: { fieldNumber: number; arrayIndex: number }[]
  ): void {
    const fields = Array.from(msg.type.fields.values());

    fields.forEach((field, index) => {
      const isLastField = index === fields.length - 1;
      this.formatField(msg, field, lines, prefix, isLastField, path);
    });
  }

  private formatField(
    parent: MessageValue,
    field: FieldDef,
    lines: string[],
    prefix: string,
    isLast: boolean,
    parentPath: { fieldNumber: number; arrayIndex: number }[]
  ): void {
    const fieldData = parent.fields.get(field.number);
    const isRepeated = field.label === FieldLabel.LABEL_REPEATED;
    const isEmpty = !fieldData || fieldData.length === 0;

    // Skip unset fields unless showUnsetFields is true
    if (isEmpty && !this.options.showUnsetFields) {
      return;
    }

    // Tree characters
    const branch = isLast ? '└─ ' : '├─ ';
    const continuation = isLast ? '   ' : '│  ';

    // Field name and number
    let fieldHeader = this.cyan(field.name);
    if (this.options.showFieldNumbers) {
      fieldHeader += this.dim(` (${field.number})`);
    }

    // Get comments for this field
    const currentPath = {
      segments: [...parentPath, { fieldNumber: field.number, arrayIndex: 0 }],
    };
    const comments = this.options.showComments
      ? this.editor.getComments(currentPath)
      : [];

    if (isEmpty) {
      // Unset field - show as empty
      const emptyValue = isRepeated ? '[]' : this.dim('(unset)');
      lines.push(`${prefix}${branch}${fieldHeader}: ${emptyValue}`);
      return;
    }

    if (isRepeated) {
      // Repeated field - show count and items
      const count = fieldData!.length;
      const countStr = this.dim(`[${count} item${count === 1 ? '' : 's'}]`);

      // Optionally show type name
      let typeInfo = '';
      if (this.options.showTypes && field.typeName && field.typeName.startsWith('.')) {
        typeInfo = ` ${this.blue(field.typeName)}`;
      }

      lines.push(`${prefix}${branch}${fieldHeader}:${typeInfo} ${countStr}`);

      // Show each item
      fieldData!.forEach((item: any, idx: number) => {
        const isLastItem = idx === fieldData!.length - 1;
        const itemBranch = isLastItem ? '└─ ' : '├─ ';
        const itemContinuation = isLastItem ? '   ' : '│  ';
        const itemPrefix = `${prefix}${continuation}`;

        const itemPath = [
          ...parentPath,
          { fieldNumber: field.number, arrayIndex: idx },
        ];
        const itemComments = this.options.showComments
          ? this.editor.getComments({ segments: itemPath })
          : [];

        // Show array index
        const indexStr = this.dim(`[${idx}]`);
        const formatted = this.formatValue(item, field, itemPath);

        // For message types in arrays, optionally show type name
        let itemOutput = `${itemPrefix}${itemBranch}${indexStr}:`;
        if (this.options.showTypes && this.isMessageValue(item)) {
          itemOutput += ` ${this.blue(field.typeName || '(message)')}`;
        }
        itemOutput += formatted ? ` ${formatted}` : '';

        lines.push(itemOutput);

        // Show nested message if applicable
        if (this.isMessageValue(item)) {
          this.formatMessage(
            item,
            lines,
            `${itemPrefix}${itemContinuation}`,
            isLastItem,
            itemPath
          );
        }

        // Show comments
        if (itemComments.length > 0) {
          this.formatComments(itemComments, lines, `${itemPrefix}${itemContinuation}`);
        }
      });
    } else {
      // Singular field
      const value = fieldData![0];
      const formatted = this.formatValue(value, field, parentPath);

      // For message types, optionally show type name before the value
      let output = `${prefix}${branch}${fieldHeader}:`;
      if (this.options.showTypes && this.isMessageValue(value)) {
        output += ` ${this.blue(field.typeName || '(message)')}`;
      }
      output += ` ${formatted}`;

      lines.push(output);

      // Show nested message if applicable
      if (this.isMessageValue(value)) {
        const valuePath = [...parentPath, { fieldNumber: field.number, arrayIndex: 0 }];
        this.formatMessage(value, lines, `${prefix}${continuation}`, isLast, valuePath);
      }

      // Show comments
      if (comments.length > 0) {
        this.formatComments(comments, lines, `${prefix}${continuation}`);
      }
    }
  }

  private formatValue(
    value: any,
    field: FieldDef,
    path: { fieldNumber: number; arrayIndex: number }[]
  ): string {
    if (value === null || value === undefined) {
      return this.dim('(null)');
    }

    switch (field.type) {
      case FieldType.TYPE_STRING:
        return this.formatString(value as string);

      case FieldType.TYPE_BOOL:
        return this.magenta(String(value));

      case FieldType.TYPE_INT32:
      case FieldType.TYPE_UINT32:
      case FieldType.TYPE_INT64:
      case FieldType.TYPE_UINT64:
      case FieldType.TYPE_DOUBLE:
      case FieldType.TYPE_FLOAT:
        return this.yellow(String(value));

      case FieldType.TYPE_BYTES:
        return this.formatBytes(value as Uint8Array);

      case FieldType.TYPE_ENUM:
        return this.formatEnum(value as number, field);

      case FieldType.TYPE_MESSAGE:
        // Don't show type name in value - it's shown separately if showTypes is true
        return '';

      default:
        return String(value);
    }
  }

  private formatString(str: string): string {
    // Escape special characters but keep it readable
    const escaped = str
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '\\r');

    // Truncate very long strings
    const maxLen = this.options.compact ? 50 : 200;
    const truncated = escaped.length > maxLen
      ? escaped.substring(0, maxLen) + '...'
      : escaped;

    return this.green(`"${truncated}"`);
  }

  private formatBytes(bytes: Uint8Array): string {
    const len = bytes.length;
    if (len === 0) {
      return this.dim('(empty bytes)');
    }

    // Show first few bytes as hex
    const preview = Array.from(bytes.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');

    const suffix = len > 8 ? '...' : '';
    return this.dim(`<${len} bytes: ${preview}${suffix}>`);
  }

  private formatEnum(value: number, field: FieldDef): string {
    if (!field.typeName) {
      return this.yellow(String(value));
    }

    const enumRegistry = this.editor.enumRegistry;
    const enumType = enumRegistry.get(field.typeName);
    if (!enumType) {
      return this.yellow(String(value));
    }

    const name = enumType.values.get(value);
    if (name) {
      return `${this.cyan(name)}${this.dim(` (${value})`)}`;
    }

    return this.yellow(String(value));
  }

  private formatComments(comments: Comment[], lines: string[], prefix: string): void {
    comments.forEach((comment) => {
      const commentText = this.dim(`💬 ${comment.text}`);
      if (comment.author) {
        lines.push(`${prefix}${commentText} ${this.dim(`— ${comment.author}`)}`);
      } else {
        lines.push(`${prefix}${commentText}`);
      }
    });
  }

  private isMessageValue(value: any): value is MessageValue {
    return (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      'fields' in value
    );
  }

  // Color helpers (no-op if colors disabled)
  private cyan(text: string): string {
    return this.options.colors ? pc.cyan(text) : text;
  }

  private green(text: string): string {
    return this.options.colors ? pc.green(text) : text;
  }

  private yellow(text: string): string {
    return this.options.colors ? pc.yellow(text) : text;
  }

  private blue(text: string): string {
    return this.options.colors ? pc.blue(text) : text;
  }

  private magenta(text: string): string {
    return this.options.colors ? pc.magenta(text) : text;
  }

  private dim(text: string): string {
    return this.options.colors ? pc.dim(text) : text;
  }
}
