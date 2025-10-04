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