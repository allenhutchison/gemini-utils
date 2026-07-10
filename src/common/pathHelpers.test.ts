import { extname } from './pathHelpers.js';

describe('extname', () => {
  it('returns the extension including the leading dot', () => {
    expect(extname('note.md')).toBe('.md');
    expect(extname('photo.JPG')).toBe('.JPG');
  });

  it('uses only the last dot of the final segment', () => {
    expect(extname('archive.tar.gz')).toBe('.gz');
    expect(extname('a/b/c.d.e.txt')).toBe('.txt');
  });

  it('strips the directory portion for both separators', () => {
    expect(extname('/usr/local/file.pdf')).toBe('.pdf');
    expect(extname('C:\\dir\\doc.docx')).toBe('.docx');
  });

  it('returns empty string when there is no extension', () => {
    expect(extname('README')).toBe('');
    expect(extname('/path/to/noext')).toBe('');
  });

  it('treats leading-dot dotfiles as having no extension', () => {
    expect(extname('.gitignore')).toBe('');
    expect(extname('/etc/.bashrc')).toBe('');
  });

  it('handles trailing dots the way path.extname does', () => {
    expect(extname('foo.')).toBe('.');
  });
});
