import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// 隐藏初始加载器
const hideInitialLoader = () => {
  const loader = document.getElementById('initial-loading');
  if (loader) {
    loader.style.display = 'none';
  }
};

// 显示错误信息
const showError = (message) => {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 20px;
        text-align: center;
        background: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      ">
        <div style="color: #e53e3e; font-size: 24px; margin-bottom: 16px;">
          Ошибка загрузки приложения
        </div>
        <div style="color: #666666; margin-bottom: 20px; max-width: 600px; line-height: 1.5;">
          ${message}
        </div>
        <button onclick="window.location.reload()" style="
          padding: 10px 20px;
          background: #1a365d;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
        ">
          Перезагрузить страницу
        </button>
      </div>
    `;
  }
};

// 初始化应用
const initApp = () => {
  try {
    // 检查根元素
    const container = document.getElementById('root');
    if (!container) {
      throw new Error('Элемент #root не найден в DOM');
    }

    // 隐藏加载器
    hideInitialLoader();

    // 创建 React 根
    const root = createRoot(container);
    
    // 渲染应用
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    console.log('3D Print Marketplace успешно загружен');

  } catch (error) {
    console.error('Ошибка инициализации приложения:', error);
    hideInitialLoader();
    showError('Не удалось инициализировать приложение. Проверьте консоль браузера для получения подробной информации.');
  }
};

// глобальная обработка ошибок
window.addEventListener('error', (event) => {
  console.error('Глобальная ошибка:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Необработанное отклонение промиса:', event.reason);
  event.preventDefault();
});

// запуск приложения
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// экспорт для отладки
window.__APP_DEBUG__ = {
  showError,
  reload: () => window.location.reload()
};