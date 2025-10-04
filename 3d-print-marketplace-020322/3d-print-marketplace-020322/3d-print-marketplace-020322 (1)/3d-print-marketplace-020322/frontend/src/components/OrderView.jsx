import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaEye, FaComments, FaCalendarAlt, FaCreditCard, FaBox, FaUser, FaSearch } from 'react-icons/fa';

const OrderView = ({ isAdmin = false, isExecutor = false }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewingOrder, setViewingOrder] = useState(null);
  const [updatingOrder, setUpdatingOrder] = useState(null);
  const [assigningExecutors, setAssigningExecutors] = useState(null);
  const [availableExecutors, setAvailableExecutors] = useState([]);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  const statusOptions = [
    'создан заказ',
    'принят к исполнению',
    'не оплачено',
    'печатается',
    'красится',
    'упаковывается',
    'отменен',
    'задерживается',
    'готово'
  ];

  useEffect(() => {
    loadOrders();
    if (isAdmin) {
      loadExecutors();
    }
  }, [searchTerm, statusFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // Упрощенная логика загрузки как в v94
      if (isAdmin) {
        // Администратор видит все заказы
        params.append('admin', 'true');
      } else if (isExecutor) {
        // Исполнитель видит назначенные ему заказы
        params.append('executor_id', currentUser.id);
      } else {
        // Обычный пользователь видит только свои заказы
        params.append('user_id', currentUser.id);
      }
      
      if (searchTerm && searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      if (statusFilter) {
        params.append('status', statusFilter);
      }

      console.log('Загрузка заказов с параметрами:', params.toString());
      
      const response = await axios.get(`/api/orders?${params.toString()}`, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Ответ сервера заказов:', response.status, response.data);
      
      // Проверяем корректность ответа
      if (response.data && Array.isArray(response.data)) {
        const validOrders = response.data.filter(order => {
          return order && typeof order === 'object' && order.id;
        });
        console.log('Получены валидные заказы:', validOrders.length);
        setOrders(validOrders);
      } else {
        console.warn('Некорректный ответ от сервера заказов:', response.data);
        setOrders([]);
      }
    } catch (error) {
      console.error('Детальная ошибка загрузки заказов:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });
      
      let errorMessage = 'Ошибка загрузки заказов';
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = 'API заказов не найдено';
        } else if (error.response.status === 500) {
          errorMessage = 'Ошибка сервера при загрузке заказов';
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Превышено время ожидания загрузки заказов';
      } else if (error.request) {
        errorMessage = 'Нет связи с сервером';
      }
      
      alert(errorMessage);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutors = async () => {
    if (!currentUser.id || currentUser.id !== 1) {
      console.warn('Недостаточно прав для загрузки исполнителей');
      return;
    }
    
    try {
      console.log('Загрузка исполнителей...');
      const response = await axios.get('/api/admin/users?role_filter=executor', {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Ответ сервера исполнителей:', response.status, response.data);
      
      if (response.data && Array.isArray(response.data)) {
        const validExecutors = response.data.filter(executor => {
          return executor && typeof executor === 'object' && executor.id && executor.username;
        });
        console.log('Получены валидные исполнители:', validExecutors.length);
        setAvailableExecutors(validExecutors);
      } else {
        console.warn('Некорректный ответ от сервера исполнителей:', response.data);
        setAvailableExecutors([]);
      }
    } catch (error) {
      console.error('Детальная ошибка загрузки исполнителей:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMessage = 'Ошибка загрузки исполнителей';
      if (error.response?.status === 404) {
        errorMessage = 'API пользователей не найдено';
      } else if (error.response?.status === 403) {
        errorMessage = 'Недостаточно прав для просмотра исполнителей';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Превышено время ожидания';
      }
      
      console.warn(errorMessage);
      setAvailableExecutors([]);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    if (!orderId || !newStatus) {
      alert('Некорректные данные для обновления статуса');
      return;
    }
    
    if (!currentUser.id || currentUser.id !== 1) {
      alert('Недостаточно прав для изменения статуса');
      return;
    }
    
    try {
      console.log('Обновление статуса заказа:', orderId, newStatus);
      
      const updateData = {
        status: newStatus
      };
      
      // Добавляем admin_id только если пользователь администратор
      if (currentUser.id === 1) {
        updateData.admin_id = currentUser.id;
      }
      
      const response = await axios.put(`/api/orders/${orderId}`, updateData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Ответ сервера на обновление статуса:', response.status, response.data);
      
      if (response.status === 200) {
        alert('Статус заказа обновлен');
        loadOrders();
        setUpdatingOrder(null);
      } else {
        throw new Error(`Неожиданный статус ответа: ${response.status}`);
      }
    } catch (error) {
      console.error('Детальная ошибка обновления статуса:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        orderId,
        newStatus
      });
      
      let errorMessage = 'Ошибка при обновлении статуса';
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = 'Заказ не найден';
        } else if (error.response.status === 403) {
          errorMessage = 'Недостаточно прав для изменения статуса';
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Превышено время ожидания обновления';
      }
      
      alert(errorMessage);
    }
  };

  const updateOrderPrice = async (orderId, newPrice) => {
    if (!confirm(`Изменить цену заказа на ${newPrice}₽?`)) return;

    try {
      await axios.put(`/api/orders/${orderId}`, { total_price: newPrice });
      alert('Цена заказа обновлена');
      loadOrders();
    } catch (error) {
      console.error('Ошибка обновления цены:', error);
      alert('Ошибка при обновлении цены');
    }
  };

  const assignExecutors = async (orderId, executorIds) => {
    try {
      console.log('Назначение исполнителей:', orderId, executorIds);
      const response = await axios.put(`/api/orders/${orderId}`, { 
        assigned_executors: JSON.stringify(executorIds),
        status: 'принят к исполнению',
        admin_id: currentUser.id
      });
      console.log('Ответ сервера:', response.data);
      alert('Исполнители назначены');
      loadOrders();
      setAssigningExecutors(null);
    } catch (error) {
      console.error('Ошибка назначения исполнителей:', error);
      const errorMessage = error.response?.data?.error || 'Ошибка при назначении исполнителей';
      alert(errorMessage);
    }
  };

  const openChat = (userId, orderId) => {
    const chatUrl = `#/chat?user=${userId}&order=${orderId}`;
    window.location.href = chatUrl;
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'создан заказ': 'status-created',
      'принят к исполнению': 'status-processing',
      'не оплачено': 'status-cancelled',
      'печатается': 'status-processing',
      'красится': 'status-processing',
      'упаковывается': 'status-processing',
      'отменен': 'status-cancelled',
      'задерживается': 'status-cancelled',
      'готово': 'status-completed'
    };
    
    return `status-badge ${statusMap[status] || 'status-created'}`;
  };

  const formatProducts = (products) => {
    if (!products || products.length === 0) return 'Товары не указаны';
    
    return products.map(product => {
      const sizeInfo = product.selectedSize ? ` (${product.selectedSize.size})` : '';
      const resinInfo = product.selectedSize?.resin_ml ? ` - ${product.selectedSize.resin_ml}мл` : '';
      return `${product.name}${sizeInfo}${resinInfo} x${product.quantity}`;
    }).join(', ');
  };

  const calculateTotalWithOptions = (products) => {
    if (!products || products.length === 0) return 0;
    
    return products.reduce((total, product) => {
      const price = product.selectedSize?.price || product.price || 0;
      const quantity = product.quantity || 1;
      return total + (price * quantity);
    }, 0);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-black">
          {isAdmin ? 'Управление заказами' : isExecutor ? 'Мои назначенные заказы' : 'Мои заказы'}
        </h1>
      </div>

      {/* Поиск и фильтры */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по ID заказа..."
                className="input pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <select
                className="input select w-full"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Все статусы</option>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Список заказов */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold">
            Заказы ({Array.isArray(orders) ? orders.length : 0})
            {currentUser?.role && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({currentUser.role === 'admin' ? 'Все' : currentUser.role === 'executor' ? 'Назначенные' : 'Мои'} заказы)
              </span>
            )}
          </h2>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
              <p className="text-gray-500">Загрузка заказов...</p>
              <p className="text-xs text-gray-400 mt-2">Пользователь: {currentUser?.username} (ID: {currentUser?.id})</p>
            </div>
          ) : !Array.isArray(orders) ? (
            <div className="text-center py-8">
              <FaBox className="text-4xl text-red-300 mx-auto mb-4" />
              <p className="text-red-500">Ошибка загрузки данных заказов</p>
              <p className="text-xs text-gray-500 mt-2">Некорректный формат ответа сервера</p>
              <button 
                className="btn btn-secondary btn-sm mt-3"
                onClick={loadOrders}
              >
                Попробовать снова
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <FaBox className="text-4xl text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm || statusFilter ? 'Заказы не найдены по заданным критериям' : 'Заказы не найдены'}
              </p>
              {(searchTerm || statusFilter) && (
                <button 
                  className="btn btn-ghost btn-sm mt-3"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('');
                  }}
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="border rounded-lg p-6 bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-semibold text-black text-lg">
                          Заказ #{order.id}
                        </h3>
                        <div className="text-sm text-gray-600 flex items-center gap-4 mt-1">
                          <span className="flex items-center gap-1">
                            <FaCalendarAlt />
                            {new Date(order.created_date).toLocaleDateString('ru-RU')}
                          </span>
                          {isAdmin && (
                            <span className="flex items-center gap-1">
                              <FaUser />
                              Клиент #{order.user_id}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={getStatusBadge(order.status)}>
                        {order.status}
                      </span>
                      <div className="text-right">
                        <div className="font-semibold text-lg text-accent-blue">
                          {order.total_price}₽
                        </div>
                        {isAdmin && (
                          <button
                            className="text-xs text-gray-500 hover:text-accent-blue"
                            onClick={() => {
                              const newPrice = prompt('Новая цена:', order.total_price);
                              if (newPrice && !isNaN(newPrice)) {
                                updateOrderPrice(order.id, parseFloat(newPrice));
                              }
                            }}
                          >
                            Изменить цену
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Состав заказа */}
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Состав заказа:</div>
                    <div className="bg-white p-3 rounded border">
                      {order.products && order.products.length > 0 ? (
                        <div className="space-y-2">
                          {order.products.map((product, index) => (
                            <div key={index} className="flex justify-between items-center">
                              <div>
                                <span className="font-medium">{product.name}</span>
                                <span className="text-gray-600 ml-2">(ID: {product.id})</span>
                                {product.selectedSize && (
                                  <div className="text-sm text-gray-500 mt-1">
                                    <span>Размер: {product.selectedSize.size}</span>
                                    {product.selectedSize.resin_ml && (
                                      <span> • Смола: {product.selectedSize.resin_ml}мл</span>
                                    )}
                                    <span> • Цена: {product.selectedSize.price}₽</span>
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-medium">x{product.quantity}</div>
                                <div className="text-sm text-gray-500">
                                  {(product.selectedSize?.price || product.price || 0) * product.quantity}₽
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500">Состав заказа не указан</p>
                      )}
                    </div>
                  </div>

                  {/* Примечания */}
                  {(order.notes || order.admin_notes) && (
                    <div className="mb-4">
                      {order.notes && (
                        <div className="mb-2">
                          <span className="text-sm font-medium text-gray-700">Примечание клиента:</span>
                          <p className="text-sm text-gray-600 bg-white p-2 rounded border mt-1">
                            {order.notes}
                          </p>
                        </div>
                      )}
                      {order.admin_notes && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Примечание администратора:</span>
                          <p className="text-sm text-gray-600 bg-white p-2 rounded border mt-1">
                            {order.admin_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Назначенные исполнители */}
                  {order.assigned_executors && order.assigned_executors.length > 0 && (
                    <div className="mb-4">
                      <span className="text-sm font-medium text-gray-700">Исполнители:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {order.assigned_executors.map((executorId, index) => (
                          <span key={index} className="status-badge status-processing">
                            ID: {executorId}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Действия */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setViewingOrder(order)}
                    >
                      <FaEye className="mr-1" />
                      Подробнее
                    </button>

                    <button
                      className="btn btn-accent btn-sm"
                      onClick={() => openChat(isAdmin ? order.user_id : 1, order.id)}
                    >
                      <FaComments className="mr-1" />
                      {isAdmin ? 'Чат с клиентом' : 'Написать администратору'}
                    </button>

                    {isAdmin && (
                      <>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setUpdatingOrder(order)}
                        >
                          Изменить статус
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setAssigningExecutors(order)}
                        >
                          Назначить исполнителей
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно просмотра заказа */}
      {viewingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Подробности заказа #{viewingOrder.id}
                </h3>
                <button
                  className="btn btn-ghost"
                  onClick={() => setViewingOrder(null)}
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>ID заказа:</strong> {viewingOrder.id}</div>
                  <div><strong>Дата:</strong> {new Date(viewingOrder.created_date).toLocaleString('ru-RU')}</div>
                  <div><strong>Статус:</strong> <span className={getStatusBadge(viewingOrder.status)}>{viewingOrder.status}</span></div>
                  <div><strong>Общая сумма:</strong> {viewingOrder.total_price}₽</div>
                  {isAdmin && <div><strong>Клиент:</strong> #{viewingOrder.user_id}</div>}
                </div>

                <div>
                  <strong>Состав заказа:</strong>
                  <div className="bg-gray-50 p-4 rounded mt-2">
                    {viewingOrder.products && viewingOrder.products.length > 0 ? (
                      <div className="space-y-3">
                        {viewingOrder.products.map((product, index) => (
                          <div key={index} className="border-b pb-2 last:border-b-0">
                            <div className="font-medium">{product.name} (ID: {product.id})</div>
                            <div className="text-sm text-gray-600 mt-1">
                              <div>Количество: {product.quantity}</div>
                              {product.selectedSize && (
                                <>
                                  <div>Размер: {product.selectedSize.size}</div>
                                  <div>Цена за единицу: {product.selectedSize.price}₽</div>
                                  {product.selectedSize.resin_ml && (
                                    <div>Количество смолы: {product.selectedSize.resin_ml}мл</div>
                                  )}
                                  <div className="font-medium mt-1">
                                    Итого: {product.selectedSize.price * product.quantity}₽
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">Состав заказа не указан</p>
                    )}
                  </div>
                </div>

                {viewingOrder.notes && (
                  <div>
                    <strong>Примечание клиента:</strong>
                    <p className="bg-gray-50 p-3 rounded mt-2">{viewingOrder.notes}</p>
                  </div>
                )}

                {viewingOrder.admin_notes && (
                  <div>
                    <strong>Примечание администратора:</strong>
                    <p className="bg-gray-50 p-3 rounded mt-2">{viewingOrder.admin_notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно изменения статуса */}
      {updatingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Изменить статус заказа #{updatingOrder.id}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Новый статус:</label>
                  <select className="input select w-full" defaultValue={updatingOrder.status}>
                    {statusOptions.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex gap-3">
                  <button
                    className="btn btn-primary flex-1"
                    onClick={(e) => {
                      const select = e.target.closest('.p-6').querySelector('select');
                      updateOrderStatus(updatingOrder.id, select.value);
                    }}
                  >
                    Обновить статус
                  </button>
                  <button
                    className="btn btn-ghost flex-1"
                    onClick={() => setUpdatingOrder(null)}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно назначения исполнителей */}
      {assigningExecutors && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Назначить исполнителей для заказа #{assigningExecutors.id}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Выберите исполнителей:</label>
                  <div className="max-h-40 overflow-y-auto border rounded p-2">
                    {availableExecutors.map(executor => (
                      <label key={executor.id} className="flex items-center gap-2 p-2 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          defaultChecked={assigningExecutors.assigned_executors?.includes(executor.id)}
                        />
                        <span>{executor.username} (ID: {executor.id})</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    className="btn btn-primary flex-1"
                    onClick={(e) => {
                      const checkboxes = e.target.closest('.p-6').querySelectorAll('input[type="checkbox"]:checked');
                      const selectedIds = Array.from(checkboxes).map(cb => {
                        const label = cb.closest('label').textContent;
                        const match = label.match(/ID: (\d+)/);
                        return match ? parseInt(match[1]) : null;
                      }).filter(id => id !== null);
                      
                      assignExecutors(assigningExecutors.id, selectedIds);
                    }}
                  >
                    Назначить
                  </button>
                  <button
                    className="btn btn-ghost flex-1"
                    onClick={() => setAssigningExecutors(null)}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderView;