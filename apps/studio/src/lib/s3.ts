import type {
  CopyObjectCommandInput,
  PutObjectCommandInput,
  PutObjectTaggingCommandInput,
} from "@aws-sdk/client-s3"
import {
  CopyObjectCommand,
  GetObjectTaggingCommand,
  PutObjectCommand,
  PutObjectTaggingCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { env } from "~/env.mjs"

const { NEXT_PUBLIC_S3_REGION } = env

const storage = new S3Client({
  region: NEXT_PUBLIC_S3_REGION,
})

export const generateSignedPutUrl = async ({
  Bucket,
  Key,
  ContentType,
  ContentDisposition,
}: Pick<
  PutObjectCommandInput,
  "Bucket" | "Key" | "ContentType" | "ContentDisposition"
>): Promise<string> => {
  return getSignedUrl(
    storage,
    new PutObjectCommand({
      Bucket,
      Key,
      ContentType,
      ContentDisposition,
    }),
    {
      expiresIn: 60 * 5, // 5 minutes
      // Sign these headers so S3 rejects PUTs with different values (prevents type-confusion XSS)
      signableHeaders: new Set(["content-type", "content-disposition"]),
    },
  )
}

/**
 * Server-side copy within the same bucket (e.g. duplicating page assets).
 * CopySource must be URL-encoded per S3 API; path segments are encoded separately.
 */
export const copyObjectInBucket = async ({
  Bucket,
  sourceKey,
  destinationKey,
}: Pick<CopyObjectCommandInput, "Bucket"> & {
  sourceKey: string
  destinationKey: string
}) => {
  const copySource = `${Bucket}/${sourceKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`

  return storage.send(
    new CopyObjectCommand({
      Bucket,
      Key: destinationKey,
      CopySource: copySource,
    }),
  )
}

export const deleteFile = async ({
  Key,
  Bucket,
}: Pick<PutObjectTaggingCommandInput, "Key" | "Bucket">) => {
  const objectTag = await storage.send(
    new GetObjectTaggingCommand({
      Bucket,
      Key,
    }),
  )

  const originalTagSet = objectTag.TagSet ?? []

  return storage.send(
    new PutObjectTaggingCommand({
      Bucket,
      Key,
      // NOTE: We perform a soft delete here so the file can be kept available
      // until the page is published
      Tagging: {
        TagSet: [
          ...originalTagSet.filter(({ Key }) => Key !== "ISOMER_STATUS"),
          {
            Key: "ISOMER_STATUS",
            Value: "DELETED",
          },
        ],
      },
    }),
  )
}
