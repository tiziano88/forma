// Use dynamic import to load the CommonJS protobuf module
let descriptor_pb: any = null;

async function loadDescriptorPb() {
  if (!descriptor_pb) {
    descriptor_pb = await import('./generated/config/descriptor_pb.js');
  }
  return descriptor_pb;
}

type FileDescriptorSet = any; // descriptor_pb.FileDescriptorSet from google.protobuf namespace
type DescriptorProto = any;   // descriptor_pb.DescriptorProto from google.protobuf namespace
type FieldDescriptorProto = any; // descriptor_pb.FieldDescriptorProto from google.protobuf namespace

/**
 * Extracts all message descriptors from a FileDescriptorSet.
 * This function recursively finds nested messages.
 *
 * @param fileDescriptorSet The descriptor set, typically from a .desc file.
 * @returns A flat array of all message descriptors (DescriptorProto).
 */
export async function getMessages(
  fileDescriptorSet: FileDescriptorSet
): Promise<DescriptorProto[]> {
  await loadDescriptorPb(); // Ensure the module is loaded
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
export async function getFields(message: DescriptorProto): Promise<FieldDescriptorProto[]> {
  await loadDescriptorPb(); // Ensure the module is loaded
  return message.getFieldList();
}
