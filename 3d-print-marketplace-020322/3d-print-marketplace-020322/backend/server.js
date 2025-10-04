const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();

// 日志配置
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// 全局异常捕获
process.on('uncaughtException', (err) => {
  logger.error('未捕获异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', reason);
});

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: false,
  frameguard: false
}));

// 允许跨域访问
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 静态资源配置
const publicDir = path.resolve(__dirname, '../frontend/public');
const distDir = path.resolve(__dirname, '../frontend/dist');
const publicPath = fs.existsSync(publicDir) ? publicDir : distDir;
app.use(express.static(publicPath));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(publicPath, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB限制
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'backup_file' && file.mimetype === 'application/json') {
      cb(null, true);
    } else if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传JSON或图片文件'), false);
    }
  }
});

// PostgreSQL 数据库连接配置
const sequelize = new Sequelize(
  process.env.DB_NAME || 'marketplace',
  process.env.DB_USER || 'postgres', 
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      freezeTableName: true,
      timestamps: true
    }
  }
);

// 定义数据模型
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'buyer' },
  avatar: DataTypes.TEXT,
  city: DataTypes.STRING,
  birthday: DataTypes.STRING,
  notes: DataTypes.TEXT,
  initial_username: DataTypes.STRING
}, { tableName: 'users', timestamps: true, createdAt: 'registration_date', updatedAt: 'updated_date' });

const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  related_name: DataTypes.STRING,
  description: DataTypes.TEXT,
  original_height: DataTypes.FLOAT,
  original_width: DataTypes.FLOAT,
  original_length: DataTypes.FLOAT,
  parts_count: { type: DataTypes.INTEGER, defaultValue: 1 },
  main_image: DataTypes.TEXT,
  additional_images: DataTypes.TEXT,
  price_options: { type: DataTypes.TEXT, allowNull: false },
  is_visible: { type: DataTypes.BOOLEAN, defaultValue: true },
  sales_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  favorites_count: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'products', timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });

const Order = sequelize.define('Order', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  products: DataTypes.TEXT,
  total_price: DataTypes.FLOAT,
  status: { type: DataTypes.STRING, defaultValue: 'создан заказ' },
  notes: DataTypes.TEXT,
  admin_notes: DataTypes.TEXT,
  assigned_executors: DataTypes.TEXT
}, { tableName: 'orders', timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });

const Settings = sequelize.define('Settings', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  payment_info: DataTypes.TEXT,
  price_coefficient: { type: DataTypes.FLOAT, defaultValue: 5.25 },
  discount_rules: DataTypes.TEXT,
  show_discount_on_products: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'settings', timestamps: false });

// 数据库初始化函数
async function initDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('数据库连接成功');
    await sequelize.sync({ alter: false });
    logger.info('数据库表结构检查完成');
    
    // 创建默认管理员账户
    const adminExists = await User.findOne({ where: { id: 1 } });
    if (!adminExists) {
      await User.create({
        id: 1,
        username: 'admin',
        password: bcrypt.hashSync('123456', 10),
        role: 'admin'
      });
      logger.info('默认管理员账户创建成功');
    }
    
    // 创建默认设置
    const settingsExists = await Settings.findOne();
    if (!settingsExists) {
      await Settings.create({
        payment_info: 'Реквизиты для оплаты:\nБанковская карта: 1234 5678 9012 3456',
        price_coefficient: 5.25,
        discount_rules: '[]',
        show_discount_on_products: false
      });
      logger.info('默认设置创建成功');
    }
  } catch (error) {
    logger.error('数据库初始化错误:', error.message);
  }
}

// 初始化数据库
initDatabase();

// 用户认证相关API
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Укажите имя пользователя и пароль' });
    }

    const user = await User.findOne({ where: { username } });
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Неверные учетные данные' });
    }

    logger.info(`Пользователь ${username} успешно вошел в систему`);
    res.json({ 
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    logger.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role = 'buyer' } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Укажите имя пользователя и пароль' });
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      role,
      initial_username: username
    });

    logger.info(`Новый пользователь зарегистрирован: ${username}`);
    res.status(201).json({ message: 'Пользователь успешно зарегистрирован' });
  } catch (error) {
    logger.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// Продукты API
app.get('/api/products', async (req, res) => {
  try {
    const { search, filter = 'name', admin } = req.query;
    
    let whereClause = {};
    
    // Если не админ, показываем только видимые товары
    if (!admin) {
      whereClause.is_visible = true;
    }
    
    // Поиск по параметрам
    if (search && search.trim()) {
      const searchTerm = search.trim();
      
      switch (filter) {
        case 'description':
          whereClause.description = { [Op.iLike]: `%${searchTerm}%` };
          break;
        case 'id':
          whereClause.id = parseInt(searchTerm) || 0;
          break;
        case 'name':
        default:
          whereClause.name = { [Op.iLike]: `%${searchTerm}%` };
          break;
      }
    }

    const products = await Product.findAll({
      where: whereClause,
      order: [['created_date', 'DESC']],
      raw: true
    });

    // Парсим JSON поля
    const processedProducts = products.map(product => {
      try {
        return {
          ...product,
          price_options: product.price_options ? JSON.parse(product.price_options) : [],
          additional_images: product.additional_images ? JSON.parse(product.additional_images) : []
        };
      } catch (parseError) {
        logger.warn(`Ошибка парсинга данных товара ${product.id}:`, parseError);
        return {
          ...product,
          price_options: [],
          additional_images: []
        };
      }
    });

    logger.info(`Загружено товаров: ${processedProducts.length}`);
    res.json(processedProducts);
  } catch (error) {
    logger.error('Ошибка загрузки товаров:', error);
    res.status(500).json({ error: 'Ошибка сервера при загрузке товаров' });
  }
});

app.post('/api/products', upload.fields([
  { name: 'main_image', maxCount: 1 },
  { name: 'additional_images', maxCount: 4 }
]), async (req, res) => {
  try {
    const {
      name,
      related_name,
      description,
      original_height,
      original_width,
      original_length,
      parts_count,
      price_options,
      is_visible = true
    } = req.body;

    if (!name || !price_options) {
      return res.status(400).json({ error: 'Укажите название и варианты цен' });
    }

    let parsedPriceOptions;
    try {
      parsedPriceOptions = JSON.parse(price_options);
    } catch (e) {
      return res.status(400).json({ error: 'Неверный формат вариантов цен' });
    }

    const mainImagePath = req.files?.main_image?.[0] ? 
      `/uploads/${req.files.main_image[0].filename}` : null;
    
    const additionalImagesPaths = req.files?.additional_images?.map(file => 
      `/uploads/${file.filename}`
    ) || [];

    const product = await Product.create({
      name,
      related_name,
      description,
      original_height: original_height ? parseFloat(original_height) : null,
      original_width: original_width ? parseFloat(original_width) : null,
      original_length: original_length ? parseFloat(original_length) : null,
      parts_count: parts_count ? parseInt(parts_count) : 1,
      main_image: mainImagePath,
      additional_images: JSON.stringify(additionalImagesPaths),
      price_options: JSON.stringify(parsedPriceOptions),
      is_visible: Boolean(is_visible)
    });

    logger.info(`Товар создан: ${name} (ID: ${product.id})`);
    res.status(201).json({ success: true, product });
  } catch (error) {
    logger.error('Ошибка создания товара:', error);
    res.status(500).json({ error: 'Ошибка сервера при создании товара' });
  }
});

// Заказы API
app.get('/api/orders', async (req, res) => {
  try {
    const { user_id, admin, executor_id, search, status } = req.query;
    
    let whereClause = {};
    
    if (admin) {
      // Админ видит все заказы
    } else if (executor_id) {
      // Исполнитель видит назначенные ему заказы
      whereClause.assigned_executors = { [Op.like]: `%${executor_id}%` };
    } else if (user_id) {
      // Пользователь видит только свои заказы
      whereClause.user_id = parseInt(user_id);
    }
    
    if (search && search.trim()) {
      whereClause.id = parseInt(search.trim()) || 0;
    }
    
    if (status) {
      whereClause.status = status;
    }

    const orders = await Order.findAll({
      where: whereClause,
      order: [['created_date', 'DESC']],
      raw: true
    });

    const processedOrders = orders.map(order => {
      try {
        return {
          ...order,
          products: order.products ? JSON.parse(order.products) : [],
          assigned_executors: order.assigned_executors ? JSON.parse(order.assigned_executors) : []
        };
      } catch (parseError) {
        logger.warn(`Ошибка парсинга данных заказа ${order.id}:`, parseError);
        return {
          ...order,
          products: [],
          assigned_executors: []
        };
      }
    });

    logger.info(`Загружено заказов: ${processedOrders.length}`);
    res.json(processedOrders);
  } catch (error) {
    logger.error('Ошибка загрузки заказов:', error);
    res.status(500).json({ error: 'Ошибка сервера при загрузке заказов' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { user_id, products, total_price, notes } = req.body;

    if (!user_id || !products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Некорректные данные заказа' });
    }

    if (!total_price || total_price <= 0) {
      return res.status(400).json({ error: 'Некорректная сумма заказа' });
    }

    const order = await Order.create({
      user_id: parseInt(user_id),
      products: JSON.stringify(products),
      total_price: parseFloat(total_price),
      notes: notes || '',
      status: 'создан заказ'
    });

    logger.info(`Заказ создан: ID ${order.id} для пользователя ${user_id}`);
    res.status(201).json({ success: true, order });
  } catch (error) {
    logger.error('Ошибка создания заказа:', error);
    res.status(500).json({ error: 'Ошибка сервера при создании заказа' });
  }
});

// Пользователи API
app.get('/api/users', async (req, res) => {
  try {
    const { search, role_filter } = req.query;
    
    let whereClause = {};
    
    if (search && search.trim()) {
      const searchTerm = search.trim();
      whereClause[Op.or] = [
        { username: { [Op.iLike]: `%${searchTerm}%` } },
        { id: parseInt(searchTerm) || 0 }
      ];
    }
    
    if (role_filter) {
      whereClause.role = role_filter;
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      order: [['registration_date', 'DESC']],
      raw: true
    });

    logger.info(`Загружено пользователей: ${users.length}`);
    res.json(users);
  } catch (error) {
    logger.error('Ошибка загрузки пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера при загрузке пользователей' });
  }
});

// Настройки API
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await Settings.findOne();
    
    if (!settings) {
      // Создаем настройки по умолчанию
      const defaultSettings = await Settings.create({
        payment_info: 'Реквизиты для оплаты:\nБанковская карта: 1234 5678 9012 3456',
        price_coefficient: 5.25,
        discount_rules: '[]',
        show_discount_on_products: false
      });
      return res.json(defaultSettings);
    }

    res.json(settings);
  } catch (error) {
    logger.error('Ошибка загрузки настроек:', error);
    res.status(500).json({ error: 'Ошибка сервера при загрузке настроек' });
  }
});

// Резервное копирование API
app.get('/api/backup/all', async (req, res) => {
  try {
    const users = await User.findAll({ raw: true });
    const products = await Product.findAll({ raw: true });
    const orders = await Order.findAll({ raw: true });
    const settings = await Settings.findAll({ raw: true });

    const exportData = { users, products, orders, settings };
    logger.info('Данные экспортированы успешно');
    res.json(exportData);
  } catch (error) {
    logger.error('Ошибка экспорта данных:', error);
    res.status(500).json({ error: 'Ошибка сервера при экспорте данных' });
  }
});

app.post('/api/backup/restore', upload.single('backup_file'), async (req, res) => {
  let transaction;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл резервной копии не загружен' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    let importData;
    
    try {
      importData = JSON.parse(fileContent);
    } catch (parseError) {
      return res.status(400).json({ error: 'Неверный формат JSON файла' });
    }

    if (!importData || typeof importData !== 'object') {
      return res.status(400).json({ error: 'Некорректная структура данных' });
    }

    const requiredFields = ['users', 'products', 'orders'];
    const missingFields = requiredFields.filter(field => !importData[field] || !Array.isArray(importData[field]));
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Отсутствуют обязательные поля: ${missingFields.join(', ')}` 
      });
    }

    transaction = await sequelize.transaction();

    await Promise.all([
      User.destroy({ where: {}, transaction }),
      Product.destroy({ where: {}, transaction }),
      Order.destroy({ where: {}, transaction }),
      Settings.destroy({ where: {}, transaction })
    ]);

    const insertPromises = [];
    
    if (importData.users && importData.users.length > 0) {
      insertPromises.push(User.bulkCreate(importData.users, { transaction }));
    }
    
    if (importData.products && importData.products.length > 0) {
      insertPromises.push(Product.bulkCreate(importData.products, { transaction }));
    }
    
    if (importData.orders && importData.orders.length > 0) {
      insertPromises.push(Order.bulkCreate(importData.orders, { transaction }));
    }
    
    if (importData.settings && importData.settings.length > 0) {
      insertPromises.push(Settings.bulkCreate(importData.settings, { transaction }));
    }

    await Promise.all(insertPromises);
    await transaction.commit();

    try {
      fs.unlinkSync(req.file.path);
    } catch (fileError) {
      logger.warn('Ошибка удаления временного файла:', fileError);
    }

    logger.info('База данных восстановлена успешно');
    res.json({ 
      success: true, 
      message: 'База данных успешно восстановлена',
      imported: {
        users: importData.users.length,
        products: importData.products.length,
        orders: importData.orders.length,
        settings: importData.settings ? importData.settings.length : 0
      }
    });

  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error('Ошибка отката транзакции:', rollbackError);
      }
    }

    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (fileError) {
        logger.warn('Ошибка удаления временного файла:', fileError);
      }
    }

    logger.error('Ошибка восстановления базы данных:', error);
    res.status(500).json({ error: 'Ошибка сервера при восстановлении базы данных' });
  }
});

// Логи системы
app.get('/api/logs', (req, res) => {
  try {
    res.json({ 
      message: 'Система логирования работает корректно',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Ошибка получения логов:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении логов' });
  }
});

// Обработка ошибок загрузки файлов
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Файл слишком большой' });
    }
  }
  logger.error('Ошибка middleware:', error);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Обработка статических файлов и SPA роутинг
app.get('*', (req, res) => {
  try {
    const filePath = path.join(publicPath, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.sendFile(filePath);
    } else {
      res.sendFile(path.join(publicPath, 'index.html'));
    }
  } catch (error) {
    logger.error('Ошибка обработки маршрута:', error);
    res.status(500).send('Ошибка сервера');
  }
});

// Обработка 404 ошибок
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Глобальная обработка ошибок
app.use((err, req, res, next) => {
  logger.error('Глобальная ошибка:', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Сервер запущен на порту ${PORT}`);
  logger.info(`Статические файлы обслуживаются из: ${publicPath}`);
});