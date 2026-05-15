import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTextMock: vi.fn(),
  destroyMock: vi.fn(),
  extractRawTextMock: vi.fn()
}));

vi.mock('pdf-parse', () => ({
  PDFParse: vi.fn().mockImplementation(() => ({
    getText: mocks.getTextMock,
    destroy: mocks.destroyMock
  }))
}));

vi.mock('mammoth', () => ({
  default: {
    extractRawText: mocks.extractRawTextMock
  }
}));

import {
  detectResumeSourceType,
  RESUME_MAX_FILE_SIZE_BYTES,
  RESUME_PRIVATE_UPLOAD_DIR,
  resumeTextExtractionService
} from '@modules/resumes/services/resume-text-extraction.service.js';

let tempDir: string | undefined;

const longEnoughText =
  'Senior software engineer with product leadership, cloud systems, TypeScript, Node.js, PostgreSQL, Redis, queue processing, and measurable business impact across multiple production platforms.';

const createTempFile = async (name: string, content: string | Buffer) => {
  await mkdir(RESUME_PRIVATE_UPLOAD_DIR, { recursive: true });
  tempDir ??= await mkdtemp(path.join(RESUME_PRIVATE_UPLOAD_DIR, 'tmp-resume-extraction-'));
  const filePath = path.join(tempDir, name);
  await writeFile(filePath, content);
  return filePath;
};

afterEach(async () => {
  vi.clearAllMocks();
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe('resumeTextExtractionService', () => {
  it('extracts TXT resumes from disk and normalizes whitespace', async () => {
    const filePath = await createTempFile(
      'resume.txt',
      `\n\n${longEnoughText}\n\nAdditional     resume       detail.`
    );

    const result = await resumeTextExtractionService.extract({
      filePath,
      fileType: 'text/plain'
    });

    expect(result.sourceType).toBe('TXT');
    expect(result.text).toContain('Senior software engineer');
    expect(result.text).not.toContain('     ');
    expect(result.wordCount).toBeGreaterThan(10);
    expect(result.characterCount).toBe(result.text.length);
  });

  it('extracts PDF resumes through pdf-parse', async () => {
    const filePath = await createTempFile('resume.pdf', Buffer.from('%PDF-1.4'));
    mocks.getTextMock.mockResolvedValue({ text: longEnoughText });

    const result = await resumeTextExtractionService.extract({
      filePath,
      fileType: 'application/pdf'
    });

    expect(result.sourceType).toBe('PDF');
    expect(result.text).toContain('cloud systems');
    expect(mocks.getTextMock).toHaveBeenCalled();
    expect(mocks.destroyMock).toHaveBeenCalled();
  });

  it('extracts DOCX resumes through mammoth', async () => {
    const filePath = await createTempFile('resume.docx', Buffer.from('docx'));
    mocks.extractRawTextMock.mockResolvedValue({
      value: longEnoughText,
      messages: [{ message: 'Ignored unsupported style' }]
    });

    const result = await resumeTextExtractionService.extract({
      filePath,
      fileType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    expect(result.sourceType).toBe('DOCX');
    expect(result.text).toContain('TypeScript');
    expect(result.extractionWarnings).toContain('Ignored unsupported style');
  });

  it('rejects unsupported file types', async () => {
    expect(() =>
      detectResumeSourceType('resume.png', 'image/png')
    ).toThrow('Unsupported resume file type');
  });

  it('rejects empty or too-short extracted text', async () => {
    const filePath = await createTempFile('empty.txt', 'short');

    await expect(
      resumeTextExtractionService.extract({
        filePath,
        fileType: 'text/plain'
      })
    ).rejects.toThrow('too little text');
  });

  it('rejects remote resume URLs without fetching them', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      resumeTextExtractionService.extract({
        filePath: 'https://example.com/resume.pdf',
        fileType: 'application/pdf'
      })
    ).rejects.toThrow('Remote resume URLs are not supported');

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('rejects local files outside the controlled resume upload directory', async () => {
    const filePath = path.join(process.cwd(), 'resume.txt');

    await expect(
      resumeTextExtractionService.extract({
        filePath,
        fileType: 'text/plain'
      })
    ).rejects.toThrow('secure upload store');
  });

  it('rejects oversized local resume files', async () => {
    const filePath = await createTempFile(
      'large.txt',
      Buffer.alloc(RESUME_MAX_FILE_SIZE_BYTES + 1, 'a')
    );

    await expect(
      resumeTextExtractionService.extract({
        filePath,
        fileType: 'text/plain'
      })
    ).rejects.toThrow('too large');
  });
});
