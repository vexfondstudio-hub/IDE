/**
 * tools-updater.js
 * ---------------------------------------------------------------------------
 * Модуль автоматической загрузки и установки "инструментов" Joker IDE
 * из GitHub-репозитория vexfondstudio-hub/IDE (папка /tools).
 *
 * Как это работает:
 *  1. При старте приложения (и затем периодически) модуль запрашивает у GitHub
 *     список файлов в папке TOOLS_PATH через GitHub Contents API.
 *  2. Для каждого файла сравнивается его sha с тем, что уже установлен
 *     локально (хранится в manifest.json).
 *  3. Новые или изменённые файлы скачиваются и сохраняются в локальную папку
 *     инструментов приложения.
 *  4. Если передан callback onToolsChanged — он вызывается со списком
 *     установленных/обновлённых инструментов, чтобы приложение могло
 *     подгрузить их (require/import) без перезапуска.
 *
 * Использование (Electron main process или обычный Node.js):
 *
 *   const { ToolsUpdater } = require('./tools-updater');
 *
 *   const updater = new ToolsUpdater({
 *     owner: 'vexfondstudio-hub',
 *     repo: 'IDE',
 *     toolsPath: 'tools',
 *     installDir: path.join(app.getPath('userData'), 'tools'),
 *     // токен нужен только если репозиторий приватный или чтобы поднять
 *     // лимит запросов к GitHub API (без токена — 60 запросов/час)
 *     githubToken: process.env.GITHUB_TOKEN || null,
 *     onToolsChanged: (changedTools) => {
 *       changedTools.forEach(t => console.log('Установлен инструмент:', t.name));
 *       // здесь можно динамически require() новый файл, если это .js-плагин
 *     }
 *   });
 *
 *   updater.checkNow();              // разовая проверка сразу
 *   updater.startAutoCheck(5 * 60_000); // и проверять каждые 5 минут
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

class ToolsUpdater {
  constructor(options) {
    this.owner = options.owner;
    this.repo = options.repo;
    this.toolsPath = options.toolsPath || 'tools';
    this.installDir = options.installDir;
    this.githubToken = options.githubToken || null;
    this.onToolsChanged = options.onToolsChanged || (() => {});
    this.onError = options.onError || ((err) => console.error('[ToolsUpdater]', err));

    this._timer = null;
    this._manifestPath = path.join(this.installDir, 'manifest.json');

    if (!fs.existsSync(this.installDir)) {
      fs.mkdirSync(this.installDir, { recursive: true });
    }
  }

  // --- Манифест уже установленных инструментов (имя файла -> sha) ---------
  _loadManifest() {
    try {
      const raw = fs.readFileSync(this._manifestPath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  _saveManifest(manifest) {
    fs.writeFileSync(this._manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  // --- Низкоуровневый HTTPS GET с поддержкой JSON и бинарных файлов -------
  _request(url, { json = true } = {}) {
    return new Promise((resolve, reject) => {
      const headers = {
        'User-Agent': 'Joker-IDE-Tools-Updater',
        Accept: json ? 'application/vnd.github+json' : 'application/octet-stream',
      };
      if (this.githubToken) {
        headers.Authorization = `Bearer ${this.githubToken}`;
      }

      https
        .get(url, { headers }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            // обработка редиректов (например, для download_url)
            this._request(res.headers.location, { json }).then(resolve).catch(reject);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub вернул статус ${res.statusCode} для ${url}`));
            res.resume();
            return;
          }

          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve(json ? JSON.parse(buffer.toString('utf8')) : buffer);
          });
        })
        .on('error', reject);
    });
  }

  // --- Получить список файлов в папке /tools репозитория ------------------
  async _fetchRemoteToolsList() {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${this.toolsPath}`;
    const items = await this._request(url, { json: true });
    if (!Array.isArray(items)) {
      throw new Error('Папка с инструментами не найдена или репозиторий недоступен (проверь права/токен)');
    }
    // оставляем только файлы (не подпапки)
    return items.filter((item) => item.type === 'file');
  }

  // --- Основная проверка и установка ---------------------------------------
  async checkNow() {
    try {
      const manifest = this._loadManifest();
      const remoteFiles = await this._fetchRemoteToolsList();
      const changed = [];

      for (const file of remoteFiles) {
        const known = manifest[file.name];
        if (known && known.sha === file.sha) {
          continue; // файл не изменился, пропускаем
        }

        const content = await this._request(file.download_url, { json: false });
        const localPath = path.join(this.installDir, file.name);
        fs.writeFileSync(localPath, content);

        manifest[file.name] = { sha: file.sha, installedAt: new Date().toISOString() };
        changed.push({ name: file.name, path: localPath, sha: file.sha });
      }

      this._saveManifest(manifest);

      if (changed.length > 0) {
        this.onToolsChanged(changed);
      }

      return changed;
    } catch (err) {
      this.onError(err);
      return [];
    }
  }

  // --- Периодическая проверка ----------------------------------------------
  startAutoCheck(intervalMs = 5 * 60 * 1000) {
    this.stopAutoCheck();
    this._timer = setInterval(() => this.checkNow(), intervalMs);
    return this._timer;
  }

  stopAutoCheck() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

module.exports = { ToolsUpdater };
