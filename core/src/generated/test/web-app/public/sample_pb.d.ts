// package: example
// file: web-app/public/sample.proto

import * as jspb from 'google-protobuf'

export class Address extends jspb.Message {
  getStreet(): string
  setStreet(value: string): void

  getCity(): string
  setCity(value: string): void

  getZipCode(): string
  setZipCode(value: string): void

  serializeBinary(): Uint8Array
  toObject(includeInstance?: boolean): Address.AsObject
  static toObject(includeInstance: boolean, msg: Address): Address.AsObject
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> }
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>
  }
  static serializeBinaryToWriter(
    message: Address,
    writer: jspb.BinaryWriter
  ): void
  static deserializeBinary(bytes: Uint8Array): Address
  static deserializeBinaryFromReader(
    message: Address,
    reader: jspb.BinaryReader
  ): Address
}

export namespace Address {
  export type AsObject = {
    street: string
    city: string
    zipCode: string
  }
}

export class PhoneNumber extends jspb.Message {
  getNumber(): string
  setNumber(value: string): void

  getType(): PhoneNumber.PhoneTypeMap[keyof PhoneNumber.PhoneTypeMap]
  setType(value: PhoneNumber.PhoneTypeMap[keyof PhoneNumber.PhoneTypeMap]): void

  serializeBinary(): Uint8Array
  toObject(includeInstance?: boolean): PhoneNumber.AsObject
  static toObject(
    includeInstance: boolean,
    msg: PhoneNumber
  ): PhoneNumber.AsObject
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> }
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>
  }
  static serializeBinaryToWriter(
    message: PhoneNumber,
    writer: jspb.BinaryWriter
  ): void
  static deserializeBinary(bytes: Uint8Array): PhoneNumber
  static deserializeBinaryFromReader(
    message: PhoneNumber,
    reader: jspb.BinaryReader
  ): PhoneNumber
}

export namespace PhoneNumber {
  export type AsObject = {
    number: string
    type: PhoneNumber.PhoneTypeMap[keyof PhoneNumber.PhoneTypeMap]
  }

  export interface PhoneTypeMap {
    PHONE_TYPE_UNSPECIFIED: 0
    MOBILE: 1
    HOME: 2
    WORK: 3
  }

  export const PhoneType: PhoneTypeMap
}

export class Article extends jspb.Message {
  getTitle(): string
  setTitle(value: string): void

  getContent(): string
  setContent(value: string): void

  getUrl(): string
  setUrl(value: string): void

  clearTagsList(): void
  getTagsList(): Array<string>
  setTagsList(value: Array<string>): void
  addTags(value: string, index?: number): string

  getPublishedAt(): number
  setPublishedAt(value: number): void

  serializeBinary(): Uint8Array
  toObject(includeInstance?: boolean): Article.AsObject
  static toObject(includeInstance: boolean, msg: Article): Article.AsObject
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> }
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>
  }
  static serializeBinaryToWriter(
    message: Article,
    writer: jspb.BinaryWriter
  ): void
  static deserializeBinary(bytes: Uint8Array): Article
  static deserializeBinaryFromReader(
    message: Article,
    reader: jspb.BinaryReader
  ): Article
}

export namespace Article {
  export type AsObject = {
    title: string
    content: string
    url: string
    tagsList: Array<string>
    publishedAt: number
  }
}

export class CatDetails extends jspb.Message {
  getAgeYears(): number
  setAgeYears(value: number): void

  serializeBinary(): Uint8Array
  toObject(includeInstance?: boolean): CatDetails.AsObject
  static toObject(
    includeInstance: boolean,
    msg: CatDetails
  ): CatDetails.AsObject
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> }
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>
  }
  static serializeBinaryToWriter(
    message: CatDetails,
    writer: jspb.BinaryWriter
  ): void
  static deserializeBinary(bytes: Uint8Array): CatDetails
  static deserializeBinaryFromReader(
    message: CatDetails,
    reader: jspb.BinaryReader
  ): CatDetails
}

export namespace CatDetails {
  export type AsObject = {
    ageYears: number
  }
}

export class Person extends jspb.Message {
  getName(): string
  setName(value: string): void

  getId(): number
  setId(value: number): void

  getIsVerified(): boolean
  setIsVerified(value: boolean): void

  getEyeColor(): EyeColorMap[keyof EyeColorMap]
  setEyeColor(value: EyeColorMap[keyof EyeColorMap]): void

  hasAddress(): boolean
  clearAddress(): void
  getAddress(): Address | undefined
  setAddress(value?: Address): void

  clearPhonesList(): void
  getPhonesList(): Array<PhoneNumber>
  setPhonesList(value: Array<PhoneNumber>): void
  addPhones(value?: PhoneNumber, index?: number): PhoneNumber

  clearArticlesList(): void
  getArticlesList(): Array<Article>
  setArticlesList(value: Array<Article>): void
  addArticles(value?: Article, index?: number): Article

  getCatsMap(): jspb.Map<string, CatDetails>
  clearCatsMap(): void
  serializeBinary(): Uint8Array
  toObject(includeInstance?: boolean): Person.AsObject
  static toObject(includeInstance: boolean, msg: Person): Person.AsObject
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> }
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>
  }
  static serializeBinaryToWriter(
    message: Person,
    writer: jspb.BinaryWriter
  ): void
  static deserializeBinary(bytes: Uint8Array): Person
  static deserializeBinaryFromReader(
    message: Person,
    reader: jspb.BinaryReader
  ): Person
}

export namespace Person {
  export type AsObject = {
    name: string
    id: number
    isVerified: boolean
    eyeColor: EyeColorMap[keyof EyeColorMap]
    address?: Address.AsObject
    phonesList: Array<PhoneNumber.AsObject>
    articlesList: Array<Article.AsObject>
    catsMap: Array<[string, CatDetails.AsObject]>
  }
}

export interface EyeColorMap {
  EYE_COLOR_UNSPECIFIED: 0
  BLUE: 1
  GREEN: 2
  BROWN: 3
}

export const EyeColor: EyeColorMap
