import React, { useState } from 'react';
import { FaUser, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'buyer'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Очищаем ошибку для поля при изменении
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Имя пользователя обязательно';
    } else if (formData.username.trim().length < 3) {
      newErrors.username = 'Имя пользователя должно содержать минимум 3 символа';
    }

    if (!formData.password) {
      newErrors.password = 'Пароль обязателен';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Пароль должен содержать минимум 6 символов';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Подтверждение пароля обязательно';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password,
          role: formData.role
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert('Регистрация прошла успешно! Теперь вы можете войти в систему.');
        // Перенаправляем на страницу входа или автоматически логиним
        window.location.reload();
      } else {
        alert(result.error || 'Произошла ошибка при регистрации');
      }
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      alert('Произошла ошибка при регистрации. Попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        <div className="card-header text-center">
          <h1 className="text-2xl font-bold text-black mb-2">
            ЦИФРОВАЯ СРЕДА NIGHTINGALE
          </h1>
          <p className="text-gray-600">Создайте новый аккаунт</p>
        </div>
        
        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Имя пользователя */}
            <div>
              <label className="block text-sm font-medium mb-2 text-black">
                Имя пользователя *
              </label>
              <div className="relative">
                <FaUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="username"
                  className={`input w-full pl-10 ${errors.username ? 'border-red-500' : ''}`}
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Введите имя пользователя"
                  disabled={loading}
                />
              </div>
              {errors.username && (
                <p className="text-red-500 text-xs mt-1">{errors.username}</p>
              )}
            </div>

            {/* Роль */}
            <div>
              <label className="block text-sm font-medium mb-2 text-black">
                Роль
              </label>
              <select
                name="role"
                className="input select w-full"
                value={formData.role}
                onChange={handleInputChange}
                disabled={loading}
              >
                <option value="buyer">Покупатель</option>
                <option value="executor">Исполнитель</option>
              </select>
            </div>

            {/* Пароль */}
            <div>
              <label className="block text-sm font-medium mb-2 text-black">
                Пароль *
              </label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className={`input w-full pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Введите пароль"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            {/* Подтверждение пароля */}
            <div>
              <label className="block text-sm font-medium mb-2 text-black">
                Подтвердите пароль *
              </label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  className={`input w-full pl-10 pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Подтвердите пароль"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Кнопка регистрации */}
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </form>

          {/* Ссылка на вход */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Уже есть аккаунт?{' '}
              <button 
                className="text-accent-blue hover:underline"
                onClick={() => window.location.reload()}
                disabled={loading}
              >
                Войти
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;