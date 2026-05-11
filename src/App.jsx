import { useEffect, useMemo, useState } from 'react';
import './App.css';

// Адрес backend API. Через настройки Vite запросы /api уходят на сервер server.js.
const API_URL = '/api/books';

// Пустая форма используется при добавлении новой книги и при сбросе модального окна.
const EMPTY_FORM = {
  title: '',
  author: '',
  year: '',
  category: 'Художественная литература',
  status: 'to-read',
  isFavorite: false,
  isRecentlyRead: false,
  description: '',
};

// Списки для выпадающих фильтров и формы книги. Здесь можно добавить новые категории.
const CATEGORIES = [
  'Все категории',
  'Художественная литература',
  'Научно-популярная литература',
  'Биография',
  'Наука',
  'Программирование',
];

// Статусы книги: прочитана или запланирована к чтению.
const STATUSES = [
  { value: 'all', label: 'Все статусы' },
  { value: 'read', label: 'Прочитано' },
  { value: 'to-read', label: 'К прочтению' },
];

// Варианты сортировки на главной странице.
const SORT_OPTIONS = [
  { value: 'title', label: 'По названию' },
  { value: 'author', label: 'По автору' },
  { value: 'year', label: 'По году' },
];

// Формирует адрес страницы подробной информации о книге.
const getBookPath = (id) => `/book/${id}`;

function App() {
  // Основные данные приложения и служебные состояния загрузки/ошибок.
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Состояния фильтров, поиска и сортировки на главной странице.
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Все категории');
  const [status, setStatus] = useState('all');
  const [sortBy, setSortBy] = useState('title');

  // Простая маршрутизация SPA: React сам меняет адрес без перезагрузки страницы.
  const [route, setRoute] = useState(window.location.pathname);

  // Состояния формы добавления/редактирования книги.
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Следим за кнопками браузера "назад" и "вперёд".
  useEffect(() => {
    const handleRouteChange = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  // Определяем, открыта ли страница конкретной книги вида /book/123.
  const currentBookId = route.startsWith('/book/') ? Number(route.split('/')[2]) : null;
  const currentBook = books.find((book) => book.id === currentBookId);

  // Здесь выполняются поиск, фильтрация и сортировка списка книг.
  const filteredBooks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...books]
      .filter((book) => category === 'Все категории' || book.category === category)
      .filter((book) => status === 'all' || book.status === status)
      .filter((book) => {
        if (!normalizedSearch) return true;
        return (
          book.title.toLowerCase().includes(normalizedSearch) ||
          book.author.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'year') return Number(b.year) - Number(a.year);
        return String(a[sortBy]).localeCompare(String(b[sortBy]), 'ru');
      });
  }, [books, category, search, sortBy, status]);

  // Небольшая статистика для верхних карточек на главной странице.
  const stats = useMemo(() => {
    const read = books.filter((book) => book.status === 'read').length;
    const favorite = books.filter((book) => book.isFavorite).length;
    return { total: books.length, read, favorite };
  }, [books]);

  // Первичная загрузка книг с backend API при открытии приложения.
  useEffect(() => {
    let isActive = true;

    fetch(API_URL)
      .then((response) => {
        if (!response.ok) throw new Error('Не удалось загрузить книги');
        return response.json();
      })
      .then((data) => {
        if (isActive) setBooks(data);
      })
      .catch((requestError) => {
        if (isActive) setError(requestError.message);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  // Переход между страницами SPA без полной перезагрузки браузера.
  function navigate(path) {
    window.history.pushState({}, '', path);
    setRoute(path);
  }

  // Открывает форму в режиме создания новой книги.
  function openCreateForm() {
    setEditingBook(null);
    setForm({ ...EMPTY_FORM });
    setIsFormOpen(true);
  }

  // Открывает форму в режиме редактирования выбранной книги.
  function openEditForm(book) {
    setEditingBook(book);
    setForm({
      title: book.title,
      author: book.author,
      year: String(book.year),
      category: book.category,
      status: book.status,
      isFavorite: Boolean(book.isFavorite),
      isRecentlyRead: Boolean(book.isRecentlyRead),
      description: book.description || '',
    });
    setIsFormOpen(true);
  }

  // Закрывает форму и возвращает поля к начальному состоянию.
  function closeForm() {
    setIsFormOpen(false);
    setEditingBook(null);
    setForm({ ...EMPTY_FORM });
  }

  // Сохраняет книгу: POST создаёт новую, PUT обновляет существующую.
  async function saveBook(event) {
    event.preventDefault();

    const payload = {
      ...form,
      title: form.title.trim(),
      author: form.author.trim(),
      year: Number(form.year),
      description: form.description.trim(),
    };

    if (!payload.title || !payload.author || !payload.year) return;

    const url = editingBook ? `${API_URL}/${editingBook.id}` : API_URL;
    const method = editingBook ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setError('Не удалось сохранить книгу');
      return;
    }

    const savedBook = await response.json();
    setBooks((current) => (
      editingBook
        ? current.map((book) => (book.id === savedBook.id ? savedBook : book))
        : [savedBook, ...current]
    ));
    closeForm();
  }

  // Удаляет книгу и возвращает пользователя на главную, если он был на странице этой книги.
  async function deleteBook(bookId) {
    const response = await fetch(`${API_URL}/${bookId}`, { method: 'DELETE' });

    if (!response.ok) {
      setError('Не удалось удалить книгу');
      return;
    }

    setBooks((current) => current.filter((book) => book.id !== bookId));
    if (currentBookId === bookId) navigate('/');
  }

  // Переключает флаги isFavorite и isRecentlyRead через обновление книги на сервере.
  async function updateBookFlag(book, key) {
    const nextBook = { ...book, [key]: !book[key] };
    const response = await fetch(`${API_URL}/${book.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextBook),
    });

    if (!response.ok) return;

    const savedBook = await response.json();
    setBooks((current) => current.map((item) => (item.id === savedBook.id ? savedBook : item)));
  }

  if (isLoading) {
    return (
      <div className="loader-screen">
        <div className="loader" />
        <p>Загружаем библиотеку...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('/')}>
          Моя библиотека
        </button>
        <nav>
          <button className={route === '/' ? 'nav-button active' : 'nav-button'} onClick={() => navigate('/')}>
            Все книги
          </button>
          <button className="primary-button" onClick={openCreateForm}>
            Добавить книгу
          </button>
        </nav>
      </header>

      <main className="page">
        {error && <div className="message error">{error}</div>}

        {route === '/' ? (
          <>
            <section className="overview">
              <div>
                <span>Всего книг</span>
                <strong>{stats.total}</strong>
              </div>
              <div>
                <span>Прочитано</span>
                <strong>{stats.read}</strong>
              </div>
              <div>
                <span>Избранные</span>
                <strong>{stats.favorite}</strong>
              </div>
            </section>

            <section className="controls" aria-label="Фильтры библиотеки">
              <input
                type="search"
                placeholder="Поиск по названию или автору"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                {SORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </section>

            <section className="book-grid">
              {filteredBooks.length ? (
                filteredBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onOpen={() => navigate(getBookPath(book.id))}
                    onEdit={() => openEditForm(book)}
                    onDelete={() => deleteBook(book.id)}
                    onFavorite={() => updateBookFlag(book, 'isFavorite')}
                  />
                ))
              ) : (
                <div className="empty-state">Книги не найдены. Попробуйте изменить фильтры.</div>
              )}
            </section>
          </>
        ) : (
          <BookDetails
            book={currentBook}
            onBack={() => navigate('/')}
            onEdit={openEditForm}
            onDelete={deleteBook}
            onFavorite={(book) => updateBookFlag(book, 'isFavorite')}
            onRecentlyRead={(book) => updateBookFlag(book, 'isRecentlyRead')}
          />
        )}
      </main>

      {isFormOpen && (
        <BookForm
          form={form}
          editingBook={editingBook}
          onChange={setForm}
          onClose={closeForm}
          onSubmit={saveBook}
        />
      )}
    </div>
  );
}

// Карточка книги в общем списке.
function BookCard({ book, onOpen, onEdit, onDelete, onFavorite }) {
  const read = book.status === 'read';

  return (
    <article className={read ? 'book-card read' : 'book-card'}>
      <button className="card-body" onClick={onOpen}>
        <div className="card-heading">
          <span className="book-category">{book.category}</span>
          {book.isFavorite && <span className="badge favorite">Избранное</span>}
          {book.isRecentlyRead && <span className="badge recent">Недавно прочитано</span>}
        </div>
        <h2>{book.title}</h2>
        <p>{book.author}</p>
        <div className="book-meta">
          <span>{book.year}</span>
          <span>{read ? 'Прочитано' : 'К прочтению'}</span>
        </div>
      </button>
      <div className="card-actions">
        <button onClick={onFavorite}>{book.isFavorite ? 'Убрать из избранного' : 'В избранное'}</button>
        <button onClick={onEdit}>Редактировать</button>
        <button className="danger" onClick={onDelete}>Удалить</button>
      </div>
    </article>
  );
}

// Страница с полной информацией о выбранной книге.
function BookDetails({ book, onBack, onEdit, onDelete, onFavorite, onRecentlyRead }) {
  if (!book) {
    return (
      <section className="details-panel">
        <button className="secondary-button" onClick={onBack}>Назад к списку</button>
        <div className="empty-state">Книга не найдена.</div>
      </section>
    );
  }

  return (
    <section className={book.status === 'read' ? 'details-panel read' : 'details-panel'}>
      <button className="secondary-button" onClick={onBack}>Назад к списку</button>
      <div className="details-header">
        <div>
          <span className="book-category">{book.category}</span>
          <h1>{book.title}</h1>
          <p>{book.author}</p>
        </div>
        <div className="details-actions">
          <button onClick={() => onFavorite(book)}>{book.isFavorite ? 'Не избранная' : 'Избранная'}</button>
          <button onClick={() => onRecentlyRead(book)}>
            {book.isRecentlyRead ? 'Обычная' : 'Недавно прочитана'}
          </button>
        </div>
      </div>

      <dl className="details-list">
        <div>
          <dt>Год издания</dt>
          <dd>{book.year}</dd>
        </div>
        <div>
          <dt>Статус</dt>
          <dd>{book.status === 'read' ? 'Прочитано' : 'К прочтению'}</dd>
        </div>
        <div>
          <dt>Идентификатор</dt>
          <dd>#{book.id}</dd>
        </div>
      </dl>

      <p className="description">{book.description || 'Описание пока не добавлено.'}</p>

      <div className="wide-actions">
        <button className="primary-button" onClick={() => onEdit(book)}>Редактировать</button>
        <button className="danger-button" onClick={() => onDelete(book.id)}>Удалить</button>
      </div>
    </section>
  );
}

// Модальное окно для добавления и редактирования книги.
function BookForm({ form, editingBook, onChange, onClose, onSubmit }) {
  const updateField = (field, value) => onChange({ ...form, [field]: value });

  return (
    <div className="modal-backdrop">
      <form className="book-form" onSubmit={onSubmit}>
        <div className="form-header">
          <h2>{editingBook ? 'Редактировать книгу' : 'Добавить книгу'}</h2>
          <button type="button" onClick={onClose}>x</button>
        </div>

        <label>
          Название
          <input value={form.title} onChange={(event) => updateField('title', event.target.value)} required />
        </label>
        <label>
          Автор
          <input value={form.author} onChange={(event) => updateField('author', event.target.value)} required />
        </label>
        <label>
          Год издания
          <input
            type="number"
            min="1"
            max="2100"
            value={form.year}
            onChange={(event) => updateField('year', event.target.value)}
            required
          />
        </label>
        <label>
          Категория
          <select value={form.category} onChange={(event) => updateField('category', event.target.value)}>
            {CATEGORIES.filter((item) => item !== 'Все категории').map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Статус
          <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
            <option value="to-read">К прочтению</option>
            <option value="read">Прочитано</option>
          </select>
        </label>
        <label>
          Описание
          <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} />
        </label>

        <div className="checkbox-row">
          <label>
            <input
              type="checkbox"
              checked={form.isFavorite}
              onChange={(event) => updateField('isFavorite', event.target.checked)}
            />
            Избранная книга
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.isRecentlyRead}
              onChange={(event) => updateField('isRecentlyRead', event.target.checked)}
            />
            Недавно прочитана
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Отмена</button>
          <button type="submit" className="primary-button">Сохранить</button>
        </div>
      </form>
    </div>
  );
}

export default App;
