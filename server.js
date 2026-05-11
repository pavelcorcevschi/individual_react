import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Настройки сервера и путь к JSON-файлу, который играет роль простой базы данных.
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'data', 'books.json');
const DIST_DIR = path.join(__dirname, 'dist');

// Типы файлов нужны, когда сервер отдаёт собранный frontend из папки dist.
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Читает все книги из JSON-базы.
async function readBooks() {
  const content = await readFile(DB_PATH, 'utf8');
  return JSON.parse(content);
}

// Перезаписывает JSON-базу после добавления, редактирования или удаления книги.
async function writeBooks(books) {
  await writeFile(DB_PATH, JSON.stringify(books, null, 2), 'utf8');
}

// Получает JSON-данные, отправленные из формы на frontend.
async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

// Отправляет ответ API в формате JSON.
function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

// Приводит данные книги к единому виду перед сохранением.
function normalizeBook(book, id) {
  return {
    id,
    title: String(book.title || '').trim(),
    author: String(book.author || '').trim(),
    year: Number(book.year),
    category: String(book.category || 'Художественная литература'),
    status: book.status === 'read' ? 'read' : 'to-read',
    isFavorite: Boolean(book.isFavorite),
    isRecentlyRead: Boolean(book.isRecentlyRead),
    description: String(book.description || '').trim(),
  };
}

// Все API-маршруты для книг: получить, добавить, изменить, удалить.
async function handleApi(request, response, url) {
  const books = await readBooks();
  const id = Number(url.pathname.split('/')[3]);

  if (request.method === 'GET' && url.pathname === '/api/books') {
    sendJson(response, 200, books);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/books') {
    const body = await readRequestBody(request);
    const nextId = Math.max(0, ...books.map((book) => book.id)) + 1;
    const newBook = normalizeBook(body, nextId);

    if (!newBook.title || !newBook.author || !newBook.year) {
      sendJson(response, 400, { message: 'Заполните название, автора и год' });
      return;
    }

    const nextBooks = [newBook, ...books];
    await writeBooks(nextBooks);
    sendJson(response, 201, newBook);
    return;
  }

  if (request.method === 'PUT' && id) {
    const index = books.findIndex((book) => book.id === id);
    if (index === -1) {
      sendJson(response, 404, { message: 'Книга не найдена' });
      return;
    }

    const body = await readRequestBody(request);
    const updatedBook = normalizeBook(body, id);
    books[index] = updatedBook;
    await writeBooks(books);
    sendJson(response, 200, updatedBook);
    return;
  }

  if (request.method === 'DELETE' && id) {
    const nextBooks = books.filter((book) => book.id !== id);
    if (nextBooks.length === books.length) {
      sendJson(response, 404, { message: 'Книга не найдена' });
      return;
    }

    await writeBooks(nextBooks);
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 404, { message: 'Маршрут не найден' });
}

// Отдаёт frontend после npm run build. Для SPA неизвестные адреса ведут на index.html.
async function serveStatic(response, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(DIST_DIR, requestedPath);
  const finalPath = existsSync(filePath) ? filePath : path.join(DIST_DIR, 'index.html');

  if (!existsSync(finalPath)) {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('API работает. Соберите фронтенд командой npm run build, чтобы открыть приложение через этот сервер.');
    return;
  }

  const extension = path.extname(finalPath);
  const content = await readFile(finalPath);
  response.writeHead(200, { 'Content-Type': contentTypes[extension] || 'application/octet-stream' });
  response.end(content);
}

// Главная точка входа backend-сервера.
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, 500, { message: error.message });
  }
}).listen(PORT, () => {
  console.log(`Library API is running on http://localhost:${PORT}`);
});
