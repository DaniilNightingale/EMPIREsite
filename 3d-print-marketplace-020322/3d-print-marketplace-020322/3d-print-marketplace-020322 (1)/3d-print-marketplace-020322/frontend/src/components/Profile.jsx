import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaUser, FaEdit, FaSave, FaTimes, FaCamera, FaBell, FaCalendarAlt, FaMapMarkerAlt, FaStickyNote } from 'react-icons/fa';

const Profile = () => {
  const [profile, setProfile] = useState({
    id: '',
    username: '',
    initial_username: '',
    avatar: '',
    city: '',
    birthday: '',
    notes: '',
    registration_date: '',
    role: ''
  });

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [avatarFile, setAvatarFile] = useState(null);
  const [previewAvatar, setPreviewAvatar] = useState('');
  const [uploading, setUploading] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  useEffect(() => {
    loadProfile();
    loadNotifications();
  }, []);

  const loadProfile = async () => {
    if (!currentUser.id) return;

    try {
      setLoading(true);
      const response = await axios.get(`/api/users/${currentUser.id}`);
      setProfile(response.data);
      // Восстановлено из версии 94: правильная обработка пути аватара
      const avatarPath = response.data.avatar ? response.data.avatar : '';
      setPreviewAvatar(avatarPath);
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      // Загружаем уведомления о новых сообщениях, заказах и заявках
      const [messagesResponse, ordersResponse, requestsResponse] = await Promise.all([
        axios.get(`/api/chat?user_id=${currentUser.id}`),
        axios.get(`/api/orders?user_id=${currentUser.id}&role=${currentUser.role}`),
        axios.get(`/api/custom-requests?user_id=${currentUser.id}&role=${currentUser.role}`)
      ]);

      const recentMessages = messagesResponse.data.filter(msg => 
        new Date(msg.created_date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length;

      const recentOrders = ordersResponse.data.filter(order => 
        new Date(order.created_date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length;

      const recentRequests = requestsResponse.data.filter(req => 
        new Date(req.created_date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length;

      const notificationsList = [];
      if (recentMessages > 0) notificationsList.push(`${recentMessages} новых сообщений`);
      if (recentOrders > 0) notificationsList.push(`${recentOrders} новых заказов`);
      if (recentRequests > 0) notificationsList.push(`${recentRequests} новых заявок`);

      setNotifications(notificationsList);
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Проверка размера файла
      if (file.size > 5 * 1024 * 1024) {
        alert('Максимальный размер файла: 5MB');
        e.target.value = ''; // Очищаем input
        return;
      }

      // Проверка типа файла
      if (!file.type.startsWith('image/')) {
        alert('Разрешены только изображения (JPG, PNG, GIF, WebP)');
        e.target.value = ''; // Очищаем input
        return;
      }

      // Дополнительная проверка MIME типов
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        alert('Поддерживаемые форматы: JPG, PNG, GIF, WebP');
        e.target.value = ''; // Очищаем input
        return;
      }

      try {
        // Освобождаем предыдущий preview URL
        if (previewAvatar && previewAvatar.startsWith('blob:')) {
          URL.revokeObjectURL(previewAvatar);
        }

        setAvatarFile(file);
        const previewUrl = URL.createObjectURL(file);
        setPreviewAvatar(previewUrl);
      } catch (error) {
        console.error('Ошибка создания превью:', error);
        alert('Ошибка обработки изображения');
        e.target.value = ''; // Очищаем input
      }
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return null;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      formData.append('user_id', currentUser.id);

      const response = await axios.post('/api/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      });

      if (response.data && response.data.avatar_path) {
        return response.data.avatar_path;
      } else {
        throw new Error('Сервер не вернул путь к аватару');
      }
    } catch (error) {
      console.error('Ошибка загрузки аватара:', error);
      if (error.response) {
        throw new Error(error.response.data?.error || 'Ошибка сервера при загрузке аватара');
      } else if (error.request) {
        throw new Error('Нет ответа от сервера');
      } else {
        throw error;
      }
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    try {
      setLoading(true);

      let avatarPath = profile.avatar;

      // Загружаем новый аватар, если выбран
      if (avatarFile) {
        try {
          avatarPath = await uploadAvatar();
          if (!avatarPath) {
            throw new Error('Не удалось получить путь к загруженному аватару');
          }
        } catch (error) {
          console.error('Ошибка загрузки аватара:', error);
          alert(`Ошибка при загрузке аватара: ${error.message}. Профиль будет сохранен без изменения аватара.`);
          avatarPath = profile.avatar;
        }
      }

      const updates = {
        username: profile.username?.trim() || profile.username,
        city: profile.city?.trim() || profile.city,
        birthday: profile.birthday || null,
        notes: profile.notes?.trim() || profile.notes,
        avatar: avatarPath
      };

      const response = await axios.put(`/api/users/${currentUser.id}`, updates, {
        timeout: 15000
      });

      if (response.status === 200) {
        // Обновляем информацию в localStorage
        const updatedUser = { ...currentUser, ...updates };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));

        alert('Профиль успешно обновлен');
        setEditing(false);
        setAvatarFile(null);
        
        // Освобождаем память от preview URL
        if (previewAvatar && previewAvatar.startsWith('blob:')) {
          URL.revokeObjectURL(previewAvatar);
        }
        
        await loadProfile();
      } else {
        throw new Error('Неожиданный ответ сервера');
      }

    } catch (error) {
      console.error('Ошибка обновления профиля:', error);
      let errorMessage = 'Ошибка при обновлении профиля';
      if (error.response) {
        errorMessage = error.response.data?.error || `Ошибка сервера: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'Нет связи с сервером';
      } else {
        errorMessage = error.message;
      }
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const cancelEditing = () => {
    setEditing(false);
    setAvatarFile(null);
    
    // Освобождаем память от preview URL
    if (previewAvatar && previewAvatar.startsWith('blob:')) {
      URL.revokeObjectURL(previewAvatar);
    }
    
    setPreviewAvatar(profile.avatar || '');
    loadProfile();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const getRoleLabel = (role) => {
    const roleMap = {
      'buyer': 'Покупатель',
      'executor': 'Исполнитель', 
      'admin': 'Администратор'
    };
    return roleMap[role] || role;
  };

  if (!currentUser.id) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Необходимо войти в систему</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-black">Мой профиль</h1>
        {!editing && (
          <button
            className="btn btn-accent"
            onClick={() => setEditing(true)}
          >
            <FaEdit className="mr-2" />
            Редактировать
          </button>
        )}
      </div>

      {/* Уведомления */}
      {notifications.length > 0 && (
        <div className="card mb-6 border-l-4 border-l-accent-blue">
          <div className="card-body">
            <div className="flex items-center gap-3 mb-3">
              <FaBell className="text-accent-blue text-xl" />
              <h2 className="text-lg font-semibold text-black">Уведомления</h2>
            </div>
            <div className="space-y-2">
              {notifications.map((notification, index) => (
                <div key={index} className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                  {notification}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Аватар и основная информация */}
        <div className="card">
          <div className="card-body text-center">
            <div className="relative inline-block mb-4">
              {/* Восстановлено из версии 94: улучшенная логика отображения аватара */}
              {(previewAvatar && previewAvatar.trim()) ? (
                <img
                  src={previewAvatar.startsWith('blob:') ? previewAvatar : previewAvatar}
                  alt="Аватар"
                  className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                  onError={(e) => {
                    console.warn('Ошибка загрузки аватара:', previewAvatar);
                    e.target.style.display = 'none';
                    e.target.nextElementSibling?.style.setProperty('display', 'flex', 'important');
                  }}
                />
              ) : null}
              
              {/* Дефолтный аватар - показывается когда нет изображения */}
              <div 
                className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-200"
                style={{ display: (previewAvatar && previewAvatar.trim()) ? 'none' : 'flex' }}
              >
                {(profile.username || currentUser.username) ? 
                  (profile.username || currentUser.username).charAt(0).toUpperCase() : 
                  <FaUser className="text-4xl text-gray-400" />
                }
              </div>
              
              {/* Кнопка загрузки аватара - всегда видима */}
              <label className="absolute bottom-0 right-0 bg-black text-white rounded-full p-2 cursor-pointer hover:bg-gray-800 transition-all duration-200 shadow-lg">
                <FaCamera className="text-sm" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
              
              {/* Индикатор загрузки */}
              {uploading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                </div>
              )}
            </div>

            <h2 className="text-xl font-semibold text-black mb-2">
              {profile.username || currentUser.username}
            </h2>
            
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex items-center justify-center gap-2">
                <FaUser />
                <span>{getRoleLabel(profile.role || currentUser.role)}</span>
              </div>
              <div>ID: {profile.id || currentUser.id}</div>
            </div>

            {/* Информация о выбранном файле */}
            {avatarFile && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                <div className="font-medium">Выбран новый аватар:</div>
                <div>{avatarFile.name}</div>
                <div className="mt-2 flex gap-2">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={saveProfile}
                    disabled={loading || uploading}
                  >
                    {uploading ? 'Загрузка...' : 'Сохранить аватар'}
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={cancelEditing}
                    disabled={loading || uploading}
                  >
                    Отменить
                  </button>
                </div>
              </div>
            )}
            
            {/* Подсказка для пользователя */}
            <div className="mt-2 text-xs text-gray-500 text-center">
              Нажмите на иконку камеры для изменения аватара
            </div>
          </div>
        </div>

        {/* Редактируемые поля */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">Персональная информация</h3>
            </div>
            <div className="card-body space-y-4">
              {/* Никнейм */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <FaUser />
                  Никнейм
                </label>
                {editing ? (
                  <input
                    type="text"
                    name="username"
                    className="input w-full"
                    value={profile.username}
                    onChange={handleInputChange}
                    placeholder="Введите никнейм"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded border">
                    {profile.username || 'Не указано'}
                  </div>
                )}
              </div>

              {/* Дата рождения */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <FaCalendarAlt />
                  Дата рождения
                </label>
                {editing ? (
                  <input
                    type="date"
                    name="birthday"
                    className="input w-full"
                    value={profile.birthday || ''}
                    onChange={handleInputChange}
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded border">
                    {formatDate(profile.birthday)}
                  </div>
                )}
              </div>

              {/* Город */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <FaMapMarkerAlt />
                  Город
                </label>
                {editing ? (
                  <input
                    type="text"
                    name="city"
                    className="input w-full"
                    value={profile.city || ''}
                    onChange={handleInputChange}
                    placeholder="Введите город"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded border">
                    {profile.city || 'Не указано'}
                  </div>
                )}
              </div>

              {/* Личные заметки */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <FaStickyNote />
                  Личные заметки
                </label>
                {editing ? (
                  <textarea
                    name="notes"
                    className="input textarea w-full"
                    value={profile.notes || ''}
                    onChange={handleInputChange}
                    placeholder="Добавьте заметки о себе..."
                    rows={3}
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded border min-h-[80px]">
                    {profile.notes || 'Заметки не добавлены'}
                  </div>
                )}
              </div>

              {/* Кнопки редактирования */}
              {editing && (
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    className="btn btn-primary flex-1"
                    onClick={saveProfile}
                    disabled={loading || uploading}
                  >
                    <FaSave className="mr-2" />
                    {loading ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button
                    className="btn btn-ghost flex-1"
                    onClick={cancelEditing}
                    disabled={loading || uploading}
                  >
                    <FaTimes className="mr-2" />
                    Отмена
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Неизменяемые данные */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">Системная информация</h3>
            </div>
            <div className="card-body space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">Дата регистрации:</span>
                <span className="font-medium">{formatDate(profile.registration_date)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">ID пользователя:</span>
                <span className="font-medium">{profile.id}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Никнейм при регистрации:</span>
                <span className="font-medium">{profile.initial_username || 'Не указан'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Индикатор загрузки */}
      {(loading || uploading) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
            <p className="text-black">
              {uploading ? 'Загрузка аватара...' : 'Обновление профиля...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;