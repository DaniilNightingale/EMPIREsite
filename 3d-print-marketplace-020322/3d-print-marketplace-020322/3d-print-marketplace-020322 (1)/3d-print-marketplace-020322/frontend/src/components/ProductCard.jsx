import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaShoppingCart, FaHeart, FaEye, FaRuler, FaSearch } from 'react-icons/fa';

const ProductCard = ({ product, onAddToCart, showCustomRequest = true }) => {
  const [selectedPriceOption, setSelectedPriceOption] = useState(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

  useEffect(() => {
    // устанавливаем первый вариант цены как выбранный по умолчанию
    if (product.price_options && product.price_options.length > 0) {
      setSelectedPriceOption(product.price_options[0]);
    }

    // проверяем, добавлен ли товар в избранное
    checkFavoriteStatus();
  }, [product]);

  const checkFavoriteStatus = async () => {
    if (!currentUser.id) return;

    try {
      // Загружаем из localStorage (как в v94)
      const favorites = JSON.parse(localStorage.getItem(`favorites_${currentUser.id}`) || '[]');
      const isCurrentlyFavorited = Array.isArray(favorites) && favorites.includes(product.id);
      setIsFavorited(isCurrentlyFavorited);
      
      // В фоновом режиме пытаемся синхронизировать с сервером
      try {
        const response = await axios.get(`/api/favorites/${currentUser.id}`, { timeout: 3000 });
        if (response.data && Array.isArray(response.data)) {
          const serverFavoriteIds = response.data.map(item => item.product_id || item.id).filter(Boolean);
          if (JSON.stringify(favorites.sort()) !== JSON.stringify(serverFavoriteIds.sort())) {
            // Обновляем localStorage данными с сервера только при различиях
            localStorage.setItem(`favorites_${currentUser.id}`, JSON.stringify(serverFavoriteIds));
            setIsFavorited(serverFavoriteIds.includes(product.id));
          }
        }
      } catch (serverError) {
        // Сервер недоступен - используем локальные данные
        console.warn('Сервер избранного недоступен, используем локальные данные');
      }
    } catch (error) {
      console.error('Ошибка проверки избранного:', error);
      setIsFavorited(false);
    }
  };

  const toggleFavorite = async (e) => {
    // Предотвращаем всплытие события
    e.stopPropagation();
    
    if (!currentUser.id) {
      alert('Войдите в систему для добавления в избранное');
      return;
    }

    // Получаем текущее состояние
    const previousState = isFavorited;
    setLoading(true);

    try {
      // Обновляем localStorage напрямую (как в v94)
      const favorites = JSON.parse(localStorage.getItem(`favorites_${currentUser.id}`) || '[]');
      let updatedFavorites;
      let newFavoriteState;
      
      if (previousState) {
        // удаляем из избранного
        updatedFavorites = favorites.filter(id => id !== product.id);
        newFavoriteState = false;
      } else {
        // добавляем в избранное
        updatedFavorites = [...favorites.filter(id => id !== product.id), product.id];
        newFavoriteState = true;
      }
      
      // Сразу обновляем UI и localStorage
      setIsFavorited(newFavoriteState);
      localStorage.setItem(`favorites_${currentUser.id}`, JSON.stringify(updatedFavorites));
      
      // Обновляем счетчик избранного
      const currentCount = product.favorites_count || 0;
      if (newFavoriteState && !previousState) {
        product.favorites_count = currentCount + 1;
      } else if (!newFavoriteState && previousState) {
        product.favorites_count = Math.max(0, currentCount - 1);
      }
      
      // Пытаемся синхронизировать с сервером (необязательно для работы)
      try {
        await axios.post('/api/favorites/toggle', {
          user_id: currentUser.id,
          product_id: product.id
        }, { timeout: 5000 });
      } catch (serverError) {
        console.warn('Не удалось синхронизировать с сервером, используем локальные данные:', serverError.message);
      }
      
      // Уведомляем о изменении избранного
      window.dispatchEvent(new CustomEvent('favoriteUpdated', {
        detail: { productId: product.id, isFavorite: newFavoriteState }
      }));
      
    } catch (error) {
      console.error('Ошибка обновления избранного:', error);
      // Откатываем изменения UI при критической ошибке
      setIsFavorited(previousState);
      
      // Восстанавливаем localStorage
      const favorites = JSON.parse(localStorage.getItem(`favorites_${currentUser.id}`) || '[]');
      if (previousState) {
        // Восстанавливаем в избранном
        const restoredFavorites = [...favorites.filter(id => id !== product.id), product.id];
        localStorage.setItem(`favorites_${currentUser.id}`, JSON.stringify(restoredFavorites));
      } else {
        // Удаляем из избранного
        const restoredFavorites = favorites.filter(id => id !== product.id);
        localStorage.setItem(`favorites_${currentUser.id}`, JSON.stringify(restoredFavorites));
      }
      
      alert('Ошибка при обновлении избранного. Данные восстановлены.');
    } finally {
      setLoading(false);
    }
  };

  const handleSizeSelection = (option) => {
    setSelectedPriceOption(option);
    setShowSizeSelector(false);
  };

  const handleAddToCart = () => {
    if (!currentUser.id) {
      alert('Войдите в систему для добавления товаров в корзину');
      return;
    }

    if (!selectedPriceOption) {
      alert('Выберите размер товара');
      return;
    }

    try {
      // Используем базовую цену без сложных вычислений (как в v94)
      const basePrice = parseFloat(selectedPriceOption.price) || 0;
      
      if (basePrice <= 0) {
        alert('Некорректная цена товара');
        return;
      }

      const cartItem = {
        id: product.id,
        name: product.name,
        main_image: product.main_image,
        price: basePrice,
        selectedSize: {
          ...selectedPriceOption,
          price: basePrice
        },
        quantity: 1,
        addedAt: new Date().toISOString()
      };

      // добавляем товар в корзину (localStorage)
      const existingCart = JSON.parse(localStorage.getItem(`cart_${currentUser.id}`) || '[]');
      
      // проверяем, есть ли уже такой товар с таким же размером
      const existingItemIndex = existingCart.findIndex(
        item => item.id === product.id && 
                 item.selectedSize?.size === selectedPriceOption.size
      );

      if (existingItemIndex > -1) {
        existingCart[existingItemIndex].quantity += 1;
      } else {
        existingCart.push(cartItem);
      }

      localStorage.setItem(`cart_${currentUser.id}`, JSON.stringify(existingCart));

      if (onAddToCart) {
        onAddToCart(cartItem);
      }

      alert('Товар добавлен в корзину');
    } catch (error) {
      console.error('Ошибка добавления в корзину:', error);
      alert('Ошибка при добавлении товара в корзину');
    }
  };

  const handleCustomRequest = () => {
    // переход к форме заявки на замер с автоматически заполненным ID товара
    const event = new CustomEvent('openCustomRequest', { 
      detail: { productId: product.id } 
    });
    window.dispatchEvent(event);
  };

  const getPriceRange = () => {
    if (!product.price_options || product.price_options.length === 0) {
      return 'Цена не указана';
    }

    const coefficient = product.coefficient || 5.25;
    const prices = product.price_options.map(option => {
      // Применяем новую формулу: цена / 5.25 * коэффициент
      return Math.round((option.price / 5.25) * coefficient);
    });
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (minPrice === maxPrice) {
      return `${minPrice}₽`;
    } else {
      return `от ${minPrice}₽ до ${maxPrice}₽`;
    }
  };

  return (
    <>
      <div className="card h-full flex flex-col transition-all hover:shadow-lg product-card">
        {/* главное изображение */}
        <div className="relative overflow-hidden product-image-container">
          {product.main_image ? (
            <img
              src={product.main_image}
              alt={product.name}
              className="w-full h-48 sm:h-48 md:h-56 lg:h-48 object-cover cursor-pointer hover:scale-105 transition-transform product-image"
              onClick={() => setShowDetails(true)}
            />
          ) : (
            <div className="w-full h-48 sm:h-48 md:h-56 lg:h-48 bg-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-300 transition-colors">
              <FaSearch className="text-2xl sm:text-3xl md:text-4xl text-gray-400" />
            </div>
          )}
          
          {/* кнопка избранного */}
          <button
            className={`absolute top-2 sm:top-3 right-2 sm:right-3 btn btn-sm rounded-full transition-all duration-200 favorite-btn ${
              isFavorited 
                ? 'bg-red-500 text-white hover:bg-red-600 scale-105' 
                : 'bg-white text-gray-600 hover:bg-gray-100'
            } ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
            onClick={toggleFavorite}
            disabled={loading}
            title={isFavorited ? 'Удалить из избранного' : 'Добавить в избранное'}
          >
            <FaHeart className={`transition-all duration-200 text-sm sm:text-base ${
              isFavorited ? 'text-white animate-pulse' : ''
            }`} />
            <span className="ml-1 text-xs sm:text-sm font-medium">{product.favorites_count || 0}</span>
          </button>
        </div>

        {/* информация о товаре */}
        <div className="card-body flex-1 flex flex-col p-3 sm:p-4 lg:p-6">
          <div className="flex-1">
            <h3 className="font-semibold text-black mb-2 line-clamp-2 text-sm sm:text-base product-title">
              {product.name}
            </h3>
            
            {product.related_name && (
              <p className="text-xs sm:text-sm text-gray-600 mb-2">
                {product.related_name}
              </p>
            )}

            {product.description && (
              <p className="text-xs sm:text-sm text-gray-500 mb-3 line-clamp-2 hidden sm:block">
                {product.description}
              </p>
            )}

            {/* диапазон цен */}
            <div className="mb-3">
              <span className="text-sm sm:text-base lg:text-lg font-semibold text-accent-blue">
                {getPriceRange()}
              </span>
            </div>

            {/* выбранный размер */}
            {selectedPriceOption && (
              <div className="mb-3 p-2 sm:p-3 bg-gray-50 rounded border">
                <div className="text-xs sm:text-sm">
                  <div className="font-medium text-black mb-1">
                    Выбранный размер: {selectedPriceOption.size}
                  </div>
                  <div className="text-accent-blue font-semibold mb-1">
                    Цена: {Math.round((selectedPriceOption.price / 5.25) * (product.coefficient || 5.25))}₽
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* кнопки действий */}
          <div className="space-y-2 mt-4 product-actions">
            {/* кнопка выбора размера */}
            <button
              className="btn btn-secondary w-full flex items-center justify-center text-xs sm:text-sm mobile-btn"
              onClick={() => setShowSizeSelector(true)}
              disabled={!product.price_options || product.price_options.length === 0}
            >
              <FaRuler className="mr-1 sm:mr-2 text-xs sm:text-sm" />
              <span className="hidden sm:inline">{selectedPriceOption ? 'Изменить размер' : 'Выбрать размер'}</span>
              <span className="sm:hidden">{selectedPriceOption ? 'Размер' : 'Размер'}</span>
            </button>

            {/* кнопка добавления в корзину */}
            <button
              className="btn btn-primary w-full flex items-center justify-center text-xs sm:text-sm mobile-btn"
              onClick={handleAddToCart}
              disabled={!selectedPriceOption}
            >
              <FaShoppingCart className="mr-1 sm:mr-2 text-xs sm:text-sm" />
              <span className="hidden sm:inline">В корзину</span>
              <span className="sm:hidden">Купить</span>
            </button>

            {/* кнопки дополнительных действий */}
            <div className="grid grid-cols-2 gap-1 sm:gap-2">
              <button
                className="btn btn-ghost btn-sm text-xs mobile-action-btn"
                onClick={() => setShowDetails(true)}
              >
                <FaEye className="mr-1 text-xs" />
                <span className="hidden sm:inline">Подробнее</span>
                <span className="sm:hidden">Инфо</span>
              </button>

              {showCustomRequest && (
                <button
                  className="btn btn-ghost btn-sm text-xs mobile-action-btn"
                  onClick={handleCustomRequest}
                >
                  <span className="hidden sm:inline">Другой размер</span>
                  <span className="sm:hidden">Замер</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* модальное окно выбора размера */}
      {showSizeSelector && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSizeSelector(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg max-w-md w-full max-h-[85vh] overflow-y-auto mx-2 my-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white z-10 p-4 sm:p-6 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <h3 className="text-base sm:text-lg font-semibold pr-8">Выберите размер и цену</h3>
                <button
                  className="btn btn-ghost btn-sm absolute top-2 right-2 sm:top-4 sm:right-4 bg-white hover:bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center"
                  onClick={() => setShowSizeSelector(false)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 pt-0">

              <div className="space-y-3">
                {product.price_options?.map((option, index) => (
                  <div
                    key={index}
                    className={`price-option cursor-pointer border rounded-lg p-3 sm:p-4 transition-all hover:border-accent-blue hover:bg-gray-50 ${
                      selectedPriceOption?.size === option.size ? 'border-accent-blue bg-accent-blue bg-opacity-10' : 'border-gray-200'
                    }`}
                    onClick={() => handleSizeSelection(option)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="price-info">
                        <div className="size-text text-sm sm:text-lg font-medium text-black">{option.size}</div>
                      </div>
                      <div className="price-text text-lg sm:text-xl font-semibold text-accent-blue">
                        {Math.round((option.price / 5.25) * (product.coefficient || 5.25))}₽
                      </div>
                    </div>
                    {selectedPriceOption?.size === option.size && (
                      <div className="mt-2 text-xs sm:text-sm text-accent-blue font-medium">
                        ✓ Выбран
                      </div>
                    )}
                  </div>
                )) || (
                  <div className="text-center py-4 text-gray-500">
                    Варианты размеров не настроены
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3 sticky bottom-0 bg-white pt-4 border-t border-gray-100">
                <button
                  className="btn btn-primary flex-1 text-sm"
                  onClick={() => {
                    setShowSizeSelector(false);
                    if (selectedPriceOption) {
                      handleAddToCart();
                    }
                  }}
                  disabled={!selectedPriceOption}
                >
                  Добавить в корзину
                </button>
                <button
                  className="btn btn-ghost flex-1 text-sm"
                  onClick={() => setShowSizeSelector(false)}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* модальное окно с подробностями товара */}
      {showDetails && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDetails(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-2 my-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white z-10 p-4 sm:p-6 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <h3 className="text-base sm:text-lg font-semibold pr-8">{product.name}</h3>
                <button
                  className="btn btn-ghost btn-sm absolute top-2 right-2 sm:top-4 sm:right-4 bg-white hover:bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center"
                  onClick={() => setShowDetails(false)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 pt-0">

              <div className="space-y-4">
                {/* главное изображение */}
                {product.main_image && (
                  <img
                    src={product.main_image}
                    alt={product.name}
                    className="w-full h-48 sm:h-64 object-cover rounded border"
                  />
                )}

                {/* дополнительные изображения */}
                {product.additional_images && product.additional_images.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-sm sm:text-base">Дополнительные фото:</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {product.additional_images.map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`${product.name} ${index + 1}`}
                          className="w-full h-16 sm:h-20 object-cover rounded border cursor-pointer hover:opacity-75"
                          onClick={() => window.open(image, '_blank')}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* описание */}
                {product.description && (
                  <div>
                    <h4 className="font-medium mb-2 text-sm sm:text-base">Описание:</h4>
                    <p className="text-gray-700 text-sm sm:text-base">{product.description}</p>
                  </div>
                )}

                {/* технические характеристики */}
                <div>
                  <h4 className="font-medium mb-2 text-sm sm:text-base">Характеристики:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                    <div><strong>ID товара:</strong> {product.id}</div>
                    {product.original_height && (
                      <div><strong>Исходная высота:</strong> {product.original_height}см</div>
                    )}
                    {product.original_width && (
                      <div><strong>Исходная ширина:</strong> {product.original_width}см</div>
                    )}
                    {product.original_length && (
                      <div><strong>Исходная длина:</strong> {product.original_length}см</div>
                    )}
                    <div><strong>Количество деталей:</strong> {product.parts_count || 1}</div>
                    <div><strong>Продано:</strong> {product.sales_count || 0}</div>
                  </div>
                </div>

                {/* варианты размеров и цен */}
                <div>
                  <h4 className="font-medium mb-2 text-sm sm:text-base">Доступные размеры:</h4>
                  <div className="space-y-2">
                    {product.price_options?.map((option, index) => (
                      <div key={index} className="border rounded p-3 bg-gray-50">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-sm sm:text-base">{option.size}</div>
                          </div>
                          <div className="text-base sm:text-lg font-semibold text-accent-blue">
                            {Math.round((option.price / 5.25) * (product.coefficient || 5.25))}₽
                          </div>
                        </div>
                      </div>
                    )) || (
                      <p className="text-gray-500 text-sm">Варианты размеров не настроены</p>
                    )}
                  </div>
                </div>

                {/* кнопки действий */}
                <div className="sticky bottom-0 bg-white pt-4 border-t border-gray-100">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      className="btn btn-primary flex-1 text-sm"
                      onClick={() => {
                        setShowDetails(false);
                        setShowSizeSelector(true);
                      }}
                    >
                      <FaShoppingCart className="mr-2" />
                      Купить
                    </button>
                    <button
                      className="btn btn-secondary text-sm"
                      onClick={toggleFavorite}
                    >
                      <FaHeart className={isFavorited ? 'text-red-500' : ''} />
                    </button>
                    {showCustomRequest && (
                      <button
                        className="btn btn-ghost text-sm"
                        onClick={() => {
                          setShowDetails(false);
                          handleCustomRequest();
                        }}
                      >
                        Запросить другой размер
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Мобильные стили */}
      <style jsx>{`
        .product-card {
          min-height: auto;
        }

        .product-image-container {
          position: relative;
        }

        .product-image {
          transition: transform 0.2s ease;
        }

        .favorite-btn {
          min-width: 40px;
          min-height: 32px;
          padding: 4px 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .product-title {
          line-height: 1.3;
          word-break: break-word;
        }

        .product-actions {
          margin-top: auto;
        }

        .mobile-btn {
          min-height: 40px;
          font-weight: 500;
          border-radius: 6px;
        }

        .mobile-action-btn {
          min-height: 36px;
          padding: 8px 12px;
          font-weight: 400;
        }

        @media (max-width: 640px) {
          .product-card {
            border-radius: 8px;
          }

          .card-body {
            padding: 12px;
          }

          .favorite-btn {
            min-width: 36px;
            min-height: 30px;
            padding: 4px 6px;
          }

          .mobile-btn {
            min-height: 44px;
            font-size: 14px;
          }

          .mobile-action-btn {
            min-height: 40px;
            font-size: 12px;
            padding: 6px 8px;
          }

          .product-title {
            font-size: 14px;
            margin-bottom: 8px;
          }

          .price-option {
            padding: 12px;
          }

          .modal-content {
            margin: 8px;
            max-height: calc(100vh - 32px);
          }
        }

        @media (max-width: 480px) {
          .grid.grid-cols-2 {
            gap: 4px;
          }

          .mobile-action-btn {
            font-size: 11px;
            padding: 4px 6px;
            min-height: 36px;
          }

          .favorite-btn span {
            font-size: 10px;
          }

          .btn {
            -webkit-tap-highlight-color: transparent;
          }
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Touch optimization */
        @media (hover: none) and (pointer: coarse) {
          .product-image:hover {
            transform: none;
          }

          .btn:active {
            transform: scale(0.98);
          }

          .favorite-btn:active {
            transform: scale(0.95);
          }
        }
      `}</style>
    </>
  );
};

export default ProductCard;