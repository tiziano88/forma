import {
  ParsedFileDescriptorSet,
  ParsedDescriptorProto,
  ParsedFieldDescriptorProto,
} from './descriptor-parser';

/**
 * Extracts all message descriptors from a FileDescriptorSet.
 * This function recursively finds nested messages.
 *
 * @param fileDescriptorSet The descriptor set, typically from a .desc file.
 * @returns A flat array of all message descriptors (IDescriptorProto).
 */
export function getMessages(
  fileDescriptorSet: ParsedFileDescriptorSet
): ParsedDescriptorProto[] {
  const messages: ParsedDescriptorProto[] = [];

  function findMessagesIn(items: ParsedDescriptorProto[]) {
    for (const message of items) {
      messages.push(message);
      findMessagesIn(message.nestedTypes);
    }
  }

  for (const file of fileDescriptorSet.files) {
    findMessagesIn(file.messageTypes);
  }

  return messages;
}

/**
 * Extracts all field descriptors from a message descriptor.
 *
 * @param message The message descriptor.
 * @returns An array of field descriptors (IFieldDescriptorProto).
 */
export function getFields(message: ParsedDescriptorProto): ParsedFieldDescriptorProto[] {
  return message.fields || [];
}
