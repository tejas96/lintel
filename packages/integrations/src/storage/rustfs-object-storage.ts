import type { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ObjectStorage } from '@lintel/application';
import { safeDownloadName } from './object-key';

export interface RustFsConfiguration {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKey: string;
  readonly secretKey: string;
}

/**
 * RustFS through the S3 API. RustFS needs path-style addressing unless
 * RUSTFS_SERVER_DOMAINS is configured (verified against rustfs/rustfs:1.0.0).
 */
export class RustFsObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: RustFsConfiguration) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string) {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    if (!result.Body) throw new Error('The stored object has no body.');
    return {
      body: result.Body as Readable,
      metadata: {
        contentType: result.ContentType ?? 'application/octet-stream',
        sizeBytes: result.ContentLength ?? 0,
      },
    };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  signedDownloadUrl(key: string, expiresInSeconds: number, fileName: string) {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safeDownloadName(fileName)}"`,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
