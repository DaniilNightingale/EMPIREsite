import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaSearch, FaPlus, FaEdit, FaTrash, FaEye, FaDownload, FaUpload, FaImage } from 'react-icons/fa';

const ProductManager = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewingProduct, setViewingProduct] = useState(null);

  const [productForm, setProductForm] = useState({
    name: '',
    related_name: '',
    description: '',
    original_height: '',
    original_width: '',
    original_length: '',
    parts_count: 1,
    main_image: null,
    additional_images: [],
    price_options: [{ size: '', price: '', resin_ml: '' }],
    is_visible: true
  });

  const [previewImages, setPreviewImages] = useState({
    main: null,
    additional: []
  });

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  useEffect(() => {
    if (currentUser.id === 1) {
      loadProducts();
    }
  }, [searchTerm]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await axios.get(`/api/products?${params.toString()}&admin=true`);
      setProducts(response.data);
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProductForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePriceOptionChange = (index, field, value) => {
    setProductForm(prev => ({
      ...prev,
      price_options: prev.price_options.map((option, i) =>
        i === index ? { ...option, [field]: value } : option
      )
    }));
  };

  const addPriceOption = () => {
    setProductForm(prev => ({
      ...prev,
      price_options: [...prev.price_options, { size: '', price: '', resin_ml: '' }]
    }));
  };

  const removePriceOption = (index) => {
    if (productForm.price_options.length <= 1) return;
    
    setProductForm(prev => ({
      ...prev,
      price_options: prev.price_options.filter((_, i) => i !== index)
    }));
  };

  const handleMainImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Максимальный размер файла: 5MB');
        return;
      }
      
      setProductForm(prev => ({ ...prev, main_image: file }));
      setPreviewImages(prev => ({
        ...prev,
        main: URL.createObjectURL(file)
      }));
    }
  };

  const handleAdditionalImagesChange = (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length > 4) {
      alert('Максимум 4 дополнительных изображения');
      return;
    }

    const invalidFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      alert('Максимальный размер файла: 5MB');
      return;
    }

    setProductForm(prev => ({ ...prev, additional_images: files }));
    
    const previews = files.map(file => URL.createObjectURL(file));
    setPreviewImages(prev => ({
      ...prev,
      additional: previews
    }));
  };

  const createProduct = async (e) => {
    e.preventDefault();
    
    // Более детальная валидация данных
    if (!productForm.name.trim()) {
      alert('Укажите название товара');
      return;
    }

    if (productForm.price_options.some(option => !option.size || !option.price)) {
      alert('Заполните все варианты размеров и цен');
      return;
    }

    // Проверка корректности цен
    for (const option of productForm.price_options) {
      const price = parseFloat(option.price);
      if (isNaN(price) || price <= 0) {
        alert(`Неверная цена для размера "${option.size}". Цена должна быть положительным числом.`);
        return;
      }
    }

    try {
      setLoading(true);
      console.log('Создание товара:', productForm);
      
      const formData = new FormData();
      
      // Обязательные поля
      formData.append('name', productForm.name.trim());
      formData.append('related_name', productForm.related_name?.trim() || '');
      formData.append('description', productForm.description?.trim() || '');
      formData.append('original_height', productForm.original_height || '');
      formData.append('original_width', productForm.original_width || '');
      formData.append('original_length', productForm.original_length || '');
      formData.append('parts_count', productForm.parts_count || 1);
      formData.append('is_visible', productForm.is_visible);
      
      // Валидация price_options
      const validPriceOptions = productForm.price_options.filter(option => 
        option.size && option.price
      ).map(option => ({
        ...option,
        price: parseFloat(option.price),
        resin_ml: option.resin_ml ? parseFloat(option.resin_ml) : ''
      }));
      
      formData.append('price_options', JSON.stringify(validPriceOptions));

      // Изображения
      if (productForm.main_image) {
        formData.append('main_image', productForm.main_image);
      }

      productForm.additional_images.forEach(image => {
        formData.append('additional_images', image);
      });

      console.log('Отправка данных на сервер...');
      const response = await axios.post('/api/products', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data'
        },
        timeout: 30000
      });

      console.log('Ответ сервера:', response.data);
      alert('Товар создан успешно');
      resetForm();
      loadProducts();
    } catch (error) {
      console.error('Детальная ошибка создания товара:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });
      
      let errorMessage = 'Ошибка при создании товара';
      if (error.response) {
        // Ошибка от сервера
        errorMessage = error.response.data?.error || `Ошибка сервера: ${error.response.status}`;
      } else if (error.request) {
        // Нет ответа от сервера
        errorMessage = 'Нет связи с сервером. Проверьте подключение к интернету.';
      } else if (error.message) {
        // Ошибка настройки запроса
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateProduct = async (e) => {
    e.preventDefault();
    
    if (!editingProduct) return;

    try {
      setLoading(true);
      
      const updates = {
        name: productForm.name,
        related_name: productForm.related_name,
        description: productForm.description,
        original_height: productForm.original_height,
        original_width: productForm.original_width,
        original_length: productForm.original_length,
        parts_count: productForm.parts_count,
        is_visible: productForm.is_visible,
        price_options: JSON.stringify(productForm.price_options)
      };

      await axios.put(`/api/products/${editingProduct.id}`, updates);
      
      alert('Товар обновлен успешно');
      setEditingProduct(null);
      resetForm();
      loadProducts();
    } catch (error) {
      console.error('Ошибка обновления товара:', error);
      alert('Ошибка при обновлении товара');
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (productId) => {
    if (!confirm('Вы уверены, что хотите удалить этот товар?')) return;

    try {
      setLoading(true);
      console.log('Попытка удалить товар с ID:', productId);
      
      const response = await axios.delete(`/api/products/${productId}`, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Ответ сервера на удаление:', response.status, response.data);
      
      if (response.status === 200 || response.data?.success) {
        alert('Товар удален успешно');
        loadProducts();
      } else {
        throw new Error('Неожиданный ответ сервера');
      }
    } catch (error) {
      console.error('Детальная ошибка удаления товара:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        productId
      });
      
      let errorMessage = 'Ошибка при удалении товара';
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = 'Товар не найден';
        } else if (error.response.status === 403) {
          errorMessage = 'Недостаточно прав для удаления товара';
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        } else {
          errorMessage += `: ${error.response.status}`;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Превышено время ожидания удаления товара';
      } else if (error.request) {
        errorMessage = 'Нет связи с сервером';
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setProductForm({
      name: '',
      related_name: '',
      description: '',
      original_height: '',
      original_width: '',
      original_length: '',
      parts_count: 1,
      main_image: null,
      additional_images: [],
      price_options: [{ size: '', price: '', resin_ml: '' }],
      is_visible: true
    });
    setPreviewImages({ main: null, additional: [] });
    setShowAddForm(false);
    setEditingProduct(null);
  };

  const startEdit = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      related_name: product.related_name || '',
      description: product.description || '',
      original_height: product.original_height || '',
      original_width: product.original_width || '',
      original_length: product.original_length || '',
      parts_count: product.parts_count || 1,
      main_image: null,
      additional_images: [],
      price_options: product.price_options || [{ size: '', price: '', resin_ml: '' }],
      is_visible: product.is_visible
    });
    setShowAddForm(true);
  };

  const exportProducts = async () => {
    try {
      const response = await axios.get('/api/products/export');
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `products_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      alert('Ошибка при экспорте товаров');
    }
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
        <h1 className="text-3xl font-bold text-black">Управление товарами</h1>
        <div className="flex gap-3">
          <button
            className="btn btn-secondary"
            onClick={exportProducts}
          >
            <FaDownload className="mr-2" />
            Экспорт
          </button>
          <button
            className="btn btn-accent"
            onClick={() => setShowAddForm(true)}
          >
            <FaPlus className="mr-2" />
            Добавить товар
          </button>
        </div>
      </div>

      {/* Поиск */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по названию, описанию или ID..."
              className="input pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Список товаров */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">
            Товары ({products.length})
          </h2>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
              <p className="text-gray-500">Загрузка товаров...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Товары не найдены</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-700">ID</th>
                    <th className="text-left p-3 font-medium text-gray-700">Изображение</th>
                    <th className="text-left p-3 font-medium text-gray-700">Название</th>
                    <th className="text-left p-3 font-medium text-gray-700">Варианты цен</th>
                    <th className="text-left p-3 font-medium text-gray-700">Продажи</th>
                    <th className="text-left p-3 font-medium text-gray-700">Статус</th>
                    <th className="text-left p-3 font-medium text-gray-700">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{product.id}</td>
                      <td className="p-3">
                        {product.main_image && (
                          <img
                            src={product.main_image}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded border"
                          />
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{product.name}</div>
                        {product.related_name && (
                          <div className="text-sm text-gray-500">{product.related_name}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-sm">
                          {product.price_options?.map((option, index) => (
                            <div key={index} className="mb-1">
                              {option.size}: {option.price}₽
                              {option.resin_ml && (
                                <span className="text-gray-500"> ({option.resin_ml}мл)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">{product.sales_count || 0}</td>
                      <td className="p-3">
                        <span className={`status-badge ${product.is_visible ? 'status-completed' : 'status-cancelled'}`}>
                          {product.is_visible ? 'Отображается' : 'Скрыт'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => setViewingProduct(product)}
                            title="Просмотр"
                          >
                            <FaEye />
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => startEdit(product)}
                            title="Редактировать"
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="btn btn-sm bg-red-500 text-white hover:bg-red-600"
                            onClick={() => deleteProduct(product.id)}
                            title="Удалить"
                          >
                            <FaTrash />
                          </button>
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

      {/* Форма добавления/редактирования товара */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                {editingProduct ? 'Редактировать товар' : 'Добавить товар'}
              </h3>
              
              <form onSubmit={editingProduct ? updateProduct : createProduct} className="space-y-6">
                {/* Основная информация */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Название *</label>
                    <input
                      type="text"
                      name="name"
                      className="input w-full"
                      value={productForm.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Связанное название</label>
                    <input
                      type="text"
                      name="related_name"
                      className="input w-full"
                      value={productForm.related_name}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                {/* Описание */}
                <div>
                  <label className="block text-sm font-medium mb-2">Описание</label>
                  <textarea
                    name="description"
                    className="input textarea w-full"
                    value={productForm.description}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>

                {/* Размеры */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Исходная высота</label>
                    <input
                      type="number"
                      step="0.1"
                      name="original_height"
                      className="input w-full"
                      value={productForm.original_height}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Исходная ширина</label>
                    <input
                      type="number"
                      step="0.1"
                      name="original_width"
                      className="input w-full"
                      value={productForm.original_width}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Исходная длина</label>
                    <input
                      type="number"
                      step="0.1"
                      name="original_length"
                      className="input w-full"
                      value={productForm.original_length}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Количество деталей</label>
                    <input
                      type="number"
                      min="1"
                      name="parts_count"
                      className="input w-full"
                      value={productForm.parts_count}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                {/* Варианты цен и размеров */}
                <div>
                  <label className="block text-sm font-medium mb-2">Варианты размеров и цен *</label>
                  {productForm.price_options.map((option, index) => (
                    <div key={index} className="flex gap-3 mb-3 items-end">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Размер (например: 10см)"
                          className="input w-full"
                          value={option.size}
                          onChange={(e) => handlePriceOptionChange(index, 'size', e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="number"
                          placeholder="Цена в рублях"
                          className="input w-full"
                          value={option.price}
                          onChange={(e) => handlePriceOptionChange(index, 'price', e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Количество смолы (мл)"
                          className="input w-full"
                          value={option.resin_ml}
                          onChange={(e) => handlePriceOptionChange(index, 'resin_ml', e.target.value)}
                        />
                      </div>
                      {productForm.price_options.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-sm bg-red-500 text-white hover:bg-red-600"
                          onClick={() => removePriceOption(index)}
                        >
                          <FaTrash />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addPriceOption}
                  >
                    <FaPlus className="mr-2" />
                    Добавить вариант
                  </button>
                </div>

                {/* Загрузка изображений */}
                {!editingProduct && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Главное изображение</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleMainImageChange}
                        className="input w-full"
                      />
                      {previewImages.main && (
                        <img
                          src={previewImages.main}
                          alt="Превью"
                          className="w-24 h-24 object-cover rounded border mt-2"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Дополнительные изображения (до 4)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleAdditionalImagesChange}
                        className="input w-full"
                      />
                      {previewImages.additional.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {previewImages.additional.map((preview, index) => (
                            <img
                              key={index}
                              src={preview}
                              alt={`Превью ${index + 1}`}
                              className="w-16 h-16 object-cover rounded border"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Настройки отображения */}
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_visible"
                      checked={productForm.is_visible}
                      onChange={handleInputChange}
                    />
                    <span className="text-sm">Отображать в каталоге</span>
                  </label>
                </div>

                {/* Кнопки */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="btn btn-primary flex-1"
                    disabled={loading}
                  >
                    {editingProduct ? 'Обновить' : 'Создать'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost flex-1"
                    onClick={resetForm}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Просмотр товара */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {viewingProduct.name}
                </h3>
                <button
                  className="btn btn-ghost"
                  onClick={() => setViewingProduct(null)}
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                {viewingProduct.main_image && (
                  <img
                    src={viewingProduct.main_image}
                    alt={viewingProduct.name}
                    className="w-full h-48 object-cover rounded border"
                  />
                )}
                
                <div>
                  <strong>ID:</strong> {viewingProduct.id}
                </div>
                
                {viewingProduct.related_name && (
                  <div>
                    <strong>Связанное название:</strong> {viewingProduct.related_name}
                  </div>
                )}
                
                {viewingProduct.description && (
                  <div>
                    <strong>Описание:</strong> {viewingProduct.description}
                  </div>
                )}
                
                <div>
                  <strong>Варианты размеров и цен:</strong>
                  <div className="mt-2 space-y-2">
                    {viewingProduct.price_options?.map((option, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded">
                        <div><strong>Размер:</strong> {option.size}</div>
                        <div><strong>Цена:</strong> {option.price}₽</div>
                        {option.resin_ml && (
                          <div><strong>Смола:</strong> {option.resin_ml}мл</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <strong>Продажи:</strong> {viewingProduct.sales_count || 0}
                </div>
                
                <div>
                  <strong>Статус:</strong>{' '}
                  <span className={`status-badge ${viewingProduct.is_visible ? 'status-completed' : 'status-cancelled'}`}>
                    {viewingProduct.is_visible ? 'Отображается' : 'Скрыт'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManager;