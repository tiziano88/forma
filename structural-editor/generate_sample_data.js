const protobuf = require('protobufjs');
const fs = require('fs');
const path = require('path');

async function generateSampleData() {
  try {
    const root = await protobuf.load('sample.proto');
    const Person = root.lookupType('example.Person');

    const payload = {
      name: 'John Doe',
      id: 1234,
      isVerified: true,
      eyeColor: 'BROWN',
      address: {
        street: '123 Main St',
        city: 'Anytown',
        zipCode: '12345',
      },
      phones: [
        { number: '555-1234', type: 'HOME' },
        { number: '555-5678', type: 'MOBILE' },
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
