import type { UnwrapTagged } from "type-fest"
import type { DB } from "~prisma/generated/generatedTypes"
import { TRPCError } from "@trpc/server"
import { randomUUID } from "crypto"
import get from "lodash/get"
import set from "lodash/set"
import { MAX_PAGE_URL_LENGTH } from "~/schemas/page"

import type { Transaction } from "../database/types"

const ASSET_FILE_KEY_PATTERN = /^(\d+)\/[0-9a-fA-F-]{36}\/.+/

export function getAssetFileKeyFromPublicPath(path: string): string | null {
  if (!path.startsWith("/")) {
    return null
  }
  const key = path.slice(1)
  if (!ASSET_FILE_KEY_PATTERN.test(key)) {
    return null
  }
  return key
}

export function collectAssetFileKeysFromJson(node: unknown): Set<string> {
  const keys = new Set<string>()
  const visit = (v: unknown) => {
    if (typeof v === "string") {
      const k = getAssetFileKeyFromPublicPath(v)
      if (k) {
        keys.add(k)
      }
      return
    }
    if (Array.isArray(v)) {
      v.forEach(visit)
      return
    }
    if (v !== null && typeof v === "object") {
      Object.values(v).forEach(visit)
    }
  }
  visit(node)
  return keys
}

export function buildAssetKeyReplacementMap(
  keys: Iterable<string>,
  siteId: number,
  newId: () => string = randomUUID,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const oldKey of keys) {
    const parts = oldKey.split("/")
    if (parts.length < 3) {
      continue
    }
    const fileName = parts.slice(2).join("/")
    map.set(oldKey, `${siteId}/${newId()}/${fileName}`)
  }
  return map
}

function mapJsonStrings(node: unknown, fn: (s: string) => string): unknown {
  if (typeof node === "string") {
    return fn(node)
  }
  if (Array.isArray(node)) {
    return node.map((x) => mapJsonStrings(x, fn))
  }
  if (node !== null && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) => [k, mapJsonStrings(v, fn)]),
    )
  }
  return node
}

export function rewriteAssetPathsInJson(
  node: unknown,
  map: Map<string, string>,
): unknown {
  return mapJsonStrings(node, (s) => {
    const k = getAssetFileKeyFromPublicPath(s)
    if (k) {
      const newKey = map.get(k)
      if (newKey !== undefined) {
        return `/${newKey}`
      }
    }
    return s
  })
}

export function slugifyForDuplicatePermalink(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "-")
}

export function applyDuplicateTitleToBlobContent(
  content: UnwrapTagged<PrismaJson.BlobJsonContent>,
  newTitle: string,
): void {
  if (get(content, "page.title") !== undefined) {
    set(content, "page.title", newTitle)
  }
}

export async function pickUniqueDuplicatePermalink(
  tx: Transaction<DB>,
  args: { siteId: number; parentId: string | null; sourceTitle: string },
): Promise<string> {
  const rawBase = slugifyForDuplicatePermalink(`copy-of-${args.sourceTitle}`)
  const base = (rawBase.length > 0 ? rawBase : "copy").slice(
    0,
    MAX_PAGE_URL_LENGTH,
  )

  let query = tx
    .selectFrom("Resource")
    .where("siteId", "=", args.siteId)
    .select("permalink")

  query =
    args.parentId === null
      ? query.where("parentId", "is", null)
      : query.where("parentId", "=", args.parentId)

  const rows = await query.execute()
  const existing = new Set(rows.map((r) => r.permalink))

  let candidate = base
  let n = 2
  while (existing.has(candidate)) {
    const suffix = `-${n}`
    const maxBaseLen = MAX_PAGE_URL_LENGTH - suffix.length
    if (maxBaseLen < 1) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not allocate a unique permalink for the duplicate page",
      })
    }
    candidate = `${base.slice(0, maxBaseLen)}${suffix}`
    n += 1
    if (n > 10_000) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not allocate a unique permalink for the duplicate page",
      })
    }
  }

  return candidate
}
