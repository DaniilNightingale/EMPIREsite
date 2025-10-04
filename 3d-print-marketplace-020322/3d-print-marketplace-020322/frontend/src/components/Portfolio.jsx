import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FaUpload, FaTrash, FaEye, FaPlus, FaImage } from 'react-icons/fa';

const Portfolio = () => {
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [viewImage, setViewImage] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  useEffect(() => {
    loadPortfolio();
  }, []);

  const loadPortfolio = async () => {
    if (!currentUser?.id) {
      console.warn('Нет ID пользователя для загрузки портфолио');
      return;
    }
    
    try {
      setLoading(true);
      console.log('Загрузка портфолио для пользователя:', currentUser.id);
      
      const response = await axios.get(`/api/portfolio/${currentUser.id}`, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && Array.isArray(response.data)) {
        setPortfolio(response.data);
      } else {
        console.warn('Некорректные данные портфолио:', response.data);
        setPortfolio([]);
      }
    } catch (error) {
      console.error('Детальная ошибка загрузки портфолио:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Показываем пользовательское сообщение об ошибке
      if (error.response?.status === 403) {
        console.error('Портфолио доступно только для исполнителей');
      } else if (error.response?.status === 404) {
        console.log('Портфолио пусто - это нормально для нового пользователя');
        setPortfolio([]);
      } else {
        console.error('Ошибка сервера при загрузке портфолио');
      }
      
      // Устанавливаем пустой массив в случае ошибки
      setPortfolio([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    
    if (portfolio.length + files.length > 20) {
      alert('Максимум 20 изображений в портфолио');
      return;
    }

    const invalidFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      alert('Максимальный размер файла: 5MB');
      return;
    }

    const nonImageFiles = files.filter(file => !file.type.startsWith('image/'));
    if (nonImageFiles.length > 0) {
      alert('Разрешены только изображения');
      return;
    }

    setSelectedImages(files);
    
    const previews = files.map(file => URL.createObjectURL(file));
    setPreviewImages(previews);
  };

  const uploadImages = async () => {
    if (selectedImages.length === 0) {
      alert('Выберите изображения для загрузки');
      return;
    }

    if (!currentUser?.id) {
      alert('Ошибка: не определен пользователь');
      return;
    }

    try {
      setUploading(true);
      console.log('Начало загрузки изображений:', selectedImages.length);
      
      const formData = new FormData();
      formData.append('user_id', currentUser.id);
      
      selectedImages.forEach((image, index) => {
        console.log(`Добавляем изображение ${index + 1}:`, image.name, image.size);
        formData.append('images', image);
      });

      const response = await axios.post('/api/portfolio', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000 // 30 секунд для загрузки изображений
      });
      
      console.log('Ответ сервера на загрузку:', response.status, response.data);

      alert('Изображения успешно загружены');
      setSelectedImages([]);
      setPreviewImages([]);
      
      // Очищаем input
      const fileInput = document.getElementById('portfolio-upload');
      if (fileInput) fileInput.value = '';
      
      await loadPortfolio();
      
    } catch (error) {
      console.error('Детальная ошибка загрузки изображений:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMessage = 'Ошибка при загрузке изображений';
      if (error.response) {
        if (error.response.status === 413) {
          errorMessage = 'Файлы слишком большие. Максимальный размер: 5MB';
        } else if (error.response.status === 403) {
          errorMessage = 'Недостаточно прав для загрузки в портфолио';
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Превышено время ожидания загрузки. Попробуйте еще раз.';
      }
      
      alert(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (imageId) => {
    if (!imageId) {
      alert('Ошибка: не указан ID изображения');
      return;
    }
    
    if (!confirm('Удалить это изображение?')) return;

    try {
      console.log('Удаление изображения с ID:', imageId);
      const response = await axios.delete(`/api/portfolio/${imageId}`, {
        timeout: 10000
      });
      
      console.log('Ответ сервера на удаление:', response.status);
      alert('Изображение удалено');
      await loadPortfolio();
    } catch (error) {
      console.error('Детальная ошибка удаления изображения:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        imageId
      });
      
      let errorMessage = 'Ошибка при удалении изображения';
      if (error.response?.status === 404) {
        errorMessage = 'Изображение не найдено';
      } else if (error.response?.status === 403) {
        errorMessage = 'Недостаточно прав для удаления';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      alert(errorMessage);
    }
  };

  const clearSelection = () => {
    setSelectedImages([]);
    setPreviewImages([]);
    const fileInput = document.getElementById('portfolio-upload');
    if (fileInput) fileInput.value = '';
  };

  const openImageView = (image) => {
    setViewImage(image);
  };

  const closeImageView = () => {
    setViewImage(null);
  };

  // Проверка наличия данных пользователя
  if (!currentUser || !currentUser.id) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
        <p className="text-gray-500">Загрузка данных пользователя...</p>
      </div>
    );
  }
  
  if (currentUser.role !== 'executor') {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Портфолио доступно только для исполнителей</p>
        <p className="text-xs text-gray-400 mt-2">Ваша роль: {currentUser.role || 'неопределена'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-black">Моё портфолио</h1>
        <div className="text-sm text-gray-600">
          {portfolio.length}/20 изображений
        </div>
      </div>

      {/* Загрузка изображений */}
      <div className="card mb-8">
        <div className="card-header">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FaUpload className="text-accent-blue" />
            Загрузить изображения
          </h2>
        </div>
        <div className="card-body">
          <div className="mb-4">
            <label 
              htmlFor="portfolio-upload" 
              className="block text-sm font-medium mb-2"
            >
              Выберите изображения (максимум {20 - portfolio.length}, до 5MB каждое)
            </label>
            <input
              id="portfolio-upload"
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageSelect}
              className="input w-full"
              disabled={portfolio.length >= 20 || uploading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Поддерживаемые форматы: JPG, PNG, GIF, WebP
            </p>
          </div>

          {/* Превью выбранных изображений */}
          {previewImages.length > 0 && (
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-3">Выбранные изображения:</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
                {previewImages.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`Превью ${index + 1}`}
                      className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-75"
                      onClick={() => window.open(preview, '_blank')}
                    />
                    <div className="absolute top-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-3">
                <button
                  className="btn btn-primary"
                  onClick={uploadImages}
                  disabled={uploading}
                >
                  {uploading ? 'Загрузка...' : 'Загрузить изображения'}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={clearSelection}
                  disabled={uploading}
                >
                  Отменить
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Галерея портфолио */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FaImage className="text-accent-blue" />
            Галерея работ
          </h2>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
              <p className="text-gray-500">Загрузка портфолио...</p>
            </div>
          ) : portfolio.length === 0 ? (
            <div className="text-center py-12">
              <FaImage className="text-6xl text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Ваше портфолио пусто</p>
              <p className="text-sm text-gray-400">
                Загрузите изображения своих работ, чтобы показать их администратору и клиентам
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {portfolio.map((item) => (
                <div key={item.id} className="relative group">
                  <div className="relative overflow-hidden rounded-lg border hover:border-accent-blue transition-colors">
                    <img
                      src={item.image_path}
                      alt={`Работа ${item.id}`}
                      className="w-full h-32 object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => openImageView(item)}
                    />
                    
                    {/* Overlay с кнопками */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex gap-2">
                        <button
                          className="btn btn-sm bg-white text-black hover:bg-gray-100"
                          onClick={() => openImageView(item)}
                          title="Просмотр"
                        >
                          <FaEye />
                        </button>
                        <button
                          className="btn btn-sm bg-red-500 text-white hover:bg-red-600"
                          onClick={() => deleteImage(item.id)}
                          title="Удалить"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Дата загрузки */}
                  <div className="text-xs text-gray-500 mt-1 text-center">
                    {new Date(item.created_date).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно для просмотра изображения */}
      {viewImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={closeImageView}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={viewImage.image_path}
              alt={`Работа ${viewImage.id}`}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Кнопка закрытия */}
            <button
              className="absolute top-4 right-4 btn btn-sm bg-white text-black hover:bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center"
              onClick={closeImageView}
            >
              ✕
            </button>
            
            {/* Информация */}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded">
              <p className="text-sm">
                Загружено: {new Date(viewImage.created_date).toLocaleString('ru-RU')}
              </p>
            </div>
            
            {/* Кнопка удаления */}
            <button
              className="absolute bottom-4 right-4 btn btn-sm bg-red-500 text-white hover:bg-red-600"
              onClick={() => {
                closeImageView();
                deleteImage(viewImage.id);
              }}
            >
              <FaTrash className="mr-1" />
              Удалить
            </button>
          </div>
        </div>
      )}

      {/* Индикатор загрузки */}
      {uploading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
            <p className="text-black">Загрузка изображений...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Portfolio;