export interface StoredObject {
  readonly objectKey: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export interface StorageProvider {
  createUploadUrl(objectKey: string, contentType: string): Promise<string>;
  createDownloadUrl(objectKey: string): Promise<string>;
}

/** Storage adapters are intentionally isolated from feature modules. */
export function createStorageProvider(): StorageProvider {
  return {
    async createUploadUrl(): Promise<string> {
      throw new Error("Storage provider is not configured yet.");
    },
    async createDownloadUrl(): Promise<string> {
      throw new Error("Storage provider is not configured yet.");
    },
  };
}
