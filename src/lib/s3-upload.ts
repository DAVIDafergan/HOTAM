import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const AWS_REGION = process.env.AWS_REGION;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;

const missingEnvVars = [
  ['AWS_REGION', AWS_REGION],
  ['AWS_ACCESS_KEY_ID', AWS_ACCESS_KEY_ID],
  ['AWS_SECRET_ACCESS_KEY', AWS_SECRET_ACCESS_KEY],
  ['AWS_S3_BUCKET', AWS_S3_BUCKET],
].filter(([, value]) => !value).map(([name]) => name);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required AWS S3 environment variables: ${missingEnvVars.join(', ')}`);
}

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

export async function uploadImageToS3(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const key = `products/${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );

  return `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}
