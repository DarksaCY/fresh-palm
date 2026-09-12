'use strict';

// Minimal writer for the Plucker document format (uncompressed text only,
// no images/links/appinfo). Spec: plucker-1.8 docs/manual/DBFormat.html.
// PalmOS epoch (Jan 1 1904) is 2082844800s before the Unix epoch.
const PALM_EPOCH_OFFSET = 2082844800;

function encodeParagraph(text) {
  const bytes = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code === 0x0a) {
      bytes.push(0x00, 0x38); // "New line" function, no data
    } else if (code <= 0xff) {
      bytes.push(code);
    } else if (code <= 0xffff) {
      // "16-bit Unicode character" function: NUL, 0x83, altTextLength(1),
      // char(2, big-endian), alt text bytes. Use "?" as the fallback glyph.
      bytes.push(0x00, 0x83, 1, (code >> 8) & 0xff, code & 0xff, 0x3f);
    } else {
      bytes.push(0x3f); // astral chars: just fall back to "?"
    }
  }
  return Buffer.from(bytes);
}

function buildPluckerPdb(docName, bodyText) {
  const paragraphs = bodyText.split(/\n{2,}/).map(encodeParagraph);
  if (paragraphs.length === 0) paragraphs.push(Buffer.alloc(0));

  const now = Math.floor(Date.now() / 1000) + PALM_EPOCH_OFFSET;

  // -- Record 0: index record --
  const indexBody = Buffer.alloc(10);
  indexBody.writeUInt16BE(0x0001, 0); // uid
  indexBody.writeUInt16BE(0x0001, 2); // version (DOC-compression convention; unused, nothing here is compressed)
  indexBody.writeUInt16BE(1, 4); // number of reserved records
  indexBody.writeUInt16BE(0, 6); // reserved name: home.html = 0
  indexBody.writeUInt16BE(0x0002, 8); // reserved id: uid of the text record below

  // -- Record 1: text record --
  const paragraphHeaders = Buffer.alloc(paragraphs.length * 4);
  let totalTextSize = 0;
  paragraphs.forEach((p, i) => {
    paragraphHeaders.writeUInt16BE(p.length, i * 4);
    paragraphHeaders.writeUInt16BE(0, i * 4 + 2); // attributes: no extra spacing
    totalTextSize += p.length;
  });
  const textHeader = Buffer.alloc(8);
  textHeader.writeUInt16BE(0x0002, 0); // uid
  textHeader.writeUInt16BE(paragraphs.length, 2); // number of paragraphs
  textHeader.writeUInt16BE(totalTextSize, 4); // uncompressed size
  textHeader.writeUInt8(0, 6); // type: DATATYPE_PHTML (uncompressed)
  textHeader.writeUInt8(0, 7); // flags: not continued
  const textRecord = Buffer.concat([textHeader, paragraphHeaders, ...paragraphs]);

  const records = [indexBody, textRecord];
  const recordUids = [1, 2];

  const numRecords = records.length;
  const HEADER_SIZE = 72;
  const RECLIST_HEADER_SIZE = 6;
  const RECLIST_ENTRY_SIZE = 8;
  const prefixSize = HEADER_SIZE + RECLIST_HEADER_SIZE + numRecords * RECLIST_ENTRY_SIZE + 2;

  const header = Buffer.alloc(HEADER_SIZE);
  header.write(docName.slice(0, 31), 0, 31, 'ascii');
  header.writeUInt16BE(0, 32); // flags
  header.writeUInt16BE(1, 34); // plucker format version
  header.writeUInt32BE(now, 36); // creationDate
  header.writeUInt32BE(now, 40); // modificationDate
  // bytes 44-51: unused1 (zero)
  header.writeUInt32BE(0, 52); // appInfoOffset (none)
  header.writeUInt32BE(0, 56); // sortInfoId
  header.write('DataPlkr', 60, 8, 'latin1'); // magic
  // bytes 68-71: unused2 (zero)

  const recListHeader = Buffer.alloc(RECLIST_HEADER_SIZE);
  recListHeader.writeUInt32BE(0, 0); // nextRecordListID
  recListHeader.writeUInt16BE(numRecords, 4);

  let offset = prefixSize;
  const recListEntries = Buffer.alloc(numRecords * RECLIST_ENTRY_SIZE);
  records.forEach((rec, i) => {
    recListEntries.writeUInt32BE(offset, i * RECLIST_ENTRY_SIZE);
    recListEntries.writeUInt8(0, i * RECLIST_ENTRY_SIZE + 4); // attributes
    // uniqueID: 3 bytes, big-endian
    recListEntries.writeUIntBE(recordUids[i], i * RECLIST_ENTRY_SIZE + 5, 3);
    offset += rec.length;
  });

  const padding = Buffer.alloc(2);

  return Buffer.concat([header, recListHeader, recListEntries, padding, ...records]);
}

module.exports = { buildPluckerPdb };
