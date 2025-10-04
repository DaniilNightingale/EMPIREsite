import React, { useState, useEffect } from 'react';
import { FaShoppingCart, FaUser, FaBox, FaComments, FaCog, FaUsers, FaDatabase, FaChartBar, FaBell, FaSearch, FaBars, FaTimes } from 'react-icons/fa';
import ProductCard from '../components/ProductCard';
import Cart from '../components/Cart';
import Profile from '../components/Profile';
import OrderView from '../components/OrderView';
import Chat from '../components/Chat';
import ProductManager from '../components/ProductManager';
import UserManager from '../components/UserManager';
import Settings from '../components/Settings';
import CustomRequest from '../components/CustomRequest';
import axios from 'axios';

const Admin = () => {
  const [activeTab, setActiveTab] = useState('catalog');
  const [currentUser, setCurrentUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalRequests: 0
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!user.id || user.id !== 1) {
      alert('Доступ запрещен. Только для администраторов.');
      window.location.href = '#/login';
      return;
    }
    setCurrentUser(user);
    loadProducts();
    loadNotifications();
    loadDashboardStats();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      params.append('admin', 'true');
      
      const response = await axios.get(`/api/products?${params.toString()}`);
      setProducts(response.data);
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    if (!currentUser?.id) return;

    try {
      // Загружаем уведомления о новых сообщениях, заказах и заявках
      const [messagesResponse, ordersResponse, requestsResponse] = await Promise.all([
        axios.get(`/api/chat?user_id=${currentUser.id}`),
        axios.get('/api/orders'),
        axios.get('/api/custom-requests')
      ]);

      const recentMessages = messagesResponse.data.filter(msg => 
        new Date(msg.created_date) > new Date(Date.now() - 24 * 60 * 60 * 1000) &&
        msg.to_user_id === currentUser.id
      ).length;

      const recentOrders = ordersResponse.data.filter(order => 
        new Date(order.created_date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length;

      const recentRequests = requestsResponse.data.filter(req => 
        new Date(req.created_date) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length;

      const notificationsList = [];
      if (recentMessages > 0) notificationsList.push(`${recentMessages} новых сообщений`);
      if (recentOrders > 0) notificationsList.push(`${recentOrders} новых заказов`);
      if (recentRequests > 0) notificationsList.push(`${recentRequests} новых заявок`);

      setNotifications(notificationsList);
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const [productsResponse, ordersResponse, usersResponse, requestsResponse] = await Promise.all([
        axios.get('/api/products?admin=true'),
        axios.get('/api/orders'),
        axios.get('/api/users'),
        axios.get('/api/custom-requests')
      ]);

      setDashboardStats({
        totalProducts: productsResponse.data.length,
        totalOrders: ordersResponse.data.length,
        totalUsers: usersResponse.data.length,
        totalRequests: requestsResponse.data.length
      });
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  };

  const handleAddToCart = (product) => {
    // Обновляем уведомления после добавления в корзину
    loadNotifications();
  };

  const createBackup = async () => {
    try {
      const response = await axios.get('/api/backup/all');
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      alert('Резервная копия создана успешно');
    } catch (error) {
      console.error('Ошибка создания резервной копии:', error);
      alert('Ошибка при создании резервной копии');
    }
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
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-0">
              <h2 className="text-xl sm:text-2xl font-bold text-black">Каталог товаров</h2>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <input
                  type="text"
                  placeholder="Поиск товаров..."
                  className="input flex-1 sm:flex-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 sm:py-12">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
                <p className="text-gray-500 text-sm sm:text-base">Загрузка товаров...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <p className="text-gray-500 text-sm sm:text-base">Товары не найдены</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                {products.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    showCustomRequest={false}
                  />
                ))}
              </div>
            )}
          </div>
        );

      case 'dashboard':
        return (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">Панель управления</h2>
            
            {/* Статистические карточки */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
              <div className="card">
                <div className="card-body text-center p-3 sm:p-6">
                  <FaShoppingCart className="text-2xl sm:text-3xl text-accent-blue mx-auto mb-2" />
                  <h3 className="text-sm sm:text-lg font-semibold mb-1">Товары</h3>
                  <p className="text-lg sm:text-2xl font-bold text-accent-blue">{dashboardStats.totalProducts}</p>
                </div>
              </div>
              
              <div className="card">
                <div className="card-body text-center p-3 sm:p-6">
                  <FaBox className="text-2xl sm:text-3xl text-accent-blue mx-auto mb-2" />
                  <h3 className="text-sm sm:text-lg font-semibold mb-1">Заказы</h3>
                  <p className="text-lg sm:text-2xl font-bold text-accent-blue">{dashboardStats.totalOrders}</p>
                </div>
              </div>
              
              <div className="card">
                <div className="card-body text-center p-3 sm:p-6">
                  <FaUsers className="text-2xl sm:text-3xl text-accent-blue mx-auto mb-2" />
                  <h3 className="text-sm sm:text-lg font-semibold mb-1">Пользователи</h3>
                  <p className="text-lg sm:text-2xl font-bold text-accent-blue">{dashboardStats.totalUsers}</p>
                </div>
              </div>
              
              <div className="card">
                <div className="card-body text-center p-3 sm:p-6">
                  <FaComments className="text-2xl sm:text-3xl text-accent-blue mx-auto mb-2" />
                  <h3 className="text-sm sm:text-lg font-semibold mb-1">Заявки</h3>
                  <p className="text-lg sm:text-2xl font-bold text-accent-blue">{dashboardStats.totalRequests}</p>
                </div>
              </div>
            </div>

            {/* Быстрые действия */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-base sm:text-lg font-semibold">Быстрые действия</h3>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <button
                    className="btn btn-accent text-xs sm:text-sm"
                    onClick={() => setActiveTab('product-manager')}
                  >
                    <FaShoppingCart className="mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Управление </span>товарами
                  </button>
                  <button
                    className="btn btn-accent text-xs sm:text-sm"
                    onClick={() => setActiveTab('orders')}
                  >
                    <FaBox className="mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Управление </span>заказами
                  </button>
                  <button
                    className="btn btn-accent text-xs sm:text-sm"
                    onClick={() => setActiveTab('user-manager')}
                  >
                    <FaUsers className="mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Управление </span>пользователями
                  </button>
                  <button
                    className="btn btn-accent text-xs sm:text-sm"
                    onClick={createBackup}
                  >
                    <FaDatabase className="mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Создать </span>резервную копию
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'orders':
        return <OrderView isAdmin={true} />;

      case 'custom-requests':
        return <CustomRequest />;

      case 'chat':
        return <Chat />;

      case 'product-manager':
        return <ProductManager />;

      case 'user-manager':
        return <UserManager />;

      case 'settings':
        return <Settings />;

      case 'profile':
        return <Profile />;

      default:
        return <div>Страница не найдена</div>;
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-accent-blue mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm sm:text-base">Загрузка...</p>
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
            <div className="flex items-center gap-4">
              <div className="header-logo-container">
                <img 
                  src="https://haisnap.tos-cn-beijing.volces.com/image/fb4e11b1-32cb-4ee9-a6b8-90711522901e_1759499694999.jpg" 
                  alt="NIGHTINGALE EMPIRE Logo" 
                  className="logo-image"
                />
                <h1 className="text-base sm:text-xl font-bold text-white">
                  NIGHTINGALE EMPIRE
                </h1>
              </div>
              
              {/* Мобильная кнопка меню */}
              <button
                className="md:hidden text-white p-1"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
              </button>
            </div>

            {/* Десктопная навигация */}
            <div className="hidden md:flex items-center gap-1">
              <button
                className={`nav-link text-sm ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <FaChartBar className="mr-2" />
                Панель
              </button>
              <button
                className={`nav-link text-sm ${activeTab === 'catalog' ? 'active' : ''}`}
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
                className={`nav-link text-sm ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => setActiveTab('orders')}
              >
                <FaBox className="mr-2" />
                Заказы
              </button>
              <button
                className={`nav-link text-sm ${activeTab === 'custom-requests' ? 'active' : ''}`}
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

            <div className="flex items-center gap-2 sm:gap-4">
              {/* Уведомления */}
              {notifications.length > 0 && (
                <div className="relative">
                  <FaBell className="text-white text-base sm:text-lg" />
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                </div>
              )}

              {/* Десктопные кнопки управления */}
              <div className="hidden md:flex items-center gap-1">
                <button
                  className={`nav-link text-sm ${activeTab === 'product-manager' ? 'active' : ''}`}
                  onClick={() => setActiveTab('product-manager')}
                >
                  <FaShoppingCart className="mr-2" />
                  Товары
                </button>
                <button
                  className={`nav-link text-sm ${activeTab === 'user-manager' ? 'active' : ''}`}
                  onClick={() => setActiveTab('user-manager')}
                >
                  <FaUsers className="mr-2" />
                  Пользователи
                </button>
                <button
                  className={`nav-link text-sm ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chat')}
                >
                  <FaComments className="mr-2" />
                  Чат
                </button>
                <button
                  className={`nav-link text-sm ${activeTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  <FaCog className="mr-2" />
                  Настройки
                </button>
                <button
                  className={`nav-link text-sm ${activeTab === 'profile' ? 'active' : ''}`}
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
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover"
                  />
                )}
                <div className="text-xs sm:text-sm hidden sm:block">
                  <div className="font-medium">{currentUser.username}</div>
                  <div className="text-xs text-gray-300">Администратор</div>
                </div>
              </div>

              <button
                className="btn btn-ghost text-white hover:bg-gray-800 text-xs sm:text-sm px-2 sm:px-4"
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
                  className={`mobile-nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => handleTabChange('dashboard')}
                >
                  <FaChartBar className="mr-3" />
                  Панель управления
                </button>
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
                  className={`mobile-nav-link ${activeTab === 'product-manager' ? 'active' : ''}`}
                  onClick={() => handleTabChange('product-manager')}
                >
                  <FaShoppingCart className="mr-3" />
                  Управление товарами
                </button>
                <button
                  className={`mobile-nav-link ${activeTab === 'user-manager' ? 'active' : ''}`}
                  onClick={() => handleTabChange('user-manager')}
                >
                  <FaUsers className="mr-3" />
                  Управление пользователями
                </button>
                <button
                  className={`mobile-nav-link ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => handleTabChange('chat')}
                >
                  <FaComments className="mr-3" />
                  Чат
                </button>
                <button
                  className={`mobile-nav-link ${activeTab === 'settings' ? 'active' : ''}`}
                  onClick={() => handleTabChange('settings')}
                >
                  <FaCog className="mr-3" />
                  Настройки
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3">
            <div className="flex items-center gap-3">
              <FaBell className="text-accent-blue flex-shrink-0" />
              <div className="text-xs sm:text-sm text-accent-blue overflow-hidden">
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
          .nav {
            position: sticky;
            top: 0;
            z-index: 40;
          }
          
          .nav-link {
            padding: 6px 12px;
            font-size: 12px;
          }
          
          .btn {
            padding: 6px 12px;
            font-size: 12px;
          }
          
          .card {
            margin: 0.5rem 0;
          }
          
          .card-body {
            padding: 1rem;
          }
          
          .grid {
            gap: 0.75rem;
          }
          
          h1, h2, h3 {
            font-size: 0.9rem;
          }
          
          .product-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Admin;