#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizeBaseUrl(value) {
  return String(value).replace(/\/+$/, '');
}

function toBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return String(value).trim().toLowerCase() === 'true';
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${data?.message || text || url}`);
  }

  return data;
}

async function listSubmissions({ sourceBaseUrl, sourceToken, pageSize, offset, filters }) {
  const url = new URL(`${sourceBaseUrl}/api/submissions/search`);
  url.searchParams.set('limit', String(pageSize));
  url.searchParams.set('offset', String(offset));

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return fetchJson(url, {
    headers: {
      Authorization: `Bearer ${sourceToken}`
    }
  });
}

async function fetchSubmissionDetail({ sourceBaseUrl, sourceToken, submissionId }) {
  return fetchJson(`${sourceBaseUrl}/api/submissions/${submissionId}`, {
    headers: {
      Authorization: `Bearer ${sourceToken}`
    }
  });
}

async function importSubmission({ targetBaseUrl, targetToken, submission, dryRun }) {
  if (dryRun) {
    return {
      success: true,
      imported: false,
      dryRun: true,
      submissionId: submission.id
    };
  }

  return fetchJson(`${targetBaseUrl}/api/submissions/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${targetToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ submission })
  });
}

async function main() {
  const sourceBaseUrl = normalizeBaseUrl(requiredEnv('SOURCE_APP_URL'));
  const sourceToken = requiredEnv('SOURCE_ADMIN_API_TOKEN');
  const targetBaseUrl = normalizeBaseUrl(requiredEnv('TARGET_APP_URL'));
  const targetToken = requiredEnv('TARGET_ADMIN_API_TOKEN');

  const dryRun = toBoolean(process.env.BACKFILL_DRY_RUN, false);
  const pageSize = Math.min(toPositiveInteger(process.env.BACKFILL_PAGE_SIZE, 50), 100);
  const maxSubmissions = toPositiveInteger(process.env.BACKFILL_MAX_SUBMISSIONS, Number.MAX_SAFE_INTEGER);
  const reportPath = process.env.BACKFILL_REPORT_PATH
    ? path.resolve(process.cwd(), process.env.BACKFILL_REPORT_PATH)
    : path.resolve(process.cwd(), 'backfill-report.json');

  const filters = {
    status: process.env.BACKFILL_STATUS || '',
    startDate: process.env.BACKFILL_START_DATE || '',
    endDate: process.env.BACKFILL_END_DATE || '',
    clientId: process.env.BACKFILL_CLIENT_ID || '',
    appName: process.env.BACKFILL_APP_NAME || ''
  };

  const report = {
    startedAt: new Date().toISOString(),
    sourceBaseUrl,
    targetBaseUrl,
    dryRun,
    pageSize,
    maxSubmissions,
    filters,
    processed: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    results: []
  };

  let offset = 0;

  while (report.processed < maxSubmissions) {
    const searchResult = await listSubmissions({
      sourceBaseUrl,
      sourceToken,
      pageSize,
      offset,
      filters
    });

    const results = Array.isArray(searchResult?.results) ? searchResult.results : [];
    if (results.length === 0) {
      break;
    }

    for (const result of results) {
      if (report.processed >= maxSubmissions) {
        break;
      }

      const detailResult = await fetchSubmissionDetail({
        sourceBaseUrl,
        sourceToken,
        submissionId: result.id
      });

      const submission = detailResult?.submission;
      if (!submission) {
        throw new Error(`Source app did not return a submission payload for ${result.id}`);
      }

      try {
        const importResult = await importSubmission({
          targetBaseUrl,
          targetToken,
          submission,
          dryRun
        });

        report.processed += 1;
        if (importResult?.skipped) {
          report.skipped += 1;
        } else if (importResult?.success !== false) {
          report.imported += 1;
        }

        report.results.push({
          submissionId: submission.id,
          appName: submission.appName,
          status: submission.status,
          outcome: importResult?.skipped ? 'skipped' : dryRun ? 'dry-run' : 'imported',
          copiedBlobCount: importResult?.copiedBlobCount || 0
        });

        console.log(`[${report.processed}] ${submission.id} ${importResult?.skipped ? 'skipped' : dryRun ? 'dry-run' : 'imported'}`);
      } catch (error) {
        report.processed += 1;
        report.failed += 1;
        report.results.push({
          submissionId: submission.id,
          appName: submission.appName,
          status: submission.status,
          outcome: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });

        console.error(`[${report.processed}] ${submission.id} failed`, error);
      }
    }

    offset += results.length;

    if (results.length < pageSize) {
      break;
    }
  }

  report.completedAt = new Date().toISOString();

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Backfill complete. Imported: ${report.imported}, skipped: ${report.skipped}, failed: ${report.failed}`);
  console.log(`Report written to ${reportPath}`);

  if (report.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exitCode = 1;
});
