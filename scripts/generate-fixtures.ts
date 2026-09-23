#!/usr/bin/env npx tsx
/**
 * Fixture Generator
 *
 * Generates small, REAL sample media files used by the MIME type probe
 * (scripts/probe-mime-types.ts). The probe previously synthesized binary
 * samples from hand-rolled magic bytes, which produced valid GIF/BMP/TIFF/WAV
 * files but malformed PNG/JPEG/WebP and degenerate MP3/video blobs — the API
 * rejected those as invalid content and the probe recorded them as
 * "unsupported" (false negatives).
 *
 * This script writes one fixture per binary MIME type into scripts/fixtures/
 * and validates every output with file(1) / ffprobe / unzip. Files are
 * committed to the repo so CI never needs to regenerate them.
 *
 * Requires: ffmpeg + ffprobe (audio/video), ImageMagick `magick` (images),
 * and the `zip`/`unzip` CLIs (OOXML/EPUB packages).
 *
 * Usage:
 *   npm run generate:fixtures
 *   npx tsx scripts/generate-fixtures.ts
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.join(__dirname, 'fixtures');
const TMP_DIR = path.join(OUT_DIR, '.tmp');

interface FixtureSpec {
  /** Fixture file name (matches the probe catalog extension minus the dot). */
  name: string;
  /** Human-readable description printed in the summary. */
  description: string;
  /** `file -b` output must contain one of these substrings. */
  fileSig?: string | string[];
  /** Optional ffprobe format check (substring match on format_name). */
  ffprobeFormat?: string;
  /** Extra validation hook (runs after fileSig). */
  validate?: (file: string) => void;
  generate: () => void;
}

// ---------------------------------------------------------------------------
// Tool wrappers
// ---------------------------------------------------------------------------

function magick(args: string[]): void {
  execFileSync('magick', args, { stdio: ['ignore', 'pipe', 'inherit'] });
}

function ffmpeg(outFile: string, args: string[]): void {
  execFileSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-y', ...args, outFile],
    { stdio: ['ignore', 'pipe', 'inherit'] }
  );
}

function writeZip(outFile: string, files: Record<string, string>): void {
  // Build the zip in a scratch dir so archive paths are exactly the given keys.
  const scratch = path.join(TMP_DIR, `zip-${path.basename(outFile, path.extname(outFile))}`);
  fs.rmSync(scratch, { recursive: true, force: true });
  fs.mkdirSync(scratch, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(scratch, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  // -X: no extra file attributes; -D: no directory entries. Info-Zip appends
  // ".zip" when the target has no extension, so write to <name>.zip and rename.
  const zipFile = `${outFile}.zip`;
  execFileSync(
    'zip',
    ['-q', '-r', '-X', '-D', path.resolve(zipFile), ...Object.keys(files)],
    { cwd: scratch, stdio: ['ignore', 'pipe', 'inherit'] }
  );
  fs.renameSync(zipFile, outFile);
  fs.rmSync(scratch, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Minimal, valid OOXML / EPUB package contents
// ---------------------------------------------------------------------------

const CT_XML = '<?xml version="1.0" encoding="UTF-8"?>\n';
const OPC_RELS =
  CT_XML +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="%TARGET%"/>' +
  '</Relationships>\n';

const DOCX_XML = {
  '[Content_Types].xml':
    CT_XML +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>\n',
  '_rels/.rels': OPC_RELS.replace('%TARGET%', 'word/document.xml'),
  'word/document.xml':
    CT_XML +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>\n',
};

const XLSX_XML = {
  '[Content_Types].xml':
    CT_XML +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '</Types>\n',
  '_rels/.rels': OPC_RELS.replace('%TARGET%', 'xl/workbook.xml'),
  'xl/workbook.xml':
    CT_XML +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>\n',
  'xl/_rels/workbook.xml.rels':
    CT_XML +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '</Relationships>\n',
  'xl/worksheets/sheet1.xml':
    CT_XML +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>\n',
};

const PPTX_XML = {
  '[Content_Types].xml':
    CT_XML +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
    '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' +
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    '<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>' +
    '<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>' +
    '</Types>\n',
  '_rels/.rels': OPC_RELS.replace('%TARGET%', 'ppt/presentation.xml'),
  'ppt/presentation.xml':
    CT_XML +
    '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId2"/></p:sldMasterIdLst>' +
    '<p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>' +
    '<p:sldSz cx="9144000" cy="6858000"/></p:presentation>\n',
  'ppt/_rels/presentation.xml.rels':
    CT_XML +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>' +
    '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>' +
    '</Relationships>\n',
  'ppt/slides/slide1.xml':
    CT_XML +
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:spTree>' +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr/>' +
    '<p:sp>' +
    '<p:nvSpPr><p:cNvPr id="2" name="TextBox 1"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' +
    '<p:spPr><a:xfrm><a:off x="838200" y="365125"/><a:ext cx="7366000" cy="851850"/></a:xfrm>' +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Probe</a:t></a:r></a:p></p:txBody>' +
    '</p:sp>' +
    '</p:spTree></p:cSld>' +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
    '</p:sld>\n',
  'ppt/slides/_rels/slide1.xml.rels':
    CT_XML +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
    '</Relationships>\n',
  'ppt/slideLayouts/slideLayout1.xml':
    CT_XML +
    '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld name="Blank"><p:spTree>' +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr/>' +
    '</p:spTree></p:cSld>' +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
    '</p:sldLayout>\n',
  'ppt/slideLayouts/_rels/slideLayout1.xml.rels':
    CT_XML +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>' +
    '</Relationships>\n',
  'ppt/slideMasters/slideMaster1.xml':
    CT_XML +
    '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:spTree>' +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="6858000"/>' +
    '<a:chOff x="0" y="0"/><a:chExt cx="9144000" cy="6858000"/></a:xfrm></p:grpSpPr>' +
    '</p:spTree></p:cSld>' +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" ' +
    'accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" ' +
    'hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    '</p:sldMaster>\n',
  'ppt/slideMasters/_rels/slideMaster1.xml.rels':
    CT_XML +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>' +
    '</Relationships>\n',
  'ppt/theme/theme1.xml':
    CT_XML +
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Probe">' +
    '<a:themeElements>' +
    '<a:clrScheme name="Probe">' +
    '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>' +
    '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="1D1E1F"/></a:dk2>' +
    '<a:lt2><a:srgbClr val="F2F2F2"/></a:lt2>' +
    '<a:accent1><a:srgbClr val="4472C4"/></a:accent1>' +
    '<a:accent2><a:srgbClr val="ED7D31"/></a:accent2>' +
    '<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>' +
    '<a:accent4><a:srgbClr val="FFC000"/></a:accent4>' +
    '<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>' +
    '<a:accent6><a:srgbClr val="70AD47"/></a:accent6>' +
    '<a:hlink><a:srgbClr val="0563C1"/></a:hlink>' +
    '<a:folHlink><a:srgbClr val="954F72"/></a:folHlink>' +
    '</a:clrScheme>' +
    '<a:fontScheme name="Probe">' +
    '<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>' +
    '</a:fontScheme>' +
    '<a:fmtScheme name="Probe">' +
    '<a:fillStyleLst>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '</a:fillStyleLst>' +
    '<a:lnStyleLst>' +
    '<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
    '<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
    '<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
    '</a:lnStyleLst>' +
    '<a:effectStyleLst>' +
    '<a:effectStyle><a:effectLst/></a:effectStyle>' +
    '<a:effectStyle><a:effectLst/></a:effectStyle>' +
    '<a:effectStyle><a:effectLst/></a:effectStyle>' +
    '</a:effectStyleLst>' +
    '<a:bgFillStyleLst>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '</a:bgFillStyleLst>' +
    '</a:fmtScheme>' +
    '</a:themeElements>' +
    '</a:theme>\n',
  'ppt/presProps.xml':
    CT_XML + '<p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>\n',
  'ppt/viewProps.xml':
    CT_XML + '<p:viewPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>\n',
};

const EPUB_XML = {
  mimetype: 'application/epub+zip',
  'META-INF/container.xml':
    '<?xml version="1.0"?>\n' +
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
    '<rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>' +
    '</rootfiles></container>\n',
  'content.opf':
    '<?xml version="1.0"?>\n' +
    '<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="uid">' +
    '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    '<dc:title>Probe Fixture</dc:title><dc:language>en</dc:language>' +
    '<dc:identifier id="uid">urn:uuid:00000000-0000-0000-0000-000000000000</dc:identifier>' +
    '</metadata>' +
    '<manifest>' +
    '<item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>' +
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>' +
    '</manifest>' +
    '<spine toc="ncx"><itemref idref="chapter1"/></spine>' +
    '</package>\n',
  'chapter1.xhtml':
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">\n' +
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Probe Fixture</title></head>' +
    '<body><h1>Probe Fixture</h1><p>Hello.</p></body></html>\n',
  'toc.ncx':
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">' +
    '<head><meta name="dtb:uid" content="urn:uuid:00000000-0000-0000-0000-000000000000"/></head>' +
    '<docTitle><text>Probe Fixture</text></docTitle>' +
    '<navMap><navPoint id="nav1" playOrder="1"><navLabel><text>Chapter 1</text></navLabel>' +
    '<content src="chapter1.xhtml"/></navPoint></navMap>' +
    '</ncx>\n',
};

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

/** Real 1x1 image encodes via ImageMagick. `format` is the magick format ID;
 * required because fixture filenames have no extension to infer from. */
function imageFixture(name: string, format: string, fileSig: string, extra: string[] = []): FixtureSpec {
  return {
    name,
    description: `1x1 real ${name.toUpperCase()} (magick)`,
    fileSig,
    generate: () => {
      const src = path.join(TMP_DIR, 'src.png');
      magick(['-size', '1x1', 'xc:red', '-strip', src]);
      magick([src, '-strip', ...extra, `${format}:${path.join(OUT_DIR, name)}`]);
    },
  };
}

/** Real 0.25s 8kHz mono silent audio via ffmpeg. */
function audioFixture(name: string, codecArgs: string[], fileSig: string | string[], ffprobeFormat: string): FixtureSpec {
  return {
    name,
    description: `0.25s real silence (${codecArgs[1]}, ffmpeg)`,
    fileSig,
    ffprobeFormat,
    generate: () =>
      ffmpeg(path.join(OUT_DIR, name), [
        '-f', 'lavfi', '-i', 'anullsrc=r=8000:cl=mono',
        '-t', '0.25',
        ...codecArgs,
      ]),
  };
}

/** Real 2-frame silent video via ffmpeg (H.263/MPEG-1 require their own sizes/fps). */
function videoFixture(
  name: string,
  codecArgs: string[],
  fileSig: string | string[],
  ffprobeFormat: string,
  size = '64x64',
  fps = 10
): FixtureSpec {
  return {
    name,
    description: `2-frame real ${size}@${fps}fps video (${codecArgs[1]}, ffmpeg)`,
    fileSig,
    ffprobeFormat,
    generate: () =>
      ffmpeg(path.join(OUT_DIR, name), [
        '-f', 'lavfi', '-i', `color=c=red:s=${size}:r=${fps}`,
        '-t', '0.3',
        ...codecArgs,
      ]),
  };
}

/** Real OPC (OOXML) zip package. */
function ooxmlFixture(name: string, files: Record<string, string>): FixtureSpec {
  return {
    name,
    description: 'minimal valid OOXML package',
    validate: (file) => execFileSync('unzip', ['-t', file], { stdio: 'pipe' }),
    generate: () => writeZip(path.join(OUT_DIR, name), files),
  };
}

/** EPUB 2.0: mimetype must be the first, stored entry, and the OPF must
 * reference at least one content document via manifest + spine. */
const epubFixture: FixtureSpec = {
  name: 'epub',
  description: 'minimal valid EPUB 2.0 (content document + NCX + spine)',
  validate: (file) => {
    const mimetype = execFileSync('unzip', ['-p', file, 'mimetype'], { encoding: 'utf8' }).trim();
    if (mimetype !== 'application/epub+zip') {
      throw new Error(`bad epub mimetype entry: "${mimetype}"`);
    }
    const opf = execFileSync('unzip', ['-p', file, 'content.opf'], { encoding: 'utf8' });
    if (!opf.includes('<itemref idref="chapter1"')) {
      throw new Error('content.opf has no spine itemref for chapter1');
    }
    const ncx = execFileSync('unzip', ['-p', file, 'toc.ncx'], { encoding: 'utf8' });
    if (!ncx.includes('<navMap>') || !ncx.includes('chapter1.xhtml')) {
      throw new Error('toc.ncx has no navMap entry pointing at chapter1.xhtml');
    }
    execFileSync('unzip', ['-t', file], { stdio: 'pipe' });
  },
  generate: () => {
    const scratch = path.join(TMP_DIR, 'epub');
    fs.rmSync(scratch, { recursive: true, force: true });
    fs.mkdirSync(path.join(scratch, 'META-INF'), { recursive: true });
    fs.writeFileSync(path.join(scratch, 'mimetype'), EPUB_XML.mimetype);
    fs.writeFileSync(path.join(scratch, 'META-INF/container.xml'), EPUB_XML['META-INF/container.xml']);
    fs.writeFileSync(path.join(scratch, 'content.opf'), EPUB_XML['content.opf']);
    fs.writeFileSync(path.join(scratch, 'chapter1.xhtml'), EPUB_XML['chapter1.xhtml']);
    fs.writeFileSync(path.join(scratch, 'toc.ncx'), EPUB_XML['toc.ncx']);
    // Info-Zip appends ".zip" when the target has no extension, so write to
    // <name>.zip and rename (mimetype must be the first, uncompressed entry).
    const zipFile = path.join(OUT_DIR, 'epub.zip');
    execFileSync('zip', ['-q', '-X0', zipFile, 'mimetype'], { cwd: scratch, stdio: ['ignore', 'pipe', 'inherit'] });
    execFileSync(
      'zip',
      ['-q', '-r', '-X', '-D', zipFile, 'META-INF', 'content.opf', 'chapter1.xhtml', 'toc.ncx'],
      { cwd: scratch, stdio: ['ignore', 'pipe', 'inherit'] }
    );
    fs.renameSync(zipFile, path.join(OUT_DIR, 'epub'));
    fs.rmSync(scratch, { recursive: true, force: true });
  },
};

const midiFixture: FixtureSpec = {
  name: 'mid',
  description: 'hand-built minimal MIDI (SMF 0)',
  fileSig: 'Standard MIDI',
  generate: () => {
    const header = Buffer.from([
      0x4d, 0x54, 0x68, 0x64, // "MThd"
      0x00, 0x00, 0x00, 0x06, // header length
      0x00, 0x00,             // format 0
      0x00, 0x01,             // one track
      0x01, 0xe0,             // division: 480 ticks/quarter
    ]);
    const trackBody = Buffer.from([
      0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, // tempo: 120 BPM
      0x00, 0xc0, 0x00,                         // program change (piano)
      0x00, 0x90, 0x3c, 0x40,                   // note on C4
      0x3c, 0x80, 0x3c, 0x00,                   // delta 60, note off C4
      0x00, 0xff, 0x2f, 0x00,                   // end of track
    ]);
    const track = Buffer.concat([
      Buffer.from([0x4d, 0x54, 0x72, 0x6b]), // "MTrk"
      Buffer.from([0x00, 0x00, 0x00, trackBody.length]),
      trackBody,
    ]);
    fs.writeFileSync(path.join(OUT_DIR, 'mid'), Buffer.concat([header, track]));
  },
};

const FIXTURE_SPECS: FixtureSpec[] = [
    // --- Images (covers all image false-negative types) ---
  imageFixture('png', 'png', 'PNG image data'),
  imageFixture('jpg', 'jpg', 'JPEG image data'),
  imageFixture('gif', 'gif', 'GIF image data'),
  imageFixture('webp', 'webp', 'Web/P image'),
  imageFixture('bmp', 'bmp', 'PC bitmap'),
  imageFixture('tiff', 'tiff', 'TIFF image data'),
  imageFixture('ico', 'ico', 'MS Windows icon resource', ['-resize', '16x16']),
  imageFixture('heic', 'heic', 'HEIF Image'),
  imageFixture('heif', 'heif', 'HEIF Image'),
  imageFixture('avif', 'avif', 'AVIF Image'),

  // --- Audio ---
  audioFixture('wav', ['-c:a', 'pcm_s16le', '-f', 'wav'], 'WAVE audio', 'wav'),
  audioFixture('aiff', ['-c:a', 'pcm_s16le', '-f', 'aiff'], 'AIFF', 'aiff'),
  audioFixture('flac', ['-c:a', 'flac', '-f', 'flac'], 'FLAC', 'flac'),
  audioFixture('mp3', ['-c:a', 'libmp3lame', '-f', 'mp3'], ['Audio file with ID3', 'MPEG ADTS'], 'mp3'),
  audioFixture('aac', ['-c:a', 'aac', '-f', 'adts'], ['ADTS AAC', 'AAC'], 'aac'),
  audioFixture('m4a', ['-c:a', 'aac', '-f', 'ipod'], 'ISO Media', 'mov,mp4,m4a,3gp,3g2,mj2'),
  audioFixture('ogg', ['-c:a', 'libopus', '-f', 'ogg'], 'Ogg data', 'ogg'),
  audioFixture('opus', ['-c:a', 'libopus', '-f', 'ogg'], 'Ogg data', 'ogg'),
  audioFixture('weba', ['-c:a', 'libopus', '-f', 'webm'], ['WebM', 'Matroska'], 'webm'),
  midiFixture,

  // --- Video ---
  videoFixture('mp4', ['-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-f', 'mp4'], 'ISO Media', 'mov,mp4,m4a,3gp,3g2,mj2'),
  videoFixture('mov', ['-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-f', 'mov'], 'ISO Media', 'mov,mp4,m4a,3gp,3g2,mj2'),
  videoFixture('mkv', ['-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-f', 'matroska'], ['Matroska', 'EBML'], 'matroska,webm'),
  videoFixture('webm', ['-c:v', 'libvpx', '-b:v', '100k', '-f', 'webm'], ['WebM', 'Matroska'], 'matroska,webm'),
  videoFixture('avi', ['-c:v', 'mpeg4', '-q:v', '3', '-f', 'avi'], 'AVI', 'avi'),
  videoFixture('mpeg', ['-c:v', 'mpeg1video', '-q:v', '3', '-f', 'mpeg'], 'MPEG sequence', 'mpeg', '64x64', 25),
  videoFixture('flv', ['-c:v', 'flv', '-f', 'flv'], 'Flash', 'flv'),
  videoFixture('3gp', ['-c:v', 'h263', '-f', '3gp'], 'ISO Media', 'mov,mp4,m4a,3gp,3g2,mj2', '128x96'),
  videoFixture('3g2', ['-c:v', 'mpeg4', '-f', '3g2'], 'ISO Media', 'mov,mp4,m4a,3gp,3g2,mj2'),
  videoFixture('wmv', ['-c:v', 'wmv2', '-f', 'asf'], 'ASF', 'asf'),

  // --- Document packages (valid zip/OPC containers instead of magic bytes) ---
  ooxmlFixture('docx', DOCX_XML),
  ooxmlFixture('xlsx', XLSX_XML),
  {
    name: 'pptx',
    description: 'complete minimal PresentationML package (slide/layout/master/theme)',
    validate: (file) => {
      execFileSync('unzip', ['-t', file], { stdio: 'pipe' });
      // Format-aware validation when python-pptx is installed: opens the
      // package, parses the presentation, master, and slide parts.
      try {
        execFileSync('python3', ['-c', 'import pptx'], { stdio: 'pipe' });
      } catch {
        console.log('    (python-pptx not installed; skipping format-aware PPTX validation)');
        return;
      }
      execFileSync(
        'python3',
        [
          '-c',
          `import pptx; p = pptx.Presentation(${JSON.stringify(file)}); ` +
            'assert len(p.slide_masters) == 1; assert len(p.slide_layouts) >= 1; ' +
            'assert len(p.slides) == 1',
        ],
        { stdio: 'pipe' }
      );
    },
    generate: () => writeZip(path.join(OUT_DIR, 'pptx'), PPTX_XML),
  },
  epubFixture,
];

// ---------------------------------------------------------------------------
// Runner + validation
// ---------------------------------------------------------------------------

function main(): void {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  console.log(`Generating ${FIXTURE_SPECS.length} fixtures into ${OUT_DIR}\n`);

  for (const spec of FIXTURE_SPECS) {
    try {
      spec.generate();
      console.log(`  ${spec.name.padEnd(8)} OK   (${spec.description})`);
    } catch (error) {
      console.error(`  ${spec.name.padEnd(8)} FAILED`);
      throw error;
    }
  }

  fs.rmSync(TMP_DIR, { recursive: true, force: true });

  console.log('\nValidation:');
  let failures = 0;
  for (const spec of FIXTURE_SPECS) {
    const file = path.join(OUT_DIR, spec.name);
    const out = execFileSync('file', ['-b', file], { encoding: 'utf8' }).trim();
    const size = fs.statSync(file).size;
    const problems: string[] = [];

    if (spec.fileSig) {
      const sigs = Array.isArray(spec.fileSig) ? spec.fileSig : [spec.fileSig];
      if (!sigs.some((sig) => out.includes(sig))) {
        problems.push(`file signature mismatch: "${out}" (expected one of: ${sigs.join(' | ')})`);
      }
    }
    if (spec.ffprobeFormat) {
      let format = '';
      try {
        format = execFileSync(
          'ffprobe',
          ['-v', 'error', '-show_entries', 'format=format_name', '-of', 'default=nw=1:nk=1', file],
          { encoding: 'utf8' }
        ).trim();
      } catch {
        problems.push('ffprobe failed to parse');
      }
      if (format && !format.includes(spec.ffprobeFormat)) {
        problems.push(`ffprobe format "${format}" does not contain "${spec.ffprobeFormat}"`);
      }
    }
    try {
      spec.validate?.(file);
    } catch (error) {
      problems.push(`validate() failed: ${(error as Error).message.split('\n')[0]}`);
    }
    if (size === 0) problems.push('empty file');

    const sizeStr = `${size}B`.padStart(7);
    if (problems.length === 0) {
      console.log(`  ${spec.name.padEnd(8)} ${sizeStr}  ${out}`);
    } else {
      failures++;
      console.log(`  ${spec.name.padEnd(8)} ${sizeStr}  FAILED: ${problems.join('; ')}`);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} fixture(s) failed validation.`);
    process.exit(1);
  }
  console.log(`\nAll ${FIXTURE_SPECS.length} fixtures generated and validated.`);
}

main();