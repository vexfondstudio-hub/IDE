/**
 * Пример интеграции ToolsUpdater в главный процесс Electron-приложения
 * Joker IDE. Файл показывает, куда вставить вызовы в существующий main.js.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { ToolsUpdater } = require('./tools-updater');

let mainWindow;
let toolsUpdater;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  toolsUpdater = new ToolsUpdater({
    owner: 'vexfondstudio-hub',
    repo: 'IDE',
    toolsPath: 'tools',
    installDir: path.join(app.getPath('userData'), 'tools'),
    // Если репозиторий приватный — нужен Personal Access Token с правом
    // "repo: read" (Settings -> Developer settings -> Tokens).
    // Хранить токен лучше не в коде, а в переменной окружения или
    // в зашифрованном виде через electron-store/keytar.
    githubToken: process.env.JOKER_GITHUB_TOKEN || null,

    onToolsChanged: (changedTools) => {
      console.log('Новые/обновлённые инструменты:', changedTools.map((t) => t.name));

      // Сообщаем интерфейсу (renderer process), что появились новые инструменты,
      // чтобы можно было показать уведомление пользователю.
      if (mainWindow) {
        mainWindow.webContents.send('tools-updated', changedTools);
      }
    },

    onError: (err) => {
      console.error('Ошибка обновления инструментов:', err.message);
    },
  });

  // Проверяем сразу при запуске приложения...
  toolsUpdater.checkNow();

  // ...и затем каждые 5 минут, пока приложение открыто.
  toolsUpdater.startAutoCheck(5 * 60 * 1000);

  // Позволяем пользователю проверить вручную (например, по кнопке "Обновить" в UI)
  ipcMain.handle('check-tools-now', async () => {
    return await toolsUpdater.checkNow();
  });
});

app.on('window-all-closed', () => {
  if (toolsUpdater) toolsUpdater.stopAutoCheck();
  if (process.platform !== 'darwin') app.quit();
});
