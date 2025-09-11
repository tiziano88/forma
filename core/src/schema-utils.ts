import {
  IFileDescriptorSet,
  IDescriptorProto,
  IFieldDescriptorProto,
} from './proto-types';

/**
 * Extracts all message descriptors from a FileDescriptorSet.
 * This function recursively finds nested messages.
 *
 * @param fileDescriptorSet The descriptor set, typically from a .desc file.
 * @returns A flat array of all message descriptors (IDescriptorProto).
 */
export function getMessages(
  fileDescriptorSet: IFileDescriptorSet
): IDescriptorProto[] {
  const messages: IDescriptorProto[] = [];

  function findMessagesIn(items: IDescriptorProto[] | undefined | null) {
    if (!items) return;
    for (const message of items) {
      messages.push(message);
      findMessagesIn(message.nestedType);
    }
  }

  for (const file of fileDescriptorSet.file) {
    findMessagesIn(file.messageType);
  }

  return messages;
}

/**
 * Extracts all field descriptors from a message descriptor.
 *
 * @param message The message descriptor.
 * @returns An array of field descriptors (IFieldDescriptorProto).
 */
export function getFields(message: IDescriptorProto): IFieldDescriptorProto[] {
  return (message.field as IFieldDescriptorProto[]) || [];
}
