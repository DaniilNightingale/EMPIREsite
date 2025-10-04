import React, { useState, useEffect } from 'react';
import { FaShoppingCart, FaUser, FaBox, FaComments, FaHeart, FaImage, FaBell, FaBars, FaTimes } from 'react-icons/fa';
import ProductCard from '../components/ProductCard';
import Cart from '../components/Cart';
import Profile from '../components/Profile';
import OrderView from '../components/OrderView';
import Chat from '../components/Chat';
import Portfolio from '../components/Portfolio';
import CustomRequest from '../components/CustomRequest';
import axios from 'axios';

const Executor = () => {
  const [activeTab, setActiveTab] = useState('catalog');
  const [currentUser, setCurrentUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showCustomRequest, setShowCustomRequest] = useState(false);
  const [customRequestProductId, setCustomRequestProductId] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!user.id || user.role !== 'executor') {
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

    window.addEventListener('openCustomRequest', handleCustomRequest);
    return () => window.removeEventListener('openCustomRequest', handleCustomRequest);
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await axios.get(`/api/products?${params.toString()}`);
      setProducts(response.data);
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    if (!currentUser?.id) return;
    
    try {
      const savedFavorites = JSON.parse(localStorage.getItem(`favorites_${currentUser.id}`) || '[]');
      setFavorites(savedFavorites);
    } catch (error) {
      console.error('Ошибка загрузки избранного:', error);
    }
  };

  const loadNotifications = async () => {
    if (!currentUser?.id) return;

    try {
      // Загружаем уведомления о новых сообщениях и заказах
      const [messagesResponse, ordersResponse] = await Promise.all([
        axios.get(`/api/chat?user_id=${currentUser.id}`),
        axios.get(`/api/orders?user_id=${currentUser.id}&role=${currentUser.role}`)
      ]);

      const recentMessages = messagesResponse.data.filter(msg => 
        new Date(msg.created_date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length;

      const recentOrders = ordersResponse.data.filter(order => 
        new Date(order.created_date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length;

      const notificationsList = [];
      if (recentMessages > 0) notificationsList.push(`${recentMessages} новых сообщений`);
      if (recentOrders > 0) notificationsList.push(`${recentOrders} новых заказов`);

      setNotifications(notificationsList);
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
    }
  };

  const getFavoriteProducts = () => {
    return products.filter(product => favorites.includes(product.id));
  };

  const handleAddToCart = (product) => {
    // Обновляем уведомления после добавления в корзину
    loadNotifications();
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    closeMobileMenu();
  };

  useEffect(() => {
    loadProducts();
  }, [searchTerm]);

  const renderContent = () => {
    switch (activeTab) {
      case 'catalog':
        return (
          <div>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold text-black">Каталог товаров</h2>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <input
                  type="text"
                  placeholder="Поиск товаров..."
                  className="input flex-1 sm:flex-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button
                  className="btn btn-accent whitespace-nowrap"
                  onClick={() => setShowCustomRequest(true)}
                >
                  Подать заявку
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
                <p className="text-gray-500">Загрузка товаров...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Товары не найдены</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {products.map(product => (
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
        return <OrderView isExecutor={true} />;

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

      case 'portfolio':
        return <Portfolio />;

      case 'favorites':
        return (
          <div>
            <h2 className="text-2xl font-bold text-black mb-6">Избранные товары</h2>
            {favorites.length === 0 ? (
              <div className="text-center py-12">
                <FaHeart className="text-6xl text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Нет избранных товаров</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {getFavoriteProducts().map(product => (
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
          <p className="text-gray-500">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Верхняя навигация */}
      <nav className="nav shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-14 sm:h-16">
            {/* Логотип и мобильная кнопка меню */}
            <div className="flex items-center gap-2">
              <div className="header-logo-container">
                <img 
                  src="https://haisnap.tos-cn-beijing.volces.com/image/fb4e11b1-32cb-4ee9-a6b8-90711522901e_1759499694999.jpg" 
                  alt="NIGHTINGALE EMPIRE Logo" 
                  className="logo-image"
                />
                <h1 className="text-lg sm:text-xl font-bold text-white">
                  NIGHTINGALE EMPIRE
                </h1>
              </div>
              
              {/* Мобильная кнопка меню */}
              <button
                className="md:hidden text-white p-1"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
              </button>
            </div>

            {/* Десктопная навигация */}
            <div className="hidden md:flex items-center gap-1">
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
                Заявки
              </button>
            </div>

            {/* Правая часть навигации */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Уведомления */}
              {notifications.length > 0 && (
                <div className="relative hidden sm:block">
                  <FaBell className="text-white text-lg" />
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                </div>
              )}

              {/* Десктопные кнопки */}
              <div className="hidden md:flex items-center gap-1">
                <button
                  className={`nav-link ${activeTab === 'portfolio' ? 'active' : ''}`}
                  onClick={() => setActiveTab('portfolio')}
                >
                  <FaImage className="mr-2" />
                  Портфолио
                </button>
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
              <div className="flex items-center gap-1 text-white">
                {currentUser.avatar && (
                  <img
                    src={currentUser.avatar}
                    alt="Avatar"
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover"
                  />
                )}
                <div className="text-xs sm:text-sm hidden sm:block">
                  <div className="font-medium">{currentUser.username}</div>
                  <div className="text-xs text-gray-300">Исполнитель</div>
                </div>
              </div>

              <button
                className="btn btn-ghost text-white hover:bg-gray-800 text-xs px-1 sm:px-2"
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
            <div className="md:hidden bg-gray-800 mt-2 rounded-lg overflow-hidden">
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
                  className={`mobile-nav-link ${activeTab === 'portfolio' ? 'active' : ''}`}
                  onClick={() => handleTabChange('portfolio')}
                >
                  <FaImage className="mr-3" />
                  Портфолио
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <FaBell className="text-accent-blue flex-shrink-0" />
              <div className="text-sm text-accent-blue overflow-hidden">
                <div className="truncate">
                  {notifications.join(', ')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Основной контент */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {renderContent()}
      </main>

      {/* Модальное окно заявки на замер */}
      {showCustomRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Подача заявки на замер</h3>
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
        
        @media (max-width: 640px) {
          .product-grid {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 768px) {
          .nav {
            position: sticky;
            top: 0;
            z-index: 40;
          }
          
          .nav-link {
            padding: 8px 12px;
            font-size: 14px;
          }
          
          .btn {
            padding: 6px 4px;
            font-size: 12px;
            white-space: nowrap;
          }
          
          .btn-ghost {
            padding: 4px 6px;
            min-width: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default Executor;