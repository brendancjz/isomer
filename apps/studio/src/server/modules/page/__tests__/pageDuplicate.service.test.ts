import type { UnwrapTagged } from "type-fest"
import { describe, expect, it } from "vitest"

import {
  applyDuplicateTitleToBlobContent,
  buildAssetKeyReplacementMap,
  collectAssetFileKeysFromJson,
  getAssetFileKeyFromPublicPath,
  rewriteAssetPathsInJson,
  slugifyForDuplicatePermalink,
} from "../pageDuplicate.service"

describe("pageDuplicate.service", () => {
  describe("getAssetFileKeyFromPublicPath", () => {
    it("returns file key for a valid asset path", () => {
      expect(
        getAssetFileKeyFromPublicPath(
          "/1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/photo.png",
        ),
      ).toBe("1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/photo.png")
    })

    it("returns null for placeholders and non-asset paths", () => {
      expect(getAssetFileKeyFromPublicPath("/placeholder_no_image.png")).toBe(
        null,
      )
      expect(getAssetFileKeyFromPublicPath("https://x.com/a.png")).toBe(null)
      expect(getAssetFileKeyFromPublicPath("/1/not-a-uuid/file.png")).toBe(null)
    })
  })

  describe("collectAssetFileKeysFromJson", () => {
    it("collects keys from nested structures and dedupes", () => {
      const key = "1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/a.png"
      const json = {
        a: [`/${key}`],
        b: { c: [`/${key}`, { d: `/${key}` }] },
      }
      expect(collectAssetFileKeysFromJson(json)).toEqual(new Set([key]))
    })
  })

  describe("buildAssetKeyReplacementMap and rewriteAssetPathsInJson", () => {
    it("maps each source key to a new site-scoped key and rewrites JSON", () => {
      const siteId = 42
      const oldKey = "42/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/doc.pdf"
      let n = 0
      const newId = () => `new-uuid-${++n}`
      const map = buildAssetKeyReplacementMap([oldKey], siteId, newId)
      expect(map.get(oldKey)).toBe("42/new-uuid-1/doc.pdf")

      const out = rewriteAssetPathsInJson(
        { x: `/${oldKey}`, y: "leave-me" },
        map,
      ) as { x: string; y: string }
      expect(out.x).toBe("/42/new-uuid-1/doc.pdf")
      expect(out.y).toBe("leave-me")
    })
  })

  describe("slugifyForDuplicatePermalink", () => {
    it("lowercases and replaces non-alphanumeric with hyphens", () => {
      expect(slugifyForDuplicatePermalink("Hello World!")).toBe("hello-world-")
    })
  })

  describe("applyDuplicateTitleToBlobContent", () => {
    it("sets page.title when present", () => {
      const content: UnwrapTagged<PrismaJson.BlobJsonContent> = {
        page: { title: "Old", contentPageHeader: { summary: "s" } },
        layout: "content",
        content: [],
        version: "0.1.0",
      }
      applyDuplicateTitleToBlobContent(content, "Copy of X")
      expect((content.page as { title: string }).title).toBe("Copy of X")
    })

    it("does not add page.title when absent", () => {
      const content = {
        page: { contentPageHeader: { summary: "s" } },
        layout: "content",
        content: [],
        version: "0.1.0",
      } as UnwrapTagged<PrismaJson.BlobJsonContent>
      applyDuplicateTitleToBlobContent(content, "Copy of X")
      expect((content.page as { title?: string }).title).toBeUndefined()
    })
  })
})
