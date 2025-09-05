import protobuf from 'protobufjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Recreate __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateSampleData() {
  try {
    const root = await protobuf.load('sample.proto');
    const Person = root.lookupType('example.Person');

    const payload = {
      name: 'John Doe',
      id: 1234,
      isVerified: true,
      eyeColor: 3, // Use the numeric value for BROWN
      address: {
        street: '123 Main St',
        city: 'Anytown',
        zipCode: '12345',
      },
      phones: [
        { number: '555-1234', type: 2 }, // HOME
        { number: '555-5678', type: 1 }, // MOBILE
      ],
    };

    const errMsg = Person.verify(payload);
    if (errMsg) {
      throw new Error(errMsg);
    }

    const message = Person.create(payload);
    const buffer = Person.encode(message).finish();

    const filePath = path.join(__dirname, 'sample.bin');
    fs.writeFileSync(filePath, buffer);

    console.log(`Successfully created sample.bin at ${filePath}`);

  } catch (err) {
    console.error("Error generating sample data:", err);
  }
}

generateSampleData();