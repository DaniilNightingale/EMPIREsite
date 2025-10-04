import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FaPaperPlane, FaUser, FaUserShield, FaUserCog, FaSmile, FaBars, FaTimes } from 'react-icons/fa';

const Chat = ({ targetUserId = null, orderContext = null }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const messagesEndRef = useRef(null);

  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isAdmin = currentUser.id === 1;

  const emojis = ['😊', '😂', '😍', '👍', '👎', '❤️', '🔥', '🎉', '😢', '😡', '🤔', '👏'];

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    } else if (targetUserId) {
      setSelectedUser({ id: targetUserId, username: 'Администратор', role: 'admin' });
    } else {
      setSelectedUser({ id: 1, username: 'Администратор', role: 'admin' });
    }
  }, [targetUserId, isAdmin]);

  useEffect(() => {
    if (selectedUser) {
      console.log('Selected user changed, loading messages for:', selectedUser);
      
      // Пытаемся загрузить сохраненные сообщения из localStorage
      const savedMessagesKey = `chat_messages_${currentUser.id}_${selectedUser.id}`;
      const savedMessages = localStorage.getItem(savedMessagesKey);
      
      if (savedMessages) {
        try {
          const parsedMessages = JSON.parse(savedMessages);
          setMessages(parsedMessages);
          console.log('Loaded cached messages:', parsedMessages.length);
        } catch (error) {
          console.error('Ошибка парсинга сохраненных сообщений:', error);
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
      
      // Добавляем небольшую задержку для стабилизации состояния
      const timer = setTimeout(() => {
        fetchMessages();
      }, 100);
      
      // Устанавливаем сообщение с ID заказа, если передан orderContext
      if (orderContext) {
        setNewMessage(`Заказ #${orderContext}: `);
      }
      
      return () => clearTimeout(timer);
    }
  }, [selectedUser, orderContext]);

  // Отладочный useEffect для отслеживания изменений messages
  useEffect(() => {
    console.log('Messages state updated:', {
      length: messages.length,
      messages: messages,
      selectedUser: selectedUser?.id,
      loading: loading
    });
  }, [messages, selectedUser, loading]);

  // Автопрокрутка к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadUsers = async () => {
    try {
      // Сначала пробуем базовый API пользователей
      const response = await axios.get('/api/users', {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Загружены пользователи для чата:', response.data);
      
      if (response.data && Array.isArray(response.data)) {
        const filteredUsers = response.data.filter(user => 
          user.id !== currentUser.id && user.id && user.username
        );
        console.log('Отфильтровано пользователей:', filteredUsers.length);
        setUsers(filteredUsers);
      } else {
        console.warn('Некорректный ответ API пользователей:', response.data);
        setUsers([]);
      }
    } catch (error) {
      console.error('Детальная ошибка загрузки пользователей для чата:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Fallback - пробуем admin API если базовый не работает
      try {
        console.log('Пробуем админский API...');
        const fallbackResponse = await axios.get('/api/admin/users', {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (fallbackResponse.data && Array.isArray(fallbackResponse.data)) {
          const filteredUsers = fallbackResponse.data.filter(user => 
            user.id !== currentUser.id && user.id && user.username
          );
          console.log('Админский API - отфильтровано пользователей:', filteredUsers.length);
          setUsers(filteredUsers);
        } else {
          console.warn('Админский API вернул некорректные данные');
          setUsers([]);
        }
      } catch (fallbackError) {
        console.error('Админский API также не удался:', fallbackError);
        // Устанавливаем пустой массив вместо undefined
        setUsers([]);
      }
    }
  };

  // Функция получения сообщений с улучшенной обработкой ошибок
  const fetchMessages = async () => {
    if (!selectedUser) {
      console.warn('Нет выбранного пользователя для загрузки сообщений');
      return;
    }

    try {
      setLoading(true);
      console.log('Загрузка сообщений для пользователя:', selectedUser);
      let loadedMessages = [];
      
      // Всегда используем стандартный API чата
      const response = await axios.get(`/api/chat/messages`, {
        params: {
          user_id: currentUser.id,
          with_user_id: selectedUser.id,
          limit: 100
        },
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Ответ API сообщений:', response.data);
      
      if (response.data && Array.isArray(response.data)) {
        loadedMessages = response.data.filter(msg => 
          msg && (msg.id || msg.message) // Базовая валидация
        );
      } else {
        console.warn('API вернул некорректные данные сообщений:', response.data);
        loadedMessages = [];
      }
      
      // Нормализуем и сортируем сообщения
      const normalizedMessages = loadedMessages.map(msg => ({
        id: msg.id || `msg_${Date.now()}_${Math.random()}`,
        content: msg.message || msg.content || '',
        created_at: msg.created_date || msg.created_at || new Date().toISOString(),
        sender_id: msg.from_user_id || msg.sender_id || 0,
        receiver_id: msg.to_user_id || msg.receiver_id || 0,
        sender_name: msg.from_username || msg.sender_name || 
          (msg.from_user_id === currentUser.id ? currentUser.username : selectedUser.username)
      })).sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at)
      );
      
      console.log('Нормализованные сообщения:', normalizedMessages.length);
      
      // Обновляем состояние
      setMessages(normalizedMessages);
      
      // Сохраняем сообщения в localStorage
      const savedMessagesKey = `chat_messages_${currentUser.id}_${selectedUser.id}`;
      try {
        localStorage.setItem(savedMessagesKey, JSON.stringify(normalizedMessages));
      } catch (storageError) {
        console.warn('Не удалось сохранить сообщения в localStorage:', storageError);
      }
      
    } catch (error) {
      console.error('Детальная ошибка загрузки сообщений:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        selectedUser: selectedUser
      });
      
      // Простой fallback - загружаем из localStorage если есть
      const savedMessagesKey = `chat_messages_${currentUser.id}_${selectedUser.id}`;
      try {
        const cached = localStorage.getItem(savedMessagesKey);
        if (cached) {
          const cachedMessages = JSON.parse(cached);
          console.log('Загружены кэшированные сообщения:', cachedMessages.length);
          setMessages(cachedMessages);
        } else {
          console.log('Нет кэшированных сообщений');
          setMessages([]);
        }
      } catch (cacheError) {
        console.error('Ошибка загрузки кэшированных сообщений:', cacheError);
        setMessages([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedUser) return;

    const messageText = newMessage.trim();
    
    try {
      const messageData = {
        from_user_id: currentUser.id,
        to_user_id: selectedUser.id,
        message: messageText
      };

      // Создаем временное сообщение для немедленного отображения
      const tempMessage = {
        id: Date.now(), // временный ID
        sender_id: currentUser.id,
        receiver_id: selectedUser.id,
        content: messageText,
        sender_name: currentUser.username || 'Вы',
        created_at: new Date().toISOString()
      };

      // Добавляем сообщение в локальное состояние сразу
      setMessages(prevMessages => {
        const updatedMessages = [...prevMessages, tempMessage];
        
        // Сохраняем обновленные сообщения в localStorage
        const savedMessagesKey = `chat_messages_${currentUser.id}_${selectedUser.id}`;
        localStorage.setItem(savedMessagesKey, JSON.stringify(updatedMessages));
        
        return updatedMessages;
      });
      setNewMessage('');
      setShowEmojiPicker(false);

      // Отправляем сообщение на сервер
      const response = await axios.post('/api/chat', messageData);
      
      // Обновляем временное сообщение реальными данными с сервера
      if (response.data && response.data.data) {
        const serverMessage = {
          ...response.data.data,
          content: response.data.data.message || response.data.data.content,
          created_at: response.data.data.created_date || new Date().toISOString(),
          sender_name: response.data.data.from_username || currentUser.username,
          sender_id: response.data.data.from_user_id,
          receiver_id: response.data.data.to_user_id
        };
        
        setMessages(prevMessages => {
          const updatedMessages = prevMessages.map(msg => 
            msg.id === tempMessage.id ? serverMessage : msg
          );
          
          // Сохраняем обновленные сообщения в localStorage
          const savedMessagesKey = `chat_messages_${currentUser.id}_${selectedUser.id}`;
          localStorage.setItem(savedMessagesKey, JSON.stringify(updatedMessages));
          
          return updatedMessages;
        });
      }
      
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      // В случае ошибки удаляем временное сообщение
      setMessages(prevMessages => {
        const updatedMessages = prevMessages.filter(msg => msg.id !== tempMessage?.id);
        
        // Обновляем localStorage после удаления временного сообщения
        const savedMessagesKey = `chat_messages_${currentUser.id}_${selectedUser.id}`;
        localStorage.setItem(savedMessagesKey, JSON.stringify(updatedMessages));
        
        return updatedMessages;
      });
      setNewMessage(messageText); // Возвращаем текст обратно
      alert('Ошибка при отправке сообщения');
    }
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    setShowUserList(false);
  };

  const addEmoji = (emoji) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const getUserIcon = (role) => {
    switch (role) {
      case 'admin':
        return <FaUserShield className="text-accent-blue" />;
      case 'executor':
        return <FaUserCog className="text-gray-600" />;
      default:
        return <FaUser className="text-gray-500" />;
    }
  };

  const getRoleLabel = (role) => {
    const roleMap = {
      'admin': 'Администратор',
      'executor': 'Исполнитель',
      'buyer': 'Покупатель'
    };
    return roleMap[role] || role;
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="chat-wrapper">
      <div className="chat-header">
        <h1 className="chat-title">
          {isAdmin ? 'Чат с клиентами' : 'Чат с администратором'}
        </h1>
        
        {/* Мобильная кнопка для списка пользователей */}
        {isAdmin && (
          <button
            className="mobile-users-btn"
            onClick={() => setShowUserList(!showUserList)}
          >
            {showUserList ? <FaTimes /> : <FaBars />}
          </button>
        )}
      </div>

      <div className="chat-container">
        {/* Список пользователей - мобильная версия */}
        {isAdmin && (
          <div className={`users-panel ${showUserList ? 'mobile-users-open' : ''}`}>
            <div className="users-header">
              <h2 className="users-title">Пользователи</h2>
            </div>
            <div className="users-list">
              {users.length === 0 ? (
                <div className="no-users">
                  Нет доступных пользователей
                </div>
              ) : (
                <div className="users-scroll">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className={`user-item ${
                        selectedUser?.id === user.id ? 'user-selected' : ''
                      }`}
                      onClick={() => selectUser(user)}
                    >
                      <div className="user-content">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.username}
                            className="user-avatar"
                          />
                        ) : (
                          <div className="user-avatar-placeholder">
                            {getUserIcon(user.role)}
                          </div>
                        )}
                        <div className="user-info">
                          <div className="user-name">{user.username}</div>
                          <div className="user-details">
                            ID: {user.id} • {getRoleLabel(user.role)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Область чата */}
        <div className="chat-main">
          {/* Заголовок чата */}
          <div className="chat-user-header">
            {selectedUser ? (
              <div className="selected-user-info">
                <div className="selected-user-avatar">
                  {getUserIcon(selectedUser.role)}
                </div>
                <div className="selected-user-details">
                  <h2 className="selected-user-name">{selectedUser.username}</h2>
                  <div className="selected-user-role">
                    {getRoleLabel(selectedUser.role)}
                  </div>
                </div>
              </div>
            ) : (
              <h2 className="no-user-selected">Выберите пользователя</h2>
            )}
          </div>

          {selectedUser && (
            <div className="chat-content">
              {/* Сообщения */}
              <div className="messages-container">
                {loading ? (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p className="loading-text">Загрузка сообщений...</p>
                  </div>
                ) : (
                  <div className="messages-list">
                    {messages.length === 0 ? (
                      <div className="empty-messages">
                        <i className="fas fa-comment-dots empty-icon"></i>
                        <p className="empty-text">
                          {isAdmin ? 'Нет сообщений с этим пользователем' : 'Нет сообщений. Начните диалог!'}
                        </p>
                        <small className="empty-subtext">
                          {isAdmin ? 'Начните диалог, отправив первое сообщение' : 'Администратор отвечает на сообщения в рабочее время'}
                        </small>
                      </div>
                    ) : (
                      messages.map((message) => {
                        if (!message || typeof message !== 'object') {
                          console.warn('Некорректное сообщение:', message);
                          return null;
                        }
                        
                        const messageId = message.id || `msg-${Math.random()}`;
                        const senderId = message.sender_id || message.from_user_id || 0;
                        const messageText = message.content || message.message || '';
                        const senderName = message.sender_name || message.from_username || 'Неизвестный пользователь';
                        const createdAt = message.created_at || message.created_date || new Date().toISOString();
                        const isFromCurrentUser = senderId === currentUser.id;
                        
                        return (
                          <div key={messageId} className={`message ${isFromCurrentUser ? 'message-sent' : 'message-received'}`}>
                            <div className="message-avatar">
                              {isFromCurrentUser ? (
                                currentUser.username?.charAt(0).toUpperCase() || 'U'
                              ) : (
                                isAdmin ? (selectedUser?.username?.charAt(0).toUpperCase() || '?') : 'A'
                              )}
                            </div>
                            <div className="message-content">
                              <div className="message-text">{messageText}</div>
                              <div className="message-time">
                                {formatTime(createdAt)}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Форма отправки сообщения */}
              <div className="message-input-container">
                <form onSubmit={sendMessage} className="message-form">
                  <div className="input-wrapper">
                    <textarea
                      className="message-input"
                      placeholder="Введите сообщение..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(e);
                        }
                      }}
                    />
                    
                    {/* Кнопка эмодзи */}
                    <button
                      type="button"
                      className="emoji-btn"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    >
                      <FaSmile />
                    </button>

                    {/* Панель эмодзи */}
                    {showEmojiPicker && (
                      <div className="emoji-picker">
                        {emojis.map((emoji, index) => (
                          <button
                            key={index}
                            type="button"
                            className="emoji-item"
                            onClick={() => addEmoji(emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <button
                    type="submit"
                    className="send-btn"
                    disabled={!newMessage.trim()}
                  >
                    <FaPaperPlane />
                  </button>
                </form>
              </div>
            </div>
          )}

          {!selectedUser && !isAdmin && (
            <div className="no-chat-state">
              <FaUser className="no-chat-icon" />
              <p className="no-chat-text">
                Чат с администратором будет доступен после входа в систему
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Подсказка для быстрых сообщений - скрыта на мобильных */}
      {selectedUser && (
        <div className="quick-phrases">
          <div className="quick-phrases-title">Быстрые фразы:</div>
          <div className="quick-phrases-list">
            {[
              'Здравствуйте!',
              'Спасибо за помощь',
              'Есть вопрос по заказу',
              'Когда будет готово?',
              'Всё понятно'
            ].map((phrase, index) => (
              <button
                key={index}
                className="quick-phrase-btn"
                onClick={() => setNewMessage(phrase)}
              >
                {phrase}
              </button>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .chat-wrapper {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 100px);
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem;
        }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding: 0 0.5rem;
        }

        .chat-title {
          font-size: 1.5rem;
          font-weight: bold;
          color: #000;
          margin: 0;
        }

        .mobile-users-btn {
          display: none;
          background: var(--accent-blue);
          color: white;
          border: none;
          padding: 0.5rem;
          border-radius: 0.25rem;
          cursor: pointer;
        }

        .chat-container {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 1rem;
          height: 100%;
          background: white;
          border-radius: 0.5rem;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .users-panel {
          border-right: 1px solid #e0e0e0;
          display: flex;
          flex-direction: column;
          background: #f9f9f9;
        }

        .users-header {
          padding: 1rem;
          border-bottom: 1px solid #e0e0e0;
          background: white;
        }

        .users-title {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0;
          color: #000;
        }

        .users-list {
          flex: 1;
          overflow: hidden;
        }

        .no-users {
          padding: 2rem 1rem;
          text-align: center;
          color: #666;
        }

        .users-scroll {
          height: 100%;
          overflow-y: auto;
        }

        .user-item {
          padding: 1rem;
          border-bottom: 1px solid #e0e0e0;
          cursor: pointer;
          transition: background-color 0.2s;
          background: white;
        }

        .user-item:hover {
          background-color: #f0f0f0;
        }

        .user-selected {
          background-color: rgba(26, 54, 93, 0.1) !important;
          border-left: 4px solid var(--accent-blue);
        }

        .user-content {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .user-avatar, .user-avatar-placeholder {
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 50%;
          object-fit: cover;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e0e0e0;
        }

        .user-info {
          flex: 1;
        }

        .user-name {
          font-weight: 500;
          color: #000;
          margin-bottom: 0.25rem;
        }

        .user-details {
          font-size: 0.875rem;
          color: #666;
        }

        .chat-main {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .chat-user-header {
          padding: 1rem;
          border-bottom: 1px solid #e0e0e0;
          background: white;
        }

        .selected-user-info {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .selected-user-avatar {
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          background: #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .selected-user-name {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0;
          color: #000;
        }

        .selected-user-role {
          font-size: 0.875rem;
          color: #666;
        }

        .no-user-selected {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0;
          color: #666;
        }

        .chat-content {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          background: #f9f9f9;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .loading-spinner {
          width: 2rem;
          height: 2rem;
          border: 3px solid #e0e0e0;
          border-top: 3px solid var(--accent-blue);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loading-text {
          color: #666;
          margin: 0;
        }

        .messages-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .empty-messages {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          padding: 2rem;
        }

        .empty-icon {
          font-size: 3rem;
          color: #ddd;
          margin-bottom: 1rem;
        }

        .empty-text {
          color: #666;
          margin: 0 0 0.5rem 0;
        }

        .empty-subtext {
          color: #999;
          font-size: 0.875rem;
        }

        .message {
          display: flex;
          gap: 0.5rem;
          align-items: flex-start;
          max-width: 70%;
        }

        .message-sent {
          margin-left: auto;
          flex-direction: row-reverse;
        }

        .message-received {
          margin-right: auto;
        }

        .message-avatar {
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          background: var(--accent-blue);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: bold;
          flex-shrink: 0;
        }

        .message-content {
          background: white;
          padding: 0.75rem;
          border-radius: 1rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .message-sent .message-content {
          background: var(--accent-blue);
          color: white;
        }

        .message-text {
          margin-bottom: 0.25rem;
          word-wrap: break-word;
        }

        .message-time {
          font-size: 0.75rem;
          opacity: 0.7;
        }

        .message-input-container {
          padding: 1rem;
          background: white;
          border-top: 1px solid #e0e0e0;
        }

        .message-form {
          display: flex;
          gap: 0.5rem;
          align-items: flex-end;
        }

        .input-wrapper {
          position: relative;
          flex: 1;
        }

        .message-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 1rem;
          resize: none;
          outline: none;
          font-family: inherit;
        }

        .message-input:focus {
          border-color: var(--accent-blue);
        }

        .emoji-btn {
          position: absolute;
          bottom: 0.5rem;
          right: 0.5rem;
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 50%;
          transition: background-color 0.2s;
        }

        .emoji-btn:hover {
          background: #f0f0f0;
        }

        .emoji-picker {
          position: absolute;
          bottom: 100%;
          right: 0;
          background: white;
          border: 1px solid #ddd;
          border-radius: 0.5rem;
          padding: 0.5rem;
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 0.25rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .emoji-item {
          background: none;
          border: none;
          font-size: 1.25rem;
          padding: 0.25rem;
          cursor: pointer;
          border-radius: 0.25rem;
          transition: background-color 0.2s;
        }

        .emoji-item:hover {
          background: #f0f0f0;
        }

        .send-btn {
          background: var(--accent-blue);
          color: white;
          border: none;
          padding: 0.75rem;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s;
          min-width: 3rem;
          height: 3rem;
        }

        .send-btn:hover:not(:disabled) {
          background: var(--accent-blue-hover);
        }

        .send-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .no-chat-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 2rem;
          text-align: center;
        }

        .no-chat-icon {
          font-size: 4rem;
          color: #ddd;
          margin-bottom: 1rem;
        }

        .no-chat-text {
          color: #666;
          margin: 0;
        }

        .quick-phrases {
          margin-top: 1rem;
          padding: 1rem;
          background: #f9f9f9;
          border-radius: 0.5rem;
        }

        .quick-phrases-title {
          font-size: 0.875rem;
          color: #666;
          margin-bottom: 0.5rem;
        }

        .quick-phrases-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .quick-phrase-btn {
          background: white;
          border: 1px solid #ddd;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .quick-phrase-btn:hover {
          background: #f0f0f0;
          border-color: var(--accent-blue);
        }

        /* Мобильные стили */
        @media (max-width: 768px) {
          .chat-wrapper {
            padding: 0.5rem;
            height: calc(100vh - 60px);
          }

          .chat-header {
            margin-bottom: 0.5rem;
          }

          .chat-title {
            font-size: 1.125rem;
          }

          .mobile-users-btn {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .chat-container {
            grid-template-columns: 1fr;
            position: relative;
          }

          .users-panel {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            z-index: 10;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
            border-right: none;
          }

          .mobile-users-open {
            transform: translateX(0);
          }

          .users-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .message {
            max-width: 85%;
          }

          .message-avatar {
            width: 1.75rem;
            height: 1.75rem;
            font-size: 0.625rem;
          }

          .message-content {
            padding: 0.5rem 0.75rem;
          }

          .message-text {
            font-size: 0.875rem;
          }

          .message-time {
            font-size: 0.6875rem;
          }

          .message-input-container {
            padding: 0.75rem;
          }

          .message-input {
            padding: 0.5rem 2.5rem 0.5rem 0.75rem;
            font-size: 1rem;
          }

          .send-btn {
            min-width: 2.5rem;
            height: 2.5rem;
            padding: 0.5rem;
          }

          .quick-phrases {
            display: none;
          }

          .emoji-picker {
            grid-template-columns: repeat(4, 1fr);
            left: 50%;
            transform: translateX(-50%);
            right: auto;
          }

          .selected-user-name {
            font-size: 1rem;
          }

          .users-title {
            font-size: 1rem;
          }

          .user-item {
            padding: 0.75rem;
          }

          .user-avatar,
          .user-avatar-placeholder {
            width: 2rem;
            height: 2rem;
          }

          .user-name {
            font-size: 0.875rem;
          }

          .user-details {
            font-size: 0.75rem;
          }
        }

        @media (max-width: 480px) {
          .chat-wrapper {
            padding: 0.25rem;
          }

          .chat-title {
            font-size: 1rem;
          }

          .message {
            max-width: 90%;
          }

          .message-content {
            padding: 0.5rem;
          }

          .message-input {
            font-size: 16px; /* Предотвращает зум на iOS */
          }

          .emoji-picker {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        /* Переменные CSS */
        :root {
          --accent-blue: #1a365d;
          --accent-blue-hover: #2c5282;
        }
      `}</style>
    </div>
  );
};

export default Chat;