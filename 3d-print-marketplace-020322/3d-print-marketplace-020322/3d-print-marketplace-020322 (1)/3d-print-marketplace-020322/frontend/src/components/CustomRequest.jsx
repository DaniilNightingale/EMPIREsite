import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CustomRequest = ({ productId = '', onClose }) => {
  const [formData, setFormData] = useState({
    product_name: '',
    model_links: [''],
    additional_name: '',
    required_heights: [''],
    images: [],
    product_id: productId || ''
  });

  const [loading, setLoading] = useState(false);
  const [previewImages, setPreviewImages] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(!!productId);

  useEffect(() => {
    // Добавляем проверку на существование пользователя перед загрузкой
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (currentUser.id) {
      loadRequests();
    }
  }, []);

  const loadRequests = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      
      // Проверяем наличие обязательных данных пользователя
      if (!currentUser.id || !currentUser.role) {
        console.warn('Недостаточно данных пользователя для загрузки заявок');
        setRequests([]);
        return;
      }
      
      const response = await axios.get(`/api/custom-requests?user_id=${currentUser.id}&role=${currentUser.role}`);
      
      // Проверяем корректность ответа
      if (response.data && Array.isArray(response.data)) {
        setRequests(response.data);
      } else {
        console.warn('Некорректный ответ от сервера:', response.data);
        setRequests([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
      // Устанавливаем пустой массив в случае ошибки
      setRequests([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleArrayInputChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const addArrayField = (field) => {
    if (field === 'model_links' && formData.model_links.length >= 5) {
      alert('Максимум 5 ссылок на модели');
      return;
    }
    if (field === 'required_heights' && formData.required_heights.length >= 5) {
      alert('Максимум 5 размеров высоты');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeArrayField = (field, index) => {
    if (formData[field].length <= 1) return;
    
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length > 3) {
      alert('Максимум 3 изображения');
      return;
    }

    // Проверка размера каждого файла (5MB)
    const invalidFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      alert('Максимальный размер файла: 5MB');
      return;
    }

    setFormData(prev => ({
      ...prev,
      images: files
    }));

    // Создание превью
    const previews = files.map(file => URL.createObjectURL(file));
    setPreviewImages(previews);
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    
    if (!formData.product_name.trim()) {
      alert('Укажите название товара');
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!currentUser.id) {
      alert('Необходимо войти в систему');
      return;
    }

    try {
      setLoading(true);
      
      const submitData = new FormData();
      submitData.append('user_id', currentUser.id);
      submitData.append('product_name', formData.product_name);
      submitData.append('additional_name', formData.additional_name);
      submitData.append('product_id', formData.product_id);
      
      // Фильтруем пустые ссылки и высоты
      const validLinks = formData.model_links.filter(link => link.trim());
      const validHeights = formData.required_heights.filter(height => height.trim());
      
      submitData.append('model_links', JSON.stringify(validLinks));
      submitData.append('required_heights', JSON.stringify(validHeights));
      
      // Добавляем изображения
      formData.images.forEach((image, index) => {
        submitData.append('images', image);
      });

      await axios.post('/api/custom-requests', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      alert('Заявка на замер успешно отправлена');
      
      // Сброс формы
      setFormData({
        product_name: '',
        model_links: [''],
        additional_name: '',
        required_heights: [''],
        images: [],
        product_id: ''
      });
      setPreviewImages([]);
      setShowForm(false);
      
      // Обновляем список заявок
      loadRequests();
      
      if (onClose) onClose();
      
    } catch (error) {
      console.error('Ошибка отправки заявки:', error);
      alert('Ошибка при отправке заявки');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'в обработке': 'status-processing',
      'ожидает': 'status-created',
      'отказано': 'status-cancelled',
      'выполнен': 'status-completed'
    };
    
    return `status-badge ${statusMap[status] || 'status-created'}`;
  };

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isAdmin = currentUser.id === 1;

  const updateRequestStatus = async (requestId, newStatus, adminNotes = '') => {
    if (!requestId || !newStatus) {
      alert('Некорректные данные для обновления статуса');
      return;
    }
    
    if (!currentUser.id || currentUser.id !== 1) {
      alert('Недостаточно прав для изменения статуса');
      return;
    }
    
    try {
      setLoading(true);
      console.log('Обновление статуса заявки:', requestId, newStatus);
      
      const updateData = {
        status: newStatus
      };
      
      // Добавляем примечание только если оно есть
      if (adminNotes && adminNotes.trim()) {
        updateData.admin_notes = adminNotes.trim();
      }
      
      const response = await axios.put(`/api/custom-requests/${requestId}`, updateData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Ответ сервера на обновление статуса:', response.status, response.data);
      
      if (response.status === 200) {
        alert('Статус заявки обновлен');
        loadRequests();
      } else {
        throw new Error(`Неожиданный статус ответа: ${response.status}`);
      }
    } catch (error) {
      console.error('Детальная ошибка обновления статуса:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        requestId,
        newStatus
      });
      
      let errorMessage = 'Ошибка при обновлении статуса';
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = 'Заявка не найдена';
        } else if (error.response.status === 403) {
          errorMessage = 'Недостаточно прав для изменения статуса';
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Превышено время ожидания обновления';
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-black">
          {isAdmin ? 'Управление заявками на замер' : 'Заявки на замер'}
        </h1>
        {!isAdmin && (
          <button
            className="btn btn-accent"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Скрыть форму' : 'Подать заявку на замер'}
          </button>
        )}
      </div>

      {/* Форма подачи заявки */}
      {showForm && !isAdmin && (
        <div className="card mb-8">
          <div className="card-header">
            <h2 className="text-xl font-semibold">Новая заявка на замер</h2>
          </div>
          <div className="card-body">
            <form onSubmit={submitRequest} className="space-y-6">
              {/* Название товара */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Название товара *
                </label>
                <input
                  type="text"
                  name="product_name"
                  className="input w-full"
                  value={formData.product_name}
                  onChange={handleInputChange}
                  placeholder="Введите название товара"
                  required
                />
              </div>

              {/* Дополнительное название */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Дополнительное название
                </label>
                <input
                  type="text"
                  name="additional_name"
                  className="input w-full"
                  value={formData.additional_name}
                  onChange={handleInputChange}
                  placeholder="Дополнительная информация о товаре"
                />
              </div>

              {/* ID существующего товара */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  ID существующего товара (необязательно)
                </label>
                <input
                  type="text"
                  name="product_id"
                  className="input w-full"
                  value={formData.product_id}
                  onChange={handleInputChange}
                  placeholder="Если есть похожий товар в каталоге"
                />
              </div>

              {/* Ссылки на модели */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Ссылки на модель или сайт
                </label>
                {formData.model_links.map((link, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="url"
                      className="input flex-1"
                      value={link}
                      onChange={(e) => handleArrayInputChange(index, 'model_links', e.target.value)}
                      placeholder="https://example.com/model"
                    />
                    {formData.model_links.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeArrayField('model_links', index)}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                ))}
                {formData.model_links.length < 5 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => addArrayField('model_links')}
                  >
                    Добавить ссылку
                  </button>
                )}
              </div>

              {/* Требуемые высоты */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Нужная высота
                </label>
                {formData.required_heights.map((height, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      className="input flex-1"
                      value={height}
                      onChange={(e) => handleArrayInputChange(index, 'required_heights', e.target.value)}
                      placeholder="Например: 15 см, 20 см"
                    />
                    {formData.required_heights.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeArrayField('required_heights', index)}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                ))}
                {formData.required_heights.length < 5 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => addArrayField('required_heights')}
                  >
                    Добавить размер
                  </button>
                )}
              </div>

              {/* Загрузка изображений */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Изображения (максимум 3, до 5MB каждое)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                  className="input w-full"
                />
                
                {/* Превью изображений */}
                {previewImages.length > 0 && (
                  <div className="flex gap-4 mt-4">
                    {previewImages.map((preview, index) => (
                      <div key={index} className="relative">
                        <img
                          src={preview}
                          alt={`Превью ${index + 1}`}
                          className="w-24 h-24 object-cover rounded border"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Отправка...' : 'Отправить заявку'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowForm(false)}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Список заявок */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">
            {isAdmin ? 'Все заявки на замер' : 'Мои заявки на замер'}
          </h2>
        </div>
        <div className="card-body">
          {requests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {isAdmin ? 'Нет заявок на замер' : 'У вас пока нет заявок на замер'}
            </p>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-black">{request.product_name}</h3>
                      {request.additional_name && (
                        <p className="text-sm text-gray-600">{request.additional_name}</p>
                      )}
                      {isAdmin && request.User && (
                        <p className="text-sm text-gray-500">
                          Пользователь: {request.User.username} (ID: {request.user_id})
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={getStatusBadge(request.status)}>
                        {request.status}
                      </span>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <select
                            className="text-xs p-1 border rounded"
                            value={request.status}
                            onChange={(e) => {
                              if (e.target.value !== request.status) {
                                updateRequestStatus(request.id, e.target.value);
                              }
                            }}
                            disabled={loading}
                          >
                            <option value="в обработке">В обработке</option>
                            <option value="ожидает">Ожидает</option>
                            <option value="выполнен">Выполнен</option>
                            <option value="отказано">Отказано</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">ID заявки:</span> {request.id}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Дата:</span> {new Date(request.created_date).toLocaleDateString('ru-RU')}
                    </div>
                    {isAdmin && (
                      <div>
                        <span className="font-medium text-gray-700">Пользователь:</span> ID {request.user_id}
                      </div>
                    )}
                    {request.product_id && (
                      <div>
                        <span className="font-medium text-gray-700">ID товара:</span> {request.product_id}
                      </div>
                    )}
                    {request.required_heights && (() => {
                      try {
                        const heights = JSON.parse(request.required_heights || '[]');
                        return heights.length > 0 ? (
                          <div>
                            <span className="font-medium text-gray-700">Размеры:</span> {heights.join(', ')}
                          </div>
                        ) : null;
                      } catch (e) {
                        console.error('Ошибка парсинга размеров:', e);
                        return null;
                      }
                    })()}
                  </div>

                  {(request.admin_notes || isAdmin) && (
                    <div className="mt-3 p-3 bg-white rounded border">
                      <span className="font-medium text-gray-700">Примечание администратора:</span>
                      {isAdmin ? (
                        <textarea
                          className="w-full mt-1 p-2 border rounded text-sm"
                          placeholder="Добавить примечание..."
                          defaultValue={request.admin_notes || ''}
                          onBlur={(e) => {
                            const newNotes = e.target.value.trim();
                            const currentNotes = (request.admin_notes || '').trim();
                            if (newNotes !== currentNotes) {
                              updateRequestStatus(request.id, request.status, newNotes);
                            }
                          }}
                          rows={2}
                          disabled={loading}
                        />
                      ) : (
                        <p className="text-gray-600 mt-1">{request.admin_notes}</p>
                      )}
                    </div>
                  )}

                  {request.model_links && (() => {
                    try {
                      const links = JSON.parse(request.model_links || '[]');
                      return links.length > 0 ? (
                        <div className="mt-3">
                          <span className="font-medium text-gray-700 block mb-1">Ссылки на модели:</span>
                          <div className="flex flex-wrap gap-2">
                            {links.map((link, index) => (
                              <a 
                                key={index}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-accent-blue text-white px-2 py-1 rounded hover:bg-accent-blue-hover"
                              >
                                Ссылка {index + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    } catch (e) {
                      console.error('Ошибка парсинга ссылок:', e);
                      return null;
                    }
                  })()}

                  {request.images && (() => {
                    try {
                      const images = JSON.parse(request.images || '[]');
                      return images.length > 0 ? (
                        <div className="mt-3">
                          <span className="font-medium text-gray-700 block mb-2">Изображения:</span>
                          <div className="flex gap-2">
                            {images.map((image, index) => (
                              <img
                                key={index}
                                src={image}
                                alt={`Изображение ${index + 1}`}
                                className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-75"
                                onClick={() => window.open(image, '_blank')}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  console.error('Ошибка загрузки изображения:', image);
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      ) : null;
                    } catch (e) {
                      console.error('Ошибка парсинга изображений:', e);
                      return null;
                    }
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-2"></div>
              <p>Отправка заявки...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomRequest;