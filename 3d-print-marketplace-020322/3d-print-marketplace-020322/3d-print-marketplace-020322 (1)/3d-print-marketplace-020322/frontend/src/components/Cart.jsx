import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaTrash, FaPlus, FaMinus, FaShoppingCart, FaCreditCard, FaCheck } from 'react-icons/fa';

const Cart = () => {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [settings, setSettings] = useState({});
  const [discounts, setDiscounts] = useState([]);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  useEffect(() => {
    loadCartItems();
    loadSettings();
  }, []);

  const loadCartItems = () => {
    const savedCart = JSON.parse(localStorage.getItem(`cart_${currentUser.id}`) || '[]');
    setCartItems(savedCart);
  };

  const saveCartItems = (items) => {
    localStorage.setItem(`cart_${currentUser.id}`, JSON.stringify(items));
    setCartItems(items);
  };

  const loadSettings = async () => {
    try {
      const response = await axios.get('/api/settings');
      setSettings(response.data);
      setPaymentInfo(response.data.payment_info || '');
      
      // Загружаем применимые скидки
      if (response.data.discount_rules) {
        const applicableDiscounts = calculateApplicableDiscounts(response.data.discount_rules);
        setDiscounts(applicableDiscounts);
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
    }
  };

  const calculateApplicableDiscounts = (discountRules) => {
    // Здесь можно реализовать логику расчета применимых скидок
    // на основе роли пользователя, потраченных денег и т.д.
    return discountRules.filter(rule => {
      // Пример простой проверки по роли
      if (rule.conditions.role && rule.conditions.role !== currentUser.role) {
        return false;
      }
      return true;
    });
  };

  const updateQuantity = (itemIndex, newQuantity) => {
    if (newQuantity < 1) return;
    
    const updatedItems = cartItems.map((item, index) => 
      index === itemIndex ? { ...item, quantity: newQuantity } : item
    );
    saveCartItems(updatedItems);
  };

  const removeFromCart = (itemIndex) => {
    if (!confirm('Удалить товар из корзины?')) return;
    
    const updatedItems = cartItems.filter((_, index) => index !== itemIndex);
    saveCartItems(updatedItems);
  };

  const calculateItemTotal = (item) => {
    // Обновлено: используем новую формулу цена / 5.25 * коэффициент
    const basePrice = item.selectedSize?.price || item.price || 0;
    const coefficient = settings.price_coefficient || 5.25;
    const finalPrice = Math.round((basePrice / 5.25) * coefficient);
    return finalPrice * item.quantity;
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => total + calculateItemTotal(item), 0);
  };

  const calculateDiscount = () => {
    const subtotal = calculateSubtotal();
    let totalDiscount = 0;

    discounts.forEach(discount => {
      if (discount.type === 'percentage') {
        totalDiscount += subtotal * (discount.value / 100);
      } else if (discount.type === 'fixed') {
        totalDiscount += discount.value;
      }
    });

    return Math.min(totalDiscount, subtotal);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();
    
    // Коэффициент уже применен в ценах товаров
    return Math.max(0, subtotal - discount);
  };

  const proceedToPayment = () => {
    if (cartItems.length === 0) {
      alert('Корзина пуста');
      return;
    }
    setShowPayment(true);
  };

  const confirmPayment = async () => {
    if (!currentUser.id) {
      alert('Необходимо войти в систему');
      return;
    }

    // Проверяем наличие товаров в корзине
    if (cartItems.length === 0) {
      alert('Корзина пуста');
      return;
    }

    try {
      setLoading(true);

      // Валидируем товары в корзине
      const validatedProducts = cartItems.map(item => {
        if (!item.id || !item.name || item.quantity <= 0) {
          throw new Error(`Неверные данные товара: ${item.name || 'неизвестный товар'}`);
        }
        
        const basePrice = item.selectedSize?.price || item.price || 0;
        if (basePrice <= 0) {
          throw new Error(`Неверная цена товара: ${item.name}`);
        }
        
        // Применяем формулу: цена / 5.25 * коэффициент
        const coefficient = settings.price_coefficient || 5.25;
        const finalPrice = Math.round((basePrice / 5.25) * coefficient);

        return {
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: finalPrice,
          selectedSize: item.selectedSize || null
        };
      });

      const totalPrice = calculateTotal();
      if (totalPrice <= 0) {
        throw new Error('Неверная общая сумма заказа');
      }

      const orderData = {
        user_id: currentUser.id,
        products: validatedProducts,
        total_price: totalPrice,
        notes: orderNotes.trim() || ''
      };

      console.log('Отправка данных заказа:', orderData);
      
      const response = await axios.post('/api/orders', orderData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 секунд таймаут
      });

      console.log('Ответ сервера:', response.data);
      
      if (response.status === 201 || response.status === 200) {
        alert('Заказ успешно создан!');
        
        // Очищаем корзину
        saveCartItems([]);
        setShowPayment(false);
        setOrderNotes('');
        
        // Опционально: переходим к списку заказов
        // window.location.hash = '#/orders';
      } else {
        throw new Error('Неожиданный ответ сервера');
      }
      
    } catch (error) {
      console.error('Подробная ошибка создания заказа:', error);
      
      let errorMessage = 'Ошибка при создании заказа';
      
      if (error.response) {
        // Ошибка от сервера
        errorMessage = error.response.data?.error || `Ошибка сервера: ${error.response.status}`;
      } else if (error.request) {
        // Нет ответа от сервера
        errorMessage = 'Нет связи с сервером. Проверьте подключение к интернету.';
      } else if (error.message) {
        // Ошибка валидации или другая
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser.id) {
    return (
      <div className="p-6 text-center max-w-2xl mx-auto">
        <FaShoppingCart className="text-6xl text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Войдите в систему для использования корзины</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <FaShoppingCart className="text-3xl text-accent-blue" />
        <h1 className="text-3xl font-bold text-black">Корзина</h1>
        <span className="bg-accent-blue text-white px-3 py-1 rounded-full text-sm">
          {cartItems.length}
        </span>
      </div>

      {cartItems.length === 0 ? (
        <div className="text-center py-12">
          <FaShoppingCart className="text-6xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-4">Ваша корзина пуста</p>
          <p className="text-gray-400">Добавьте товары из каталога</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Список товаров */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item, index) => (
              <div key={`${item.id}-${index}`} className="cart-item">
                <div className="flex items-center gap-4">
                  {/* Изображение товара */}
                  <div className="flex-shrink-0">
                    {item.main_image ? (
                      <img
                        src={item.main_image}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-200 rounded border flex items-center justify-center">
                        <FaShoppingCart className="text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Информация о товаре */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-black mb-1">{item.name}</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>ID: {item.id}</div>
                      {/* Обновлено: отображение информации о выбранном размере */}
                      {item.selectedSize && (
                        <>
                          <div className="font-medium text-accent-blue">
                            Размер: {item.selectedSize.size}
                          </div>
                          {/* Скрываем информацию о смоле для покупателей и исполнителей */}
                          {item.selectedSize.resin_ml && currentUser.role === 'admin' && (
                            <div className="text-gray-500">
                              Количество смолы: {item.selectedSize.resin_ml}мл
                            </div>
                          )}
                          <div className="text-gray-700">
                            Цена за единицу: {Math.round((item.selectedSize.price / 5.25) * (settings.price_coefficient || 5.25))}₽
                          </div>
                        </>
                      )}
                      {/* Если нет selectedSize, показываем базовую цену */}
                      {!item.selectedSize && item.price && (
                        <div className="text-gray-700">
                          Цена за единицу: {Math.round((item.price / 5.25) * (settings.price_coefficient || 5.25))}₽
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Управление количеством */}
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => updateQuantity(index, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      <FaMinus />
                    </button>
                    <span className="w-12 text-center font-medium">{item.quantity}</span>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => updateQuantity(index, item.quantity + 1)}
                    >
                      <FaPlus />
                    </button>
                  </div>

                  {/* Цена и удаление */}
                  <div className="text-right">
                    <div className="font-semibold text-lg text-black">
                      {calculateItemTotal(item)}₽
                    </div>
                    <button
                      className="btn btn-sm bg-red-500 text-white hover:bg-red-600 mt-2"
                      onClick={() => removeFromCart(index)}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Итоговая сумма */}
          <div className="lg:col-span-1">
            <div className="card sticky top-6">
              <div className="card-header">
                <h2 className="text-xl font-semibold">Итого</h2>
              </div>
              <div className="card-body space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Подытог:</span>
                    <span>{calculateSubtotal()}₽</span>
                  </div>

                  {discounts.length > 0 && calculateDiscount() > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Скидка:</span>
                      <span>-{calculateDiscount()}₽</span>
                    </div>
                  )}

                  <div className="border-t pt-2">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Итого:</span>
                      <span className="text-accent-blue">{calculateTotal()}₽</span>
                    </div>
                  </div>
                </div>

                {/* Применимые скидки */}
                {discounts.length > 0 && settings.show_discount_on_products && (
                  <div className="bg-green-50 p-3 rounded border border-green-200">
                    <div className="text-sm font-medium text-green-800 mb-1">
                      Применены скидки:
                    </div>
                    {discounts.map((discount, index) => (
                      <div key={index} className="text-xs text-green-700">
                        {discount.name}: {discount.value}{discount.type === 'percentage' ? '%' : '₽'}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  className="btn btn-primary w-full"
                  onClick={proceedToPayment}
                  disabled={cartItems.length === 0}
                >
                  <FaCreditCard className="mr-2" />
                  Перейти к оплате
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно оплаты */}
      {showPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Оформление заказа</h3>
              
              <div className="space-y-6">
                {/* Информация для оплаты */}
                <div>
                  <h4 className="font-medium mb-3">Реквизиты для оплаты:</h4>
                  <div className="bg-gray-50 p-4 rounded border">
                    <pre className="text-sm whitespace-pre-wrap">{paymentInfo}</pre>
                  </div>
                </div>

                {/* Детали заказа */}
                <div>
                  <h4 className="font-medium mb-3">Детали заказа:</h4>
                  <div className="bg-gray-50 p-4 rounded border space-y-3">
                    {cartItems.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <div>
                          <div className="font-medium">{item.name}</div>
                          {item.selectedSize && (
                            <div className="text-gray-600 space-y-1">
                              <div>Размер: {item.selectedSize.size}</div>
                              {item.selectedSize.resin_ml && currentUser.role === 'admin' && (
                                <div>Смола: {item.selectedSize.resin_ml}мл</div>
                              )}
                              <div>Цена: {Math.round((item.selectedSize.price / 5.25) * (settings.price_coefficient || 5.25))}₽ × {item.quantity}</div>
                            </div>
                          )}
                        </div>
                        <div className="font-medium">
                          {calculateItemTotal(item)}₽
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Итоговая сумма */}
                <div className="bg-accent-blue bg-opacity-10 p-4 rounded border border-accent-blue">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">Сумма к оплате:</div>
                    <div className="text-2xl font-bold text-accent-blue">
                      {calculateTotal()}₽
                    </div>
                  </div>
                </div>

                {/* Примечание к заказу */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Примечание к заказу (необязательно):
                  </label>
                  <textarea
                    className="input textarea w-full"
                    placeholder="Добавьте комментарий к заказу..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Кнопки */}
                <div className="flex gap-3">
                  <button
                    className="btn btn-primary flex-1"
                    onClick={confirmPayment}
                    disabled={loading}
                  >
                    <FaCheck className="mr-2" />
                    {loading ? 'Создание заказа...' : 'Подтвердить оплату'}
                  </button>
                  <button
                    className="btn btn-ghost flex-1"
                    onClick={() => setShowPayment(false)}
                    disabled={loading}
                  >
                    Назад
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Индикатор загрузки */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
            <p className="text-black">Создание заказа...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;