import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@config/env.js';

export type ResumeSourceType = 'PDF' | 'DOCX' | 'TXT';

export type ResumeTextExtractionInput = {
  filePath: string;
  fileType?: string | null;
  fileSize?: number | null;
  parsedText?: string | null;
};

export type ResumeTextExtractionResult = {
  text: string;
  wordCount: number;
  characterCount: number;
  sourceType: ResumeSourceType;
  extractionWarnings: string[];
};

export const RESUME_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
] as const;

export const RESUME_ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'] as const;
export const RESUME_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const RESUME_PRIVATE_UPLOAD_DIR = path.resolve(
  env.UPLOADS_DIR,
  'private',
  'resumes'
);
export const UNSUPPORTED_RESUME_FILE_MESSAGE =
  'Unsupported resume file type. Upload a PDF, DOCX, or TXT resume.';
const REMOTE_RESUME_FILE_MESSAGE =
  'Remote resume URLs are not supported. Upload a PDF, DOCX, or TXT resume.';
const MIN_EXTRACTED_TEXT_CHARS = 120;
const MAX_EXTRACTED_TEXT_CHARS = 50_000;

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const resumeSourceByExtension = {
  '.pdf': {
    mimeType: 'application/pdf',
    sourceType: 'PDF'
  },
  '.docx': {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sourceType: 'DOCX'
  },
  '.txt': {
    mimeType: 'text/plain',
    sourceType: 'TXT'
  }
} as const;

const normalizeWhitespace = (value: string) =>
  value.replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();

const wordCount = (value: string) =>
  value.split(/\s+/).filter((word) => word.length > 0).length;

const extensionFromFilePath = (filePath: string) => {
  if (isHttpUrl(filePath)) {
    throw new Error(REMOTE_RESUME_FILE_MESSAGE);
  }

  return path.extname(filePath).toLowerCase();
};

export const detectResumeSourceType = (
  filePath: string,
  fileType?: string | null
): ResumeSourceType => {
  const normalizedType = fileType?.toLowerCase();
  const extension = extensionFromFilePath(filePath);
  const resumeSource =
    resumeSourceByExtension[
      extension as keyof typeof resumeSourceByExtension
    ];

  if (!resumeSource) {
    throw new Error(UNSUPPORTED_RESUME_FILE_MESSAGE);
  }

  if (normalizedType && normalizedType !== resumeSource.mimeType) {
    throw new Error(UNSUPPORTED_RESUME_FILE_MESSAGE);
  }

  return resumeSource.sourceType;
};

export const isSupportedResumeUpload = (fileName: string, mimeType: string) => {
  const extension = path.extname(fileName).toLowerCase();
  const resumeSource =
    resumeSourceByExtension[
      extension as keyof typeof resumeSourceByExtension
    ];

  return Boolean(resumeSource && resumeSource.mimeType === mimeType.toLowerCase());
};

const isPathInside = (candidate: string, root: string) => {
  const relative = path.relative(root, candidate);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
};

const resolveControlledResumePath = (filePath: string) => {
  if (isHttpUrl(filePath)) {
    throw new Error(REMOTE_RESUME_FILE_MESSAGE);
  }

  const absolutePath = path.resolve(filePath);
  if (!isPathInside(absolutePath, RESUME_PRIVATE_UPLOAD_DIR)) {
    throw new Error('Resume file is not from the secure upload store.');
  }

  return absolutePath;
};

const readResumeBytes = async (filePath: string, declaredSize?: number | null) => {
  if (declaredSize && declaredSize > RESUME_MAX_FILE_SIZE_BYTES) {
    throw new Error('Resume file is too large. Maximum supported size is 5 MB.');
  }

  const absolutePath = resolveControlledResumePath(filePath);
  const metadata = await stat(absolutePath).catch(() => null);
  if (!metadata?.isFile()) {
    throw new Error('Resume file is missing or is not readable.');
  }
  if (metadata.size > RESUME_MAX_FILE_SIZE_BYTES) {
    throw new Error('Resume file is too large. Maximum supported size is 5 MB.');
  }

  return readFile(absolutePath);
};

const finalizeExtraction = (
  rawText: string,
  sourceType: ResumeSourceType,
  extractionWarnings: string[]
): ResumeTextExtractionResult => {
  const normalized = normalizeWhitespace(rawText);
  if (normalized.length < MIN_EXTRACTED_TEXT_CHARS) {
    throw new Error(
      'Resume text extraction produced too little text for reliable AI analysis.'
    );
  }

  const text =
    normalized.length > MAX_EXTRACTED_TEXT_CHARS
      ? normalized.slice(0, MAX_EXTRACTED_TEXT_CHARS)
      : normalized;

  if (normalized.length > MAX_EXTRACTED_TEXT_CHARS) {
    extractionWarnings.push('Resume text was truncated before AI analysis.');
  }

  return {
    text,
    wordCount: wordCount(text),
    characterCount: text.length,
    sourceType,
    extractionWarnings
  };
};

export const resumeTextExtractionService = {
  async extract(
    input: ResumeTextExtractionInput
  ): Promise<ResumeTextExtractionResult> {
    const sourceType = detectResumeSourceType(input.filePath, input.fileType);
    const warnings: string[] = [];

    if (input.parsedText?.trim()) {
      warnings.push('Used previously stored parsed resume text.');
      return finalizeExtraction(input.parsedText, sourceType, warnings);
    }

    const fileBuffer = await readResumeBytes(input.filePath, input.fileSize);

    if (sourceType === 'PDF') {
      const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
      try {
        const result = await parser.getText();
        return finalizeExtraction(result.text, sourceType, warnings);
      } finally {
        await parser.destroy();
      }
    }

    if (sourceType === 'DOCX') {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      for (const message of result.messages ?? []) {
        warnings.push(message.message);
      }
      return finalizeExtraction(result.value, sourceType, warnings);
    }

    return finalizeExtraction(fileBuffer.toString('utf8'), sourceType, warnings);
  }
};
