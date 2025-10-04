import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Settings = () => {
  const [settings, setSettings] = useState({
    payment_info: '',
    price_coefficient: 5.25,
    discount_rules: [],
    show_discount_on_products: false
  });
  const [currentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('currentUser') || '{}');
    } catch {
      return {};
    }
  });

  const [newDiscount, setNewDiscount] = useState({
    name: '',
    type: 'percentage',
    value: 0,
    conditions: {
      min_total_spent: 0,
      role: '',
      registration_date_after: '',
      min_order_amount: 0,
      monthly_orders_count: 0,
      monthly_spent_amount: 0,
      start_date: '',
      end_date: '',
      user_id: '',
      product_ids: []
    }
  });

  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [importFile, setImportFile] = useState(null);

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (currentUser.id === 1) {
      loadSettings();
    } else {
      console.error('Доступ к настройкам запрещен');
    }
  }, []);

  const loadSettings = async () => {
    try {
      console.log('Загрузка настроек...');
      const response = await axios.get('/api/settings', {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Ответ сервера на загрузку настроек:', response.data);
      
      if (response.data && response.status === 200) {
        // Обработка discount_rules как строки из базы данных
        let discountRules = [];
        if (response.data.discount_rules) {
          try {
            discountRules = typeof response.data.discount_rules === 'string' 
              ? JSON.parse(response.data.discount_rules) 
              : response.data.discount_rules;
          } catch (parseError) {
            console.warn('Ошибка парсинга discount_rules:', parseError);
            discountRules = [];
          }
        }
        
        const loadedSettings = {
          payment_info: response.data.payment_info || '',
          price_coefficient: parseFloat(response.data.price_coefficient) || 5.25,
          discount_rules: Array.isArray(discountRules) ? discountRules : [],
          show_discount_on_products: Boolean(response.data.show_discount_on_products)
        };
        
        console.log('Успешно загружены настройки:', loadedSettings);
        setSettings(loadedSettings);
      } else {
        console.warn('Сервер не вернул корректные данные, используем значения по умолчанию');
        setDefaultSettings();
      }
    } catch (error) {
      console.error('Критическая ошибка загрузки настроек:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      
      // Устанавливаем значения по умолчанию при любой ошибке
      setDefaultSettings();
      
      // Показываем пользователю информативное сообщение
      if (error.response?.status === 404) {
        console.info('API настроек недоступно, используем локальные значения');
      } else if (error.code === 'ECONNABORTED') {
        alert('Превышено время ожидания загрузки настроек');
      } else {
        alert('Ошибка при загрузке настроек. Используются значения по умолчанию.');
      }
    }
  };

  const setDefaultSettings = () => {
    console.log('Установка настроек по умолчанию');
    setSettings({
      payment_info: 'Реквизиты для оплаты:\nБанковская карта: 1234 5678 9012 3456\nЯндекс.Деньги: 410011234567890\nQIWI: +79001234567',
      price_coefficient: 5.25,
      discount_rules: [],
      show_discount_on_products: false
    });
  };

  const updateSettings = async (updatedSettings) => {
    if (!updatedSettings) {
      alert('Некорректные данные для обновления');
      return;
    }

    try {
      setLoading(true);
      console.log('Подготовка данных для отправки:', updatedSettings);
      
      // Валидация данных перед отправкой
      const validatedData = {
        payment_info: String(updatedSettings.payment_info || ''),
        price_coefficient: parseFloat(updatedSettings.price_coefficient) || 5.25,
        discount_rules: JSON.stringify(Array.isArray(updatedSettings.discount_rules) ? updatedSettings.discount_rules : []),
        show_discount_on_products: Boolean(updatedSettings.show_discount_on_products)
      };
      
      console.log('Валидированные данные для отправки:', validatedData);
      
      const response = await axios.put('/api/settings', validatedData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 20000
      });
      
      console.log('Успешный ответ сервера:', response.data);
      
      if (response.status === 200) {
        // Обновляем локальное состояние только при успешном ответе
        setSettings({
          ...updatedSettings,
          discount_rules: Array.isArray(updatedSettings.discount_rules) ? updatedSettings.discount_rules : []
        });
        alert('Настройки успешно обновлены');
      } else {
        throw new Error(`Неожиданный статус ответа: ${response.status}`);
      }
    } catch (error) {
      console.error('Критическая ошибка обновления настроек:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      
      let errorMessage = 'Ошибка при обновлении настроек';
      if (error.response) {
        if (error.response.status === 403) {
          errorMessage = 'Недостаточно прав для изменения настроек';
        } else if (error.response.status === 500) {
          errorMessage = 'Ошибка сервера при сохранении настроек';
        } else {
          errorMessage += `: ${error.response.data?.error || error.response.statusText}`;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Превышено время ожидания. Проверьте соединение с сервером.';
      } else if (error.request) {
        errorMessage = 'Нет ответа от сервера. Проверьте подключение к интернету.';
      } else {
        errorMessage += `: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const addDiscount = async () => {
    // Валидация данных скидки
    if (!newDiscount.name || !newDiscount.name.trim()) {
      alert('Укажите название скидки');
      return;
    }

    if (!newDiscount.value || parseFloat(newDiscount.value) <= 0) {
      alert('Укажите корректное значение скидки');
      return;
    }

    if (newDiscount.type === 'percentage' && parseFloat(newDiscount.value) > 100) {
      alert('Процентная скидка не может превышать 100%');
      return;
    }

    try {
      // Создаем новую скидку с уникальным ID
      const newDiscountRule = {
        ...newDiscount,
        id: Date.now() + Math.random(), // Более уникальный ID
        name: newDiscount.name.trim(),
        value: parseFloat(newDiscount.value),
        conditions: {
          ...newDiscount.conditions,
          min_total_spent: parseFloat(newDiscount.conditions.min_total_spent) || 0,
          min_order_amount: parseFloat(newDiscount.conditions.min_order_amount) || 0,
          monthly_orders_count: parseInt(newDiscount.conditions.monthly_orders_count) || 0,
          monthly_spent_amount: parseFloat(newDiscount.conditions.monthly_spent_amount) || 0
        }
      };

      console.log('Добавляется новая скидка:', newDiscountRule);

      // Обновляем массив скидок
      const updatedRules = [...(settings.discount_rules || []), newDiscountRule];
      
      console.log('Обновленный список скидок:', updatedRules);

      // Сохраняем настройки с новой скидкой
      await updateSettings({ ...settings, discount_rules: updatedRules });
      
      // Сбрасываем форму только после успешного сохранения
      setNewDiscount({
        name: '',
        type: 'percentage',
        value: 0,
        conditions: {
          min_total_spent: 0,
          role: '',
          registration_date_after: '',
          min_order_amount: 0,
          monthly_orders_count: 0,
          monthly_spent_amount: 0,
          start_date: '',
          end_date: '',
          user_id: '',
          product_ids: []
        }
      });
      
      console.log('Скидка успешно добавлена и форма сброшена');
      
    } catch (error) {
      console.error('Ошибка при добавлении скидки:', error);
      alert('Ошибка при добавлении скидки. Попробуйте еще раз.');
    }
  };

  const removeDiscount = (discountId) => {
    const updatedRules = settings.discount_rules.filter(rule => rule.id !== discountId);
    updateSettings({ ...settings, discount_rules: updatedRules });
  };

  const exportDatabase = async () => {
    if (!confirm('Экспортировать все данные базы? Это может занять некоторое время.')) {
      return;
    }

    try {
      setLoading(true);
      console.log('Начинаем экспорт базы данных...');
      
      const response = await axios.get('/api/backup/all', {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Данные экспорта получены:', response.data);
      
      // Создаем и скачиваем файл
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `database_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      alert('База данных успешно экспортирована!');
      console.log('Экспорт базы данных завершен');
      
    } catch (error) {
      console.error('Критическая ошибка экспорта базы данных:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      
      let errorMessage = 'Ошибка при экспорте базы данных';
      
      if (error.response) {
        if (error.response.status === 403) {
          errorMessage = 'Недостаточно прав для экспорта базы данных';
        } else if (error.response.status === 500) {
          errorMessage = 'Ошибка сервера при экспорте базы данных';
        } else if (error.response.data?.error) {
          errorMessage += `: ${error.response.data.error}`;
        } else {
          errorMessage += `: HTTP ${error.response.status}`;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Превышено время ожидания экспорта базы данных';
      } else if (error.request) {
        errorMessage = 'Нет соединения с сервером';
      } else {
        errorMessage += `: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('Выбран файл для импорта:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified).toLocaleString()
      });
      
      // Проверка расширения файла
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.json')) {
        alert('Файл должен иметь расширение .json');
        e.target.value = '';
        return;
      }
      
      // Проверка MIME типа (более гибкая)
      const validMimeTypes = ['application/json', 'text/json', 'text/plain'];
      if (file.type && !validMimeTypes.includes(file.type)) {
        console.warn('Неожиданный MIME тип:', file.type);
        if (!confirm(`Файл имеет тип "${file.type}". Продолжить импорт?`)) {
          e.target.value = '';
          return;
        }
      }
      
      if (file.size > 50 * 1024 * 1024) { // 50MB лимит
        alert('Файл слишком большой. Максимальный размер: 50MB');
        e.target.value = '';
        return;
      }
      
      if (file.size === 0) {
        alert('Файл пустой. Выберите файл с данными.');
        e.target.value = '';
        return;
      }
      
      console.log('Файл успешно выбран для импорта');
      setImportFile(file);
    } else {
      setImportFile(null);
    }
  };

  const importDatabase = async () => {
    if (!importFile) {
      alert('Выберите файл для импорта');
      return;
    }

    // Предварительная валидация файла
    if (!importFile.type || !importFile.type.includes('json')) {
      alert('Файл должен быть в формате JSON');
      return;
    }

    if (importFile.size > 50 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер: 50MB');
      return;
    }

    // Проверка содержимого файла
    try {
      const fileContent = await importFile.text();
      const jsonData = JSON.parse(fileContent);
      
      // Валидация структуры данных
      if (!jsonData || typeof jsonData !== 'object') {
        throw new Error('Некорректная структура файла');
      }
      
      const requiredFields = ['users', 'products', 'orders'];
      const missingFields = requiredFields.filter(field => !jsonData[field] || !Array.isArray(jsonData[field]));
      
      if (missingFields.length > 0) {
        throw new Error(`Отсутствуют обязательные поля: ${missingFields.join(', ')}`);
      }
      
      console.log('Валидация файла прошла успешно:', {
        users: jsonData.users.length,
        products: jsonData.products.length,
        orders: jsonData.orders.length,
        settings: jsonData.settings ? jsonData.settings.length : 0
      });
      
    } catch (validationError) {
      console.error('Ошибка валидации файла:', validationError);
      alert(`Ошибка в файле: ${validationError.message}. Убедитесь, что файл содержит корректные данные.`);
      return;
    }

    const confirmMessage = `ВНИМАНИЕ! Вы собираетесь заменить ВСЮ базу данных.\n\nВсе текущие данные будут удалены:\n- Пользователи\n- Товары\n- Заказы\n- Сообщения\n- Настройки\n\nЭто действие НЕОБРАТИМО!\n\nВы уверены, что хотите продолжить?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    // Дополнительное подтверждение
    const finalConfirm = prompt('Для подтверждения введите "УДАЛИТЬ ВСЕ ДАННЫЕ" (без кавычек):');
    if (finalConfirm !== 'УДАЛИТЬ ВСЕ ДАННЫЕ') {
      alert('Импорт отменен');
      return;
    }

    try {
      setLoading(true);
      console.log('Начинаем импорт базы данных...');
      
      const formData = new FormData();
      formData.append('backup_file', importFile);
      
      const response = await axios.post('/api/backup/restore', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 120000, // 2 минуты на импорт
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`Загрузка файла: ${percentCompleted}%`);
        }
      });
      
      console.log('Ответ сервера на импорт:', response.status, response.data);
      
      if (response.status === 200 && response.data) {
        const result = response.data;
        
        if (result.success) {
          let successMessage = 'База данных успешно импортирована!';
          
          if (result.imported) {
            successMessage += `\n\nИмпортировано:\n`;
            if (result.imported.users) successMessage += `- Пользователей: ${result.imported.users}\n`;
            if (result.imported.products) successMessage += `- Товаров: ${result.imported.products}\n`;
            if (result.imported.orders) successMessage += `- Заказов: ${result.imported.orders}\n`;
            if (result.imported.settings) successMessage += `- Настроек: ${result.imported.settings}\n`;
          }
          
          successMessage += '\nПерезагрузите страницу для применения изменений.';
          
          alert(successMessage);
          setImportFile(null);
          
          // Очищаем поле выбора файла
          const fileInput = document.querySelector('input[type="file"]');
          if (fileInput) {
            fileInput.value = '';
          }
          
          console.log('Импорт базы данных завершен успешно');
          
          // Предлагаем перезагрузить страницу
          if (confirm('Импорт завершен. Перезагрузить страницу сейчас?')) {
            window.location.reload();
          }
        } else {
          throw new Error(result.message || result.error || 'Сервер сообщил об ошибке импорта');
        }
      } else {
        throw new Error(`Неожиданный ответ сервера: статус ${response.status}`);
      }
      
    } catch (error) {
      console.error('Критическая ошибка импорта базы данных:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      
      let errorMessage = 'Ошибка при импорте базы данных';
      
      if (error.response) {
        const status = error.response.status;
        const serverError = error.response.data?.error;
        
        if (status === 400) {
          errorMessage = 'Некорректный файл или формат данных';
          if (serverError) {
            errorMessage += `: ${serverError}`;
          }
        } else if (status === 403) {
          errorMessage = 'Недостаточно прав для импорта базы данных';
        } else if (status === 413) {
          errorMessage = 'Файл слишком большой для загрузки';
        } else if (status === 500) {
          errorMessage = 'Ошибка сервера при импорте базы данных';
          if (serverError) {
            errorMessage += `: ${serverError}`;
          }
        } else if (serverError) {
          errorMessage += `: ${serverError}`;
        } else {
          errorMessage += `: HTTP ${status}`;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Превышено время ожидания импорта базы данных (более 2 минут)';
      } else if (error.request) {
        errorMessage = 'Нет соединения с сервером. Проверьте подключение к интернету.';
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastMessage || !broadcastMessage.trim()) {
      alert('Введите сообщение для рассылки');
      return;
    }

    if (!currentUser || !currentUser.id) {
      alert('Ошибка: не определен текущий пользователь');
      return;
    }

    try {
      setLoading(true);
      
      const messageData = {
        message: broadcastMessage.trim(),
        from_user_id: currentUser.id
      };
      
      console.log('Отправка рассылки с данными:', messageData);
      
      const response = await axios.post('/api/chat/broadcast', messageData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      console.log('Полный ответ сервера на рассылку:', response);
      
      if (response.status === 200 || response.status === 201) {
        const responseData = response.data;
        let successMessage = 'Рассылка отправлена успешно!';
        
        if (responseData) {
          if (responseData.count !== undefined) {
            successMessage += `\nОтправлено сообщений: ${responseData.count}`;
          }
          if (responseData.recipients !== undefined) {
            successMessage += `\nПолучателей: ${responseData.recipients}`;
          }
          if (responseData.message) {
            successMessage += `\n${responseData.message}`;
          }
        }
        
        alert(successMessage);
        setBroadcastMessage('');
        
        console.log('Рассылка успешно завершена');
      } else {
        throw new Error(`Неожиданный статус ответа: ${response.status}`);
      }
    } catch (error) {
      console.error('Критическая ошибка при рассылке:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      
      let errorMessage = 'Ошибка при отправке рассылки';
      
      if (error.response) {
        const status = error.response.status;
        const serverError = error.response.data?.error;
        
        if (status === 403) {
          errorMessage = 'Недостаточно прав для отправки рассылки';
        } else if (status === 404) {
          errorMessage = 'API рассылки не найдено';
        } else if (status === 500) {
          errorMessage = 'Ошибка сервера при отправке рассылки';
        } else if (serverError) {
          errorMessage += `: ${serverError}`;
        } else {
          errorMessage += `: HTTP ${status}`;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Превышено время ожидания отправки рассылки';
      } else if (error.request) {
        errorMessage = 'Нет соединения с сервером';
      } else {
        errorMessage += `: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Проверка прав доступа
  if (!currentUser.id || currentUser.id !== 1) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Доступ запрещен. Только для администраторов.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-black mb-8">Системные настройки</h1>

      {/* Платежная информация */}
      <div className="card mb-8">
        <div className="card-header">
          <h2 className="text-xl font-semibold">Информация для оплаты</h2>
        </div>
        <div className="card-body">
          <textarea
            className="input textarea w-full mb-4"
            placeholder="Введите реквизиты для оплаты..."
            value={settings.payment_info}
            onChange={(e) => setSettings({ ...settings, payment_info: e.target.value })}
            rows={4}
          />
          <button
            className="btn btn-primary"
            onClick={() => updateSettings(settings)}
            disabled={loading}
          >
            Сохранить реквизиты
          </button>
        </div>
      </div>

      {/* Коэффициент стоимости */}
      <div className="card mb-8">
        <div className="card-header">
          <h2 className="text-xl font-semibold">Коэффициент стоимости</h2>
        </div>
        <div className="card-body">
          <div className="flex items-center gap-4 mb-4">
            <label className="text-gray-700">Коэффициент:</label>
            <input
              type="number"
              step="0.01"
              className="input w-32"
              value={settings.price_coefficient}
              onChange={(e) => setSettings({ ...settings, price_coefficient: parseFloat(e.target.value) || 0 })}
            />
            <span className="text-gray-500">
              (по умолчанию 5.25 = +0%)
            </span>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => updateSettings(settings)}
            disabled={loading}
          >
            Обновить коэффициент
          </button>
        </div>
      </div>

      {/* Управление скидками */}
      <div className="card mb-8">
        <div className="card-header">
          <h2 className="text-xl font-semibold">Управление скидками</h2>
        </div>
        <div className="card-body">
          {/* Существующие скидки */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-4">Активные скидки</h3>
            {settings.discount_rules.length === 0 ? (
              <p className="text-gray-500">Скидки не настроены</p>
            ) : (
              <div className="space-y-3">
                {settings.discount_rules.map((rule) => (
                  <div key={rule.id} className="border rounded p-4 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-black">{rule.name}</h4>
                        <p className="text-sm text-gray-600">
                          Тип: {rule.type === 'percentage' ? 'Процент' : 'Фиксированная сумма'} - {rule.value}{rule.type === 'percentage' ? '%' : '₽'}
                        </p>
                        <div className="text-xs text-gray-500 mt-1">
                          {rule.conditions.min_total_spent > 0 && `Мин. потрачено: ${rule.conditions.min_total_spent}₽ `}
                          {rule.conditions.role && `Роль: ${rule.conditions.role} `}
                          {rule.conditions.min_order_amount > 0 && `Мин. сумма заказа: ${rule.conditions.min_order_amount}₽ `}
                        </div>
                      </div>
                      <button
                        className="btn btn-sm bg-red-500 text-white hover:bg-red-600"
                        onClick={() => removeDiscount(rule.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Добавление новой скидки */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium mb-4">Добавить новую скидку</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Название скидки</label>
                <input
                  type="text"
                  className="input w-full"
                  value={newDiscount.name}
                  onChange={(e) => setNewDiscount({ ...newDiscount, name: e.target.value })}
                  placeholder="Например: Скидка постоянным клиентам"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Тип скидки</label>
                <select
                  className="input select w-full"
                  value={newDiscount.type}
                  onChange={(e) => setNewDiscount({ ...newDiscount, type: e.target.value })}
                >
                  <option value="percentage">Процент</option>
                  <option value="fixed">Фиксированная сумма</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Значение</label>
                <input
                  type="number"
                  className="input w-full"
                  value={newDiscount.value}
                  onChange={(e) => setNewDiscount({ ...newDiscount, value: parseFloat(e.target.value) || 0 })}
                  placeholder={newDiscount.type === 'percentage' ? '10' : '500'}
                />
              </div>
            </div>

            {/* Условия скидки */}
            <div className="mb-4">
              <h4 className="text-md font-medium mb-2">Условия применения</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Мин. потрачено всего (₽)</label>
                  <input
                    type="number"
                    className="input w-full text-sm"
                    value={newDiscount.conditions.min_total_spent}
                    onChange={(e) => setNewDiscount({
                      ...newDiscount,
                      conditions: { ...newDiscount.conditions, min_total_spent: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Роль</label>
                  <select
                    className="input select w-full text-sm"
                    value={newDiscount.conditions.role}
                    onChange={(e) => setNewDiscount({
                      ...newDiscount,
                      conditions: { ...newDiscount.conditions, role: e.target.value }
                    })}
                  >
                    <option value="">Любая</option>
                    <option value="buyer">Покупатель</option>
                    <option value="executor">Исполнитель</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Мин. сумма заказа (₽)</label>
                  <input
                    type="number"
                    className="input w-full text-sm"
                    value={newDiscount.conditions.min_order_amount}
                    onChange={(e) => setNewDiscount({
                      ...newDiscount,
                      conditions: { ...newDiscount.conditions, min_order_amount: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">ID пользователя</label>
                  <input
                    type="text"
                    className="input w-full text-sm"
                    value={newDiscount.conditions.user_id}
                    onChange={(e) => setNewDiscount({
                      ...newDiscount,
                      conditions: { ...newDiscount.conditions, user_id: e.target.value }
                    })}
                    placeholder="Оставить пустым для всех"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Дата начала</label>
                  <input
                    type="date"
                    className="input w-full text-sm"
                    value={newDiscount.conditions.start_date}
                    onChange={(e) => setNewDiscount({
                      ...newDiscount,
                      conditions: { ...newDiscount.conditions, start_date: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Дата окончания</label>
                  <input
                    type="date"
                    className="input w-full text-sm"
                    value={newDiscount.conditions.end_date}
                    onChange={(e) => setNewDiscount({
                      ...newDiscount,
                      conditions: { ...newDiscount.conditions, end_date: e.target.value }
                    })}
                  />
                </div>
              </div>
            </div>

            <button
              className="btn btn-accent mr-4"
              onClick={addDiscount}
              disabled={loading}
            >
              Добавить скидку
            </button>
          </div>

          {/* Отображение скидок на товарах */}
          <div className="border-t pt-4 mt-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.show_discount_on_products}
                onChange={(e) => setSettings({ ...settings, show_discount_on_products: e.target.checked })}
              />
              <span className="text-sm">Отображать применение скидки на товарах</span>
            </label>
            <button
              className="btn btn-secondary mt-2"
              onClick={() => updateSettings(settings)}
              disabled={loading}
            >
              Сохранить настройку отображения
            </button>
          </div>
        </div>
      </div>

      {/* Управление базой данных */}
      <div className="card mb-8">
        <div className="card-header">
          <h2 className="text-xl font-semibold">Управление базой данных</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-lg font-medium mb-3">Экспорт данных</h3>
              <p className="text-sm text-gray-600 mb-4">
                Скачать все данные базы в формате JSON для резервного копирования
              </p>
              <button
                className="btn btn-primary w-full"
                onClick={exportDatabase}
                disabled={loading}
              >
                Экспортировать базу данных
              </button>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-3">Импорт данных</h3>
              <p className="text-sm text-gray-600 mb-4">
                Загрузить данные из JSON файла (заменит текущую базу данных)
              </p>
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="input w-full mb-2"
                disabled={loading}
              />
              <div className="text-xs text-red-500 mb-2">
                ⚠️ Внимание! Импорт полностью заменит текущую базу данных
              </div>
              {importFile && (
                <button
                  className="btn btn-accent w-full"
                  onClick={importDatabase}
                  disabled={loading}
                >
                  Импортировать базу данных
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Общая рассылка */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">Общая рассылка</h2>
        </div>
        <div className="card-body">
          <textarea
            className="input textarea w-full mb-4"
            placeholder="Введите сообщение для рассылки всем пользователям..."
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            rows={3}
          />
          <button
            className="btn btn-accent"
            onClick={sendBroadcast}
            disabled={loading || !broadcastMessage.trim()}
          >
            Отправить рассылку
          </button>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-2"></div>
              <p>Обновление настроек...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;