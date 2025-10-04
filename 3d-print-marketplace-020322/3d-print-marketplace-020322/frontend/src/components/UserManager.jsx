import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaSearch, FaPlus, FaEdit, FaTrash, FaEye, FaUserCog, FaImage, FaSortAlphaDown, FaSortAlphaUp, FaCalendarAlt } from 'react-icons/fa';

const UserManager = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [sortBy, setSortBy] = useState('registration_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingPortfolio, setViewingPortfolio] = useState(null);
  const [portfolio, setPortfolio] = useState([]);

  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'buyer'
  });

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  useEffect(() => {
    if (currentUser.id === 1) {
      loadUsers();
    }
  }, [searchTerm, roleFilter, sortBy, sortOrder]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (roleFilter) params.append('role_filter', roleFilter);
      
      console.log('Загрузка пользователей с параметрами:', params.toString());
      
      // Возврат к простому API users как в v94
      const response = await axios.get(`/api/users?${params.toString()}`, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Ответ сервера пользователей:', response.data);
      
      if (!response.data || !Array.isArray(response.data)) {
        console.error('Некорректный ответ сервера:', response.data);
        // Попробуем fallback к admin API
        try {
          const fallbackResponse = await axios.get(`/api/admin/users?${params.toString()}`, {
            timeout: 10000
          });
          if (fallbackResponse.data && Array.isArray(fallbackResponse.data)) {
            console.log('Использован fallback admin API');
            setUsers(fallbackResponse.data);
            return;
          }
        } catch (fallbackError) {
          console.error('Fallback API также не работает:', fallbackError);
        }
        setUsers([]);
        return;
      }
      
      let sortedUsers = [...response.data];
      
      // Сортировка
      sortedUsers.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'username':
            aValue = (a.username || '').toLowerCase();
            bValue = (b.username || '').toLowerCase();
            break;
          case 'registration_date':
            aValue = new Date(a.registration_date || 0);
            bValue = new Date(b.registration_date || 0);
            break;
          case 'role':
            aValue = a.role || '';
            bValue = b.role || '';
            break;
          default:
            aValue = a.id || 0;
            bValue = b.id || 0;
        }
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
      
      console.log('Загружено пользователей:', sortedUsers.length);
      setUsers(sortedUsers);
    } catch (error) {
      console.error('Детальная ошибка загрузки пользователей:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Упрощенное сообщение об ошибке
      console.warn('Не удалось загрузить пользователей, устанавливаем пустой массив');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    
    if (!newUser.username.trim() || !newUser.password.trim()) {
      alert('Заполните все обязательные поля');
      return;
    }

    try {
      setLoading(true);
      console.log('Создание пользователя:', newUser);
      
      const response = await axios.post('/api/register', {
        username: newUser.username.trim(),
        password: newUser.password,
        role: newUser.role
      });
      
      console.log('Пользователь создан:', response.data);
      alert('Пользователь создан успешно');
      
      setNewUser({ username: '', password: '', role: 'buyer' });
      setShowAddForm(false);
      loadUsers();
    } catch (error) {
      console.error('Ошибка создания пользователя:', error);
      alert(error.response?.data?.error || 'Ошибка при создании пользователя');
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userId, updates) => {
    try {
      setLoading(true);
      await axios.put(`/api/users/${userId}`, updates);
      alert('Пользователь обновлен успешно');
      setEditingUser(null);
      loadUsers();
    } catch (error) {
      console.error('Ошибка обновления пользователя:', error);
      alert('Ошибка при обновлении пользователя');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;

    try {
      setLoading(true);
      // Используем стандартный API как в v94
      await axios.delete(`/api/users/${userId}`);
      alert('Пользователь удален успешно');
      loadUsers();
    } catch (error) {
      console.error('Ошибка удаления пользователя:', error);
      alert(error.response?.data?.error || 'Ошибка при удалении пользователя');
    } finally {
      setLoading(false);
    }
  };

  const changeUserRole = async (userId, newRole) => {
    if (!confirm(`Изменить роль пользователя на "${newRole}"?`)) return;
    
    await updateUser(userId, { role: newRole });
  };

  const viewPortfolio = async (userId) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/portfolio/${userId}`);
      setPortfolio(response.data);
      setViewingPortfolio(userId);
    } catch (error) {
      console.error('Ошибка загрузки портфолио:', error);
      alert('Ошибка при загрузке портфолио');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role) => {
    const roleMap = {
      'buyer': { label: 'Покупатель', class: 'status-created' },
      'executor': { label: 'Исполнитель', class: 'status-processing' },
      'admin': { label: 'Администратор', class: 'status-completed' }
    };
    
    const roleInfo = roleMap[role] || { label: role, class: 'status-created' };
    return `status-badge ${roleInfo.class}`;
  };

  const getRoleLabel = (role) => {
    const roleMap = {
      'buyer': 'Покупатель',
      'executor': 'Исполнитель',
      'admin': 'Администратор'
    };
    
    return roleMap[role] || role;
  };

  if (currentUser.id !== 1) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Доступ запрещен. Только для администраторов.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-black">Управление пользователями</h1>
        <button
          className="btn btn-accent"
          onClick={() => setShowAddForm(true)}
        >
          <FaPlus className="mr-2" />
          Добавить пользователя
        </button>
      </div>

      {/* Поиск и фильтры */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Поиск */}
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по ID или никнейму..."
                className="input pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Фильтр по роли */}
            <div>
              <select
                className="input select w-full"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">Все роли</option>
                <option value="buyer">Покупатели</option>
                <option value="executor">Исполнители</option>
                <option value="admin">Администраторы</option>
              </select>
            </div>

            {/* Сортировка */}
            <div>
              <select
                className="input select w-full"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="registration_date">По дате регистрации</option>
                <option value="username">По алфавиту</option>
                <option value="role">По роли</option>
              </select>
            </div>

            {/* Порядок сортировки */}
            <div>
              <button
                className="btn btn-ghost w-full flex items-center justify-center"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? (
                  <>
                    <FaSortAlphaDown className="mr-2" />
                    По возрастанию
                  </>
                ) : (
                  <>
                    <FaSortAlphaUp className="mr-2" />
                    По убыванию
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Список пользователей */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">
            Пользователи ({users.length})
          </h2>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
              <p className="text-gray-500">Загрузка пользователей...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Пользователи не найдены</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-700">ID</th>
                    <th className="text-left p-3 font-medium text-gray-700">Никнейм</th>
                    <th className="text-left p-3 font-medium text-gray-700">Роль</th>
                    <th className="text-left p-3 font-medium text-gray-700">Регистрация</th>
                    <th className="text-left p-3 font-medium text-gray-700">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{user.id || 'N/A'}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {user.avatar && (
                            <img
                              src={user.avatar}
                              alt="Avatar"
                              className="w-8 h-8 rounded-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          )}
                          <div>
                            <div className="font-medium">{user.username || 'Неизвестный пользователь'}</div>
                            {user.city && (
                              <div className="text-sm text-gray-500">{user.city}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={getRoleBadge(user.role || 'buyer')}>
                          {getRoleLabel(user.role || 'buyer')}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {user.registration_date ? 
                          new Date(user.registration_date).toLocaleDateString('ru-RU') : 
                          'Неизвестно'
                        }
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => setEditingUser(user)}
                            title="Редактировать"
                            disabled={loading}
                          >
                            <FaEdit />
                          </button>
                          
                          {user.role === 'executor' && (
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => viewPortfolio(user.id)}
                              title="Портфолио"
                              disabled={loading}
                            >
                              <FaImage />
                            </button>
                          )}
                          
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => changeUserRole(
                              user.id, 
                              user.role === 'buyer' ? 'executor' : 'buyer'
                            )}
                            title="Изменить роль"
                            disabled={loading || user.id === 1}
                          >
                            <FaUserCog />
                          </button>
                          
                          {user.id !== 1 && (
                            <button
                              className="btn btn-sm bg-red-500 text-white hover:bg-red-600"
                              onClick={() => deleteUser(user.id)}
                              title="Удалить"
                              disabled={loading}
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Форма добавления пользователя */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Добавить пользователя</h3>
              
              <form onSubmit={createUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Никнейм *
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="Введите никнейм"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Пароль *
                  </label>
                  <input
                    type="password"
                    className="input w-full"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Введите пароль"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Роль
                  </label>
                  <select
                    className="input select w-full"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="buyer">Покупатель</option>
                    <option value="executor">Исполнитель</option>
                  </select>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="btn btn-primary flex-1"
                    disabled={loading}
                  >
                    Создать
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost flex-1"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewUser({ username: '', password: '', role: 'buyer' });
                    }}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Форма редактирования пользователя */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Редактировать пользователя #{editingUser.id}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Никнейм
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    defaultValue={editingUser.username}
                    onBlur={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Город
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    defaultValue={editingUser.city || ''}
                    onBlur={(e) => setEditingUser({ ...editingUser, city: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Роль
                  </label>
                  <select
                    className="input select w-full"
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  >
                    <option value="buyer">Покупатель</option>
                    <option value="executor">Исполнитель</option>
                    {editingUser.id === 1 && <option value="admin">Администратор</option>}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Новый пароль (оставьте пустым, если не меняете)
                  </label>
                  <input
                    type="password"
                    className="input w-full"
                    onBlur={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    className="btn btn-primary flex-1"
                    onClick={() => {
                      const updates = { ...editingUser };
                      delete updates.id;
                      delete updates.registration_date;
                      if (!updates.password) delete updates.password;
                      updateUser(editingUser.id, updates);
                    }}
                    disabled={loading}
                  >
                    Сохранить
                  </button>
                  <button
                    className="btn btn-ghost flex-1"
                    onClick={() => setEditingUser(null)}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Просмотр портфолио */}
      {viewingPortfolio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Портфолио пользователя #{viewingPortfolio}
                </h3>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setViewingPortfolio(null);
                    setPortfolio([]);
                  }}
                >
                  ✕
                </button>
              </div>
              
              {portfolio.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Портфолио пусто
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {portfolio.map((item) => (
                    <div key={item.id} className="relative group">
                      <img
                        src={item.image_path}
                        alt={`Работа ${item.id}`}
                        className="w-full h-32 object-cover rounded border cursor-pointer hover:opacity-75"
                        onClick={() => window.open(item.image_path, '_blank')}
                      />
                      <div className="text-xs text-gray-500 mt-1 text-center">
                        {new Date(item.created_date).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManager;