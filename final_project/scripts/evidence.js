// Starts a clean isolated server and records actual curl.exe/curl output.
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const app = require('../index');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'evidence');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bookshop-evidence-'));
const curl = process.platform === 'win32' ? 'curl.exe' : 'curl';
const repo = process.env.GITHUB_REPO || 'asikxz008/expressBookReviews';
const sections = [];

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookie = path.join(temp, 'cookies.txt');
  // spawnSync would block the server's event loop, so run curl asynchronously.
  async function record(name, args, displayed = args) {
    const { spawn } = require('node:child_process');
    const child = spawn(curl, ['--silent', '--show-error', '--fail-with-body', '--max-time', '20', ...args], { cwd: temp });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const [code] = await once(child, 'close');
    if (code) throw new Error(`${name}: curl exit ${code}: ${stderr} ${stdout}`);
    const command = [curl, '--silent', '--show-error', '--fail-with-body', '--max-time', '20', ...displayed].map(arg => /[\s&]/.test(arg) || arg.startsWith('@') ? `"${arg}"` : arg).join(' ');
    const content = `$ ${command}\n${stdout.trim()}\n`;
    fs.writeFileSync(path.join(output, `${name}.txt`), content);
    sections.push(`## ${name}\n\n\x60\x60\x60text\n${content}\x60\x60\x60\n`);
    console.log(`Saved ${name}`);
    return JSON.parse(stdout);
  }
  try {
    const metadata = await record('githubrepo', ['-H', 'Accept: application/vnd.github+json', `https://api.github.com/repos/${repo}`]);
    if (!metadata.fork || metadata.parent?.full_name !== 'ibm-developer-skills-network/expressBookReviews') throw new Error('GitHub repository is not the required IBM fork');
    await record('getallbooks', [base + '/']);
    await record('getbooksbyISBN', [base + '/isbn/1']);
    await record('getbooksbyauthor', [base + '/author/Unknown']);
    await record('getbooksbytitle', [base + '/title/Things%20Fall%20Apart']);
    await record('getbookreview', [base + '/review/1']);
    const credentials = JSON.stringify({ username: 'student_demo', password: 'DemoPass123!' });
    fs.writeFileSync(path.join(temp, 'credentials.json'), credentials);
    fs.writeFileSync(path.join(output, 'credentials.json'), credentials + '\n');
    await record('register', ['-X', 'POST', '-H', 'Content-Type: application/json', '--data-binary', '@credentials.json', base + '/register']);
    await record('login', ['-X', 'POST', '-H', 'Content-Type: application/json', '--data-binary', '@credentials.json', '-c', cookie, base + '/customer/login'],
      ['-X', 'POST', '-H', 'Content-Type: application/json', '--data-binary', '@credentials.json', '-c', 'cookies.txt', base + '/customer/login']);
    const reviewURL = base + '/customer/auth/review/1';
    await record('reviewadded', ['-X', 'PUT', '-b', cookie, reviewURL + '?review=A%20thought-provoking%20book.'], ['-X', 'PUT', '-b', 'cookies.txt', reviewURL + '?review=A%20thought-provoking%20book.']);
    await record('reviewupdated', ['-X', 'PUT', '-b', cookie, reviewURL + '?review=Updated%20review%3A%20highly%20recommended.'], ['-X', 'PUT', '-b', 'cookies.txt', reviewURL + '?review=Updated%20review%3A%20highly%20recommended.']);
    await record('deletereview', ['-X', 'DELETE', '-b', cookie, reviewURL], ['-X', 'DELETE', '-b', 'cookies.txt', reviewURL]);
    fs.writeFileSync(path.join(output, 'submission.txt'),
      'ОТВЕТЫ ДЛЯ СДАЧИ\n\nВсе ответы ниже получены фактическим запуском cURL. Порт выделен автоматически для этого прогона.\n' +
      'credentials.json содержит только вымышленные учебные данные. cookies.txt создаётся командой входа.\n\n' +
      sections.join('\n') + `\n## general.js (задание 11)\nhttps://github.com/${repo}/blob/main/final_project/router/general.js\n`);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp, { recursive: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
