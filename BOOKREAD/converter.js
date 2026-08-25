(function() {
  // Book Converter Engine for Koodo Reader
  // Converts any book to Markdown (.md), Plain Text (.txt), or Structured JSON (.json)

  function saveBlobAs(blob, fileName, ko) {
    var saveLib = ko || (window.ko) || null;
    if (saveLib && typeof saveLib.saveAs === "function") {
      saveLib.saveAs(blob, fileName);
      return;
    }
    if (typeof window.saveAs === "function") {
      window.saveAs(blob, fileName);
      return;
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function htmlToMarkdown(html) {
    if (!html) return "";
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");

    var removeTags = doc.querySelectorAll("script, style, link, meta, noscript");
    for (var ri = 0; ri < removeTags.length; ri++) {
      removeTags[ri].parentNode && removeTags[ri].parentNode.removeChild(removeTags[ri]);
    }

    function formatTableToMarkdown(table) {
      var rows = table.querySelectorAll("tr");
      if (!rows.length) return "";
      var md = "\n\n";
      var headerProcessed = false;
      for (var ri2 = 0; ri2 < rows.length; ri2++) {
        var cells = rows[ri2].querySelectorAll("th, td");
        var rowParts = [];
        for (var ci = 0; ci < cells.length; ci++) {
          rowParts.push(cells[ci].textContent.trim().replace(/\|/g, "\\|"));
        }
        md += "| " + rowParts.join(" | ") + " |\n";
        if (ri2 === 0 && !headerProcessed) {
          var sep = [];
          for (var si = 0; si < cells.length; si++) sep.push("---");
          md += "| " + sep.join(" | ") + " |\n";
          headerProcessed = true;
        }
      }
      return md + "\n";
    }

    function convertNode(node) {
      if (!node) return "";
      if (node.nodeType === 3) { // TEXT_NODE
        return node.nodeValue.replace(/[\t\r\n]+/g, " ");
      }
      if (node.nodeType !== 1) return ""; // not ELEMENT_NODE
      var tag = node.tagName.toLowerCase();
      var childNodes = node.childNodes;
      var childrenText = "";
      for (var i = 0; i < childNodes.length; i++) {
        childrenText += convertNode(childNodes[i]);
      }

      if (tag === "h1") return "\n\n# " + childrenText.trim() + "\n\n";
      if (tag === "h2") return "\n\n## " + childrenText.trim() + "\n\n";
      if (tag === "h3") return "\n\n### " + childrenText.trim() + "\n\n";
      if (tag === "h4") return "\n\n#### " + childrenText.trim() + "\n\n";
      if (tag === "h5") return "\n\n##### " + childrenText.trim() + "\n\n";
      if (tag === "h6") return "\n\n###### " + childrenText.trim() + "\n\n";
      if (tag === "p" || tag === "div") return "\n\n" + childrenText.trim() + "\n\n";
      if (tag === "br") return "\n";
      if (tag === "hr") return "\n\n---\n\n";
      if (tag === "strong" || tag === "b") {
        var t1 = childrenText.trim();
        return t1 ? " **" + t1 + "** " : "";
      }
      if (tag === "em" || tag === "i") {
        var t2 = childrenText.trim();
        return t2 ? " *" + t2 + "* " : "";
      }
      if (tag === "code") return " `" + childrenText.trim() + "` ";
      if (tag === "pre") return "\n\n```\n" + node.textContent.trim() + "\n```\n\n";
      if (tag === "blockquote") return "\n\n> " + childrenText.trim().replace(/\n/g, "\n> ") + "\n\n";
      if (tag === "ul" || tag === "ol") return "\n\n" + childrenText + "\n\n";
      if (tag === "li") return "\n- " + childrenText.trim();
      if (tag === "a") {
        var href = node.getAttribute("href");
        return href ? "[" + childrenText.trim() + "](" + href + ")" : childrenText;
      }
      if (tag === "img") {
        var alt = node.getAttribute("alt") || "image";
        var src = node.getAttribute("src") || "";
        return src ? "![" + alt + "](" + src + ")" : "";
      }
      if (tag === "table") return formatTableToMarkdown(node);
      return childrenText;
    }

    var md = convertNode(doc.body);
    return md.replace(/\n{3,}/g, "\n\n").trim();
  }

  function htmlToPlainText(html) {
    if (!html) return "";
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, "text/html");
    var removeTags = doc.querySelectorAll("script, style, link, meta, noscript");
    for (var ri = 0; ri < removeTags.length; ri++) {
      removeTags[ri].parentNode && removeTags[ri].parentNode.removeChild(removeTags[ri]);
    }

    // Insert newlines as text
    var blocks = doc.querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, li, tr, blockquote");
    for (var bi = 0; bi < blocks.length; bi++) {
      blocks[bi].after("\n\n");
    }
    var brs = doc.querySelectorAll("br");
    for (var bri = 0; bri < brs.length; bri++) {
      brs[bri].after("\n");
    }

    return (doc.body.textContent || "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async function extractPdfContent(book, buffer) {
    var uint8 = new Uint8Array(buffer);
    var pdfDoc = await window.pdfjsLib.getDocument({
      data: uint8,
      password: (book && book.password) || ""
    }).promise;

    var numPages = pdfDoc.numPages;
    var chapters = [];
    var fullText = "";
    var fullMarkdown = "";

    var outline = [];
    try { outline = (await pdfDoc.getOutline()) || []; } catch(e) {}

    for (var pageNum = 1; pageNum <= numPages; pageNum++) {
      var page = await pdfDoc.getPage(pageNum);
      var textContent = await page.getTextContent();

      var linesMap = new Map();
      for (var ii = 0; ii < textContent.items.length; ii++) {
        var item = textContent.items[ii];
        if (!item.str) continue;
        var y = Math.round(item.transform[5]);
        if (!linesMap.has(y)) linesMap.set(y, []);
        linesMap.get(y).push(item);
      }

      var sortedY = Array.from(linesMap.keys()).sort(function(a, b) { return b - a; });
      var pageLines = [];
      for (var yi = 0; yi < sortedY.length; yi++) {
        var lineItems = linesMap.get(sortedY[yi]).sort(function(a, b) { return a.transform[4] - b.transform[4]; });
        var lineText = lineItems.map(function(it) { return it.str; }).join(" ").trim();
        if (lineText) pageLines.push(lineText);
      }

      var pageText = pageLines.join("\n");
      var pageMarkdown = "### Page " + pageNum + "\n\n" + pageLines.join("\n\n");

      chapters.push({ title: "Page " + pageNum, chapterIndex: pageNum, text: pageText, markdown: pageMarkdown });
      fullText += (fullText ? "\n\n" : "") + "--- Page " + pageNum + " ---\n" + pageText;
      fullMarkdown += (fullMarkdown ? "\n\n" : "") + pageMarkdown;
    }

    return {
      title: book.name,
      author: book.author || "",
      publisher: book.publisher || "",
      description: book.description || "",
      format: "PDF",
      pageCount: numPages,
      toc: outline,
      chapters: chapters,
      fullText: fullText,
      fullMarkdown: fullMarkdown
    };
  }

  async function extractRenditionContent(book, buffer, BookHelper, Kookit) {
    var format = (book.format || "").toUpperCase();

    if (format === "TXT") {
      var decoder = new TextDecoder(book.charset || "utf-8");
      var rawText = decoder.decode(new Uint8Array(buffer));
      var lines = rawText.split(/\r?\n/);
      var chapters = [];
      var currentChapter = { title: "Beginning", chapterIndex: 1, text: "", markdown: "" };
      var chapterPattern = /^(?:chapter\s+\d+|第[0-9一二三四五六七八九十百千万]+[章节回卷]|section\s+\d+|part\s+\d+)/i;

      for (var li = 0; li < lines.length; li++) {
        if (chapterPattern.test(lines[li].trim())) {
          if (currentChapter.text.trim()) {
            currentChapter.markdown = "## " + currentChapter.title + "\n\n" + currentChapter.text.trim();
            chapters.push(currentChapter);
          }
          currentChapter = { title: lines[li].trim(), chapterIndex: chapters.length + 1, text: "", markdown: "" };
        } else {
          currentChapter.text += lines[li] + "\n";
        }
      }
      if (currentChapter.text.trim() || chapters.length === 0) {
        currentChapter.markdown = "## " + currentChapter.title + "\n\n" + currentChapter.text.trim();
        chapters.push(currentChapter);
      }
      return {
        title: book.name, author: book.author || "", publisher: book.publisher || "",
        description: book.description || "", format: "TXT", chapters: chapters,
        fullText: rawText,
        fullMarkdown: "# " + book.name + "\n\n" + (book.author ? "**Author:** " + book.author + "\n\n" : "") + chapters.map(function(c){ return c.markdown; }).join("\n\n---\n\n")
      };
    }

    if (format === "MD") {
      var dec2 = new TextDecoder("utf-8");
      var rawMd = dec2.decode(new Uint8Array(buffer));
      return {
        title: book.name, author: book.author || "", publisher: book.publisher || "",
        description: book.description || "", format: "MD",
        chapters: [{ title: book.name, chapterIndex: 1, text: rawMd.replace(/[#*`_>\[\]]/g, ""), markdown: rawMd }],
        fullText: rawMd.replace(/[#*`_>\[\]]/g, ""),
        fullMarkdown: rawMd
      };
    }

    // EPUB, MOBI, AZW, AZW3, FB2, DOCX, HTML, etc.
    var helper = BookHelper || (window.Kookit ? window.Kookit.BookHelper : window.BookHelper);
    var kookitCtx = Kookit || window.Kookit;
    var rendition = helper.getRendition(buffer, {
      format: format, charset: book.charset || "utf-8",
      readerMode: "", animation: "none", convertChinese: "Default"
    }, kookitCtx);

    await rendition.parse();

    var chapters2 = [];
    var fullText2 = "";
    var fullMarkdown2 = "";
    var toc2 = [];

    if (rendition.book) {
      toc2 = rendition.book.toc || [];
      try {
        var chapterDocs = [];
        if (typeof rendition.book.getChapterDoc === "function") {
          chapterDocs = await rendition.book.getChapterDoc();
        } else if (rendition.chapterDocList && rendition.chapterDocList.length > 0) {
          chapterDocs = rendition.chapterDocList;
        }
        for (var ci = 0; ci < chapterDocs.length; ci++) {
          var doc = chapterDocs[ci];
          var htmlContent = "";
          if (doc.text && typeof doc.text.load === "function") {
            try {
              var blobUrl = await doc.text.load();
              var res = await fetch(blobUrl);
              var blob = await res.blob();
              htmlContent = await blob.text();
            } catch(e) { console.warn("Failed loading section", ci, e); }
          } else if (doc.html) {
            htmlContent = doc.html;
          } else if (doc.body) {
            htmlContent = doc.body.innerHTML || "";
          }
          var chapterTitle = doc.label || ("Chapter " + (ci + 1));
          var chapterText = htmlToPlainText(htmlContent);
          var chapterMd = htmlToMarkdown(htmlContent);
          chapters2.push({
            title: chapterTitle, chapterIndex: ci + 1, href: doc.href || "",
            text: chapterText,
            markdown: (chapterMd ? ("## " + chapterTitle + "\n\n" + chapterMd) : ("## " + chapterTitle + "\n\n" + chapterText)),
            html: htmlContent
          });
        }
      } catch(e) { console.warn("Failed extracting chapter docs:", e); }
    }

    if (chapters2.length === 0) {
      chapters2.push({ title: book.name, chapterIndex: 1, text: book.name, markdown: "# " + book.name });
    }

    fullText2 = chapters2.map(function(c) { return "=== " + c.title + " ===\n\n" + c.text; }).join("\n\n");
    fullMarkdown2 = "# " + book.name + "\n\n" +
      (book.author ? "**Author:** " + book.author + "\n\n" : "") +
      (book.description ? "> " + book.description + "\n\n" : "") +
      "---\n\n" +
      chapters2.map(function(c) { return c.markdown; }).join("\n\n---\n\n");

    return {
      title: book.name, author: book.author || "", publisher: book.publisher || "",
      description: book.description || "", format: format,
      toc: toc2, chapters: chapters2, fullText: fullText2, fullMarkdown: fullMarkdown2
    };
  }

  async function convertBook(book, targetFormat, deps) {
    deps = deps || {};
    var QtService = (deps.Qt && deps.Qt.Z) ? deps.Qt.Z : (deps.Qt || (window.Qt ? window.Qt.Z : null));
    if (!QtService) throw new Error("BookService (Qt) not available");

    var rawBuffer = await QtService.fetchBook(book.key, book.format.toLowerCase(), true, book.path);
    if (!rawBuffer) throw new Error("Failed to fetch book file");

    var extractedData;
    if ((book.format || "").toUpperCase() === "PDF") {
      extractedData = await extractPdfContent(book, rawBuffer);
    } else {
      extractedData = await extractRenditionContent(book, rawBuffer, deps.BookHelper, deps.Kookit);
    }

    var resultBlob;
    var fileName = (book.name || "book").replace(/[\/\\?%*:|"<>]/g, "_");

    if (targetFormat === "md") {
      resultBlob = new Blob([extractedData.fullMarkdown], { type: "text/markdown;charset=utf-8" });
      fileName += ".md";
    } else if (targetFormat === "txt") {
      var header = "============================================================\n" +
        "Title: " + extractedData.title + "\n" +
        (extractedData.author ? "Author: " + extractedData.author + "\n" : "") +
        (extractedData.publisher ? "Publisher: " + extractedData.publisher + "\n" : "") +
        "Format: " + extractedData.format + "\n" +
        "============================================================\n\n";
      resultBlob = new Blob([header + extractedData.fullText], { type: "text/plain;charset=utf-8" });
      fileName += ".txt";
    } else if (targetFormat === "json") {
      // Remove html from chapters to reduce JSON size
      var exportData = JSON.parse(JSON.stringify(extractedData));
      if (exportData.chapters) {
        exportData.chapters = exportData.chapters.map(function(c) {
          var cc = Object.assign({}, c);
          delete cc.html;
          return cc;
        });
      }
      resultBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
      fileName += ".json";
    } else {
      throw new Error("Unsupported target format: " + targetFormat);
    }

    return { blob: resultBlob, fileName: fileName, extractedData: extractedData };
  }

  async function convertSingleBook(book, targetFormat, t, deps) {
    deps = deps || {};
    var toast = (deps.Yt) || (window.Yt ? window.Yt.ZP : { loading: function(){}, success: function(){}, error: function(){}, dismiss: function(){} });
    var tFn = typeof t === "function" ? t : function(k) { return k; };

    if (targetFormat === "original") {
      try {
        var QtService = (deps.Qt && deps.Qt.Z) ? deps.Qt.Z : (deps.Qt || (window.Qt ? window.Qt.Z : null));
        var raw = await QtService.fetchBook(book.key, book.format.toLowerCase(), true, book.path);
        if (raw) {
          var hlFn = deps.hl || window.hl;
          var saveName = hlFn ? hlFn(book) : (book.name + "." + book.format.toLowerCase());
          saveBlobAs(new Blob([raw]), saveName, deps.ko);
          toast.success(tFn("Export successful"));
        }
      } catch(e) {
        console.error("Export original failed:", e);
        toast.error(tFn("Export failed: " + (e.message || e)));
      }
      return;
    }

    try {
      toast.loading(tFn("Converting book..."), { id: "convert-book" });
      var result = await convertBook(book, targetFormat, deps);
      saveBlobAs(result.blob, result.fileName, deps.ko);
      toast.success(tFn("Export successful"), { id: "convert-book" });
    } catch(e) {
      console.error("Conversion failed:", e);
      toast.error(tFn("Export failed: " + (e.message || e)), { id: "convert-book" });
    }
  }

  async function convertMultipleBooks(books, targetFormat, t, deps) {
    deps = deps || {};
    var toast = (deps.Yt) || (window.Yt ? window.Yt.ZP : { loading: function(){}, success: function(){}, error: function(){}, dismiss: function(){} });
    var tFn = typeof t === "function" ? t : function(k) { return k; };

    if (!books || books.length === 0) {
      if (typeof toast === "function") toast(tFn("Nothing to export"));
      else toast.error(tFn("Nothing to export"));
      return;
    }

    try {
      toast.loading(tFn("Converting books..."), { id: "convert-books" });
      // Try to get JSZip from deps, window global, or webpack internal
      var JSZip = (deps.JSZip && typeof deps.JSZip === "function" ? deps.JSZip : null)
        || window.JSZip
        || (window.xo ? window.xo() : null);

      if (!JSZip) throw new Error("Zip library not available");
      var zip = new JSZip();

      for (var i = 0; i < books.length; i++) {
        try {
          var result = await convertBook(books[i], targetFormat, deps);
          zip.file(result.fileName, result.blob);
        } catch(e) {
          console.warn("Failed converting book " + books[i].name, e);
        }
      }

      var zipBlob = await zip.generateAsync({ type: "blob" });
      var date = new Date();
      var dateStr = date.getFullYear() + "-" +
        String(date.getMonth() + 1).padStart(2, "0") + "-" +
        String(date.getDate()).padStart(2, "0");
      saveBlobAs(zipBlob, "KoodoReader-Books-" + targetFormat.toUpperCase() + "-" + dateStr + ".zip", deps.ko);
      toast.success(tFn("Export successful"), { id: "convert-books" });
    } catch(e) {
      console.error("Batch conversion failed:", e);
      toast.error(tFn("Export failed: " + (e.message || e)), { id: "convert-books" });
    }
  }

  window.BookConverter = {
    htmlToMarkdown: htmlToMarkdown,
    htmlToPlainText: htmlToPlainText,
    extractPdfContent: extractPdfContent,
    extractRenditionContent: extractRenditionContent,
    convertBook: convertBook,
    convertSingleBook: convertSingleBook,
    convertMultipleBooks: convertMultipleBooks,
    saveBlobAs: saveBlobAs
  };

  console.log("[BookConverter] Ready");
})();
