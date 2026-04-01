import { describe, expect, it } from "vitest"

import {
  buildFileDownloadLinkMetaSuffix,
  getDisplayLabelForDownloadFileName,
  stripFileDownloadLinkMetaSuffix,
} from "../fileDownloadLinkLabel"

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
      const file = new File([new Uint8Array(286720)], "speech.pdf", {
        type: "application/pdf",
      })
      expect(buildFileDownloadLinkMetaSuffix(file)).toBe(" [PDF, 280.00 KB]")
    })

    it("includes only size when extension is unknown", () => {
      const file = new File([new Uint8Array(100)], "unknown.bin", {
        type: "application/octet-stream",
      })
      expect(buildFileDownloadLinkMetaSuffix(file)).toBe(" [100.00 B]")
    })
  })

  describe("stripFileDownloadLinkMetaSuffix", () => {
    it("removes trailing [type, size] before re-upload", () => {
      expect(
        stripFileDownloadLinkMetaSuffix("Download speech [PDF, 280.00 KB]"),
      ).toBe("Download speech")
    })

    it("removes XLSX before shorter XLS would incorrectly match", () => {
      expect(
        stripFileDownloadLinkMetaSuffix("File [XLSX, 1.00 MB]"),
      ).toBe("File")
    })

    it("does not strip unrelated trailing brackets", () => {
      const t = "See policy [section 2a]"
      expect(stripFileDownloadLinkMetaSuffix(t)).toBe(t)
    })
  })
})
