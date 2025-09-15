import * as descriptor_pb from './generated/config/descriptor_pb.js';
import type {
  FileDescriptorSet,
  DescriptorProto,
  FieldDescriptorProto,
} from './generated/config/descriptor_pb.js';

/**
 * Extracts all message descriptors from a FileDescriptorSet.
 * This function recursively finds nested messages.
 *
 * @param fileDescriptorSet The descriptor set, typically from a .desc file.
 * @returns A flat array of all message descriptors (DescriptorProto).
 */
export function getMessages(
  fileDescriptorSet: FileDescriptorSet
): DescriptorProto[] {
  const messages: DescriptorProto[] = [];

  function findMessagesIn(items: DescriptorProto[]) {
    for (const message of items) {
      messages.push(message);
      findMessagesIn(message.getNestedTypeList());
    }
  }

  for (const file of fileDescriptorSet.getFileList()) {
    findMessagesIn(file.getMessageTypeList());
  }

  return messages;
}

/**
 * Extracts all field descriptors from a message descriptor.
 *
 * @param message The message descriptor.
 * @returns An array of field descriptors (FieldDescriptorProto).
 */
export function getFields(message: DescriptorProto): FieldDescriptorProto[] {
  return message.getFieldList();
}
