import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { existsSync, createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

// Only fictitious records in a fresh SQLite database. Existing dev services stay untouched.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = randomUUID();
const artifactDir = path.join(root, 'tmp', 'e2e', runId);
const dbPath = path.join(artifactDir, 'lablink.db');
const python = process.env.PYTHON_PATH || path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const apiUrl = 'http://127.0.0.1:8001';
const webUrl = 'http://127.0.0.1:5174';
const csrf = { 'X-Requested-With': 'LabLink' };
const password = 'E2E-Fictional-2026!';
const checks = [];
const pageErrors = [];
const externalRequests = [];
const children = [];
const contexts = [];
const cleanupErrors = [];
let browser;
let stopTask;
let failure;

function checked(message) {
  checks.push(message);
  console.log(`PASS ${message}`);
}

async function assertFreePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', error => reject(new Error(error.code === 'EADDRINUSE'
      ? `Test port ${port} is occupied. Stop that test service or free the port; existing services will not be reused.`
      : `Cannot reserve test port ${port}: ${error.code || error.message}`)));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(resolve));
  });
}

function launch(name, command, args, cwd, env) {
  const log = createWriteStream(path.join(artifactDir, `${name}.log`));
  const child = spawn(command, args, {
    cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32', windowsHide: true,
  });
  const entry = { name, child, log, error: null };
  children.push(entry);
  console.log(`Started ${name}: PID ${child.pid ?? 'unavailable'}`);
  log.write(`LabLink E2E ${name} PID ${child.pid ?? 'unavailable'}\n`);
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  child.once('error', error => { entry.error = error; });
  child.once('close', () => log.end());
  return entry;
}

async function waitReady(entry, url) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (entry.error) throw entry.error;
    if (entry.child.exitCode !== null) throw new Error(`${entry.name} exited (${entry.child.exitCode}). See ${entry.name}.log.`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
    } catch { /* The child is still starting. */ }
    await delay(250);
  }
  throw new Error(`${entry.name} did not become ready within 60 seconds. See ${entry.name}.log.`);
}

const execFileAsync = promisify(execFile);
async function stopChildren() {
  if (stopTask) return stopTask;
  stopTask = (async () => {
    const errors = [];
    for (const { name, child, log } of [...children].reverse()) {
      const alive = () => child.pid && child.exitCode === null && child.signalCode === null;
      try {
        if (!alive()) continue;
        console.log(`Stopping ${name}: PID ${child.pid}`);
        if (process.platform === 'win32') {
          // Own subprocess tree only; ask for termination before forcing remaining children.
          await execFileAsync('taskkill', ['/PID', String(child.pid), '/T'], { windowsHide: true, timeout: 5000 }).catch(() => {});
          if (alive()) {
            await delay(250);
            try {
              await execFileAsync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 5000 });
            } catch (error) {
              if (alive()) {
                errors.push(new Error(`Cannot stop ${name} process tree PID ${child.pid}: ${(error.stderr || error.message).trim()}`));
                // Try the direct child too; preserve the tree-cleanup error for operator action.
                try { child.kill('SIGTERM'); } catch { /* The error above identifies the owned PID. */ }
              }
            }
          }
        } else {
          try { process.kill(-child.pid, 'SIGTERM'); } catch (error) {
            if (error.code !== 'ESRCH') errors.push(error);
          }
          const deadline = Date.now() + 2000;
          while (alive() && Date.now() < deadline) await delay(50);
          if (alive()) {
            try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
              if (error.code !== 'ESRCH') errors.push(error);
            }
          }
        }
        const deadline = Date.now() + 1500;
        while (alive() && Date.now() < deadline) await delay(50);
        if (alive()) errors.push(new Error(`${name} PID ${child.pid} is still running after cleanup; terminate this test-owned process tree before retrying.`));
      } finally {
        // Failed OS cleanup must produce a failed report, never an indefinitely hanging runner.
        child.stdout?.unpipe(log);
        child.stderr?.unpipe(log);
        child.stdout?.destroy();
        child.stderr?.destroy();
        log.end();
        child.unref();
      }
    }
    if (errors.length) throw new AggregateError(errors, errors.map(error => error.message).join('\n'));
  })();
  return stopTask;
}

async function cleanup() {
  await Promise.allSettled(contexts.map(context => context.close()));
  await browser?.close().catch(() => {});
  await stopChildren();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { void cleanup().catch(error => console.error(error.message)).finally(() => process.exit(signal === 'SIGINT' ? 130 : 143)); });
}

function pdfFixture() {
  const content = 'BT /F1 12 Tf 50 740 Td (Fictitious candidate CV: ReactJS Python NLP and RAG research.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

async function api(context, method, endpoint, data) {
  const response = await context.request.fetch(`${webUrl}/api${endpoint}`, { method, data, headers: csrf });
  assert.ok(response.ok(), `${method} ${endpoint}: ${response.status()} ${await response.text()}`);
  return response.json();
}

async function newContext() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1040 }, locale: 'vi-VN', reducedMotion: 'reduce' });
  contexts.push(context);
  // No fonts, trackers, LLMs, crawlers or other external services are used by this suite.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && ['5174', '8001'].includes(url.port)) return route.continue();
    externalRequests.push(url.origin);
    return route.abort();
  });
  context.on('page', page => {
    page.setDefaultTimeout(15_000);
    page.on('pageerror', error => pageErrors.push(error.message));
  });
  return context;
}

async function expectMutation(page, suffix, method, action) {
  const pending = page.waitForResponse(response => response.url().endsWith(suffix) && response.request().method() === method);
  await action();
  const response = await pending;
  assert.ok(response.ok(), `${method} ${suffix}: ${response.status()} ${await response.text()}`);
  return response.json();
}

try {
  assert.ok(existsSync(python), `Python virtual environment missing: ${python}. Follow README setup first.`);
  assert.ok(existsSync(vite), 'Vite is missing. Run npm ci first.');
  await Promise.all([assertFreePort(8001), assertFreePort(5174)]);
  await mkdir(artifactDir, { recursive: true });
  console.log(`LabLink E2E artifacts: ${artifactDir}`);
  const apiServer = launch('api', python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8001'], path.join(root, 'apps', 'api'), {
    APP_ENV: 'development', SEED_DEMO: 'false', COOKIE_SECURE: 'false',
    DATABASE_URL: `sqlite:///${dbPath.replaceAll('\\', '/')}`,
    STORAGE_DIR: path.join(artifactDir, 'uploads'), FRONTEND_ORIGINS: webUrl,
    AI_MODE: 'local', OPENAI_API_KEY: '', PYTHONUNBUFFERED: '1',
  });
  await waitReady(apiServer, `${apiUrl}/api/health`);
  const webServer = launch('web', process.execPath, [vite, '--host', '127.0.0.1', '--port', '5174', '--strictPort'], path.join(root, 'apps', 'web'), { API_PROXY_TARGET: apiUrl });
  await waitReady(webServer, webUrl);
  checked('Isolated API and Vite started; existing ports 8000/5173 untouched');

  const channel = process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium');
  browser = await chromium.launch({ headless: true, ...(channel === 'chromium' ? {} : { channel }) });
  const lecturerContext = await newContext();
  const studentContext = await newContext();
  const shortId = runId.slice(0, 8);
  const studentName = 'E2E Student Researcher';
  const labName = `E2E Language Research ${shortId}`;
  await api(lecturerContext, 'POST', '/auth/register', { name: 'E2E Lecturer', email: `lecturer-${shortId}@example.test`, password, role: 'lecturer' });
  const lab = await api(lecturerContext, 'POST', '/labs', {
    name: labName, summary: 'Fictitious NLP lab for automated end-to-end verification.',
    description: 'Research natural language processing and retrieval augmented generation using Python and ReactJS.',
    topics: ['NLP', 'AI'], skills: ['Python', 'ReactJS'], min_gpa: 3.2, capacity: 2, location: 'Fictitious test room',
  });
  const paper = await api(lecturerContext, 'POST', `/labs/${lab.id}/publications`, {
    title: 'Fictitious RAG evaluation paper', abstract: 'NLP and Python evaluation of retrieval augmented generation.', year: 2026,
  });
  assert.ok(paper.topics.includes('NLP'), 'Manual research publications should be automatically classified.');
  const registration = await api(studentContext, 'POST', '/auth/register', {
    name: 'E2E Student', email: `student-${shortId}@example.test`, password, role: 'student',
  });
  checked('Separate fictitious lecturer/student accounts and classified lab research created');

  await studentContext.addInitScript(({ id, origin }) => {
    if (location.origin === origin) localStorage.setItem(`lablink-saved-${id}`, 'null');
  }, { id: registration.user.id, origin: webUrl });
  const studentPage = await studentContext.newPage();
  const initialProfile = studentPage.waitForResponse(response => response.url().endsWith('/api/profile') && response.request().method() === 'GET');
  await studentPage.goto(`${webUrl}/profile`);
  assert.equal((await initialProfile).status(), 200);
  await studentPage.getByLabel('Họ và tên', { exact: true }).waitFor();
  await studentPage.waitForFunction(() => document.querySelector('.profile-forms input')?.value === 'E2E Student');
  await studentPage.getByLabel('Họ và tên', { exact: true }).fill(studentName);
  await studentPage.getByLabel('Trường / Đơn vị').fill('Fictitious Test University');
  await studentPage.getByLabel('Ngành học / Chuyên môn').fill('Computer Science');
  await studentPage.getByRole('combobox', { name: /^Năm học/ }).selectOption('3');
  await studentPage.getByLabel('GPA (thang 4.0)', { exact: true }).fill('3.75');
  await studentPage.getByLabel('Giới thiệu bản thân', { exact: true }).fill('Fictitious student interested in reproducible NLP research.');
  await studentPage.getByLabel('Kỹ năng hiện có', { exact: true }).fill('Python, ReactJS, SQL');
  await studentPage.getByLabel('Chủ đề nghiên cứu quan tâm', { exact: true }).fill('NLP, AI');
  const saved = await expectMutation(studentPage, '/api/profile', 'PATCH', () => studentPage.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click());
  assert.equal(saved.name, studentName);
  assert.equal(saved.gpa, 3.75);
  assert.equal(saved.consent_ai, false);
  await studentPage.getByRole('status').filter({ hasText: 'Đã lưu hồ sơ' }).waitFor();
  checked('Student profile saved through UI, including GPA, skills and local-only consent');

  const pdfPath = path.join(artifactDir, 'fictitious-cv.pdf');
  await writeFile(pdfPath, pdfFixture());
  const document = await expectMutation(studentPage, '/api/documents', 'POST', () => studentPage.locator('input[type="file"]').setInputFiles(pdfPath));
  assert.equal(document.kind, 'cv');
  await studentPage.locator('.document-row').filter({ hasText: 'fictitious-cv.pdf' }).waitFor();
  await studentPage.screenshot({ path: path.join(artifactDir, 'student-profile.png'), fullPage: true });
  checked('Valid PDF uploaded and listed through the real file input');

  await studentPage.locator('nav a[href="/explore"]').click();
  await studentPage.locator('.card-title').filter({ hasText: labName }).waitFor();
  assert.equal(await studentPage.locator('.explore-grid .lab-card').count(), 1);
  assert.deepEqual(pageErrors, [], 'Corrupted saved favorites must not crash lab cards.');
  checked('Corrupted favorites JSON recovers safely and explorer renders');
  await studentPage.locator('.card-title').filter({ hasText: labName }).click();
  const labDialog = studentPage.getByRole('dialog', { name: labName, exact: true });
  await labDialog.getByText('Fictitious RAG evaluation paper', { exact: true }).waitFor();
  await labDialog.getByRole('button', { name: 'Ứng tuyển vào lab', exact: true }).click();
  await labDialog.getByLabel('Lời giới thiệu với giảng viên', { exact: true }).fill('Em mong muốn nghiên cứu NLP, xây dựng hệ thống RAG và đánh giá khả năng truy xuất có kiểm chứng.');
  const application = await expectMutation(studentPage, '/api/applications', 'POST', () => labDialog.getByRole('button', { name: 'Gửi hồ sơ', exact: true }).click());
  assert.equal(application.status, 'submitted');
  assert.equal(application.documents[0].id, document.id);
  await studentPage.getByRole('status').filter({ hasText: 'Đã gửi hồ sơ' }).waitFor();
  await labDialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  checked('Lab details and research rendered; student applied with CV snapshot through UI');

  await studentPage.locator('nav a[href="/assistant"]').click();
  await studentPage.getByRole('textbox', { name: 'Nhập câu hỏi cho trợ lý nghiên cứu' }).fill('Tìm lab nghiên cứu NLP với kỹ năng Python');
  const reply = await expectMutation(studentPage, '/api/ai/chat', 'POST', () => studentPage.getByRole('button', { name: 'Gửi câu hỏi', exact: true }).click());
  assert.equal(reply.mode, 'local');
  assert.ok(reply.sources.some(source => source.type === 'lab' && source.entity_id === lab.id));
  await studentPage.locator(`.chat-sources a[href="/explore?lab=${lab.id}"]`).waitFor();
  await studentPage.screenshot({ path: path.join(artifactDir, 'student-rag.png'), fullPage: true });
  checked('Local RAG returns grounded sources with working internal lab links');

  const lecturerPage = await lecturerContext.newPage();
  await lecturerPage.goto(`${webUrl}/applications`);
  const candidate = lecturerPage.locator('.candidate-card').filter({ hasText: studentName });
  await candidate.waitFor();
  await lecturerPage.screenshot({ path: path.join(artifactDir, 'lecturer-kanban.png'), fullPage: true });
  await candidate.getByRole('button', { name: studentName, exact: true }).click();
  const candidateDialog = lecturerPage.getByRole('dialog', { name: studentName, exact: true });
  await candidateDialog.locator(`a[href="/api/documents/${document.id}/download"]`).waitFor();
  const download = await lecturerContext.request.get(`${webUrl}/api/documents/${document.id}/download`);
  assert.equal(download.status(), 200);
  assert.ok((await download.body()).subarray(0, 5).equals(Buffer.from('%PDF-')));
  for (const [status, label] of [['reviewing', 'Đang duyệt CV'], ['interview', 'Phỏng vấn'], ['accepted', 'Đã chấp nhận']]) {
    await candidateDialog.getByLabel('Ghi chú cho bước xử lý', { exact: true }).fill(`E2E: verified ${status}`);
    const changed = await expectMutation(lecturerPage, `/api/applications/${application.id}/status`, 'PATCH', () => candidateDialog.getByRole('button', { name: `Chuyển: ${label}`, exact: true }).click());
    assert.equal(changed.status, status);
    await candidateDialog.locator('.application-detail-top .status').filter({ hasText: label }).waitFor();
  }
  checked('Lecturer Kanban opens candidate/CV and advances reviewing → interview → accepted with notes');

  await studentPage.goto(`${webUrl}/applications`);
  await studentPage.locator('.application-card .status-accepted').waitFor();
  await studentPage.locator('.application-card').getByRole('button', { name: 'Xem hồ sơ', exact: true }).click();
  const resultDialog = studentPage.getByRole('dialog', { name: labName, exact: true });
  await resultDialog.getByText('E2E: verified accepted', { exact: true }).waitFor();
  assert.equal(await resultDialog.locator('.timeline > div').count(), 4);
  assert.equal(await resultDialog.getByRole('button', { name: 'Rút hồ sơ ứng tuyển', exact: true }).count(), 0);
  await studentPage.screenshot({ path: path.join(artifactDir, 'student-accepted-history.png'), fullPage: true });
  await resultDialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  checked('Student sees acceptance and full audit history; completed application cannot be withdrawn');

  // Expire only this suite's SQLite session, then exercise the live shell's 401 handling.
  await execFileAsync(python, ['-c', "import sqlite3,sys; db=sqlite3.connect(sys.argv[1]); db.execute(\"UPDATE sessions SET expires_at='2000-01-01 00:00:00.000000' WHERE user_id=?\", (int(sys.argv[2]),)); db.commit(); db.close()", dbPath, String(registration.user.id)], { windowsHide: true });
  await studentPage.locator('nav a[href="/profile"]').click();
  await studentPage.getByLabel('Họ và tên', { exact: true }).waitFor();
  const expired = studentPage.waitForResponse(response => response.url().endsWith('/api/profile') && response.request().method() === 'PATCH');
  await studentPage.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  assert.equal((await expired).status(), 401);
  await studentPage.getByRole('heading', { name: 'Chào bạn trở lại.', exact: true }).waitFor();
  assert.equal(await studentPage.locator('.app-shell').count(), 0);
  await studentPage.screenshot({ path: path.join(artifactDir, 'expired-session-login.png'), fullPage: true });
  checked('Expired server session returns the current UI to sign-in and clears private shell');
  assert.deepEqual(pageErrors, [], 'Browser must have no uncaught JavaScript errors.');
  assert.deepEqual(externalRequests, [], 'The workflow must make no external network requests.');
  checked('No uncaught browser errors or external network calls');
} catch (error) {
  failure = error;
  console.error(error.stack || error.message || String(error));
  if (existsSync(artifactDir)) {
    for (const [index, context] of contexts.entries()) {
      for (const [pageIndex, page] of context.pages().entries()) {
        await page.screenshot({ path: path.join(artifactDir, `failure-${index}-${pageIndex}.png`), fullPage: true }).catch(() => {});
      }
    }
  }
} finally {
  try {
    await cleanup();
  } catch (error) {
    cleanupErrors.push(error.message);
    failure ||= error;
    console.error(`Cleanup failed: ${error.message}`);
  }
  if (existsSync(artifactDir)) {
    await writeFile(path.join(artifactDir, 'report.json'), JSON.stringify({ passed: !failure, checks, pageErrors, externalRequests, cleanupErrors, processes: children.map(({ name, child }) => ({ name, pid: child.pid, exitCode: child.exitCode, signalCode: child.signalCode })), error: failure?.message }, null, 2));
    console.log(`Artifacts retained: ${artifactDir}`);
  }
  process.exitCode = failure ? 1 : 0;
}
