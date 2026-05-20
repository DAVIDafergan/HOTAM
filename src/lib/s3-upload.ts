import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const S3_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const S3_UPLOAD_ERROR_CODE = 'S3_UPLOAD_ERROR';
const S3_CONFIG_ERROR_CODE = 'S3_CONFIG_ERROR';
const PUBLIC_IMAGE_BASE_URL = 'https://d2wz99qr883116.cloudfront.net';

type S3EnvConfig = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

let s3Client: S3Client | null = null;

function createS3ConfigError(message: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = S3_CONFIG_ERROR_CODE;
  return error;
}

function createS3UploadError(message: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = S3_UPLOAD_ERROR_CODE;
  return error;
}

function getS3EnvConfig(): S3EnvConfig {
  const region = process.env.AWS_REGION?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.AWS_S3_BUCKET?.trim();

  const missingEnvVars = [
    ['AWS_REGION', region],
    ['AWS_ACCESS_KEY_ID', accessKeyId],
    ['AWS_SECRET_ACCESS_KEY', secretAccessKey],
    ['AWS_S3_BUCKET', bucket],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingEnvVars.length > 0) {
    throw createS3ConfigError(`Missing required S3 environment variables: ${missingEnvVars.join(', ')}`);
  }

  return {
    region: region!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
  };
}

function getS3Client(config: S3EnvConfig): S3Client {
  if (s3Client) return s3Client;
  s3Client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return s3Client;
}

function sanitizeFilename(fileName: string): string {
  const normalized = fileName.normalize('NFKC').trim();
  const withoutPath = normalized.split(/[/\\]/).pop() || 'file';
  const safe = withoutPath.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^[_\.]+/, '');
  return safe || 'file';
}

export function buildPublicImageUrl(key: string): string {
  const normalizedKey = key.replace(/^\/+/, '');
  return `${PUBLIC_IMAGE_BASE_URL}/${normalizedKey}`;
}

export async function uploadImageToS3(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  keyPrefix: string = 'products'
): Promise<string> {
  const config = getS3EnvConfig();
  const sanitizedPrefix = keyPrefix.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '') || 'products';
  const sanitizedFileName = sanitizeFilename(fileName);
  const randomSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  const s3Key = `${sanitizedPrefix}/${randomSuffix}_${sanitizedFileName}`;

  try {
    await getS3Client(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: contentType,
        CacheControl: S3_CACHE_CONTROL,
      })
    );
  } catch {
    throw createS3UploadError('Failed to upload image to S3.');
  }

  return buildPublicImageUrl(s3Key);
}
