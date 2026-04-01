import { describe, expect, it } from "vitest"

import {
  buildFileDownloadLinkMetaSuffix,
  getDisplayLabelForDownloadFileName,
  stripFileDownloadLinkMetaSuffix,
} from "../fileDownloadLinkLabel"

/** Minimal stand-in for browser `File` (implementation only uses `name` and `size`). */
const mockFile = (name: string, size: number): File => ({ name, size }) as File

describe("fileDownloadLinkLabel", () => {
  describe("getDisplayLabelForDownloadFileName", () => {
    it("maps allowed extensions to display labels", () => {
      expect(getDisplayLabelForDownloadFileName("report.PDF")).toBe("PDF")
      expect(getDisplayLabelForDownloadFileName("data.xlsx")).toBe("XLSX")
      expect(getDisplayLabelForDownloadFileName("old.xls")).toBe("XLS")
    })

    it("returns undefined for unknown extensions", () => {
      expect(getDisplayLabelForDownloadFileName("file.bin")).toBeUndefined()
    })
  })

  describe("buildFileDownloadLinkMetaSuffix", () => {
    it("includes type and size for a PDF", () => {
      expect(
        buildFileDownloadLinkMetaSuffix(mockFile("speech.pdf", 286720)),
      ).toBe(" [PDF, 280.00 KB]")
    })

    it("includes only size when extension is unknown", () => {
      expect(
        buildFileDownloadLinkMetaSuffix(mockFile("unknown.bin", 100)),
      ).toBe(" [100.00 B]")
    })
  })

  describe("stripFileDownloadLinkMetaSuffix", () => {
    it("removes trailing [type, size] before re-upload", () => {
      expect(
        stripFileDownloadLinkMetaSuffix("Download speech [PDF, 280.00 KB]"),
      ).toBe("Download speech")
    })

    it("removes XLSX before shorter XLS would incorrectly match", () => {
      expect(stripFileDownloadLinkMetaSuffix("File [XLSX, 1.00 MB]")).toBe(
        "File",
      )
    })

    it("does not strip unrelated trailing brackets", () => {
      const t = "See policy [section 2a]"
      expect(stripFileDownloadLinkMetaSuffix(t)).toBe(t)
    })
  })
})
