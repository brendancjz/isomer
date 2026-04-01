import type { NextApiRequest, NextApiResponse } from "next"
import { isDevMockS3UploadsEnabled } from "~/server/modules/asset/asset.service"

/**
 * Discards the request body (binary file). Used when ISOMER_DEV_MOCK_S3_UPLOADS=true
 * so the Studio client can complete the presigned-PUT flow without AWS credentials.
 */
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!isDevMockS3UploadsEnabled()) {
    return res.status(404).end()
  }

  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT")
    return res.status(405).json({ error: "Method not allowed" })
  }

  await new Promise<void>((resolve, reject) => {
    req.resume()
    req.on("end", () => resolve())
    req.on("error", reject)
  })

  return res.status(200).end()
}
