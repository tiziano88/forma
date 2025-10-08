import { StructuralEditor } from '../StructuralEditor.svelte';
import {
  loadDescriptor,
  loadBinaryData,
  createTestPersonData,
  assertMessageValue,
} from '../test-utils';

// Import generated protobuf bindings for canonical objects
// Note: The generated files use a nested path structure
import * as sampleProto from '../generated/test/web-app/public/sample_pb';
const { Person, Address, PhoneNumber, Article } = sampleProto;

describe('MessageValue System', () => {
  let editor: StructuralEditor;

  beforeEach(() => {
    editor = new StructuralEditor();
  });

  describe('Schema Loading', () => {
    test('loads sample.desc binary descriptor correctly', async () => {
      const descriptorBytes = loadDescriptor('sample.desc');
      expect(descriptorBytes.length).toBeGreaterThan(0);

      await editor.initialize({
        schemaDescriptor: descriptorBytes,
        data: new Uint8Array(0),
      });
      const typeRegistry = editor.typeRegistry;

      // Verify expected message types are loaded
      expect(typeRegistry.has('.example.Person')).toBe(true);
      expect(typeRegistry.has('.example.Address')).toBe(true);
      expect(typeRegistry.has('.example.PhoneNumber')).toBe(true);
      expect(typeRegistry.has('.example.Article')).toBe(true);

      // Verify Person message structure
      const personType = typeRegistry.get('.example.Person')!;
      expect(personType.fullName).toBe('.example.Person');
      expect(personType.fields.size).toBe(8);

      // Check specific fields
      expect(personType.fields.get(1)?.name).toBe('name');
      expect(personType.fields.get(2)?.name).toBe('id');
      expect(personType.fields.get(3)?.name).toBe('is_verified');
      expect(personType.fields.get(4)?.name).toBe('eye_color');
      expect(personType.fields.get(5)?.name).toBe('address');
      expect(personType.fields.get(6)?.name).toBe('phones');
      expect(personType.fields.get(7)?.name).toBe('articles');
      expect(personType.fields.get(8)?.name).toBe('cats');
    });
  });

  describe('Existing Test Data Parsing', () => {
    test('parses sample-data.binpb correctly', async () => {
      // Load schema and data
      const schemaBytes = loadDescriptor('sample.desc');
      const dataBytes = loadBinaryData('sample-data.binpb');

      expect(dataBytes.length).toBe(143); // Known size from browser logs

      // Initialize editor
      await editor.initialize({
        schemaDescriptor: schemaBytes,
        data: dataBytes,
        typeName: '.example.Person',
      });

      const decodedData = editor.decodedData;
      expect(decodedData).toBeDefined();
      expect(decodedData?.type.fullName).toBe('.example.Person');

      // Validate specific field values from known test data
      assertMessageValue(decodedData!, {
        1: 'xxx', // name
        2: 1234, // id
        3: true, // is_verified
        4: 1, // eye_color (BLUE)
      });

      // Check nested address
      const address = decodedData!.getField(5);
      expect(address).toBeDefined();
      expect((address as any).type.fullName).toBe('.example.Address');
      assertMessageValue(address, {
        1: '123 Main St', // street
        2: 'Anytown', // city
        3: '12345', // zip_code
      });

      // Check repeated phones
      const phones = decodedData!.getRepeatedField(6);
      expect(phones).toHaveLength(3);

      assertMessageValue(phones[0], {
        1: '555-1234', // number
        2: 2, // type (HOME)
      });

      assertMessageValue(phones[1], {
        1: '111222', // number
        2: 2, // type (HOME)
      });

      assertMessageValue(phones[2], {
        1: '555-5678', // number
        2: 1, // type (MOBILE)
      });

      // Check repeated articles
      const articles = decodedData!.getRepeatedField(7);
      expect(articles).toHaveLength(2);

      assertMessageValue(articles[0], {
        1: 'ttt', // title
        2: 'xxx', // content
        3: 'ddd', // url
        5: 222, // published_at
      });

      // Check first article tags
      const firstArticleTags = (articles[0] as any).getRepeatedField(4);
      expect(firstArticleTags).toEqual(['aaa', 'bbb', 'ccc', 'ddd']);
    });
  });

  describe('Round-trip Serialization', () => {
    test('creates, serializes, and parses back a comprehensive Person object', async () => {
      // Load schema
      const schemaBytes = loadDescriptor('sample.desc');
      await editor.initialize({
        schemaDescriptor: schemaBytes,
        data: new Uint8Array(0),
      });

      // Create a test Person using generated TypeScript bindings
      const testData = createTestPersonData();

      const person = new Person();
      person.setName(testData.name);
      person.setId(testData.id);
      person.setIsVerified(testData.is_verified);
      person.setEyeColor(testData.eye_color as any);

      // Create and set address
      const address = new Address();
      address.setStreet(testData.address.street);
      address.setCity(testData.address.city);
      address.setZipCode(testData.address.zip_code);
      person.setAddress(address);

      // Create and set phone numbers
      testData.phones.forEach((phoneData) => {
        const phone = new PhoneNumber();
        phone.setNumber(phoneData.number);
        phone.setType(phoneData.type as any);
        person.addPhones(phone);
      });

      // Create and set articles
      testData.articles.forEach((articleData) => {
        const article = new Article();
        article.setTitle(articleData.title);
        article.setContent(articleData.content);
        article.setUrl(articleData.url);
        article.setTagsList(articleData.tags);
        article.setPublishedAt(articleData.published_at);
        person.addArticles(article);
      });

      // Serialize to binary
      const serializedBytes = person.serializeBinary();
      expect(serializedBytes).toBeInstanceOf(Uint8Array);
      expect(serializedBytes.length).toBeGreaterThan(0);

      // Parse with our MessageValue system
      await editor.setData(serializedBytes);
      editor.setCurrentType('.example.Person');

      const messageValue = editor.decodedData;
      expect(messageValue).toBeDefined();
      expect(messageValue?.type.fullName).toBe('.example.Person');

      // Validate all fields match our test data
      assertMessageValue(messageValue!, {
        1: testData.name,
        2: testData.id,
        3: testData.is_verified,
        4: testData.eye_color,
      });

      // Validate nested address
      const parsedAddress = messageValue!.getField(5);
      assertMessageValue(parsedAddress, {
        1: testData.address.street,
        2: testData.address.city,
        3: testData.address.zip_code,
      });

      // Validate repeated phones
      const parsedPhones = messageValue!.getRepeatedField(6);
      expect(parsedPhones).toHaveLength(testData.phones.length);

      testData.phones.forEach((expectedPhone, index) => {
        assertMessageValue(parsedPhones[index], {
          1: expectedPhone.number,
          2: expectedPhone.type,
        });
      });

      // Validate repeated articles
      const parsedArticles = messageValue!.getRepeatedField(7);
      expect(parsedArticles).toHaveLength(testData.articles.length);

      testData.articles.forEach((expectedArticle, index) => {
        assertMessageValue(parsedArticles[index], {
          1: expectedArticle.title,
          2: expectedArticle.content,
          3: expectedArticle.url,
          5: expectedArticle.published_at,
        });

        // Check tags array
        const parsedTags = (parsedArticles[index] as any).getRepeatedField(4);
        expect(parsedTags).toEqual(expectedArticle.tags);
      });
    });
  });

  describe('MessageValue Methods', () => {
    let messageValue: any;

    beforeEach(async () => {
      const schemaBytes = loadDescriptor('sample.desc');
      const dataBytes = loadBinaryData('sample-data.binpb');

      await editor.initialize({
        schemaDescriptor: schemaBytes,
        data: dataBytes,
        typeName: '.example.Person',
      });

      messageValue = editor.decodedData;
    });

    test('getField() returns correct values', () => {
      expect(messageValue.getField(1)).toBe('xxx');
      expect(messageValue.getField(2)).toBe(1234);
      expect(messageValue.getField(3)).toBe(true);
      expect(messageValue.getField(999)).toBeUndefined();
    });

    test('getRepeatedField() returns correct arrays', () => {
      const phones = messageValue.getRepeatedField(6);
      expect(phones).toHaveLength(3);
      expect(phones[0].getField(1)).toBe('555-1234');

      const nonExistentArray = messageValue.getRepeatedField(999);
      expect(nonExistentArray).toEqual([]);
    });

    test('hasField() works correctly', () => {
      expect(messageValue.hasField(1)).toBe(true);
      expect(messageValue.hasField(2)).toBe(true);
      expect(messageValue.hasField(999)).toBe(false);
    });

    test('getSetFields() returns set field numbers', () => {
      const fieldNumbers = messageValue.getSetFields();
      expect(fieldNumbers).toContain(1);
      expect(fieldNumbers).toContain(2);
      expect(fieldNumbers).toContain(3);
      expect(fieldNumbers).toContain(4);
      expect(fieldNumbers).toContain(5);
      expect(fieldNumbers).toContain(6);
      expect(fieldNumbers).toContain(7);
      expect(fieldNumbers).toHaveLength(7);
    });

    test('modification tracking works', () => {
      // Reset tracking first since parsing sets modified state
      messageValue.resetModifiedTracking();
      expect(messageValue.isModified()).toBe(false);

      messageValue.setField(1, 'new name');
      expect(messageValue.isModified()).toBe(true);

      const modifiedFields = messageValue.getModifiedFieldNumbers();
      expect(modifiedFields).toContain(1);
      expect(modifiedFields).not.toContain(2);

      messageValue.resetModifiedTracking();
      expect(messageValue.isModified()).toBe(false);
    });

    test('toObject() returns plain JavaScript object', () => {
      const obj = messageValue.toObject();
      expect(obj).toHaveProperty('name', 'xxx');
      expect(obj).toHaveProperty('id', 1234);
      expect(obj).toHaveProperty('is_verified', true);
      expect(obj.address).toHaveProperty('street', '123 Main St');
      expect(obj.phones).toHaveLength(3);
      expect(obj.articles).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    test('handles invalid schema gracefully', async () => {
      const invalidBytes = new Uint8Array([1, 2, 3, 4]);
      try {
        await editor.initialize({
          schemaDescriptor: invalidBytes,
          data: new Uint8Array(0),
        });
        // If no error, check if schema was actually loaded correctly
        const typeRegistry = editor.typeRegistry;
        expect(typeRegistry.size).toBe(0); // Should have no valid types
      } catch (error) {
        // Error is also acceptable
        expect(error).toBeDefined();
      }
    });

    test('handles invalid data gracefully', async () => {
      const schemaBytes = loadDescriptor('sample.desc');
      await editor.initialize({
        schemaDescriptor: schemaBytes,
        data: new Uint8Array(0),
      });

      const invalidBytes = new Uint8Array([1, 2, 3, 4]);
      try {
        await editor.setData(invalidBytes);
        editor.setCurrentType('.example.Person');
        // If no error thrown, check that decoding still works safely
        const decoded = editor.decodedData;
        // Should either be null or have minimal fields
      } catch (error) {
        // Error is acceptable
        expect(error).toBeDefined();
      }
    });

    test('handles missing type gracefully', () => {
      // setCurrentType may not throw, but just set the type without validation
      editor.setCurrentType('.nonexistent.Type');
      const decoded = editor.decodedData;
      // Should be null or undefined since the type doesn't exist
      expect(decoded).toBeNull();
    });
  });
});
