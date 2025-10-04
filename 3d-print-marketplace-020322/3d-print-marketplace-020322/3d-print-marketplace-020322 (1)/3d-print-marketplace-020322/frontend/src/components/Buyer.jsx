import React, { useState, useEffect } from 'react';
import { FaShoppingCart, FaUser, FaBox, FaComments, FaHeart, FaBell, FaSearch, FaBars, FaTimes } from 'react-icons/fa';
import ProductCard from '../components/ProductCard';
import Cart from '../components/Cart';
import Profile from '../components/Profile';
import OrderView from '../components/OrderView';
import Chat from '../components/Chat';
import CustomRequest from '../components/CustomRequest';
import axios from 'axios';

const Buyer = () => {
  const [activeTab, setActiveTab] = useState('catalog');
  const [currentUser, setCurrentUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFilter, setSearchFilter] = useState('name');
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favoriteProducts, setFavoriteProducts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showCustomRequest, setShowCustomRequest] = useState(false);
  const [customRequestProductId, setCustomRequestProductId] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!user.id || user.role !== 'buyer') {
      window.location.href = '#/login';
      return;
    }
    setCurrentUser(user);
    loadProducts();
    loadFavorites();
    loadNotifications();

    // Слушаем событие открытия формы заявки на замер
    const handleCustomRequest = (e) => {
      setCustomRequestProductId(e.detail.productId);
      setShowCustomRequest(true);
      setActiveTab('custom-requests');
    };

    // Слушаем события обновления избранного
    const handleFavoriteUpdate = () => {
      loadFavorites();
      loadFavoriteProducts();
    };

    window.addEventListener('openCustomRequest', handleCustomRequest);
    window.addEventListener('favoriteUpdated', handleFavoriteUpdate);
    return () => {
      window.removeEventListener('openCustomRequest', handleCustomRequest);
      window.removeEventListener('favoriteUpdated', handleFavoriteUpdate);
    };
  }, []);

  // Отдельный useEffect для загрузки избранных товаров после загрузки продуктов
  useEffect(() => {
    if (currentUser?.id && products.length > 0) {
      loadFavoriteProducts();
    }
  }, [currentUser, products]);

  // Загрузка продуктов с возможностью поиска
  const loadProducts = async (search = '', filter = 'name') => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (search && search.trim()) {
        params.append('search', search.trim());
        params.append('filter', filter);
      }
      
      const response = await axios.get(`/api/products?${params.toString()}`);
      setProducts(response.data);
      setFilteredProducts(response.data);
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error);
      setProducts([]);
      setFilteredProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    if (!currentUser?.id) return;
    
    try {
      // Загружаем из localStorage
      const savedFavorites = JSON.parse(localStorage.getItem(`favorites_${currentUser.id}`) || '[]');
      setFavorites(savedFavorites);
      
      // Также пытаемся загрузить с сервера для синхронизации
      try {
        const response = await axios.get(`/api/favorites/${currentUser.id}`);
        if (response.data && Array.isArray(response.data)) {
          // Правильно извлекаем ID товаров из объектов с сервера
          const serverFavoriteIds = response.data.map(item => item.product_id || item.id);
          // Обновляем localStorage данными с сервера
          localStorage.setItem(`favorites_${currentUser.id}`, JSON.stringify(serverFavoriteIds));
          setFavorites(serverFavoriteIds);
        }
      } catch (serverError) {
        // Если сервер недоступен, используем данные из localStorage
        console.log('Используем локальные данные избранного');
      }
    } catch (error) {
      console.error('Ошибка загрузки избранного:', error);
      setFavorites([]);
    }
  };

  const loadNotifications = async () => {
    if (!currentUser?.id) return;

    try {
      // Загружаем уведомления о новых сообщениях, изменениях в статусах заказов и статусах замеров
      const [messagesResponse, ordersResponse, requestsResponse] = await Promise.all([
        axios.get(`/api/chat?user_id=${currentUser.id}`),
        axios.get(`/api/orders?user_id=${currentUser.id}&role=${currentUser.role}`),
        axios.get(`/api/custom-requests?user_id=${currentUser.id}&role=${currentUser.role}`)
      ]);

      const recentMessages = messagesResponse.data.filter(msg => 
        new Date(msg.created_date) > new Date(Date.now() - 24 * 60 * 60 * 1000) &&
        msg.to_user_id === currentUser.id
      ).length;

      const recentOrderChanges = ordersResponse.data.filter(order => 
        new Date(order.updated_date || order.created_date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length;

      const recentRequestChanges = requestsResponse.data.filter(req => 
        new Date(req.updated_date || req.created_date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length;

      const notificationsList = [];
      if (recentMessages > 0) notificationsList.push(`${recentMessages} новых сообщений`);
      if (recentOrderChanges > 0) notificationsList.push(`${recentOrderChanges} изменений в заказах`);
      if (recentRequestChanges > 0) notificationsList.push(`${recentRequestChanges} изменений в заявках`);

      setNotifications(notificationsList);
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
    }
  };

  // Обработка поиска
  const handleSearch = (e) => {
    e.preventDefault();
    loadProducts(searchTerm, searchFilter);
  };

  // Фильтрация продуктов на стороне клиента для быстрого отклика
  const filterProducts = (products, term, filter) => {
    if (!term || !term.trim()) return products;
    
    const searchTerm = term.toLowerCase().trim();
    
    return products.filter(product => {
      switch (filter) {
        case 'description':
          return product.description && product.description.toLowerCase().includes(searchTerm);
        case 'id':
          return product.id.toString() === searchTerm;
        case 'name':
        default:
          return product.name && product.name.toLowerCase().includes(searchTerm);
      }
    });
  };

  // Обработка изменения поискового запроса
  const handleSearchTermChange = (value) => {
    setSearchTerm(value);
    
    // Мгновенная фильтрация на стороне клиента
    if (value.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = filterProducts(products, value, searchFilter);
      setFilteredProducts(filtered);
    }
  };

  // Обработка изменения фильтра
  const handleFilterChange = (newFilter) => {
    setSearchFilter(newFilter);
    
    // Перефильтрация с новым фильтром
    if (searchTerm.trim() !== '') {
      const filtered = filterProducts(products, searchTerm, newFilter);
      setFilteredProducts(filtered);
    }
  };

  const loadFavoriteProducts = async () => {
    if (!currentUser?.id) return;
    
    try {
      const response = await axios.get(`/api/favorites/${currentUser.id}`);
      if (response.data && Array.isArray(response.data)) {
        // Правильно обрабатываем ответ сервера с полными данными товаров
        const favoriteProductsData = response.data.map(item => {
          // Каждый элемент уже содержит полную информацию о товаре
          const product = {
            ...item,
            price_options: item.price_options ? (
              typeof item.price_options === 'string' ? JSON.parse(item.price_options) : item.price_options
            ) : [],
            additional_images: item.additional_images ? (
              typeof item.additional_images === 'string' ? JSON.parse(item.additional_images) : item.additional_images
            ) : [],
            is_favorite: true // Отмечаем как избранный
          };
          return product;
        });
        
        console.log('Загружены избранные товары:', favoriteProductsData);
        setFavoriteProducts(favoriteProductsData);
      }
    } catch (error) {
      console.error('Ошибка загрузки избранных товаров:', error);
      // Fallback: пытаемся загрузить из обычного каталога по ID избранных
      try {
        const favoriteIds = JSON.parse(localStorage.getItem(`favorites_${currentUser.id}`) || '[]');
        if (favoriteIds.length > 0 && products.length > 0) {
          const favoriteFromProducts = products.filter(product => favoriteIds.includes(product.id));
          setFavoriteProducts(favoriteFromProducts);
        }
      } catch (fallbackError) {
        console.error('Fallback также не удался:', fallbackError);
        setFavoriteProducts([]);
      }
    }
  };

  const getFavoriteProducts = () => {
    // Приоритет отдаем данным с сервера
    if (favoriteProducts.length > 0) {
      return favoriteProducts;
    }
    // Fallback: фильтруем из общего каталога по ID избранных
    if (favorites.length > 0 && products.length > 0) {
      return products.filter(product => favorites.includes(product.id));
    }
    return [];
  };

  const handleAddToCart = (product) => {
    // Обновляем уведомления после добавления в корзину
    loadNotifications();
    // Обновляем избранное после действий с товарами
    loadFavorites();
    loadFavoriteProducts();
  };

  // Очистка поиска
  const clearSearch = () => {
    setSearchTerm('');
    setFilteredProducts(products);
  };

  // Закрытие мобильного меню
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Обработка смены вкладки с закрытием мобильного меню
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    closeMobileMenu();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'catalog':
        return (
          <div>
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-4 lg:mb-6 gap-3 lg:gap-0">
              <h2 className="text-xl lg:text-2xl font-bold text-black">Каталог товаров</h2>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                {/* Поисковая форма */}
                <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
                  <select
                    className="input select w-full sm:w-auto"
                    value={searchFilter}
                    onChange={(e) => handleFilterChange(e.target.value)}
                  >
                    <option value="name">По названию</option>
                    <option value="description">По описанию</option>
                    <option value="id">По ID</option>
                  </select>
                  <div className="relative flex-1">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Поиск товаров..."
                      className="input pl-10 w-full"
                      value={searchTerm}
                      onChange={(e) => handleSearchTermChange(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={clearSearch}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button type="submit" className="btn btn-primary w-full sm:w-auto">
                    Найти
                  </button>
                </form>
                <button
                  className="btn btn-accent w-full sm:w-auto"
                  onClick={() => setShowCustomRequest(true)}
                >
                  Подать заявку на замер
                </button>
              </div>
            </div>

            {/* Результаты поиска */}
            {searchTerm && (
              <div className="mb-4 p-3 bg-gray-50 rounded border">
                <div className="text-sm text-gray-600">
                  Поиск по {searchFilter === 'name' ? 'названию' : searchFilter === 'description' ? 'описанию' : 'ID'}: 
                  <span className="font-medium ml-1">"{searchTerm}"</span>
                  <span className="ml-2">
                    Найдено: {filteredProducts.length} из {products.length} товаров
                  </span>
                  <button
                    className="ml-3 text-accent-blue hover:underline"
                    onClick={clearSearch}
                  >
                    Очистить
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 lg:py-12">
                <div className="animate-spin rounded-full h-6 w-6 lg:h-8 lg:w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
                <p className="text-gray-500 text-sm lg:text-base">Загрузка товаров...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8 lg:py-12">
                <p className="text-gray-500 text-sm lg:text-base">
                  {searchTerm ? 'Товары не найдены по вашему запросу' : 'Товары не найдены'}
                </p>
                {searchTerm && (
                  <button
                    className="btn btn-ghost mt-4"
                    onClick={clearSearch}
                  >
                    Показать все товары
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-6">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    showCustomRequest={true}
                  />
                ))}
              </div>
            )}
          </div>
        );

      case 'cart':
        return <Cart />;

      case 'profile':
        return <Profile />;

      case 'orders':
        return <OrderView />;

      case 'custom-requests':
        return (
          <CustomRequest 
            productId={customRequestProductId}
            onClose={() => {
              setShowCustomRequest(false);
              setCustomRequestProductId('');
            }}
          />
        );

      case 'chat':
        return <Chat />;

      case 'favorites':
        const favoriteProductsList = getFavoriteProducts();
        return (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 lg:mb-6 gap-3 sm:gap-0">
              <h2 className="text-xl lg:text-2xl font-bold text-black">Избранные товары</h2>
              <div className="text-sm text-gray-600">
                {favoriteProductsList.length} товаров в избранном
              </div>
            </div>
            
            {loading ? (
              <div className="text-center py-8 lg:py-12">
                <div className="animate-spin rounded-full h-6 w-6 lg:h-8 lg:w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
                <p className="text-gray-500 text-sm lg:text-base">Загрузка избранных товаров...</p>
              </div>
            ) : favoriteProductsList.length === 0 ? (
              <div className="text-center py-8 lg:py-12">
                <FaHeart className="text-4xl lg:text-6xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-sm lg:text-base">Нет избранных товаров</p>
                <p className="text-xs lg:text-sm text-gray-400 mt-2">
                  Добавляйте товары в избранное, нажимая на сердечко
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-6">
                {favoriteProductsList.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    showCustomRequest={true}
                  />
                ))}
              </div>
            )}
          </div>
        );

      default:
        return <div>Страница не найдена</div>;
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 lg:h-8 lg:w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm lg:text-base">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Верхняя навигация */}
      <nav className="nav shadow-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="flex justify-between items-center h-14 lg:h-16">
            <div className="flex items-center gap-2 lg:gap-8 flex-1">
              <div className="header-logo-container">
                <img 
                  src="https://haisnap.tos-cn-beijing.volces.com/image/fb4e11b1-32cb-4ee9-a6b8-90711522901e_1759499694999.jpg" 
                  alt="NIGHTINGALE EMPIRE Logo" 
                  className="logo-image"
                />
                <h1 className="text-base lg:text-xl font-bold text-white">
                  NIGHTINGALE EMPIRE
                </h1>
              </div>
              
              {/* Мобильная кнопка меню */}
              <button
                className="lg:hidden text-white p-2"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
              </button>
              
              {/* Десктопная навигация */}
              <div className="hidden lg:flex gap-1">
                <button
                  className={`nav-link ${activeTab === 'catalog' ? 'active' : ''}`}
                  onClick={() => setActiveTab('catalog')}
                >
                  <img 
                    src="https://haisnap.tos-cn-beijing.volces.com/image/d808c41c-8078-41ec-9530-8a0955f2cc4e_1759499878628.jpg" 
                    alt="Catalog Icon" 
                    className="catalog-icon"
                  />
                  Каталог
                </button>
                <button
                  className={`nav-link ${activeTab === 'cart' ? 'active' : ''}`}
                  onClick={() => setActiveTab('cart')}
                >
                  <FaShoppingCart className="mr-2" />
                  Корзина
                </button>
                <button
                  className={`nav-link ${activeTab === 'orders' ? 'active' : ''}`}
                  onClick={() => setActiveTab('orders')}
                >
                  <FaBox className="mr-2" />
                  Заказы
                </button>
                <button
                  className={`nav-link ${activeTab === 'custom-requests' ? 'active' : ''}`}
                  onClick={() => setActiveTab('custom-requests')}
                >
                  <img 
                    src="https://haisnap.tos-cn-beijing.volces.com/image/78891927-a4e5-4a24-990f-9f9ef122df28_1759499812794.jpg" 
                    alt="Measurement Icon" 
                    className="measurement-icon"
                  />
                  Заявки на замер
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 lg:gap-4">
              {/* Уведомления */}
              {notifications.length > 0 && (
                <div className="relative">
                  <FaBell className="text-white text-base lg:text-lg" />
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 lg:w-5 lg:h-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                </div>
              )}

              {/* Десктопные кнопки */}
              <div className="hidden lg:flex items-center gap-1">
                <button
                  className={`nav-link ${activeTab === 'favorites' ? 'active' : ''}`}
                  onClick={() => setActiveTab('favorites')}
                >
                  <FaHeart className="mr-2" />
                  Избранное
                </button>
                <button
                  className={`nav-link ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chat')}
                >
                  <FaComments className="mr-2" />
                  Чат
                </button>
                <button
                  className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                >
                  <FaUser className="mr-2" />
                  Профиль
                </button>
              </div>

              {/* Информация о пользователе */}
              <div className="flex items-center gap-2 text-white">
                {currentUser.avatar && (
                  <img
                    src={currentUser.avatar}
                    alt="Avatar"
                    className="w-6 h-6 lg:w-8 lg:h-8 rounded-full object-cover"
                  />
                )}
                <div className="text-xs lg:text-sm hidden sm:block">
                  <div className="font-medium">{currentUser.username}</div>
                  <div className="text-xs text-gray-300">Покупатель</div>
                </div>
              </div>

              <button
                className="btn btn-ghost text-white hover:bg-gray-800 px-1 sm:px-2 lg:px-4 text-xs"
                onClick={() => {
                  localStorage.removeItem('currentUser');
                  window.location.href = '#/login';
                }}
              >
                Выход
              </button>
            </div>
          </div>

          {/* Мобильное меню */}
          {isMobileMenuOpen && (
            <div className="lg:hidden bg-gray-800 mt-2 rounded-lg overflow-hidden">
              <div className="flex flex-col space-y-1 p-2">
                <button
                  className={`mobile-nav-link ${activeTab === 'catalog' ? 'active' : ''}`}
                  onClick={() => handleTabChange('catalog')}
                >
                  <img 
                    src="https://haisnap.tos-cn-beijing.volces.com/image/d808c41c-8078-41ec-9530-8a0955f2cc4e_1759499878628.jpg" 
                    alt="Catalog Icon" 
                    className="catalog-icon mr-3"
                  />
                  Каталог
                </button>
                <button
                  className={`mobile-nav-link ${activeTab === 'cart' ? 'active' : ''}`}
                  onClick={() => handleTabChange('cart')}
                >
                  <FaShoppingCart className="mr-3" />
                  Корзина
                </button>
                <button
                  className={`mobile-nav-link ${activeTab === 'orders' ? 'active' : ''}`}
                  onClick={() => handleTabChange('orders')}
                >
                  <FaBox className="mr-3" />
                  Заказы
                </button>
                <button
                  className={`mobile-nav-link ${activeTab === 'custom-requests' ? 'active' : ''}`}
                  onClick={() => handleTabChange('custom-requests')}
                >
                  <img 
                    src="https://haisnap.tos-cn-beijing.volces.com/image/78891927-a4e5-4a24-990f-9f9ef122df28_1759499812794.jpg" 
                    alt="Measurement Icon" 
                    className="measurement-icon mr-3"
                  />
                  Заявки на замер
                </button>
                <button
                  className={`mobile-nav-link ${activeTab === 'favorites' ? 'active' : ''}`}
                  onClick={() => handleTabChange('favorites')}
                >
                  <FaHeart className="mr-3" />
                  Избранное
                </button>
                <button
                  className={`mobile-nav-link ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => handleTabChange('chat')}
                >
                  <FaComments className="mr-3" />
                  Чат
                </button>
                <button
                  className={`mobile-nav-link ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => handleTabChange('profile')}
                >
                  <FaUser className="mr-3" />
                  Профиль
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Уведомления */}
      {notifications.length > 0 && (
        <div className="bg-accent-blue bg-opacity-10 border-b border-accent-blue">
          <div className="max-w-7xl mx-auto px-4 lg:px-6 py-2 lg:py-3">
            <div className="flex items-center gap-3">
              <FaBell className="text-accent-blue flex-shrink-0" />
              <div className="text-xs lg:text-sm text-accent-blue">
                <div className="truncate">
                  {notifications.join(', ')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Основной контент */}
      <main className="max-w-7xl mx-auto px-4 lg:px-6 py-4 lg:py-8">
        {renderContent()}
      </main>

      {/* Модальное окно заявки на замер */}
      {showCustomRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 lg:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base lg:text-lg font-semibold">Подача заявки на замер</h3>
                <button
                  className="btn btn-ghost p-2"
                  onClick={() => {
                    setShowCustomRequest(false);
                    setCustomRequestProductId('');
                  }}
                >
                  ✕
                </button>
              </div>
              <CustomRequest 
                productId={customRequestProductId}
                onClose={() => {
                  setShowCustomRequest(false);
                  setCustomRequestProductId('');
                }}
              />
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .mobile-nav-link {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          transition: background-color 0.2s;
          font-size: 14px;
          width: 100%;
          text-align: left;
          background: none;
          border: none;
          cursor: pointer;
        }
        
        .mobile-nav-link:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }
        
        .mobile-nav-link.active {
          background-color: var(--accent-blue);
        }

        @media (max-width: 768px) {
          .btn-ghost {
            padding: 4px 6px;
            font-size: 11px;
            white-space: nowrap;
          }
        }
      `}</style>
    </div>
  );
};

export default Buyer;