import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Buyer from './pages/Buyer';
import Admin from './pages/Admin';
import Executor from './pages/Executor';
import './styles/index.css';

// 登录组件
const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!credentials.username.trim() || !credentials.password.trim()) {
      alert('Заполните все поля');
      return;
    }

    setLoading(true);

    try {
      if (isRegistering) {
        // Регистрация нового пользователя
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: credentials.username,
            password: credentials.password,
            role: 'buyer'
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Ошибка регистрации');
        }

        alert(result.message || 'Регистрация успешна! Теперь войдите в систему.');
        setIsRegistering(false);
      } else {
        // Вход в систему через API
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: credentials.username,
            password: credentials.password
          })
        });

        const result = await response.json();

        if (response.ok && result.user) {
          console.log('Успешная аутентификация для пользователя:', result.user.username);
          onLogin(result.user);
        } else {
          const errorMessage = result.error || 'Ошибка входа в систему';
          console.error('Ошибка аутентификации:', errorMessage);
          alert(errorMessage);
        }
      }
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Произошла ошибка при ' + (isRegistering ? 'регистрации' : 'входе'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="card max-w-md w-full">
        <div className="card-header text-center">
          <h1 className="text-2xl font-bold text-black mb-2">
            ЦИФРОВАЯ СРЕДА NIGHTINGALE
          </h1>
          <p className="text-gray-600">
            {isRegistering ? 'Регистрация в системе' : 'Вход в систему'}
          </p>
        </div>
        
        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-black">
                Имя пользователя
              </label>
              <input
                type="text"
                name="username"
                className="input w-full"
                value={credentials.username}
                onChange={handleInputChange}
                placeholder="Введите имя пользователя"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-black">
                Пароль
              </label>
              <input
                type="password"
                name="password"
                className="input w-full"
                value={credentials.password}
                onChange={handleInputChange}
                placeholder="Введите пароль"
                required
              />
            </div>
            
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'Подождите...' : (isRegistering ? 'Зарегистрироваться' : 'Войти')}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <button
              className="btn btn-ghost"
              onClick={() => setIsRegistering(!isRegistering)}
              disabled={loading}
            >
              {isRegistering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </button>
          </div>
          

        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Проверяем сохраненные данные пользователя
    try {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser && savedUser !== 'undefined' && savedUser !== 'null') {
        const parsedUser = JSON.parse(savedUser);
        // Валидируем структуру пользователя
        if (parsedUser && parsedUser.id && parsedUser.username && parsedUser.role) {
          setCurrentUser(parsedUser);
        } else {
          console.warn('Некорректная структура пользователя:', parsedUser);
          localStorage.removeItem('currentUser');
        }
      }
    } catch (error) {
      console.error('Ошибка восстановления пользователя:', error);
      localStorage.removeItem('currentUser');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (user) => {
    try {
      // Валидируем структуру пользователя перед сохранением
      if (!user || !user.id || !user.username || !user.role) {
        throw new Error('Некорректная структура пользователя');
      }
      
      console.log('Успешный вход пользователя:', user.username, 'Роль:', user.role);
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
    } catch (error) {
      console.error('Ошибка при сохранении пользователя:', error);
      alert('Ошибка входа в систему. Попробуйте еще раз.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-blue mx-auto mb-4"></div>
          <p className="text-gray-500">Загрузка приложения...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  // Определяем компонент для отображения на основе роли пользователя
  const getUserComponent = () => {
    // Дополнительная проверка на существование пользователя
    if (!currentUser || !currentUser.role) {
      console.error('Пользователь не найден или некорректен:', currentUser);
      return <Login onLogin={handleLogin} />;
    }

    try {
      switch (currentUser.role) {
        case 'admin':
          return currentUser.id === 1 ? <Admin /> : <Navigate to="/buyer" replace />;
        case 'executor':
          return <Executor />;
        case 'buyer':
        default:
          return <Buyer />;
      }
    } catch (error) {
      console.error('Ошибка рендеринга компонента пользователя:', error);
      // Сбрасываем пользователя при ошибке
      setCurrentUser(null);
      localStorage.removeItem('currentUser');
      return <Login onLogin={handleLogin} />;
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={getUserComponent()} />
        <Route path="/buyer" element={
          currentUser && currentUser.role ? <Buyer /> : <Navigate to="/" replace />
        } />
        <Route 
          path="/admin" 
          element={
            currentUser && currentUser.id === 1 ? 
              <Admin /> : 
              <Navigate to="/" replace />
          } 
        />
        <Route 
          path="/executor" 
          element={
            currentUser && currentUser.role === 'executor' ? 
              <Executor /> : 
              <Navigate to="/" replace />
          } 
        />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;