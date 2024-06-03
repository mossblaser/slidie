
// Though the code below is the mangled result of the Typescript
// compiler and esbuild bundler (hence the absent comments) it isn't
// minified so may still be readable... The full Typescript sources are
// embedded in the source map at the end of the script file and should
// show up in your Browser's debug tools. At the time of writing (2024)
// most browsers, however, still fail to resolve names/line numbers
// using the inline source maps within an inline script tag. Sorry.
//
// The following Javascript is built from the Typescript sources in the
// `slidie/render_xhtml/viewer/ts` directory of the Slidie source code
// which should be online at https://github.com/mossblaser/slidie.

"use strict";
(() => {
  // node_modules/marked/lib/marked.esm.js
  function _getDefaults() {
    return {
      async: false,
      breaks: false,
      extensions: null,
      gfm: true,
      hooks: null,
      pedantic: false,
      renderer: null,
      silent: false,
      tokenizer: null,
      walkTokens: null
    };
  }
  var _defaults = _getDefaults();
  function changeDefaults(newDefaults) {
    _defaults = newDefaults;
  }
  var escapeTest = /[&<>"']/;
  var escapeReplace = new RegExp(escapeTest.source, "g");
  var escapeTestNoEncode = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/;
  var escapeReplaceNoEncode = new RegExp(escapeTestNoEncode.source, "g");
  var escapeReplacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  var getEscapeReplacement = (ch) => escapeReplacements[ch];
  function escape$1(html2, encode) {
    if (encode) {
      if (escapeTest.test(html2)) {
        return html2.replace(escapeReplace, getEscapeReplacement);
      }
    } else {
      if (escapeTestNoEncode.test(html2)) {
        return html2.replace(escapeReplaceNoEncode, getEscapeReplacement);
      }
    }
    return html2;
  }
  var unescapeTest = /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig;
  function unescape(html2) {
    return html2.replace(unescapeTest, (_, n) => {
      n = n.toLowerCase();
      if (n === "colon")
        return ":";
      if (n.charAt(0) === "#") {
        return n.charAt(1) === "x" ? String.fromCharCode(parseInt(n.substring(2), 16)) : String.fromCharCode(+n.substring(1));
      }
      return "";
    });
  }
  var caret = /(^|[^\[])\^/g;
  function edit(regex, opt) {
    let source = typeof regex === "string" ? regex : regex.source;
    opt = opt || "";
    const obj = {
      replace: (name, val) => {
        let valSource = typeof val === "string" ? val : val.source;
        valSource = valSource.replace(caret, "$1");
        source = source.replace(name, valSource);
        return obj;
      },
      getRegex: () => {
        return new RegExp(source, opt);
      }
    };
    return obj;
  }
  function cleanUrl(href) {
    try {
      href = encodeURI(href).replace(/%25/g, "%");
    } catch (e) {
      return null;
    }
    return href;
  }
  var noopTest = { exec: () => null };
  function splitCells(tableRow, count) {
    const row = tableRow.replace(/\|/g, (match, offset, str) => {
      let escaped = false;
      let curr = offset;
      while (--curr >= 0 && str[curr] === "\\")
        escaped = !escaped;
      if (escaped) {
        return "|";
      } else {
        return " |";
      }
    }), cells = row.split(/ \|/);
    let i = 0;
    if (!cells[0].trim()) {
      cells.shift();
    }
    if (cells.length > 0 && !cells[cells.length - 1].trim()) {
      cells.pop();
    }
    if (count) {
      if (cells.length > count) {
        cells.splice(count);
      } else {
        while (cells.length < count)
          cells.push("");
      }
    }
    for (; i < cells.length; i++) {
      cells[i] = cells[i].trim().replace(/\\\|/g, "|");
    }
    return cells;
  }
  function rtrim(str, c, invert) {
    const l = str.length;
    if (l === 0) {
      return "";
    }
    let suffLen = 0;
    while (suffLen < l) {
      const currChar = str.charAt(l - suffLen - 1);
      if (currChar === c && !invert) {
        suffLen++;
      } else if (currChar !== c && invert) {
        suffLen++;
      } else {
        break;
      }
    }
    return str.slice(0, l - suffLen);
  }
  function findClosingBracket(str, b) {
    if (str.indexOf(b[1]) === -1) {
      return -1;
    }
    let level = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "\\") {
        i++;
      } else if (str[i] === b[0]) {
        level++;
      } else if (str[i] === b[1]) {
        level--;
        if (level < 0) {
          return i;
        }
      }
    }
    return -1;
  }
  function outputLink(cap, link2, raw, lexer2) {
    const href = link2.href;
    const title = link2.title ? escape$1(link2.title) : null;
    const text = cap[1].replace(/\\([\[\]])/g, "$1");
    if (cap[0].charAt(0) !== "!") {
      lexer2.state.inLink = true;
      const token = {
        type: "link",
        raw,
        href,
        title,
        text,
        tokens: lexer2.inlineTokens(text)
      };
      lexer2.state.inLink = false;
      return token;
    }
    return {
      type: "image",
      raw,
      href,
      title,
      text: escape$1(text)
    };
  }
  function indentCodeCompensation(raw, text) {
    const matchIndentToCode = raw.match(/^(\s+)(?:```)/);
    if (matchIndentToCode === null) {
      return text;
    }
    const indentToCode = matchIndentToCode[1];
    return text.split("\n").map((node) => {
      const matchIndentInNode = node.match(/^\s+/);
      if (matchIndentInNode === null) {
        return node;
      }
      const [indentInNode] = matchIndentInNode;
      if (indentInNode.length >= indentToCode.length) {
        return node.slice(indentToCode.length);
      }
      return node;
    }).join("\n");
  }
  var _Tokenizer = class {
    options;
    rules;
    // set by the lexer
    lexer;
    // set by the lexer
    constructor(options2) {
      this.options = options2 || _defaults;
    }
    space(src) {
      const cap = this.rules.block.newline.exec(src);
      if (cap && cap[0].length > 0) {
        return {
          type: "space",
          raw: cap[0]
        };
      }
    }
    code(src) {
      const cap = this.rules.block.code.exec(src);
      if (cap) {
        const text = cap[0].replace(/^ {1,4}/gm, "");
        return {
          type: "code",
          raw: cap[0],
          codeBlockStyle: "indented",
          text: !this.options.pedantic ? rtrim(text, "\n") : text
        };
      }
    }
    fences(src) {
      const cap = this.rules.block.fences.exec(src);
      if (cap) {
        const raw = cap[0];
        const text = indentCodeCompensation(raw, cap[3] || "");
        return {
          type: "code",
          raw,
          lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : cap[2],
          text
        };
      }
    }
    heading(src) {
      const cap = this.rules.block.heading.exec(src);
      if (cap) {
        let text = cap[2].trim();
        if (/#$/.test(text)) {
          const trimmed = rtrim(text, "#");
          if (this.options.pedantic) {
            text = trimmed.trim();
          } else if (!trimmed || / $/.test(trimmed)) {
            text = trimmed.trim();
          }
        }
        return {
          type: "heading",
          raw: cap[0],
          depth: cap[1].length,
          text,
          tokens: this.lexer.inline(text)
        };
      }
    }
    hr(src) {
      const cap = this.rules.block.hr.exec(src);
      if (cap) {
        return {
          type: "hr",
          raw: cap[0]
        };
      }
    }
    blockquote(src) {
      const cap = this.rules.block.blockquote.exec(src);
      if (cap) {
        const text = rtrim(cap[0].replace(/^ *>[ \t]?/gm, ""), "\n");
        const top = this.lexer.state.top;
        this.lexer.state.top = true;
        const tokens = this.lexer.blockTokens(text);
        this.lexer.state.top = top;
        return {
          type: "blockquote",
          raw: cap[0],
          tokens,
          text
        };
      }
    }
    list(src) {
      let cap = this.rules.block.list.exec(src);
      if (cap) {
        let bull = cap[1].trim();
        const isordered = bull.length > 1;
        const list2 = {
          type: "list",
          raw: "",
          ordered: isordered,
          start: isordered ? +bull.slice(0, -1) : "",
          loose: false,
          items: []
        };
        bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
        if (this.options.pedantic) {
          bull = isordered ? bull : "[*+-]";
        }
        const itemRegex = new RegExp(`^( {0,3}${bull})((?:[	 ][^\\n]*)?(?:\\n|$))`);
        let raw = "";
        let itemContents = "";
        let endsWithBlankLine = false;
        while (src) {
          let endEarly = false;
          if (!(cap = itemRegex.exec(src))) {
            break;
          }
          if (this.rules.block.hr.test(src)) {
            break;
          }
          raw = cap[0];
          src = src.substring(raw.length);
          let line = cap[2].split("\n", 1)[0].replace(/^\t+/, (t) => " ".repeat(3 * t.length));
          let nextLine = src.split("\n", 1)[0];
          let indent = 0;
          if (this.options.pedantic) {
            indent = 2;
            itemContents = line.trimStart();
          } else {
            indent = cap[2].search(/[^ ]/);
            indent = indent > 4 ? 1 : indent;
            itemContents = line.slice(indent);
            indent += cap[1].length;
          }
          let blankLine = false;
          if (!line && /^ *$/.test(nextLine)) {
            raw += nextLine + "\n";
            src = src.substring(nextLine.length + 1);
            endEarly = true;
          }
          if (!endEarly) {
            const nextBulletRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`);
            const hrRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`);
            const fencesBeginRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`);
            const headingBeginRegex = new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`);
            while (src) {
              const rawLine = src.split("\n", 1)[0];
              nextLine = rawLine;
              if (this.options.pedantic) {
                nextLine = nextLine.replace(/^ {1,4}(?=( {4})*[^ ])/g, "  ");
              }
              if (fencesBeginRegex.test(nextLine)) {
                break;
              }
              if (headingBeginRegex.test(nextLine)) {
                break;
              }
              if (nextBulletRegex.test(nextLine)) {
                break;
              }
              if (hrRegex.test(src)) {
                break;
              }
              if (nextLine.search(/[^ ]/) >= indent || !nextLine.trim()) {
                itemContents += "\n" + nextLine.slice(indent);
              } else {
                if (blankLine) {
                  break;
                }
                if (line.search(/[^ ]/) >= 4) {
                  break;
                }
                if (fencesBeginRegex.test(line)) {
                  break;
                }
                if (headingBeginRegex.test(line)) {
                  break;
                }
                if (hrRegex.test(line)) {
                  break;
                }
                itemContents += "\n" + nextLine;
              }
              if (!blankLine && !nextLine.trim()) {
                blankLine = true;
              }
              raw += rawLine + "\n";
              src = src.substring(rawLine.length + 1);
              line = nextLine.slice(indent);
            }
          }
          if (!list2.loose) {
            if (endsWithBlankLine) {
              list2.loose = true;
            } else if (/\n *\n *$/.test(raw)) {
              endsWithBlankLine = true;
            }
          }
          let istask = null;
          let ischecked;
          if (this.options.gfm) {
            istask = /^\[[ xX]\] /.exec(itemContents);
            if (istask) {
              ischecked = istask[0] !== "[ ] ";
              itemContents = itemContents.replace(/^\[[ xX]\] +/, "");
            }
          }
          list2.items.push({
            type: "list_item",
            raw,
            task: !!istask,
            checked: ischecked,
            loose: false,
            text: itemContents,
            tokens: []
          });
          list2.raw += raw;
        }
        list2.items[list2.items.length - 1].raw = raw.trimEnd();
        list2.items[list2.items.length - 1].text = itemContents.trimEnd();
        list2.raw = list2.raw.trimEnd();
        for (let i = 0; i < list2.items.length; i++) {
          this.lexer.state.top = false;
          list2.items[i].tokens = this.lexer.blockTokens(list2.items[i].text, []);
          if (!list2.loose) {
            const spacers = list2.items[i].tokens.filter((t) => t.type === "space");
            const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t) => /\n.*\n/.test(t.raw));
            list2.loose = hasMultipleLineBreaks;
          }
        }
        if (list2.loose) {
          for (let i = 0; i < list2.items.length; i++) {
            list2.items[i].loose = true;
          }
        }
        return list2;
      }
    }
    html(src) {
      const cap = this.rules.block.html.exec(src);
      if (cap) {
        const token = {
          type: "html",
          block: true,
          raw: cap[0],
          pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
          text: cap[0]
        };
        return token;
      }
    }
    def(src) {
      const cap = this.rules.block.def.exec(src);
      if (cap) {
        const tag2 = cap[1].toLowerCase().replace(/\s+/g, " ");
        const href = cap[2] ? cap[2].replace(/^<(.*)>$/, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "";
        const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : cap[3];
        return {
          type: "def",
          tag: tag2,
          raw: cap[0],
          href,
          title
        };
      }
    }
    table(src) {
      const cap = this.rules.block.table.exec(src);
      if (!cap) {
        return;
      }
      if (!/[:|]/.test(cap[2])) {
        return;
      }
      const headers = splitCells(cap[1]);
      const aligns = cap[2].replace(/^\||\| *$/g, "").split("|");
      const rows = cap[3] && cap[3].trim() ? cap[3].replace(/\n[ \t]*$/, "").split("\n") : [];
      const item = {
        type: "table",
        raw: cap[0],
        header: [],
        align: [],
        rows: []
      };
      if (headers.length !== aligns.length) {
        return;
      }
      for (const align of aligns) {
        if (/^ *-+: *$/.test(align)) {
          item.align.push("right");
        } else if (/^ *:-+: *$/.test(align)) {
          item.align.push("center");
        } else if (/^ *:-+ *$/.test(align)) {
          item.align.push("left");
        } else {
          item.align.push(null);
        }
      }
      for (const header of headers) {
        item.header.push({
          text: header,
          tokens: this.lexer.inline(header)
        });
      }
      for (const row of rows) {
        item.rows.push(splitCells(row, item.header.length).map((cell) => {
          return {
            text: cell,
            tokens: this.lexer.inline(cell)
          };
        }));
      }
      return item;
    }
    lheading(src) {
      const cap = this.rules.block.lheading.exec(src);
      if (cap) {
        return {
          type: "heading",
          raw: cap[0],
          depth: cap[2].charAt(0) === "=" ? 1 : 2,
          text: cap[1],
          tokens: this.lexer.inline(cap[1])
        };
      }
    }
    paragraph(src) {
      const cap = this.rules.block.paragraph.exec(src);
      if (cap) {
        const text = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
        return {
          type: "paragraph",
          raw: cap[0],
          text,
          tokens: this.lexer.inline(text)
        };
      }
    }
    text(src) {
      const cap = this.rules.block.text.exec(src);
      if (cap) {
        return {
          type: "text",
          raw: cap[0],
          text: cap[0],
          tokens: this.lexer.inline(cap[0])
        };
      }
    }
    escape(src) {
      const cap = this.rules.inline.escape.exec(src);
      if (cap) {
        return {
          type: "escape",
          raw: cap[0],
          text: escape$1(cap[1])
        };
      }
    }
    tag(src) {
      const cap = this.rules.inline.tag.exec(src);
      if (cap) {
        if (!this.lexer.state.inLink && /^<a /i.test(cap[0])) {
          this.lexer.state.inLink = true;
        } else if (this.lexer.state.inLink && /^<\/a>/i.test(cap[0])) {
          this.lexer.state.inLink = false;
        }
        if (!this.lexer.state.inRawBlock && /^<(pre|code|kbd|script)(\s|>)/i.test(cap[0])) {
          this.lexer.state.inRawBlock = true;
        } else if (this.lexer.state.inRawBlock && /^<\/(pre|code|kbd|script)(\s|>)/i.test(cap[0])) {
          this.lexer.state.inRawBlock = false;
        }
        return {
          type: "html",
          raw: cap[0],
          inLink: this.lexer.state.inLink,
          inRawBlock: this.lexer.state.inRawBlock,
          block: false,
          text: cap[0]
        };
      }
    }
    link(src) {
      const cap = this.rules.inline.link.exec(src);
      if (cap) {
        const trimmedUrl = cap[2].trim();
        if (!this.options.pedantic && /^</.test(trimmedUrl)) {
          if (!/>$/.test(trimmedUrl)) {
            return;
          }
          const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), "\\");
          if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
            return;
          }
        } else {
          const lastParenIndex = findClosingBracket(cap[2], "()");
          if (lastParenIndex > -1) {
            const start = cap[0].indexOf("!") === 0 ? 5 : 4;
            const linkLen = start + cap[1].length + lastParenIndex;
            cap[2] = cap[2].substring(0, lastParenIndex);
            cap[0] = cap[0].substring(0, linkLen).trim();
            cap[3] = "";
          }
        }
        let href = cap[2];
        let title = "";
        if (this.options.pedantic) {
          const link2 = /^([^'"]*[^\s])\s+(['"])(.*)\2/.exec(href);
          if (link2) {
            href = link2[1];
            title = link2[3];
          }
        } else {
          title = cap[3] ? cap[3].slice(1, -1) : "";
        }
        href = href.trim();
        if (/^</.test(href)) {
          if (this.options.pedantic && !/>$/.test(trimmedUrl)) {
            href = href.slice(1);
          } else {
            href = href.slice(1, -1);
          }
        }
        return outputLink(cap, {
          href: href ? href.replace(this.rules.inline.anyPunctuation, "$1") : href,
          title: title ? title.replace(this.rules.inline.anyPunctuation, "$1") : title
        }, cap[0], this.lexer);
      }
    }
    reflink(src, links) {
      let cap;
      if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
        const linkString = (cap[2] || cap[1]).replace(/\s+/g, " ");
        const link2 = links[linkString.toLowerCase()];
        if (!link2) {
          const text = cap[0].charAt(0);
          return {
            type: "text",
            raw: text,
            text
          };
        }
        return outputLink(cap, link2, cap[0], this.lexer);
      }
    }
    emStrong(src, maskedSrc, prevChar = "") {
      let match = this.rules.inline.emStrongLDelim.exec(src);
      if (!match)
        return;
      if (match[3] && prevChar.match(/[\p{L}\p{N}]/u))
        return;
      const nextChar = match[1] || match[2] || "";
      if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
        const lLength = [...match[0]].length - 1;
        let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
        const endReg = match[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
        endReg.lastIndex = 0;
        maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
        while ((match = endReg.exec(maskedSrc)) != null) {
          rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
          if (!rDelim)
            continue;
          rLength = [...rDelim].length;
          if (match[3] || match[4]) {
            delimTotal += rLength;
            continue;
          } else if (match[5] || match[6]) {
            if (lLength % 3 && !((lLength + rLength) % 3)) {
              midDelimTotal += rLength;
              continue;
            }
          }
          delimTotal -= rLength;
          if (delimTotal > 0)
            continue;
          rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
          const lastCharLength = [...match[0]][0].length;
          const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
          if (Math.min(lLength, rLength) % 2) {
            const text2 = raw.slice(1, -1);
            return {
              type: "em",
              raw,
              text: text2,
              tokens: this.lexer.inlineTokens(text2)
            };
          }
          const text = raw.slice(2, -2);
          return {
            type: "strong",
            raw,
            text,
            tokens: this.lexer.inlineTokens(text)
          };
        }
      }
    }
    codespan(src) {
      const cap = this.rules.inline.code.exec(src);
      if (cap) {
        let text = cap[2].replace(/\n/g, " ");
        const hasNonSpaceChars = /[^ ]/.test(text);
        const hasSpaceCharsOnBothEnds = /^ /.test(text) && / $/.test(text);
        if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
          text = text.substring(1, text.length - 1);
        }
        text = escape$1(text, true);
        return {
          type: "codespan",
          raw: cap[0],
          text
        };
      }
    }
    br(src) {
      const cap = this.rules.inline.br.exec(src);
      if (cap) {
        return {
          type: "br",
          raw: cap[0]
        };
      }
    }
    del(src) {
      const cap = this.rules.inline.del.exec(src);
      if (cap) {
        return {
          type: "del",
          raw: cap[0],
          text: cap[2],
          tokens: this.lexer.inlineTokens(cap[2])
        };
      }
    }
    autolink(src) {
      const cap = this.rules.inline.autolink.exec(src);
      if (cap) {
        let text, href;
        if (cap[2] === "@") {
          text = escape$1(cap[1]);
          href = "mailto:" + text;
        } else {
          text = escape$1(cap[1]);
          href = text;
        }
        return {
          type: "link",
          raw: cap[0],
          text,
          href,
          tokens: [
            {
              type: "text",
              raw: text,
              text
            }
          ]
        };
      }
    }
    url(src) {
      let cap;
      if (cap = this.rules.inline.url.exec(src)) {
        let text, href;
        if (cap[2] === "@") {
          text = escape$1(cap[0]);
          href = "mailto:" + text;
        } else {
          let prevCapZero;
          do {
            prevCapZero = cap[0];
            cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
          } while (prevCapZero !== cap[0]);
          text = escape$1(cap[0]);
          if (cap[1] === "www.") {
            href = "http://" + cap[0];
          } else {
            href = cap[0];
          }
        }
        return {
          type: "link",
          raw: cap[0],
          text,
          href,
          tokens: [
            {
              type: "text",
              raw: text,
              text
            }
          ]
        };
      }
    }
    inlineText(src) {
      const cap = this.rules.inline.text.exec(src);
      if (cap) {
        let text;
        if (this.lexer.state.inRawBlock) {
          text = cap[0];
        } else {
          text = escape$1(cap[0]);
        }
        return {
          type: "text",
          raw: cap[0],
          text
        };
      }
    }
  };
  var newline = /^(?: *(?:\n|$))+/;
  var blockCode = /^( {4}[^\n]+(?:\n(?: *(?:\n|$))*)?)+/;
  var fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
  var hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
  var heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
  var bullet = /(?:[*+-]|\d{1,9}[.)])/;
  var lheading = edit(/^(?!bull |blockCode|fences|blockquote|heading|html)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html))+?)\n {0,3}(=+|-+) *(?:\n+|$)/).replace(/bull/g, bullet).replace(/blockCode/g, / {4}/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).getRegex();
  var _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
  var blockText = /^[^\n]+/;
  var _blockLabel = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
  var def = edit(/^ {0,3}\[(label)\]: *(?:\n *)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n *)?| *\n *)(title))? *(?:\n+|$)/).replace("label", _blockLabel).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
  var list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
  var _tag = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
  var _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
  var html = edit("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n *)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n *)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n *)+\\n|$))", "i").replace("comment", _comment).replace("tag", _tag).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
  var paragraph = edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
  var blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", paragraph).getRegex();
  var blockNormal = {
    blockquote,
    code: blockCode,
    def,
    fences,
    heading,
    hr,
    html,
    lheading,
    list,
    newline,
    paragraph,
    table: noopTest,
    text: blockText
  };
  var gfmTable = edit("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", " {4}[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
  var blockGfm = {
    ...blockNormal,
    table: gfmTable,
    paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", gfmTable).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex()
  };
  var blockPedantic = {
    ...blockNormal,
    html: edit(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", _comment).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
    def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
    heading: /^(#{1,6})(.*)(?:\n+|$)/,
    fences: noopTest,
    // fences not supported
    lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
    paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " *#{1,6} *[^\n]").replace("lheading", lheading).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
  };
  var escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
  var inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
  var br = /^( {2,}|\\)\n(?!\s*$)/;
  var inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
  var _punctuation = "\\p{P}\\p{S}";
  var punctuation = edit(/^((?![*_])[\spunctuation])/, "u").replace(/punctuation/g, _punctuation).getRegex();
  var blockSkip = /\[[^[\]]*?\]\([^\(\)]*?\)|`[^`]*?`|<[^<>]*?>/g;
  var emStrongLDelim = edit(/^(?:\*+(?:((?!\*)[punct])|[^\s*]))|^_+(?:((?!_)[punct])|([^\s_]))/, "u").replace(/punct/g, _punctuation).getRegex();
  var emStrongRDelimAst = edit("^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)[punct](\\*+)(?=[\\s]|$)|[^punct\\s](\\*+)(?!\\*)(?=[punct\\s]|$)|(?!\\*)[punct\\s](\\*+)(?=[^punct\\s])|[\\s](\\*+)(?!\\*)(?=[punct])|(?!\\*)[punct](\\*+)(?!\\*)(?=[punct])|[^punct\\s](\\*+)(?=[^punct\\s])", "gu").replace(/punct/g, _punctuation).getRegex();
  var emStrongRDelimUnd = edit("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)[punct](_+)(?=[\\s]|$)|[^punct\\s](_+)(?!_)(?=[punct\\s]|$)|(?!_)[punct\\s](_+)(?=[^punct\\s])|[\\s](_+)(?!_)(?=[punct])|(?!_)[punct](_+)(?!_)(?=[punct])", "gu").replace(/punct/g, _punctuation).getRegex();
  var anyPunctuation = edit(/\\([punct])/, "gu").replace(/punct/g, _punctuation).getRegex();
  var autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
  var _inlineComment = edit(_comment).replace("(?:-->|$)", "-->").getRegex();
  var tag = edit("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", _inlineComment).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
  var _inlineLabel = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
  var link = edit(/^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/).replace("label", _inlineLabel).replace("href", /<(?:\\.|[^\n<>\\])+>|[^\s\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
  var reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace("label", _inlineLabel).replace("ref", _blockLabel).getRegex();
  var nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace("ref", _blockLabel).getRegex();
  var reflinkSearch = edit("reflink|nolink(?!\\()", "g").replace("reflink", reflink).replace("nolink", nolink).getRegex();
  var inlineNormal = {
    _backpedal: noopTest,
    // only used for GFM url
    anyPunctuation,
    autolink,
    blockSkip,
    br,
    code: inlineCode,
    del: noopTest,
    emStrongLDelim,
    emStrongRDelimAst,
    emStrongRDelimUnd,
    escape,
    link,
    nolink,
    punctuation,
    reflink,
    reflinkSearch,
    tag,
    text: inlineText,
    url: noopTest
  };
  var inlinePedantic = {
    ...inlineNormal,
    link: edit(/^!?\[(label)\]\((.*?)\)/).replace("label", _inlineLabel).getRegex(),
    reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", _inlineLabel).getRegex()
  };
  var inlineGfm = {
    ...inlineNormal,
    escape: edit(escape).replace("])", "~|])").getRegex(),
    url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
    _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
    del: /^(~~?)(?=[^\s~])([\s\S]*?[^\s~])\1(?=[^~]|$)/,
    text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
  };
  var inlineBreaks = {
    ...inlineGfm,
    br: edit(br).replace("{2,}", "*").getRegex(),
    text: edit(inlineGfm.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
  };
  var block = {
    normal: blockNormal,
    gfm: blockGfm,
    pedantic: blockPedantic
  };
  var inline = {
    normal: inlineNormal,
    gfm: inlineGfm,
    breaks: inlineBreaks,
    pedantic: inlinePedantic
  };
  var _Lexer = class __Lexer {
    tokens;
    options;
    state;
    tokenizer;
    inlineQueue;
    constructor(options2) {
      this.tokens = [];
      this.tokens.links = /* @__PURE__ */ Object.create(null);
      this.options = options2 || _defaults;
      this.options.tokenizer = this.options.tokenizer || new _Tokenizer();
      this.tokenizer = this.options.tokenizer;
      this.tokenizer.options = this.options;
      this.tokenizer.lexer = this;
      this.inlineQueue = [];
      this.state = {
        inLink: false,
        inRawBlock: false,
        top: true
      };
      const rules = {
        block: block.normal,
        inline: inline.normal
      };
      if (this.options.pedantic) {
        rules.block = block.pedantic;
        rules.inline = inline.pedantic;
      } else if (this.options.gfm) {
        rules.block = block.gfm;
        if (this.options.breaks) {
          rules.inline = inline.breaks;
        } else {
          rules.inline = inline.gfm;
        }
      }
      this.tokenizer.rules = rules;
    }
    /**
     * Expose Rules
     */
    static get rules() {
      return {
        block,
        inline
      };
    }
    /**
     * Static Lex Method
     */
    static lex(src, options2) {
      const lexer2 = new __Lexer(options2);
      return lexer2.lex(src);
    }
    /**
     * Static Lex Inline Method
     */
    static lexInline(src, options2) {
      const lexer2 = new __Lexer(options2);
      return lexer2.inlineTokens(src);
    }
    /**
     * Preprocessing
     */
    lex(src) {
      src = src.replace(/\r\n|\r/g, "\n");
      this.blockTokens(src, this.tokens);
      for (let i = 0; i < this.inlineQueue.length; i++) {
        const next = this.inlineQueue[i];
        this.inlineTokens(next.src, next.tokens);
      }
      this.inlineQueue = [];
      return this.tokens;
    }
    blockTokens(src, tokens = []) {
      if (this.options.pedantic) {
        src = src.replace(/\t/g, "    ").replace(/^ +$/gm, "");
      } else {
        src = src.replace(/^( *)(\t+)/gm, (_, leading, tabs) => {
          return leading + "    ".repeat(tabs.length);
        });
      }
      let token;
      let lastToken;
      let cutSrc;
      let lastParagraphClipped;
      while (src) {
        if (this.options.extensions && this.options.extensions.block && this.options.extensions.block.some((extTokenizer) => {
          if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            return true;
          }
          return false;
        })) {
          continue;
        }
        if (token = this.tokenizer.space(src)) {
          src = src.substring(token.raw.length);
          if (token.raw.length === 1 && tokens.length > 0) {
            tokens[tokens.length - 1].raw += "\n";
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (token = this.tokenizer.code(src)) {
          src = src.substring(token.raw.length);
          lastToken = tokens[tokens.length - 1];
          if (lastToken && (lastToken.type === "paragraph" || lastToken.type === "text")) {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.text;
            this.inlineQueue[this.inlineQueue.length - 1].src = lastToken.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (token = this.tokenizer.fences(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.heading(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.hr(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.blockquote(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.list(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.html(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.def(src)) {
          src = src.substring(token.raw.length);
          lastToken = tokens[tokens.length - 1];
          if (lastToken && (lastToken.type === "paragraph" || lastToken.type === "text")) {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.raw;
            this.inlineQueue[this.inlineQueue.length - 1].src = lastToken.text;
          } else if (!this.tokens.links[token.tag]) {
            this.tokens.links[token.tag] = {
              href: token.href,
              title: token.title
            };
          }
          continue;
        }
        if (token = this.tokenizer.table(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.lheading(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        cutSrc = src;
        if (this.options.extensions && this.options.extensions.startBlock) {
          let startIndex = Infinity;
          const tempSrc = src.slice(1);
          let tempStart;
          this.options.extensions.startBlock.forEach((getStartIndex) => {
            tempStart = getStartIndex.call({ lexer: this }, tempSrc);
            if (typeof tempStart === "number" && tempStart >= 0) {
              startIndex = Math.min(startIndex, tempStart);
            }
          });
          if (startIndex < Infinity && startIndex >= 0) {
            cutSrc = src.substring(0, startIndex + 1);
          }
        }
        if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
          lastToken = tokens[tokens.length - 1];
          if (lastParagraphClipped && lastToken.type === "paragraph") {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.text;
            this.inlineQueue.pop();
            this.inlineQueue[this.inlineQueue.length - 1].src = lastToken.text;
          } else {
            tokens.push(token);
          }
          lastParagraphClipped = cutSrc.length !== src.length;
          src = src.substring(token.raw.length);
          continue;
        }
        if (token = this.tokenizer.text(src)) {
          src = src.substring(token.raw.length);
          lastToken = tokens[tokens.length - 1];
          if (lastToken && lastToken.type === "text") {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.text;
            this.inlineQueue.pop();
            this.inlineQueue[this.inlineQueue.length - 1].src = lastToken.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (src) {
          const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
          if (this.options.silent) {
            console.error(errMsg);
            break;
          } else {
            throw new Error(errMsg);
          }
        }
      }
      this.state.top = true;
      return tokens;
    }
    inline(src, tokens = []) {
      this.inlineQueue.push({ src, tokens });
      return tokens;
    }
    /**
     * Lexing/Compiling
     */
    inlineTokens(src, tokens = []) {
      let token, lastToken, cutSrc;
      let maskedSrc = src;
      let match;
      let keepPrevChar, prevChar;
      if (this.tokens.links) {
        const links = Object.keys(this.tokens.links);
        if (links.length > 0) {
          while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
            if (links.includes(match[0].slice(match[0].lastIndexOf("[") + 1, -1))) {
              maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
            }
          }
        }
      }
      while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
        maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
      }
      while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
        maskedSrc = maskedSrc.slice(0, match.index) + "++" + maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
      }
      while (src) {
        if (!keepPrevChar) {
          prevChar = "";
        }
        keepPrevChar = false;
        if (this.options.extensions && this.options.extensions.inline && this.options.extensions.inline.some((extTokenizer) => {
          if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            return true;
          }
          return false;
        })) {
          continue;
        }
        if (token = this.tokenizer.escape(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.tag(src)) {
          src = src.substring(token.raw.length);
          lastToken = tokens[tokens.length - 1];
          if (lastToken && token.type === "text" && lastToken.type === "text") {
            lastToken.raw += token.raw;
            lastToken.text += token.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (token = this.tokenizer.link(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.reflink(src, this.tokens.links)) {
          src = src.substring(token.raw.length);
          lastToken = tokens[tokens.length - 1];
          if (lastToken && token.type === "text" && lastToken.type === "text") {
            lastToken.raw += token.raw;
            lastToken.text += token.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.codespan(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.br(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.del(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.autolink(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (!this.state.inLink && (token = this.tokenizer.url(src))) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        cutSrc = src;
        if (this.options.extensions && this.options.extensions.startInline) {
          let startIndex = Infinity;
          const tempSrc = src.slice(1);
          let tempStart;
          this.options.extensions.startInline.forEach((getStartIndex) => {
            tempStart = getStartIndex.call({ lexer: this }, tempSrc);
            if (typeof tempStart === "number" && tempStart >= 0) {
              startIndex = Math.min(startIndex, tempStart);
            }
          });
          if (startIndex < Infinity && startIndex >= 0) {
            cutSrc = src.substring(0, startIndex + 1);
          }
        }
        if (token = this.tokenizer.inlineText(cutSrc)) {
          src = src.substring(token.raw.length);
          if (token.raw.slice(-1) !== "_") {
            prevChar = token.raw.slice(-1);
          }
          keepPrevChar = true;
          lastToken = tokens[tokens.length - 1];
          if (lastToken && lastToken.type === "text") {
            lastToken.raw += token.raw;
            lastToken.text += token.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (src) {
          const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
          if (this.options.silent) {
            console.error(errMsg);
            break;
          } else {
            throw new Error(errMsg);
          }
        }
      }
      return tokens;
    }
  };
  var _Renderer = class {
    options;
    constructor(options2) {
      this.options = options2 || _defaults;
    }
    code(code, infostring, escaped) {
      const lang = (infostring || "").match(/^\S*/)?.[0];
      code = code.replace(/\n$/, "") + "\n";
      if (!lang) {
        return "<pre><code>" + (escaped ? code : escape$1(code, true)) + "</code></pre>\n";
      }
      return '<pre><code class="language-' + escape$1(lang) + '">' + (escaped ? code : escape$1(code, true)) + "</code></pre>\n";
    }
    blockquote(quote) {
      return `<blockquote>
${quote}</blockquote>
`;
    }
    html(html2, block2) {
      return html2;
    }
    heading(text, level, raw) {
      return `<h${level}>${text}</h${level}>
`;
    }
    hr() {
      return "<hr>\n";
    }
    list(body, ordered, start) {
      const type = ordered ? "ol" : "ul";
      const startatt = ordered && start !== 1 ? ' start="' + start + '"' : "";
      return "<" + type + startatt + ">\n" + body + "</" + type + ">\n";
    }
    listitem(text, task, checked) {
      return `<li>${text}</li>
`;
    }
    checkbox(checked) {
      return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
    }
    paragraph(text) {
      return `<p>${text}</p>
`;
    }
    table(header, body) {
      if (body)
        body = `<tbody>${body}</tbody>`;
      return "<table>\n<thead>\n" + header + "</thead>\n" + body + "</table>\n";
    }
    tablerow(content) {
      return `<tr>
${content}</tr>
`;
    }
    tablecell(content, flags) {
      const type = flags.header ? "th" : "td";
      const tag2 = flags.align ? `<${type} align="${flags.align}">` : `<${type}>`;
      return tag2 + content + `</${type}>
`;
    }
    /**
     * span level renderer
     */
    strong(text) {
      return `<strong>${text}</strong>`;
    }
    em(text) {
      return `<em>${text}</em>`;
    }
    codespan(text) {
      return `<code>${text}</code>`;
    }
    br() {
      return "<br>";
    }
    del(text) {
      return `<del>${text}</del>`;
    }
    link(href, title, text) {
      const cleanHref = cleanUrl(href);
      if (cleanHref === null) {
        return text;
      }
      href = cleanHref;
      let out = '<a href="' + href + '"';
      if (title) {
        out += ' title="' + title + '"';
      }
      out += ">" + text + "</a>";
      return out;
    }
    image(href, title, text) {
      const cleanHref = cleanUrl(href);
      if (cleanHref === null) {
        return text;
      }
      href = cleanHref;
      let out = `<img src="${href}" alt="${text}"`;
      if (title) {
        out += ` title="${title}"`;
      }
      out += ">";
      return out;
    }
    text(text) {
      return text;
    }
  };
  var _TextRenderer = class {
    // no need for block level renderers
    strong(text) {
      return text;
    }
    em(text) {
      return text;
    }
    codespan(text) {
      return text;
    }
    del(text) {
      return text;
    }
    html(text) {
      return text;
    }
    text(text) {
      return text;
    }
    link(href, title, text) {
      return "" + text;
    }
    image(href, title, text) {
      return "" + text;
    }
    br() {
      return "";
    }
  };
  var _Parser = class __Parser {
    options;
    renderer;
    textRenderer;
    constructor(options2) {
      this.options = options2 || _defaults;
      this.options.renderer = this.options.renderer || new _Renderer();
      this.renderer = this.options.renderer;
      this.renderer.options = this.options;
      this.textRenderer = new _TextRenderer();
    }
    /**
     * Static Parse Method
     */
    static parse(tokens, options2) {
      const parser2 = new __Parser(options2);
      return parser2.parse(tokens);
    }
    /**
     * Static Parse Inline Method
     */
    static parseInline(tokens, options2) {
      const parser2 = new __Parser(options2);
      return parser2.parseInline(tokens);
    }
    /**
     * Parse Loop
     */
    parse(tokens, top = true) {
      let out = "";
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (this.options.extensions && this.options.extensions.renderers && this.options.extensions.renderers[token.type]) {
          const genericToken = token;
          const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
          if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
            out += ret || "";
            continue;
          }
        }
        switch (token.type) {
          case "space": {
            continue;
          }
          case "hr": {
            out += this.renderer.hr();
            continue;
          }
          case "heading": {
            const headingToken = token;
            out += this.renderer.heading(this.parseInline(headingToken.tokens), headingToken.depth, unescape(this.parseInline(headingToken.tokens, this.textRenderer)));
            continue;
          }
          case "code": {
            const codeToken = token;
            out += this.renderer.code(codeToken.text, codeToken.lang, !!codeToken.escaped);
            continue;
          }
          case "table": {
            const tableToken = token;
            let header = "";
            let cell = "";
            for (let j = 0; j < tableToken.header.length; j++) {
              cell += this.renderer.tablecell(this.parseInline(tableToken.header[j].tokens), { header: true, align: tableToken.align[j] });
            }
            header += this.renderer.tablerow(cell);
            let body = "";
            for (let j = 0; j < tableToken.rows.length; j++) {
              const row = tableToken.rows[j];
              cell = "";
              for (let k = 0; k < row.length; k++) {
                cell += this.renderer.tablecell(this.parseInline(row[k].tokens), { header: false, align: tableToken.align[k] });
              }
              body += this.renderer.tablerow(cell);
            }
            out += this.renderer.table(header, body);
            continue;
          }
          case "blockquote": {
            const blockquoteToken = token;
            const body = this.parse(blockquoteToken.tokens);
            out += this.renderer.blockquote(body);
            continue;
          }
          case "list": {
            const listToken = token;
            const ordered = listToken.ordered;
            const start = listToken.start;
            const loose = listToken.loose;
            let body = "";
            for (let j = 0; j < listToken.items.length; j++) {
              const item = listToken.items[j];
              const checked = item.checked;
              const task = item.task;
              let itemBody = "";
              if (item.task) {
                const checkbox = this.renderer.checkbox(!!checked);
                if (loose) {
                  if (item.tokens.length > 0 && item.tokens[0].type === "paragraph") {
                    item.tokens[0].text = checkbox + " " + item.tokens[0].text;
                    if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === "text") {
                      item.tokens[0].tokens[0].text = checkbox + " " + item.tokens[0].tokens[0].text;
                    }
                  } else {
                    item.tokens.unshift({
                      type: "text",
                      text: checkbox + " "
                    });
                  }
                } else {
                  itemBody += checkbox + " ";
                }
              }
              itemBody += this.parse(item.tokens, loose);
              body += this.renderer.listitem(itemBody, task, !!checked);
            }
            out += this.renderer.list(body, ordered, start);
            continue;
          }
          case "html": {
            const htmlToken = token;
            out += this.renderer.html(htmlToken.text, htmlToken.block);
            continue;
          }
          case "paragraph": {
            const paragraphToken = token;
            out += this.renderer.paragraph(this.parseInline(paragraphToken.tokens));
            continue;
          }
          case "text": {
            let textToken = token;
            let body = textToken.tokens ? this.parseInline(textToken.tokens) : textToken.text;
            while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
              textToken = tokens[++i];
              body += "\n" + (textToken.tokens ? this.parseInline(textToken.tokens) : textToken.text);
            }
            out += top ? this.renderer.paragraph(body) : body;
            continue;
          }
          default: {
            const errMsg = 'Token with "' + token.type + '" type was not found.';
            if (this.options.silent) {
              console.error(errMsg);
              return "";
            } else {
              throw new Error(errMsg);
            }
          }
        }
      }
      return out;
    }
    /**
     * Parse Inline Tokens
     */
    parseInline(tokens, renderer) {
      renderer = renderer || this.renderer;
      let out = "";
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (this.options.extensions && this.options.extensions.renderers && this.options.extensions.renderers[token.type]) {
          const ret = this.options.extensions.renderers[token.type].call({ parser: this }, token);
          if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(token.type)) {
            out += ret || "";
            continue;
          }
        }
        switch (token.type) {
          case "escape": {
            const escapeToken = token;
            out += renderer.text(escapeToken.text);
            break;
          }
          case "html": {
            const tagToken = token;
            out += renderer.html(tagToken.text);
            break;
          }
          case "link": {
            const linkToken = token;
            out += renderer.link(linkToken.href, linkToken.title, this.parseInline(linkToken.tokens, renderer));
            break;
          }
          case "image": {
            const imageToken = token;
            out += renderer.image(imageToken.href, imageToken.title, imageToken.text);
            break;
          }
          case "strong": {
            const strongToken = token;
            out += renderer.strong(this.parseInline(strongToken.tokens, renderer));
            break;
          }
          case "em": {
            const emToken = token;
            out += renderer.em(this.parseInline(emToken.tokens, renderer));
            break;
          }
          case "codespan": {
            const codespanToken = token;
            out += renderer.codespan(codespanToken.text);
            break;
          }
          case "br": {
            out += renderer.br();
            break;
          }
          case "del": {
            const delToken = token;
            out += renderer.del(this.parseInline(delToken.tokens, renderer));
            break;
          }
          case "text": {
            const textToken = token;
            out += renderer.text(textToken.text);
            break;
          }
          default: {
            const errMsg = 'Token with "' + token.type + '" type was not found.';
            if (this.options.silent) {
              console.error(errMsg);
              return "";
            } else {
              throw new Error(errMsg);
            }
          }
        }
      }
      return out;
    }
  };
  var _Hooks = class {
    options;
    constructor(options2) {
      this.options = options2 || _defaults;
    }
    static passThroughHooks = /* @__PURE__ */ new Set([
      "preprocess",
      "postprocess",
      "processAllTokens"
    ]);
    /**
     * Process markdown before marked
     */
    preprocess(markdown) {
      return markdown;
    }
    /**
     * Process HTML after marked is finished
     */
    postprocess(html2) {
      return html2;
    }
    /**
     * Process all tokens before walk tokens
     */
    processAllTokens(tokens) {
      return tokens;
    }
  };
  var Marked = class {
    defaults = _getDefaults();
    options = this.setOptions;
    parse = this.#parseMarkdown(_Lexer.lex, _Parser.parse);
    parseInline = this.#parseMarkdown(_Lexer.lexInline, _Parser.parseInline);
    Parser = _Parser;
    Renderer = _Renderer;
    TextRenderer = _TextRenderer;
    Lexer = _Lexer;
    Tokenizer = _Tokenizer;
    Hooks = _Hooks;
    constructor(...args) {
      this.use(...args);
    }
    /**
     * Run callback for every token
     */
    walkTokens(tokens, callback) {
      let values = [];
      for (const token of tokens) {
        values = values.concat(callback.call(this, token));
        switch (token.type) {
          case "table": {
            const tableToken = token;
            for (const cell of tableToken.header) {
              values = values.concat(this.walkTokens(cell.tokens, callback));
            }
            for (const row of tableToken.rows) {
              for (const cell of row) {
                values = values.concat(this.walkTokens(cell.tokens, callback));
              }
            }
            break;
          }
          case "list": {
            const listToken = token;
            values = values.concat(this.walkTokens(listToken.items, callback));
            break;
          }
          default: {
            const genericToken = token;
            if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
              this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
                const tokens2 = genericToken[childTokens].flat(Infinity);
                values = values.concat(this.walkTokens(tokens2, callback));
              });
            } else if (genericToken.tokens) {
              values = values.concat(this.walkTokens(genericToken.tokens, callback));
            }
          }
        }
      }
      return values;
    }
    use(...args) {
      const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
      args.forEach((pack) => {
        const opts = { ...pack };
        opts.async = this.defaults.async || opts.async || false;
        if (pack.extensions) {
          pack.extensions.forEach((ext) => {
            if (!ext.name) {
              throw new Error("extension name required");
            }
            if ("renderer" in ext) {
              const prevRenderer = extensions.renderers[ext.name];
              if (prevRenderer) {
                extensions.renderers[ext.name] = function(...args2) {
                  let ret = ext.renderer.apply(this, args2);
                  if (ret === false) {
                    ret = prevRenderer.apply(this, args2);
                  }
                  return ret;
                };
              } else {
                extensions.renderers[ext.name] = ext.renderer;
              }
            }
            if ("tokenizer" in ext) {
              if (!ext.level || ext.level !== "block" && ext.level !== "inline") {
                throw new Error("extension level must be 'block' or 'inline'");
              }
              const extLevel = extensions[ext.level];
              if (extLevel) {
                extLevel.unshift(ext.tokenizer);
              } else {
                extensions[ext.level] = [ext.tokenizer];
              }
              if (ext.start) {
                if (ext.level === "block") {
                  if (extensions.startBlock) {
                    extensions.startBlock.push(ext.start);
                  } else {
                    extensions.startBlock = [ext.start];
                  }
                } else if (ext.level === "inline") {
                  if (extensions.startInline) {
                    extensions.startInline.push(ext.start);
                  } else {
                    extensions.startInline = [ext.start];
                  }
                }
              }
            }
            if ("childTokens" in ext && ext.childTokens) {
              extensions.childTokens[ext.name] = ext.childTokens;
            }
          });
          opts.extensions = extensions;
        }
        if (pack.renderer) {
          const renderer = this.defaults.renderer || new _Renderer(this.defaults);
          for (const prop in pack.renderer) {
            if (!(prop in renderer)) {
              throw new Error(`renderer '${prop}' does not exist`);
            }
            if (prop === "options") {
              continue;
            }
            const rendererProp = prop;
            const rendererFunc = pack.renderer[rendererProp];
            const prevRenderer = renderer[rendererProp];
            renderer[rendererProp] = (...args2) => {
              let ret = rendererFunc.apply(renderer, args2);
              if (ret === false) {
                ret = prevRenderer.apply(renderer, args2);
              }
              return ret || "";
            };
          }
          opts.renderer = renderer;
        }
        if (pack.tokenizer) {
          const tokenizer = this.defaults.tokenizer || new _Tokenizer(this.defaults);
          for (const prop in pack.tokenizer) {
            if (!(prop in tokenizer)) {
              throw new Error(`tokenizer '${prop}' does not exist`);
            }
            if (["options", "rules", "lexer"].includes(prop)) {
              continue;
            }
            const tokenizerProp = prop;
            const tokenizerFunc = pack.tokenizer[tokenizerProp];
            const prevTokenizer = tokenizer[tokenizerProp];
            tokenizer[tokenizerProp] = (...args2) => {
              let ret = tokenizerFunc.apply(tokenizer, args2);
              if (ret === false) {
                ret = prevTokenizer.apply(tokenizer, args2);
              }
              return ret;
            };
          }
          opts.tokenizer = tokenizer;
        }
        if (pack.hooks) {
          const hooks = this.defaults.hooks || new _Hooks();
          for (const prop in pack.hooks) {
            if (!(prop in hooks)) {
              throw new Error(`hook '${prop}' does not exist`);
            }
            if (prop === "options") {
              continue;
            }
            const hooksProp = prop;
            const hooksFunc = pack.hooks[hooksProp];
            const prevHook = hooks[hooksProp];
            if (_Hooks.passThroughHooks.has(prop)) {
              hooks[hooksProp] = (arg) => {
                if (this.defaults.async) {
                  return Promise.resolve(hooksFunc.call(hooks, arg)).then((ret2) => {
                    return prevHook.call(hooks, ret2);
                  });
                }
                const ret = hooksFunc.call(hooks, arg);
                return prevHook.call(hooks, ret);
              };
            } else {
              hooks[hooksProp] = (...args2) => {
                let ret = hooksFunc.apply(hooks, args2);
                if (ret === false) {
                  ret = prevHook.apply(hooks, args2);
                }
                return ret;
              };
            }
          }
          opts.hooks = hooks;
        }
        if (pack.walkTokens) {
          const walkTokens2 = this.defaults.walkTokens;
          const packWalktokens = pack.walkTokens;
          opts.walkTokens = function(token) {
            let values = [];
            values.push(packWalktokens.call(this, token));
            if (walkTokens2) {
              values = values.concat(walkTokens2.call(this, token));
            }
            return values;
          };
        }
        this.defaults = { ...this.defaults, ...opts };
      });
      return this;
    }
    setOptions(opt) {
      this.defaults = { ...this.defaults, ...opt };
      return this;
    }
    lexer(src, options2) {
      return _Lexer.lex(src, options2 ?? this.defaults);
    }
    parser(tokens, options2) {
      return _Parser.parse(tokens, options2 ?? this.defaults);
    }
    #parseMarkdown(lexer2, parser2) {
      return (src, options2) => {
        const origOpt = { ...options2 };
        const opt = { ...this.defaults, ...origOpt };
        if (this.defaults.async === true && origOpt.async === false) {
          if (!opt.silent) {
            console.warn("marked(): The async option was set to true by an extension. The async: false option sent to parse will be ignored.");
          }
          opt.async = true;
        }
        const throwError = this.#onError(!!opt.silent, !!opt.async);
        if (typeof src === "undefined" || src === null) {
          return throwError(new Error("marked(): input parameter is undefined or null"));
        }
        if (typeof src !== "string") {
          return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
        }
        if (opt.hooks) {
          opt.hooks.options = opt;
        }
        if (opt.async) {
          return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src).then((src2) => lexer2(src2, opt)).then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens).then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens).then((tokens) => parser2(tokens, opt)).then((html2) => opt.hooks ? opt.hooks.postprocess(html2) : html2).catch(throwError);
        }
        try {
          if (opt.hooks) {
            src = opt.hooks.preprocess(src);
          }
          let tokens = lexer2(src, opt);
          if (opt.hooks) {
            tokens = opt.hooks.processAllTokens(tokens);
          }
          if (opt.walkTokens) {
            this.walkTokens(tokens, opt.walkTokens);
          }
          let html2 = parser2(tokens, opt);
          if (opt.hooks) {
            html2 = opt.hooks.postprocess(html2);
          }
          return html2;
        } catch (e) {
          return throwError(e);
        }
      };
    }
    #onError(silent, async) {
      return (e) => {
        e.message += "\nPlease report this to https://github.com/markedjs/marked.";
        if (silent) {
          const msg = "<p>An error occurred:</p><pre>" + escape$1(e.message + "", true) + "</pre>";
          if (async) {
            return Promise.resolve(msg);
          }
          return msg;
        }
        if (async) {
          return Promise.reject(e);
        }
        throw e;
      };
    }
  };
  var markedInstance = new Marked();
  function marked(src, opt) {
    return markedInstance.parse(src, opt);
  }
  marked.options = marked.setOptions = function(options2) {
    markedInstance.setOptions(options2);
    marked.defaults = markedInstance.defaults;
    changeDefaults(marked.defaults);
    return marked;
  };
  marked.getDefaults = _getDefaults;
  marked.defaults = _defaults;
  marked.use = function(...args) {
    markedInstance.use(...args);
    marked.defaults = markedInstance.defaults;
    changeDefaults(marked.defaults);
    return marked;
  };
  marked.walkTokens = function(tokens, callback) {
    return markedInstance.walkTokens(tokens, callback);
  };
  marked.parseInline = markedInstance.parseInline;
  marked.Parser = _Parser;
  marked.parser = _Parser.parse;
  marked.Renderer = _Renderer;
  marked.TextRenderer = _TextRenderer;
  marked.Lexer = _Lexer;
  marked.lexer = _Lexer.lex;
  marked.Tokenizer = _Tokenizer;
  marked.Hooks = _Hooks;
  marked.parse = marked;
  var options = marked.options;
  var setOptions = marked.setOptions;
  var use = marked.use;
  var walkTokens = marked.walkTokens;
  var parseInline = marked.parseInline;
  var parser = _Parser.parse;
  var lexer = _Lexer.lex;

  // ts/xmlNamespaces.ts
  function ns(name) {
    return {
      svg: "http://www.w3.org/2000/svg",
      xhtml: "http://www.w3.org/1999/xhtml",
      xlink: "http://www.w3.org/1999/xlink",
      inkscape: "http://www.inkscape.org/namespaces/inkscape",
      sodipodi: "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd",
      slidie: "http://xmlns.jhnet.co.uk/slidie/1.0"
    }[name];
  }

  // ts/eventFilters.ts
  function eventInvolvesHyperlinkOrButton(evt) {
    for (const elem of evt.composedPath()) {
      if ((elem.namespaceURI == ns("xhtml") || elem.namespaceURI == ns("svg")) && elem.localName == "a" || elem.namespaceURI == ns("xhtml") && elem.localName == "button") {
        return true;
      }
    }
    return false;
  }
  function eventInvolvesInput(evt) {
    for (const elem of evt.composedPath()) {
      if (elem.namespaceURI == ns("xhtml") && elem.localName == "input") {
        return true;
      }
    }
    return false;
  }
  function keyboardEventInterferesWithElement(evt) {
    if (eventInvolvesInput(evt)) {
      return true;
    }
    switch (evt.key) {
      case "Enter":
      case "Space":
        return eventInvolvesHyperlinkOrButton(evt);
      default:
        return false;
    }
  }

  // ts/foreignObjectScaling.ts
  function getSvgStaticCTM(elem) {
    const parents = [elem];
    while (parents[0].parentElement) {
      parents.splice(
        0,
        0,
        parents[0].parentElement
      );
    }
    parents.splice(0, 1);
    const ctm = new DOMMatrix();
    for (const elem2 of parents) {
      for (const transform of elem2.transform.baseVal) {
        ctm.multiplySelf(transform.matrix);
      }
    }
    return ctm;
  }
  function getSvgUserUnitSize(svg) {
    if (svg.viewBox.baseVal === null) {
      return [1, 1];
    }
    const svgWidth = svg.width.baseVal.value;
    const svgHeight = svg.height.baseVal.value;
    const svgVBWidth = svg.viewBox.baseVal.width;
    const svgVBHeight = svg.viewBox.baseVal.height;
    const hScale = svgWidth / svgVBWidth;
    const vScale = svgHeight / svgVBHeight;
    const par = svg.preserveAspectRatio.baseVal;
    if (par.align === SVGPreserveAspectRatio.SVG_PRESERVEASPECTRATIO_NONE) {
      return [hScale, vScale];
    } else {
      const viewBoxWiderThanSVG = svgVBWidth / svgVBHeight > svgWidth / svgHeight;
      const meet = par.meetOrSlice === SVGPreserveAspectRatio.SVG_MEETORSLICE_MEET;
      if (meet == viewBoxWiderThanSVG) {
        return [hScale, hScale];
      } else {
        return [vScale, vScale];
      }
    }
  }
  function getForeignObjectSizePx(elem) {
    const ctm = getSvgStaticCTM(elem);
    const [sx, sy] = getSvgUserUnitSize(elem.ownerSVGElement);
    ctm.scaleSelf(sx, sy);
    const topLeft = ctm.transformPoint(
      new DOMPoint(elem.x.baseVal.value, elem.y.baseVal.value)
    );
    const topRight = ctm.transformPoint(
      new DOMPoint(
        elem.x.baseVal.value + elem.width.baseVal.value,
        elem.y.baseVal.value
      )
    );
    const bottomLeft = ctm.transformPoint(
      new DOMPoint(
        elem.x.baseVal.value,
        elem.y.baseVal.value + elem.height.baseVal.value
      )
    );
    const dxW = topRight.x - topLeft.x;
    const dyW = topRight.y - topLeft.y;
    const width = Math.sqrt(dxW * dxW + dyW * dyW);
    const dxH = bottomLeft.x - topLeft.x;
    const dyH = bottomLeft.y - topLeft.y;
    const height = Math.sqrt(dxH * dxH + dyH * dyH);
    return [width, height];
  }
  function scaleForeignObjectContents(foreignObject, scale = 1) {
    const [widthPx, heightPx] = getForeignObjectSizePx(foreignObject);
    const width = widthPx / scale;
    const height = heightPx / scale;
    const widthOrig = parseFloat(foreignObject.getAttribute("width"));
    const heightOrig = parseFloat(foreignObject.getAttribute("height"));
    foreignObject.setAttribute("width", width.toString());
    foreignObject.setAttribute("height", height.toString());
    const sx = widthOrig / width;
    const sy = heightOrig / height;
    const x = parseFloat(foreignObject.getAttribute("x") || "0");
    const y = parseFloat(foreignObject.getAttribute("y") || "0");
    foreignObject.removeAttribute("x");
    foreignObject.removeAttribute("y");
    const existingTransform = foreignObject.getAttribute("transform") || "";
    foreignObject.setAttribute(
      "transform",
      `${existingTransform} translate(${x}, ${y}) scale(${sx}, ${sy})`
    );
  }
  function setupForeignObjectScaling(svg) {
    for (const foreignObject of svg.getElementsByTagNameNS(
      ns("svg"),
      "foreignObject"
    )) {
      if (foreignObject.hasAttributeNS(ns("slidie"), "scale")) {
        const scale = parseFloat(
          foreignObject.getAttributeNS(ns("slidie"), "scale")
        );
        scaleForeignObjectContents(foreignObject, scale);
      }
    }
  }

  // ts/keyboard.ts
  function matchKeypress(evt, shortcuts) {
    if (evt.altKey || evt.ctrlKey || evt.metaKey) {
      return null;
    }
    for (const entry of shortcuts) {
      for (const key of entry.keys) {
        if (key.match(/^[a-zA-Z]$/) !== null) {
          if (key.toLowerCase() == evt.key.toLowerCase()) {
            return entry;
          }
        } else if (key == evt.key) {
          return entry;
        }
      }
    }
    return null;
  }

  // ts/stopwatch.ts
  function formatDuration(milliseconds) {
    let seconds = Math.floor(milliseconds / 1e3);
    const hours = Math.floor(seconds / (60 * 60));
    seconds -= hours * 60 * 60;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    const hh = hours.toString();
    const mm = minutes.toString().padStart(2, "0");
    const ss = seconds.toString().padStart(2, "0");
    if (hours > 0) {
      return `${hh}:${mm}:${ss}`;
    } else {
      return `${minutes}:${ss}`;
    }
  }
  var Stopwatch = class {
    constructor(timerRunning = false) {
      this.timerStart = Date.now();
      this.timerEnd = this.timerStart;
      this.timerRunning = timerRunning;
    }
    get running() {
      return this.timerRunning;
    }
    /** Pause the timer. */
    pause() {
      if (this.timerRunning) {
        this.timerEnd = Date.now();
        this.timerRunning = false;
      }
    }
    /** Resume the timer. */
    resume() {
      if (!this.timerRunning) {
        const now = Date.now();
        this.timerStart += now - this.timerEnd;
        this.timerEnd = now;
        this.timerRunning = true;
      }
    }
    /** Toggle the pause state. Returns 'true' iff now running. */
    togglePause() {
      if (this.timerRunning) {
        this.pause();
      } else {
        this.resume();
      }
      return this.timerRunning;
    }
    /** Reset the timer */
    reset() {
      this.timerStart = Date.now();
      this.timerEnd = this.timerStart;
    }
    /** Return the number of milliseconds on the timer. */
    read() {
      if (this.timerRunning) {
        this.timerEnd = Date.now();
      }
      return this.timerEnd - this.timerStart;
    }
  };

  // ts/buildSteps.ts
  function findBuildSteps(svgRoot) {
    const out = [];
    for (const elem of svgRoot.querySelectorAll("*")) {
      if (elem.namespaceURI == ns("svg") && elem.hasAttributeNS(ns("slidie"), "steps")) {
        const stepNumbers = JSON.parse(
          elem.getAttributeNS(ns("slidie"), "steps")
        );
        const tags = JSON.parse(
          elem.getAttributeNS(ns("slidie"), "tags") || "[]"
        );
        out.push({
          elem,
          stepNumbers,
          tags,
          steps: []
          // Placeholder, populated below
        });
      }
    }
    const firstStepNumber = Math.min(
      ...out.map(({ stepNumbers }) => stepNumbers).flat().concat([0])
    );
    for (const obj of out) {
      obj.steps = obj.stepNumbers.map((n) => n - firstStepNumber);
    }
    return out;
  }
  function layerStepNumbers(layerSteps) {
    const allSteps = layerSteps.map(({ stepNumbers }) => stepNumbers).flat().concat([0]);
    const first = Math.min(...allSteps);
    const last = Math.max(...allSteps);
    const out = [];
    for (let i = first; i <= last; i++) {
      out.push(i);
    }
    return out;
  }
  function layerStepTags(layerSteps) {
    const map = /* @__PURE__ */ new Map();
    for (const { steps, tags } of layerSteps) {
      for (const tag2 of tags) {
        if (!map.has(tag2)) {
          map.set(tag2, []);
        }
        for (const step of steps) {
          if (map.get(tag2).indexOf(step) == -1) {
            map.get(tag2).push(step);
          }
        }
        map.get(tag2).sort();
      }
    }
    return map;
  }

  // ts/urlHashes.ts
  function toUrlHash(slide, step = 0) {
    if (step == 0) {
      return `#${slide + 1}`;
    } else {
      return `#${slide + 1}#${step + 1}`;
    }
  }
  var LINK_REGEX = new RegExp(
    "^#(?:(?<slideIndex>[0-9]+)|(?<slideId>[^0-9#@<][^#@<]*))?(?:(?:#(?<stepIndex>[0-9]+))|(?:<(?<stepNumber>[-+]?[0-9]+)>)|(?:@(?<stepTag>[^\\s<>.@]+)))?$"
  );
  function parseUrlHash(hash, currentSlide, slideIds, slideStepNumbers, slideTags) {
    const match = LINK_REGEX.exec(hash);
    if (match === null) {
      return null;
    }
    const groups = match.groups;
    let slide = currentSlide;
    if (groups.slideIndex !== void 0) {
      slide = parseInt(groups.slideIndex) - 1;
    } else if (groups.slideId !== void 0) {
      const slideId = groups.slideId;
      if (slideIds.has(slideId)) {
        slide = slideIds.get(slideId);
      } else {
        return null;
      }
    }
    if (slide < 0 || slide >= slideStepNumbers.length) {
      return null;
    }
    let step = 0;
    if (groups.stepIndex !== void 0) {
      step = parseInt(groups.stepIndex) - 1;
    } else if (groups.stepNumber !== void 0) {
      step = slideStepNumbers[slide].indexOf(parseInt(groups.stepNumber));
      if (step < 0) {
        step = 0;
      }
    } else if (groups.stepTag !== void 0) {
      const tag2 = groups.stepTag;
      if (slideTags[slide].has(tag2)) {
        step = slideTags[slide].get(tag2)[0];
      }
    }
    return [slide, step];
  }
  function enumerateAbsoluteHashes(slides) {
    const out = [];
    for (const [slideNum, slide] of slides.entries()) {
      const slideValues = [`#${slideNum + 1}`];
      if (slide.hasAttributeNS(ns("slidie"), "id")) {
        slideValues.push(`#${slide.getAttributeNS(ns("slidie"), "id")}`);
      }
      const stepValues = [];
      const layerSteps = findBuildSteps(slide);
      for (const [step, stepNumber] of layerStepNumbers(layerSteps).entries()) {
        stepValues.push(`#${step + 1}`);
        stepValues.push(`<${stepNumber}>`);
      }
      for (const tag2 of layerStepTags(layerSteps).keys()) {
        stepValues.push(`@${tag2}`);
      }
      for (const slideValue of slideValues) {
        out.push(`${slideValue}`);
        for (const stepValue of stepValues) {
          out.push(`${slideValue}${stepValue}`);
        }
      }
    }
    return out;
  }

  // ts/presenterView.ts
  function openOrFocusWindow(url, target, windowFeatures = "") {
    const existingWindows = openOrFocusWindow.existingWindows || /* @__PURE__ */ new Map();
    openOrFocusWindow.existingWindows = existingWindows;
    const existingWindow = existingWindows.get(target);
    if (existingWindow && !existingWindow.closed) {
      existingWindow.focus();
      return [existingWindow, false];
    }
    const wnd = window.open(url, target, windowFeatures);
    existingWindows.set(target, wnd);
    return [wnd, true];
  }
  function connectStepperToPresenterViewSlideNumber(stepper, slides, presenterViewDocument) {
    const slideCount = presenterViewDocument.querySelector(
      "#slide-count"
    );
    const slideNumber = presenterViewDocument.querySelector(
      "#slide-number"
    );
    slideCount.innerText = slides.svgs.length.toString();
    function showSlideNumber(state) {
      slideNumber.innerText = toUrlHash(state.slide, state.step).slice(1);
    }
    stepper.onChange(showSlideNumber);
    showSlideNumber(stepper.state);
  }
  function connectStepperToPresenterViewThumbnails(stepper, slides, presenterViewDocument) {
    const flatThumbnails = Array.from(
      document.querySelectorAll("#thumbnails .thumbnail img")
    );
    const thumbnails = slides.buildStepNumbers.map(
      (stepNumbers) => stepNumbers.map(() => ({
        now: flatThumbnails.shift(),
        next: flatThumbnails[0] || null
      }))
    );
    const nowImage = presenterViewDocument.getElementById(
      "thumbnail-now"
    );
    const nextImage = presenterViewDocument.getElementById(
      "thumbnail-next"
    );
    function showNowNextThumbnails(state) {
      const { now, next } = thumbnails[state.slide][state.step];
      nowImage.src = now.src;
      if (next !== null) {
        nextImage.src = next.src;
      } else {
        nextImage.src = "";
      }
    }
    stepper.onChange(showNowNextThumbnails);
    showNowNextThumbnails(stepper.state);
  }
  function connectStopwatchToPresenterView(stopwatch, presenterViewDocument) {
    const clockElem = presenterViewDocument.getElementById("clock");
    const timerElem = presenterViewDocument.getElementById("timer");
    const pauseButton = presenterViewDocument.getElementById("timer-pause");
    const resetButton = presenterViewDocument.getElementById("timer-reset");
    function updateTimers() {
      clockElem.innerText = (/* @__PURE__ */ new Date()).toLocaleTimeString();
      timerElem.innerText = formatDuration(stopwatch.read());
      if (stopwatch.running) {
        pauseButton.innerText = "Pause";
        pauseButton.classList.add("pause");
        pauseButton.classList.remove("resume");
      } else {
        if (stopwatch.read() == 0) {
          pauseButton.innerText = "Start";
        } else {
          pauseButton.innerText = "Resume";
        }
        pauseButton.classList.add("resume");
        pauseButton.classList.remove("pause");
      }
    }
    window.setInterval(updateTimers, 1e3);
    updateTimers();
    pauseButton.addEventListener("click", (evt) => {
      stopwatch.togglePause();
      updateTimers();
      evt.stopPropagation();
    });
    resetButton.addEventListener("click", (evt) => {
      stopwatch.reset();
      updateTimers();
      evt.stopPropagation();
    });
  }
  var PRESENTER_VIEW_KEYBOARD_SHORTCUTS = [
    {
      description: "Show help",
      keys: ["F1", "?"],
      action: (helpDialog) => toggleDialog(helpDialog)
    }
  ];
  function cloneEvent(evt) {
    return new evt.constructor(evt.type, evt);
  }
  function setupPresenterViewKeyboardShortcuts(presenterViewWindow, helpDialog) {
    presenterViewWindow.addEventListener("keydown", (evt) => {
      if (keyboardEventInterferesWithElement(evt)) {
        return;
      }
      const match = matchKeypress(evt, PRESENTER_VIEW_KEYBOARD_SHORTCUTS);
      if (match !== null) {
        match.action(helpDialog);
        evt.preventDefault();
        evt.stopPropagation();
      } else {
        window.dispatchEvent(cloneEvent(evt));
      }
    });
  }
  function showPresenterView(stepper, slides, stopwatch) {
    const [wnd, newlyOpened] = openOrFocusWindow(
      "",
      "presenter-view",
      "popup=true"
    );
    if (!newlyOpened) {
      return;
    }
    window.addEventListener("pagehide", () => wnd.close());
    const presenterViewTemplaate = document.getElementById(
      "presenter-view-template"
    );
    const root = presenterViewTemplaate.content.cloneNode(true).firstElementChild;
    wnd.document.removeChild(wnd.document.firstElementChild);
    wnd.document.appendChild(root);
    const helpDialog = document.getElementById("help").cloneNode(true);
    helpDialog.close();
    wnd.document.body.appendChild(helpDialog);
    connectStepperToPresenterViewSlideNumber(stepper, slides, wnd.document);
    connectStepperToSpeakerNotes(
      stepper,
      slides,
      wnd.document.getElementById("notes")
    );
    connectStepperToPresenterViewThumbnails(stepper, slides, wnd.document);
    connectStopwatchToPresenterView(stopwatch, wnd.document);
    setupMouseClicks(stepper, wnd);
    setupPresenterViewKeyboardShortcuts(wnd, helpDialog);
  }

  // ts/resizeOnBorderDrag.ts
  function resizeOnBorderDrag(elem) {
    elem.addEventListener("mousemove", (evt) => {
      if (evt.offsetX - elem.clientWidth >= 0) {
        elem.style.cursor = "ew-resize";
      } else if (evt.offsetY < 0) {
        elem.style.cursor = "ns-resize";
      } else {
        elem.style.cursor = "auto";
      }
    });
    elem.addEventListener("mousedown", (evt) => {
      const style = getComputedStyle(elem);
      let adjust;
      let scale;
      if (style.borderRightStyle == "solid") {
        if (evt.offsetX - elem.clientWidth < 0) {
          return;
        }
        adjust = "width";
        scale = 1;
      } else if (style.borderTopStyle == "solid") {
        if (evt.offsetY >= 0) {
          return;
        }
        adjust = "height";
        scale = -1;
      } else {
        console.warn("Not implemented: Adjusting bottom/left edges!");
      }
      evt.preventDefault();
      evt.stopPropagation();
      let lastX = evt.clientX;
      let lastY = evt.clientY;
      let width = elem.offsetWidth;
      let height = elem.offsetHeight;
      function onMouseMove(evt2) {
        const deltaX = evt2.clientX - lastX;
        const deltaY = evt2.clientY - lastY;
        lastX = evt2.clientX;
        lastY = evt2.clientY;
        if (adjust == "width") {
          width += deltaX * scale;
          elem.style.width = `${width}px`;
        } else if (adjust == "height") {
          height += deltaY * scale;
          elem.style.height = `${height}px`;
        }
        evt2.preventDefault();
        evt2.stopPropagation();
      }
      function onMouseUp(evt2) {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        evt2.preventDefault();
        evt2.stopPropagation();
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }

  // ts/setClassWhileMouseIdle.ts
  function setClassWhileMouseIdle(elem, className = "mouse-idle", timeout = 2e3) {
    let timeoutId = null;
    elem.addEventListener("mousemove", () => {
      elem.classList.remove(className);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        elem.classList.add(className);
        timeoutId = null;
      }, timeout);
    });
  }

  // ts/slideChangeEvents.ts
  var SlideChangeEvent = class extends Event {
    constructor(type, state, slides) {
      super(type, {
        // Don't bubble out of the SVG's shadow DOM
        composed: false,
        // The change has already occurred by the time this event is fired
        cancelable: false,
        // Allow bubbling up to the window of the shadow DOM
        bubbles: true
      });
      this.slide = state.slide;
      this.step = state.step;
      this.stepNumber = slides.buildStepNumbers[state.slide][state.step];
      this.tags = [];
      for (const [tag2, steps] of slides.buildStepTags[state.slide].entries()) {
        if (steps.indexOf(state.step) >= 0) {
          this.tags.push(tag2);
        }
      }
    }
  };
  function connectStepperToSlideEvents(stepper, slides) {
    function dispatchEvents(state, lastState) {
      const svg = slides.svgs[state.slide];
      if (lastState === null || state.slide != lastState.slide) {
        svg.dispatchEvent(new SlideChangeEvent("slideenter", state, slides));
        if (lastState !== null) {
          const lastSvg = slides.svgs[lastState.slide];
          lastSvg.dispatchEvent(
            new SlideChangeEvent("slideleave", state, slides)
          );
        }
      }
      if (lastState !== null && state.slide == lastState.slide && state.step != lastState.step) {
        svg.dispatchEvent(new SlideChangeEvent("stepchange", state, slides));
      }
      if (lastState !== null) {
        if (state.blanked && !lastState.blanked) {
          svg.dispatchEvent(new SlideChangeEvent("slideblank", state, slides));
        }
        if (!state.blanked && lastState.blanked) {
          const lastSvg = slides.svgs[lastState.slide];
          lastSvg.dispatchEvent(
            new SlideChangeEvent("slideunblank", state, slides)
          );
        }
      }
    }
    dispatchEvents(stepper.state, null);
    stepper.onChange(dispatchEvents);
  }

  // ts/slideLookups.ts
  function getSlideId(svg) {
    if (svg.hasAttributeNS(ns("slidie"), "id")) {
      return svg.getAttributeNS(ns("slidie"), "id");
    } else {
      return null;
    }
  }
  function makeIdToSlideLookup(slides) {
    return new Map(
      slides.map((svg, slide) => [getSlideId(svg), slide]).filter(([id]) => id !== null)
    );
  }
  var SlideLookups = class {
    /**
     * Takes the SVGs (one per slide) and their corresponding container elements,
     * e.g. as produced by loadSlidesIntoContainers.
     */
    constructor(svgs, containers) {
      this.svgs = svgs;
      this.containers = containers;
      this.buildSteps = this.svgs.map((slide) => findBuildSteps(slide));
      this.buildStepTags = this.buildSteps.map(
        (buildSteps) => layerStepTags(buildSteps)
      );
      this.buildStepNumbers = this.buildSteps.map(
        (buildSteps) => layerStepNumbers(buildSteps)
      );
      this.buildStepCounts = this.buildStepNumbers.map(
        (numbers) => numbers.length
      );
      this.ids = makeIdToSlideLookup(this.svgs);
    }
  };

  // ts/speakerNotes.ts
  function getSpeakerNotes(svgRoot) {
    const out = [];
    for (const parentElem of svgRoot.getElementsByTagNameNS(
      ns("slidie"),
      "notes"
    )) {
      for (const elem of parentElem.getElementsByTagNameNS(
        ns("slidie"),
        "note"
      )) {
        let stepNumbers = null;
        if (elem.hasAttribute("steps")) {
          stepNumbers = JSON.parse(elem.getAttribute("steps"));
        }
        const text = elem.innerHTML;
        out.push({ stepNumbers, text });
      }
    }
    return out;
  }

  // ts/stepper.ts
  var Stepper = class {
    /**
     * The slideStepCounts parameter gives the number of build steps for each
     * slide.
     *
     * The initial slide and step (indices) set the initial slide/step to show.
     */
    constructor(slideStepCounts, initialSlide = 0, initialStep = 0) {
      if (slideStepCounts.length < 1) {
        throw new Error("Slide show must have at least one slide.");
      }
      this.slideStepCounts = slideStepCounts;
      this.blanked = false;
      this.userUrlHash = null;
      this.onChangeCallbacks = [];
      this.curSlide = 0;
      this.curStep = 0;
      this.show(initialSlide, initialStep);
    }
    /**
     * The current state of the stepper.
     */
    get state() {
      return {
        slide: this.curSlide,
        step: this.curStep,
        blanked: this.blanked,
        userUrlHash: this.userUrlHash
      };
    }
    /**
     * Register a callback function to be called when the stepper's state
     * changes.
     */
    onChange(callback) {
      this.onChangeCallbacks.push(callback);
    }
    /**
     * Show a particular slide/step.
     *
     * If a userUrlHash is given, it will be included in any reported states. Its
     * validity is not verified and is not interpreted in any way.
     *
     * Returns true iff the slide was valid and we've advanced to that point,
     * false otherwise (we'll stay where we are).
     */
    show(slide, step = 0, userUrlHash = null) {
      const beforeState = this.state;
      if (slide < 0 || slide >= this.slideStepCounts.length || step < 0 || step >= this.slideStepCounts[slide]) {
        return false;
      }
      const slideChanged = this.curSlide !== slide;
      const stepChanged = this.curStep !== step;
      const blankedChanged = this.blanked !== false;
      this.curSlide = slide;
      this.curStep = step;
      this.blanked = false;
      let userUrlHashChanged = false;
      if (slideChanged || stepChanged || userUrlHash !== null) {
        userUrlHashChanged = this.userUrlHash !== userUrlHash;
        this.userUrlHash = userUrlHash;
      }
      if (slideChanged || stepChanged || blankedChanged || userUrlHashChanged) {
        for (const cb of this.onChangeCallbacks) {
          cb(this.state, beforeState);
        }
      }
      return true;
    }
    /**
     * Toggle blanking of the show. Returns true iff now blanked.
     *
     * NB: Blanking is automatically disabled when the slide/step is changed.
     */
    toggleBlank() {
      const beforeState = this.state;
      this.blanked = !this.blanked;
      const afterState = this.state;
      for (const cb of this.onChangeCallbacks) {
        cb(afterState, beforeState);
      }
      return this.blanked;
    }
    /** Advance to the next step (and then slide). Returns true iff one exists. */
    nextStep() {
      let slide = this.curSlide;
      let step = this.curStep;
      if (this.blanked) {
      } else if (step + 1 < this.slideStepCounts[slide]) {
        step += 1;
      } else if (slide + 1 < this.slideStepCounts.length) {
        step = 0;
        slide += 1;
      } else {
        return false;
      }
      return this.show(slide, step);
    }
    /**
     * Advance to the first step of the next slide (skipping any remaining build
     * steps on the current slide). Returns true iff one exists.
     */
    nextSlide() {
      let slide = this.curSlide;
      let step = this.curStep;
      if (this.blanked) {
      } else if (slide + 1 < this.slideStepCounts.length) {
        step = 0;
        slide += 1;
      } else {
        return false;
      }
      return this.show(slide, step);
    }
    /** Return to the previous step (and then slide). Returns true iff one exists. */
    previousStep() {
      let slide = this.curSlide;
      let step = this.curStep;
      if (this.blanked) {
      } else if (step - 1 >= 0) {
        step -= 1;
      } else if (slide - 1 >= 0) {
        slide -= 1;
        step = this.slideStepCounts[slide] - 1;
      } else {
        return false;
      }
      return this.show(slide, step);
    }
    /**
     * Return to the first step of the current slide if not already on it.
     * Otherwise, returns to the first step of the previous slide (skipping any
     * interevening build steps on the current slide). Returns true iff one
     * exists.
     */
    previousSlide() {
      let slide = this.curSlide;
      let step = this.curStep;
      if (this.blanked) {
      } else if (step > 0) {
        step = 0;
      } else if (slide - 1 >= 0) {
        slide -= 1;
        step = 0;
      } else {
        return false;
      }
      return this.show(slide, step);
    }
    /**
     * Go to the first build step of the first slide.
     */
    start() {
      return this.show(0, 0);
    }
    /**
     * Go to the last build step of the last slide.
     */
    end() {
      const lastSlide = this.slideStepCounts.length - 1;
      const lastStep = this.slideStepCounts[lastSlide] - 1;
      return this.show(lastSlide, lastStep);
    }
  };

  // ts/thumbnails.ts
  function getThumbnails(svgRoot) {
    const out = [];
    for (const parentElem of svgRoot.getElementsByTagNameNS(
      ns("slidie"),
      "thumbnails"
    )) {
      for (const elem of parentElem.getElementsByTagNameNS(
        ns("slidie"),
        "thumbnail"
      )) {
        const stepNumber = JSON.parse(elem.getAttribute("step"));
        const type = elem.getAttribute("type");
        const encoding = elem.getAttribute("encoding");
        const codedData = elem.innerHTML;
        const dataUrl = `data:${type};${encoding},${codedData}`;
        out.push({ stepNumber, dataUrl });
      }
    }
    return out;
  }

  // ts/video.ts
  function setupMagicVideoPlayback(slide) {
    for (const video of slide.getElementsByTagNameNS(
      ns("xhtml"),
      "video"
    )) {
      if (video.hasAttributeNS(ns("slidie"), "magic")) {
        const start = parseFloat(
          video.getAttributeNS(ns("slidie"), "start") || "0"
        );
        const stepNumbers = JSON.parse(
          video.getAttributeNS(ns("slidie"), "steps") || "null"
        );
        video.currentTime = start;
        const onEnterOrChange = ({ stepNumber }) => {
          if (stepNumbers === null || stepNumbers.indexOf(stepNumber) >= 0) {
            video.play();
          } else {
            video.pause();
            video.currentTime = start;
          }
        };
        slide.addEventListener("slideenter", onEnterOrChange);
        slide.addEventListener("stepchange", onEnterOrChange);
        slide.addEventListener("slideleave", () => {
          video.pause();
          video.currentTime = start;
        });
      }
    }
  }

  // ts/workarounds.ts
  function workaroundDeclarativeShadowDOMXHTMLBug(root = document) {
    for (const template of root.querySelectorAll(
      "template[shadowrootmode]"
    )) {
      if (template.namespaceURI === ns("xhtml")) {
        const parentNode = workaroundAttachShadowToNamespacedNodeBug(
          template.parentNode
        );
        const mode = template.getAttribute("shadowrootmode");
        const shadowRoot = parentNode.attachShadow({ mode });
        shadowRoot.appendChild(template.content);
        template.remove();
        workaroundVideoMovedFromTemplateBug(shadowRoot);
        workaroundDeclarativeShadowDOMXHTMLBug(shadowRoot);
      }
    }
  }
  function workaroundVideoMovedFromTemplateBug(root) {
    for (const videoElem of root.querySelectorAll("video")) {
      if (videoElem.namespaceURI === ns("xhtml")) {
        const innerHTML = videoElem.innerHTML;
        videoElem.innerHTML = "";
        videoElem.innerHTML = innerHTML;
      }
    }
  }
  function workaroundAttachShadowToNamespacedNodeBug(elem) {
    const replacement = elem.ownerDocument.createElementNS(
      elem.namespaceURI,
      elem.localName
    );
    elem.parentNode.insertBefore(replacement, elem);
    for (let i = 0; i < elem.attributes.length; i++) {
      const { namespaceURI, localName } = elem.attributes.item(i);
      replacement.attributes.setNamedItemNS(
        elem.attributes.removeNamedItemNS(namespaceURI, localName)
      );
    }
    replacement.append(...elem.childNodes);
    elem.remove();
    return replacement;
  }
  function workaroundSVGLinkTargetBug(svg) {
    const iframes = /* @__PURE__ */ new Map();
    for (const iframe of svg.getElementsByTagNameNS(
      ns("xhtml"),
      "iframe"
    )) {
      const name = iframe.getAttribute("name");
      if (name) {
        iframes.set(name, iframe);
      }
    }
    for (const link2 of svg.getElementsByTagNameNS(ns("svg"), "a")) {
      link2.addEventListener("click", (evt) => {
        const href = link2.getAttributeNS(ns("xlink"), "href") || link2.getAttribute("href");
        const target = link2.getAttribute("target");
        if (href && target) {
          const iframe = iframes.get(target);
          if (iframe) {
            iframe.contentWindow.location = href;
            evt.preventDefault();
          }
        }
      });
    }
  }

  // ts/app.ts
  function findSlides() {
    const containers = Array.from(
      document.querySelectorAll("#slides .slide-container")
    );
    const svgs = containers.map(
      (container) => container.shadowRoot.firstElementChild
    );
    return new SlideLookups(svgs, containers);
  }
  function connectStepperToSlideVisibility(stepper, slides) {
    function updateVisibility(state) {
      for (const [slide, container] of slides.containers.entries()) {
        container.style.visibility = state.blanked ? "hidden" : "visible";
        container.style.display = state.slide == slide ? "block" : "none";
      }
      for (const build of slides.buildSteps[state.slide]) {
        build.elem.style.display = build.steps.indexOf(state.step) >= 0 ? "block" : "none";
      }
    }
    updateVisibility(stepper.state);
    stepper.onChange(updateVisibility);
  }
  function makeViewerPanesResizable() {
    resizeOnBorderDrag(document.getElementById("thumbnails"));
    resizeOnBorderDrag(document.getElementById("notes"));
  }
  function toggleDialog(dialog) {
    if (dialog.open) {
      dialog.close();
    } else {
      dialog.showModal();
      dialog.focus();
    }
  }
  function toggleHelp(document2 = window.document) {
    const dialog = document2.getElementById("help");
    toggleDialog(dialog);
  }
  function toggleHideUI() {
    document.body.classList.toggle("hide-ui");
  }
  function toggleFullScreen(stopwatch) {
    const slidePane = document.getElementById("slides");
    if (document.fullscreenElement === null) {
      slidePane.requestFullscreen();
      stopwatch.resume();
    } else {
      document.exitFullscreen();
    }
  }
  function exitFullScreenAndShowUI() {
    if (document.fullscreenElement !== null) {
      document.exitFullscreen();
    }
    document.body.classList.remove("hide-ui");
  }
  function setupToolbarButtons(stepper, slides, stopwatch) {
    const helpButton = document.getElementById("show-help");
    helpButton.addEventListener("click", () => toggleHelp());
    const presenterViewButton = document.getElementById("presenter-view");
    presenterViewButton.addEventListener(
      "click",
      () => showPresenterView(stepper, slides, stopwatch)
    );
    const hideUIButton = document.getElementById("hide-ui");
    hideUIButton.addEventListener("click", () => toggleHideUI());
    const fullScreenButton = document.getElementById("full-screen");
    fullScreenButton.addEventListener("click", () => toggleFullScreen(stopwatch));
  }
  function showTitle(slides) {
    if (slides.svgs[0].hasAttributeNS(ns("slidie"), "title")) {
      const title = slides.svgs[0].getAttributeNS(ns("slidie"), "title");
      document.title = `${title} - ${document.title}`;
      document.getElementById("title").innerText = title;
    }
  }
  function populateKeyboardHelp() {
    const container = document.getElementById("help-keyboard-shortcuts");
    for (const { keys, description } of KEYBOARD_SHORTCUTS) {
      const keysElem = document.createElementNS(ns("xhtml"), "dt");
      for (const [i, key] of keys.entries()) {
        if (i > 0) {
          keysElem.append(" or ");
        }
        const kbd = document.createElementNS(ns("xhtml"), "kbd");
        if (KEYBOARD_KEYS_TO_SYMBOLS.has(key)) {
          kbd.innerText = KEYBOARD_KEYS_TO_SYMBOLS.get(key);
        } else {
          kbd.innerText = key;
        }
        keysElem.append(kbd);
      }
      const descriptionElem = document.createElementNS(
        ns("xhtml"),
        "dd"
      );
      descriptionElem.innerText = description;
      container.append(keysElem, descriptionElem);
    }
  }
  function makeStepThumbnail(image, link2, alt) {
    const fragment = document.getElementById("step-thumbnail").content.cloneNode(true);
    const a = fragment.querySelector("a");
    a.href = link2;
    const img = fragment.querySelector("img");
    img.src = image;
    img.alt = alt;
    return fragment;
  }
  function makeSlideThumbnails(slide, numberTooltip, steps) {
    const fragment = document.getElementById("slide-thumbnails").content.cloneNode(true);
    const number = fragment.querySelector(".slide-number");
    number.innerText = (slide + 1).toString();
    number.title = numberTooltip;
    const stepThumbnailContainer = fragment.querySelector(".step-thumbnails");
    for (const [step, { image, link: link2 }] of steps.entries()) {
      stepThumbnailContainer.append(
        makeStepThumbnail(
          image,
          link2,
          step == 0 ? `Slide {slide + 1}, step {step + 1}` : `Slide {slide + 1}`
        )
      );
    }
    return fragment;
  }
  function showThumbnails(slides) {
    const thumnailsContainer = document.getElementById("thumbnails");
    for (const [slide, svg] of slides.svgs.entries()) {
      const images = getThumbnails(svg);
      const sourceFilename = svg.getAttributeNS(ns("slidie"), "source");
      thumnailsContainer.append(
        makeSlideThumbnails(
          slide,
          sourceFilename,
          images.map(({ dataUrl }, step) => ({
            image: dataUrl,
            link: toUrlHash(slide, step)
          }))
        )
      );
    }
  }
  function connectStepperToThumbnailHighlight(stepper) {
    function updateHighlight(state) {
      for (const [slide, stepsContainer] of Array.from(
        document.querySelectorAll(".step-thumbnails")
      ).entries()) {
        for (const [step, stepContainer] of Array.from(
          stepsContainer.querySelectorAll(".thumbnail")
        ).entries()) {
          if (slide === state.slide && step === state.step) {
            stepContainer.classList.add("selected");
            stepContainer.scrollIntoView({ block: "nearest", inline: "nearest" });
          } else {
            stepContainer.classList.remove("selected");
          }
        }
      }
    }
    updateHighlight(stepper.state);
    stepper.onChange(updateHighlight);
  }
  function markdownToElements(source) {
    const html2 = marked.parse(source);
    const mdDocument = new DOMParser().parseFromString(html2, "text/html");
    return mdDocument.body.childNodes;
  }
  function connectStepperToSpeakerNotes(stepper, slides, notesContainer) {
    function showSpeakerNotes(state, lastState) {
      const noteTemplate = document.getElementById(
        "note"
      );
      const speakerNotes = getSpeakerNotes(slides.svgs[state.slide]);
      const stepNumber = slides.buildStepNumbers[state.slide][state.step];
      if (lastState === null || state.slide !== lastState.slide) {
        while (notesContainer.lastChild) {
          notesContainer.removeChild(notesContainer.lastChild);
        }
        for (const { text } of speakerNotes) {
          const noteElem = noteTemplate.content.firstElementChild.cloneNode(
            true
          );
          markdownToElements(text).forEach((n) => noteElem.appendChild(n));
          notesContainer.append(noteElem);
        }
      }
      for (const [i, { stepNumbers }] of speakerNotes.entries()) {
        const noteElem = notesContainer.childNodes[i];
        if (stepNumbers === null || stepNumbers.indexOf(stepNumber) >= 0) {
          noteElem.classList.add("current");
        } else {
          noteElem.classList.remove("current");
        }
      }
    }
    showSpeakerNotes(stepper.state, null);
    stepper.onChange(showSpeakerNotes);
  }
  function connectStepperToHash(stepper, slides) {
    function fromHash(state = null) {
      const hash = decodeURI(window.location.hash);
      const slideStep = parseUrlHash(
        hash,
        state !== null ? state.slide : -1,
        slides.ids,
        slides.buildStepNumbers,
        slides.buildStepTags
      );
      const valid = slideStep !== null && stepper.show(slideStep[0], slideStep[1], hash);
      if (state !== null && !valid) {
        console.log(state.userUrlHash);
        window.location.hash = state.userUrlHash || toUrlHash(state.slide, state.step);
      }
    }
    function toHash(state) {
      window.location.hash = state.userUrlHash || toUrlHash(state.slide, state.step);
    }
    fromHash();
    toHash(stepper.state);
    stepper.onChange(toHash);
    window.addEventListener("hashchange", () => fromHash(stepper.state));
  }
  function connectStepperToSlideSelector(stepper, slides) {
    const slideCount = document.querySelector(
      "#slide-selector .slide-count"
    );
    slideCount.innerText = slides.svgs.length.toString();
    const slideList = document.getElementById(
      "slide-list"
    );
    for (const value of enumerateAbsoluteHashes(slides.svgs)) {
      const option = document.createElementNS(
        ns("xhtml"),
        "option"
      );
      option.value = value.slice(1);
      slideList.appendChild(option);
    }
    const input = document.querySelector(
      "#slide-selector input.slide-number"
    );
    function fromInput(evt, state) {
      const hash = `#${input.value}`;
      const slideStep = parseUrlHash(
        hash,
        state.slide,
        slides.ids,
        slides.buildStepNumbers,
        slides.buildStepTags
      );
      const valid = slideStep !== null && stepper.show(slideStep[0], slideStep[1], hash);
      if (valid) {
        input.blur();
        input.classList.remove("invalid");
      } else {
        input.classList.add("invalid");
      }
    }
    function toInput(state) {
      const hash = state.userUrlHash || toUrlHash(state.slide, state.step);
      input.value = hash.slice(1);
      input.classList.remove("invalid");
      input.style.width = `${Math.max(3, input.value.length)}em`;
    }
    stepper.onChange(toInput);
    toInput(stepper.state);
    input.addEventListener("change", (evt) => fromInput(evt, stepper.state));
    input.addEventListener("focus", () => {
      input.select();
    });
    input.addEventListener("keydown", (evt) => {
      if (evt.key == "Escape") {
        toInput(stepper.state);
        input.blur();
      }
    });
  }
  var KEYBOARD_SHORTCUTS = [
    {
      description: "Next step/slide",
      keys: ["Backspace", "ArrowUp", "ArrowLeft", "K"],
      action: (stepper) => stepper.previousStep()
    },
    {
      description: "Previous step/slide",
      keys: ["Enter", "ArrowDown", "ArrowRight", "J"],
      action: (stepper) => stepper.nextStep()
    },
    {
      description: "Jump to previous slide (skip build steps)",
      keys: ["PageUp"],
      action: (stepper) => stepper.previousSlide()
    },
    {
      description: "Jump to next slide (skip build steps)",
      keys: ["PageDown"],
      action: (stepper) => stepper.nextSlide()
    },
    {
      description: "Jump to start",
      keys: ["Home"],
      action: (stepper) => stepper.start()
    },
    {
      description: "Jump to end",
      keys: ["End"],
      action: (stepper) => stepper.end()
    },
    {
      description: "Black screen",
      keys: ["Z", "B", "."],
      action: (stepper) => stepper.toggleBlank()
    },
    {
      description: "Toggle user interface",
      keys: ["U"],
      action: (_stepper, _slides, _stopwatch) => toggleHideUI()
    },
    {
      description: "Toggle full screen",
      keys: ["F"],
      action: (_stepper, _slides, stopwatch) => toggleFullScreen(stopwatch)
    },
    {
      description: "Exit full screen and show UI",
      keys: ["Escape"],
      action: (_stepper, _slides, _stopwatch) => exitFullScreenAndShowUI()
    },
    {
      description: "Open presenter view",
      keys: ["P"],
      action: (stepper, slides, stopwatch) => showPresenterView(stepper, slides, stopwatch)
    },
    {
      description: "Show help",
      keys: ["F1", "?"],
      action: () => toggleHelp()
    }
  ];
  function setupKeyboardShortcuts(stepper, slides, stopwatch) {
    window.addEventListener("keydown", (evt) => {
      if (keyboardEventInterferesWithElement(evt)) {
        return;
      }
      const match = matchKeypress(evt, KEYBOARD_SHORTCUTS);
      if (match !== null) {
        match.action(stepper, slides, stopwatch);
        evt.preventDefault();
        evt.stopPropagation();
      }
    });
  }
  function setupMouseClicks(stepper, element) {
    element.addEventListener("click", (evt) => {
      if (!eventInvolvesHyperlinkOrButton(evt)) {
        stepper.nextStep();
        evt.preventDefault();
        evt.stopPropagation();
        return false;
      }
    });
  }
  var KEYBOARD_KEYS_TO_SYMBOLS = /* @__PURE__ */ new Map([
    ["ArrowLeft", "\u2190"],
    ["ArrowUp", "\u2191"],
    ["ArrowRight", "\u2192"],
    ["ArrowDown", "\u2193"],
    ["Backspace", "\u232B"],
    ["Enter", "\u23CE"]
  ]);
  function app() {
    workaroundDeclarativeShadowDOMXHTMLBug();
    const slides = findSlides();
    slides.svgs.map(workaroundSVGLinkTargetBug);
    slides.svgs.map(setupForeignObjectScaling);
    slides.svgs.map(setupMagicVideoPlayback);
    const stepper = new Stepper(slides.buildStepCounts);
    const stopwatch = new Stopwatch();
    connectStepperToSlideVisibility(stepper, slides);
    connectStepperToSlideEvents(stepper, slides);
    makeViewerPanesResizable();
    setupToolbarButtons(stepper, slides, stopwatch);
    showTitle(slides);
    populateKeyboardHelp();
    showThumbnails(slides);
    connectStepperToThumbnailHighlight(stepper);
    connectStepperToSpeakerNotes(
      stepper,
      slides,
      document.getElementById("notes")
    );
    connectStepperToHash(stepper, slides);
    connectStepperToSlideSelector(stepper, slides);
    const slidePane = document.getElementById("slides");
    setClassWhileMouseIdle(slidePane);
    setupKeyboardShortcuts(stepper, slides, stopwatch);
    setupMouseClicks(stepper, slidePane);
  }

  // ts/index.ts
  app();
})();
//# sourceMappingURL=index.js.map
