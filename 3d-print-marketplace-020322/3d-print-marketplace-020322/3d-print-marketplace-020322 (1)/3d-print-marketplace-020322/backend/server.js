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

// 允许跨域访问
app.use(helmet({
  contentSecurityPolicy: false,
  frameguard: false
}));
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  }
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(publicPath, 'uploads', 'avatars');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname);
    const fileName = `avatar_${Date.now()}_${uuidv4()}${fileExtension}`;
    cb(null, fileName);
  }
});

const avatarUpload = multer({ 
  storage: avatarStorage, 
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  }
});

// 作品集上传配置
const portfolioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const portfolioDir = path.join(publicPath, 'uploads', 'portfolio');
    if (!fs.existsSync(portfolioDir)) {
      fs.mkdirSync(portfolioDir, { recursive: true });
    }
    cb(null, portfolioDir);
  },
  filename: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname);
    const fileName = `portfolio_${Date.now()}_${uuidv4()}${fileExtension}`;
    cb(null, fileName);
  }
});

const portfolioUpload = multer({ 
  storage: portfolioStorage, 
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
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
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      len: [3, 50]
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [6, 255]
    }
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'buyer',
    validate: {
      isIn: [['buyer', 'executor', 'admin']]
    }
  },
  avatar: DataTypes.TEXT,
  city: DataTypes.STRING,
  birthday: DataTypes.STRING,
  notes: DataTypes.TEXT,
  initial_username: DataTypes.STRING
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'registration_date',
  updatedAt: 'updated_date'
});

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 255]
    }
  },
  related_name: DataTypes.STRING,
  description: DataTypes.TEXT,
  original_height: DataTypes.FLOAT,
  original_width: DataTypes.FLOAT,
  original_length: DataTypes.FLOAT,
  parts_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1
    }
  },
  main_image: DataTypes.TEXT,
  additional_images: DataTypes.TEXT,
  price_options: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  is_visible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  sales_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  favorites_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'products',
  timestamps: true,
  createdAt: 'created_date',
  updatedAt: 'updated_date'
});

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  products: DataTypes.TEXT,
  total_price: DataTypes.FLOAT,
  status: {
    type: DataTypes.STRING,
    defaultValue: 'создан заказ'
  },
  notes: DataTypes.TEXT,
  admin_notes: DataTypes.TEXT,
  assigned_executors: DataTypes.TEXT
}, {
  tableName: 'orders',
  timestamps: true,
  createdAt: 'created_date',
  updatedAt: 'updated_date'
});

const CustomRequest = sequelize.define('CustomRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  product_id: DataTypes.INTEGER,
  product_name: DataTypes.STRING,
  model_links: DataTypes.TEXT,
  additional_name: DataTypes.STRING,
  required_heights: DataTypes.TEXT,
  images: DataTypes.TEXT,
  status: {
    type: DataTypes.STRING,
    defaultValue: 'в обработке'
  },
  admin_notes: DataTypes.TEXT
}, {
  tableName: 'custom_requests',
  timestamps: true,
  createdAt: 'created_date',
  updatedAt: 'updated_date'
});

const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  from_user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  to_user_id: {
    type: DataTypes.INTEGER,  
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  message: DataTypes.TEXT
}, {
  tableName: 'chat_messages',
  timestamps: true,
  createdAt: 'created_date',
  updatedAt: false
});

const Settings = sequelize.define('Settings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  payment_info: DataTypes.TEXT,
  price_coefficient: {
    type: DataTypes.FLOAT,
    defaultValue: 5.25
  },
  discount_rules: DataTypes.TEXT,
  show_discount_on_products: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'settings',
  timestamps: false
});

const UserFavorite = sequelize.define('UserFavorite', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Product,
      key: 'id'
    }
  }
}, {
  tableName: 'user_favorites',
  timestamps: true,
  createdAt: 'created_date',
  updatedAt: false
});

const Portfolio = sequelize.define('Portfolio', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  image_path: DataTypes.TEXT
}, {
  tableName: 'portfolio',
  timestamps: true,
  createdAt: 'created_date',
  updatedAt: false
});

// 设置模型关联
User.hasMany(Order, { foreignKey: 'user_id' });
Order.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(CustomRequest, { foreignKey: 'user_id' });
CustomRequest.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(ChatMessage, { foreignKey: 'from_user_id', as: 'SentMessages' });
User.hasMany(ChatMessage, { foreignKey: 'to_user_id', as: 'ReceivedMessages' });
ChatMessage.belongsTo(User, { foreignKey: 'from_user_id', as: 'FromUser' });
ChatMessage.belongsTo(User, { foreignKey: 'to_user_id', as: 'ToUser' });

User.hasMany(UserFavorite, { foreignKey: 'user_id' });
Product.hasMany(UserFavorite, { foreignKey: 'product_id' });
UserFavorite.belongsTo(User, { foreignKey: 'user_id' });
UserFavorite.belongsTo(Product, { foreignKey: 'product_id' });

User.hasMany(Portfolio, { foreignKey: 'user_id' });
Portfolio.belongsTo(User, { foreignKey: 'user_id' });

// 数据库初始化函数
async function initDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('数据库连接成功');
    
    await sequelize.sync({ alter: false });
    logger.info('数据库表结构检查完成');

    const settingsExists = await Settings.findOne();
    if (!settingsExists) {
      await Settings.create({
        payment_info: 'Реквизиты для оплаты:\nБанковская карта: 1234 5678 9012 3456\nЯндекс.Деньги: 410011234567890\nQIWI: +79001234567',
        price_coefficient: 5.25,
        discount_rules: '[]',
        show_discount_on_products: false
      });
      logger.info('默认系统设置创建完成');
    }
  } catch (error) {
    logger.error('数据库初始化错误:', error.message);
  }
}

// 初始化数据库
initDatabase();

// API路由 - 用户管理
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['registration_date', 'DESC']],
      raw: true
    });
    
    logger.info(`获取用户列表: ${users.length} 条记录`);
    res.json(users);
  } catch (error) {
    logger.error('获取用户列表错误:', error.message);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const { search, role_filter } = req.query;
    let whereClause = {};
    
    if (search) {
      whereClause = {
        [Op.or]: [
          { id: { [Op.eq]: search } },
          { username: { [Op.iLike]: `%${search}%` } }
        ]
      };
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
    
    logger.info(`管理员获取用户列表: ${users.length} 条记录`);
    res.json(users);
  } catch (error) {
    logger.error('管理员获取用户列表错误:', error.message);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 修复用户资料更新
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // 移除不应更新的字段
    delete updateData.id;
    delete updateData.registration_date;
    delete updateData.updated_date;
    
    // 如果有密码字段，进行加密
    if (updateData.password) {
      updateData.password = bcrypt.hashSync(updateData.password, 10);
    }
    
    const [updatedRowsCount] = await User.update(updateData, {
      where: { id: parseInt(id) }
    });
    
    if (updatedRowsCount === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const updatedUser = await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });
    
    logger.info(`用户资料更新成功: ID ${id}`);
    res.json(updatedUser);
  } catch (error) {
    logger.error('用户资料更新错误:', error.message);
    res.status(500).json({ error: '更新用户资料失败' });
  }
});

// 修复用户删除
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 防止删除管理员账户
    if (parseInt(id) === 1) {
      return res.status(403).json({ error: 'Невозможно удалить администратора' });
    }
    
    const deletedRowsCount = await User.destroy({
      where: { id: parseInt(id) }
    });
    
    if (deletedRowsCount === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    logger.info(`用户删除成功: ID ${id}`);
    res.json({ message: 'Пользователь успешно удален' });
  } catch (error) {
    logger.error('用户删除错误:', error.message);
    res.status(500).json({ error: 'Ошибка удаления пользователя' });
  }
});

// API路由 - 头像上传修复
app.post('/api/upload/avatar', avatarUpload.single('avatar'), async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Файл аватара не найден' });
    }
    
    if (!user_id) {
      return res.status(400).json({ error: 'ID пользователя обязателен' });
    }

    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    
    // Обновляем аватар пользователя в базе данных
    const [updatedRowsCount] = await User.update(
      { avatar: avatarPath },
      { where: { id: parseInt(user_id) } }
    );
    
    if (updatedRowsCount === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    logger.info(`头像上传成功: 用户 ${user_id}, 文件 ${req.file.filename}`);
    res.json({ 
      success: true,
      avatar_path: avatarPath,
      message: 'Аватар успешно загружен'
    });
  } catch (error) {
    logger.error('头像上传错误:', error.message);
    res.status(500).json({ error: 'Ошибка загрузки аватара' });
  }
});

// 获取用户信息，包含正确的头像路径
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // 确保返回正确的头像路径
    const userData = {
      ...user.toJSON(),
      avatar: user.avatar ? user.avatar : null
    };
    
    logger.info(`获取用户信息成功: ID ${req.params.id}`);
    res.json(userData);
  } catch (error) {
    logger.error('获取用户信息错误:', error.message);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// API路由 - 作品集管理（修复核心功能）
app.get('/api/portfolio/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    
    if (!user_id || isNaN(parseInt(user_id))) {
      return res.status(400).json({ error: 'Некорректный ID пользователя' });
    }

    // 检查用户是否存在且是执行者
    const user = await User.findByPk(parseInt(user_id));
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.role !== 'executor') {
      return res.status(403).json({ error: 'Портфолио доступно только для исполнителей' });
    }

    const portfolio = await Portfolio.findAll({
      where: { user_id: parseInt(user_id) },
      order: [['created_date', 'DESC']],
      raw: true
    });
    
    logger.info(`获取作品集成功: 用户 ${user_id}, ${portfolio.length} 张图片`);
    res.json(portfolio);
  } catch (error) {
    logger.error('获取作品集错误:', error.message);
    res.status(500).json({ error: 'Ошибка при загрузке портфолио' });
  }
});

app.post('/api/portfolio', portfolioUpload.array('images', 20), async (req, res) => {
  try {
    const { user_id } = req.body;
    
    if (!user_id || isNaN(parseInt(user_id))) {
      return res.status(400).json({ error: 'Некорректный ID пользователя' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Не выбраны файлы для загрузки' });
    }

    // 检查用户权限
    const user = await User.findByPk(parseInt(user_id));
    if (!user || user.role !== 'executor') {
      return res.status(403).json({ error: 'Только исполнители могут загружать работы в портфолио' });
    }

    // 检查текущее количество изображений в портфолио
    const currentPortfolioCount = await Portfolio.count({
      where: { user_id: parseInt(user_id) }
    });

    if (currentPortfolioCount + req.files.length > 20) {
      return res.status(400).json({ error: 'Максимум 20 изображений в портфолио' });
    }

    // Создаем записи в базе данных для каждого загруженного файла
    const portfolioEntries = req.files.map(file => ({
      user_id: parseInt(user_id),
      image_path: `/uploads/portfolio/${file.filename}`
    }));

    const createdEntries = await Portfolio.bulkCreate(portfolioEntries);
    
    logger.info(`作品集图片上传成功: 用户 ${user_id}, ${req.files.length} 张图片`);
    res.status(201).json({
      success: true,
      message: 'Изображения успешно загружены',
      uploaded: createdEntries.length,
      images: createdEntries
    });
  } catch (error) {
    logger.error('作品集图片上传错误:', error.message);
    res.status(500).json({ error: 'Ошибка при загрузке изображений' });
  }
});

app.delete('/api/portfolio/:image_id', async (req, res) => {
  try {
    const { image_id } = req.params;
    
    if (!image_id || isNaN(parseInt(image_id))) {
      return res.status(400).json({ error: 'Некорректный ID изображения' });
    }

    const portfolioItem = await Portfolio.findByPk(parseInt(image_id));
    if (!portfolioItem) {
      return res.status(404).json({ error: 'Изображение не найдено' });
    }

    // 删除文件系统中的文件
    const imagePath = path.join(publicPath, portfolioItem.image_path);
    if (fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
        logger.info(`删除文件成功: ${imagePath}`);
      } catch (fileError) {
        logger.warn(`删除文件失败: ${imagePath}, 错误: ${fileError.message}`);
      }
    }

    // 从数据库删除记录
    await Portfolio.destroy({
      where: { id: parseInt(image_id) }
    });
    
    logger.info(`作品集图片删除成功: ID ${image_id}`);
    res.json({
      success: true,
      message: 'Изображение успешно удалено'
    });
  } catch (error) {
    logger.error('作品集图片删除错误:', error.message);
    res.status(500).json({ error: 'Ошибка при удалении изображения' });
  }
});

// API路由 - 订单管理
app.get('/api/orders', async (req, res) => {
  try {
    const { user_id, role, admin, search, status } = req.query;
    let whereClause = {};
    
    if (!admin && user_id) {
      whereClause.user_id = user_id;
    }
    
    if (search) {
      whereClause.id = search;
    }
    
    if (status) {
      whereClause.status = status;
    }

    const orders = await Order.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['id', 'username'],
          required: false
        }
      ],
      order: [['created_date', 'DESC']]
    });

    const processedOrders = orders.map(order => {
      const orderData = order.toJSON();
      
      if (orderData.products) {
        try {
          orderData.products = JSON.parse(orderData.products);
        } catch (e) {
          orderData.products = [];
        }
      }
      
      if (orderData.assigned_executors) {
        try {
          orderData.assigned_executors = JSON.parse(orderData.assigned_executors);
        } catch (e) {
          orderData.assigned_executors = [];
        }
      }
      
      return orderData;
    });
    
    logger.info(`获取订单列表: ${processedOrders.length} 条记录`);
    res.json(processedOrders);
  } catch (error) {
    logger.error('获取订单列表错误:', error.message);
    res.status(500).json({ error: '获取订单列表失败' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { user_id, products, total_price, notes } = req.body;
    
    if (!user_id || !products || !total_price) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const order = await Order.create({
      user_id,
      products: JSON.stringify(products),
      total_price,
      notes: notes || '',
      status: 'создан заказ'
    });
    
    logger.info(`创建订单: ID ${order.id}, 用户 ${user_id}`);
    res.status(201).json(order);
  } catch (error) {
    logger.error('创建订单错误:', error.message);
    res.status(500).json({ error: '创建订单失败' });
  }
});

// 修复订单状态更新
app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // 处理 assigned_executors 字段
    if (updateData.assigned_executors && typeof updateData.assigned_executors !== 'string') {
      updateData.assigned_executors = JSON.stringify(updateData.assigned_executors);
    }
    
    const [updatedRowsCount] = await Order.update(updateData, {
      where: { id: parseInt(id) }
    });
    
    if (updatedRowsCount === 0) {
      return res.status(404).json({ error: 'Заказ не найден' });
    }
    
    const updatedOrder = await Order.findByPk(id, {
      include: [
        {
          model: User,
          attributes: ['id', 'username'],
          required: false
        }
      ]
    });
    
    logger.info(`订单状态更新成功: ID ${id}`);
    res.json(updatedOrder);
  } catch (error) {
    logger.error('订单状态更新错误:', error.message);
    res.status(500).json({ error: '更新订单状态失败' });
  }
});

// API路由 - 系统设置
app.get('/api/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = await Settings.create({
        payment_info: 'Реквизиты для оплаты:\nБанковская карта: 1234 5678 9012 3456\nЯндекс.Деньги: 410011234567890\nQIWI: +79001234567',
        price_coefficient: 5.25,
        discount_rules: '[]',
        show_discount_on_products: false
      });
    }
    
    if (settings.discount_rules) {
      try {
        settings.discount_rules = JSON.parse(settings.discount_rules);
      } catch (e) {
        settings.discount_rules = [];
      }
    }
    
    logger.info('获取系统设置成功');
    res.json(settings);
  } catch (error) {
    logger.error('获取系统设置错误:', error.message);
    res.status(500).json({ error: '获取系统设置失败' });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const { payment_info, price_coefficient, discount_rules, show_discount_on_products } = req.body;
    
    let settings = await Settings.findOne();
    
    const updateData = {
      payment_info: payment_info || '',
      price_coefficient: parseFloat(price_coefficient) || 5.25,
      discount_rules: JSON.stringify(discount_rules || []),
      show_discount_on_products: Boolean(show_discount_on_products)
    };
    
    if (settings) {
      await settings.update(updateData);
    } else {
      settings = await Settings.create(updateData);
    }
    
    logger.info('更新系统设置成功');
    res.json({ message: '设置更新成功', settings });
  } catch (error) {
    logger.error('更新系统设置错误:', error.message);
    res.status(500).json({ error: '更新系统设置失败' });
  }
});

// API路由 - 商品管理
app.get('/api/products', async (req, res) => {
  try {
    const { search, filter, admin } = req.query;
    const whereClause = {};
    
    if (!admin) whereClause.is_visible = true;
    
    if (search) {
      const searchTerm = `%${search}%`;
      if (filter === 'description') {
        whereClause.description = { [Op.iLike]: searchTerm };
      } else if (filter === 'id') {
        whereClause.id = search;
      } else {
        whereClause.name = { [Op.iLike]: searchTerm };
      }
    }

    const products = await Product.findAll({
      where: whereClause,
      order: [['created_date', 'DESC']],
      raw: true
    });

    const settings = await Settings.findOne();
    const priceCoefficient = settings ? settings.price_coefficient : 5.25;

    const processedProducts = products.map(product => {
      if (product.price_options) {
        try {
          let priceOptions = JSON.parse(product.price_options);
          
          priceOptions = priceOptions.map(option => {
            const processedOption = { ...option };
            
            if (admin !== 'true') {
              delete processedOption.resin_ml;
            }
            
            if (processedOption.price) {
              processedOption.price = Math.round((processedOption.price / 5.25) * priceCoefficient);
            }
            
            return processedOption;
          });
          
          product.price_options = priceOptions;
        } catch (e) {
          product.price_options = [];
        }
      } else {
        product.price_options = [];
      }
      
      if (product.additional_images) {
        try {
          product.additional_images = JSON.parse(product.additional_images);
        } catch (e) {
          product.additional_images = [];
        }
      } else {
        product.additional_images = [];
      }
      
      return product;
    });
    
    logger.info(`获取商品列表: ${processedProducts.length} 条记录`);
    res.json(processedProducts);
  } catch (error) {
    logger.error('获取商品列表错误:', error.message);
    res.status(500).json({ error: '获取商品列表失败' });
  }
});

// 修复商品添加
app.post('/api/products', upload.fields([
  { name: 'main_image', maxCount: 1 },
  { name: 'additional_images', maxCount: 4 }
]), async (req, res) => {
  try {
    const { name, related_name, description, original_height, original_width, original_length, parts_count, price_options, is_visible } = req.body;
    
    // 验证必填字段
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название товара обязательно' });
    }
    
    if (!price_options) {
      return res.status(400).json({ error: 'Варианты цен обязательны' });
    }

    // 处理价格选项
    let parsedPriceOptions;
    try {
      parsedPriceOptions = JSON.parse(price_options);
      if (!Array.isArray(parsedPriceOptions) || parsedPriceOptions.length === 0) {
        return res.status(400).json({ error: 'Должен быть хотя бы один вариант цены' });
      }
    } catch (e) {
      return res.status(400).json({ error: 'Неверный формат вариантов цен' });
    }

    // 处理主图片
    let mainImagePath = null;
    if (req.files && req.files.main_image && req.files.main_image[0]) {
      mainImagePath = `/uploads/${req.files.main_image[0].filename}`;
    }

    // 处理附加图片
    let additionalImages = [];
    if (req.files && req.files.additional_images) {
      additionalImages = req.files.additional_images.map(file => `/uploads/${file.filename}`);
    }

    const productData = {
      name: name.trim(),
      related_name: related_name ? related_name.trim() : null,
      description: description ? description.trim() : null,
      original_height: original_height ? parseFloat(original_height) : null,
      original_width: original_width ? parseFloat(original_width) : null,
      original_length: original_length ? parseFloat(original_length) : null,
      parts_count: parts_count ? parseInt(parts_count) : 1,
      main_image: mainImagePath,
      additional_images: JSON.stringify(additionalImages),
      price_options: JSON.stringify(parsedPriceOptions),
      is_visible: is_visible !== undefined ? Boolean(is_visible) : true
    };

    const product = await Product.create(productData);
    
    logger.info(`商品创建成功: ID ${product.id}, 名称 ${product.name}`);
    res.status(201).json(product);
  } catch (error) {
    logger.error('创建商品错误:', error.message);
    res.status(500).json({ error: '创建商品失败' });
  }
});

// 修复商品删除
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Некорректный ID товара' });
    }

    const product = await Product.findByPk(parseInt(id));
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    // 删除商品相关的收藏记录
    await UserFavorite.destroy({
      where: { product_id: parseInt(id) }
    });

    // 删除商品
    await Product.destroy({
      where: { id: parseInt(id) }
    });
    
    logger.info(`商品删除成功: ID ${id}`);
    res.json({ 
      success: true,
      message: 'Товар успешно удален'
    });
  } catch (error) {
    logger.error('商品删除错误:', error.message);
    res.status(500).json({ error: 'Ошибка при удалении товара' });
  }
});

// API路由 - 收藏功能
app.post('/api/favorites/toggle', async (req, res) => {
  try {
    const { user_id, product_id } = req.body;
    
    if (!user_id || !product_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const existingFavorite = await UserFavorite.findOne({
      where: { user_id, product_id }
    });

    let is_favorite = false;

    if (existingFavorite) {
      await existingFavorite.destroy();
      
      await Product.decrement('favorites_count', {
        where: { id: product_id }
      });
      
      is_favorite = false;
    } else {
      await UserFavorite.create({ user_id, product_id });
      
      await Product.increment('favorites_count', {
        where: { id: product_id }
      });
      
      is_favorite = true;
    }
    
    logger.info(`用户 ${user_id} ${is_favorite ? '添加' : '取消'} 商品 ${product_id} 收藏`);
    res.json({ is_favorite, message: is_favorite ? '已添加到收藏' : '已取消收藏' });
  } catch (error) {
    logger.error('切换收藏状态错误:', error.message);
    res.status(500).json({ error: '操作失败' });
  }
});

app.get('/api/favorites/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    
    const favorites = await UserFavorite.findAll({
      where: { user_id },
      include: [
        {
          model: Product,
          required: true
        }
      ]
    });

    const favoriteProducts = favorites.map(fav => {
      const product = fav.Product.toJSON();
      
      if (product.price_options) {
        try {
          product.price_options = JSON.parse(product.price_options);
        } catch (e) {
          product.price_options = [];
        }
      }
      
      if (product.additional_images) {
        try {
          product.additional_images = JSON.parse(product.additional_images);
        } catch (e) {
          product.additional_images = [];
        }
      }
      
      return product;
    });
    
    logger.info(`获取用户 ${user_id} 的收藏列表: ${favoriteProducts.length} 条记录`);
    res.json(favoriteProducts);
  } catch (error) {
    logger.error('获取收藏列表错误:', error.message);
    res.status(500).json({ error: '获取收藏列表失败' });
  }
});

// API路由 - 聊天功能（修复排序）
app.get('/api/chat/messages', async (req, res) => {
  try {
    const { user_id, with_user_id, limit = 100 } = req.query;
    
    if (!user_id || !with_user_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const messages = await ChatMessage.findAll({
      where: {
        [Op.or]: [
          { from_user_id: user_id, to_user_id: with_user_id },
          { from_user_id: with_user_id, to_user_id: user_id }
        ]
      },
      include: [
        {
          model: User,
          as: 'FromUser',
          attributes: ['id', 'username']
        }
      ],
      order: [['created_date', 'DESC']], // 修复：按最新消息排序
      limit: parseInt(limit)
    });

    const processedMessages = messages.map(msg => {
      const msgData = msg.toJSON();
      return {
        id: msgData.id,
        content: msgData.message,
        sender_id: msgData.from_user_id,
        receiver_id: msgData.to_user_id,
        sender_name: msgData.FromUser ? msgData.FromUser.username : 'Unknown',
        created_at: msgData.created_date
      };
    }).reverse(); // 反转以获得正确的时间顺序用于显示
    
    logger.info(`获取聊天消息: 用户 ${user_id} 与 ${with_user_id}, ${processedMessages.length} 条消息`);
    res.json(processedMessages);
  } catch (error) {
    logger.error('获取聊天消息错误:', error.message);
    res.status(500).json({ error: '获取聊天消息失败' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { from_user_id, to_user_id, message } = req.body;
    
    if (!from_user_id || !to_user_id || !message) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const chatMessage = await ChatMessage.create({
      from_user_id,
      to_user_id,
      message: message.trim()
    });
    
    const fromUser = await User.findByPk(from_user_id, {
      attributes: ['id', 'username']
    });
    
    const responseData = {
      id: chatMessage.id,
      message: chatMessage.message,
      from_user_id: chatMessage.from_user_id,
      to_user_id: chatMessage.to_user_id,
      from_username: fromUser ? fromUser.username : 'Unknown',
      created_date: chatMessage.created_date
    };
    
    logger.info(`发送聊天消息: 从用户 ${from_user_id} 到用户 ${to_user_id}`);
    res.status(201).json({ data: responseData });
  } catch (error) {
    logger.error('发送聊天消息错误:', error.message);
    res.status(500).json({ error: '发送消息失败' });
  }
});

// 修复邮件广播API
app.post('/api/chat/broadcast', async (req, res) => {
  try {
    const { message, from_user_id } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }
    
    if (!from_user_id) {
      return res.status(400).json({ error: 'ID отправителя обязателен' });
    }

    // 获取所有用户（除了发送者）
    const users = await User.findAll({
      where: {
        id: { [Op.ne]: from_user_id }
      },
      attributes: ['id', 'username']
    });

    if (users.length === 0) {
      return res.status(404).json({ error: 'Нет пользователей для рассылки' });
    }

    // 创建广播消息给所有用户
    const broadcastMessages = users.map(user => ({
      from_user_id: parseInt(from_user_id),
      to_user_id: user.id,
      message: message.trim()
    }));

    await ChatMessage.bulkCreate(broadcastMessages);
    
    logger.info(`广播消息发送成功: 从用户 ${from_user_id} 到 ${users.length} 个用户`);
    res.status(201).json({
      message: 'Рассылка отправлена успешно',
      count: broadcastMessages.length,
      recipients: users.length
    });
  } catch (error) {
    logger.error('广播消息错误:', error.message);
    res.status(500).json({ error: 'Ошибка при отправке рассылки' });
  }
});

// API路由 - 用户注册和登录
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Имя пользователя обязательно' });
    }
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }
    
    const cleanUsername = username.trim();
    
    if (cleanUsername.length < 3 || cleanUsername.length > 50) {
      return res.status(400).json({ error: 'Имя пользователя должно содержать от 3 до 50 символов' });
    }

    const existingUser = await User.findOne({ where: { username: cleanUsername } });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
    }

    const userCount = await User.count();
    const isFirstUser = userCount === 0;

    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const userRole = isFirstUser ? 'admin' : (role && ['buyer', 'executor'].includes(role) ? role : 'buyer');
    
    const userData = {
      username: cleanUsername,
      password: hashedPassword,
      role: userRole,
      initial_username: cleanUsername
    };

    if (isFirstUser) {
      userData.id = 1;
    }

    const user = await User.create(userData);
    
    const userResponse = {
      id: user.id,
      username: user.username,
      role: user.role,
      registration_date: user.registration_date
    };
    
    logger.info(`用户注册成功: ID ${user.id}, username: ${user.username}, role: ${user.role}${isFirstUser ? ' (首个管理员)' : ''}`);
    
    res.status(201).json({ 
      message: `Пользователь успешно зарегистрирован${isFirstUser ? ' как администратор' : ''}`,
      user: userResponse
    });
    
  } catch (error) {
    logger.error('用户注册错误:', error.message);
    
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
    }
    
    if (error.name === 'SequelizeValidationError') {
      const validationErrors = error.errors.map(err => err.message);
      return res.status(400).json({ error: `Ошибка валидации: ${validationErrors.join(', ')}` });
    }
    
    res.status(500).json({ error: 'Произошла ошибка при регистрации пользователя' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !username.trim() || !password) {
      return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }

    const user = await User.findOne({ 
      where: { username: username.trim() },
      raw: true
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    const { password: userPassword, ...userInfo } = user;
    
    logger.info(`用户登录成功: ${user.username} (ID: ${user.id})`);
    res.status(200).json({
      message: 'Вход выполнен успешно',
      user: userInfo
    });

  } catch (error) {
    logger.error('登录错误:', error.message);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

// API路由 - 自定义请求管理
app.get('/api/custom-requests', async (req, res) => {
  try {
    const { user_id, role } = req.query;
    let whereClause = {};
    
    if (role !== 'admin' && user_id) {
      whereClause.user_id = user_id;
    }

    const requests = await CustomRequest.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['id', 'username'],
          required: false
        }
      ],
      order: [['created_date', 'DESC']]
    });
    
    logger.info(`获取自定义请求列表: ${requests.length} 条记录`);
    res.json(requests);
  } catch (error) {
    logger.error('获取自定义请求列表错误:', error.message);
    res.status(500).json({ error: '获取请求列表失败' });
  }
});

app.post('/api/custom-requests', upload.array('images', 3), async (req, res) => {
  try {
    const { user_id, product_name, additional_name, product_id, model_links, required_heights } = req.body;
    
    if (!user_id || !product_name || !product_name.trim()) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 处理上传的图片
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map(file => `/uploads/${file.filename}`);
    }

    const requestData = {
      user_id: parseInt(user_id),
      product_name: product_name.trim(),
      additional_name: additional_name ? additional_name.trim() : null,
      product_id: product_id ? parseInt(product_id) : null,
      model_links: model_links || null,
      required_heights: required_heights || null,
      images: images.length > 0 ? JSON.stringify(images) : null,
      status: 'в обработке'
    };

    const customRequest = await CustomRequest.create(requestData);
    
    logger.info(`创建自定义请求成功: ID ${customRequest.id}, 用户 ${user_id}`);
    res.status(201).json(customRequest);
  } catch (error) {
    logger.error('创建自定义请求错误:', error.message);
    res.status(500).json({ error: '创建请求失败' });
  }
});

// 修复测量申请状态更新
app.put('/api/custom-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Некорректный ID заявки' });
    }

    const customRequest = await CustomRequest.findByPk(parseInt(id));
    if (!customRequest) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    const [updatedRowsCount] = await CustomRequest.update(updateData, {
      where: { id: parseInt(id) }
    });
    
    if (updatedRowsCount === 0) {
      return res.status(404).json({ error: 'Заявка не найдена или не обновлена' });
    }
    
    const updatedRequest = await CustomRequest.findByPk(parseInt(id), {
      include: [
        {
          model: User,
          attributes: ['id', 'username'],
          required: false
        }
      ]
    });
    
    logger.info(`测量申请状态更新成功: ID ${id}`);
    res.json(updatedRequest);
  } catch (error) {
    logger.error('测量申请状态更新错误:', error.message);
    res.status(500).json({ error: 'Ошибка при обновлении статуса заявки' });
  }
});

// 异常日志收集
app.get('/logs', (req, res) => {
  res.json({ message: '日志功能正常运行' });
});

// 处理前端路由
app.get('*', (req, res) => {
  try {
    const filePath = path.join(publicPath, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.sendFile(filePath);
    } else {
      res.sendFile(path.join(publicPath, 'index.html'));
    }
  } catch (error) {
    logger.error('路由处理错误:', error.message);
    res.status(404).send('页面不存在');
  }
});

// 处理404错误
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 全局错误处理
app.use((err, req, res, next) => {
  logger.error('全局错误:', err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`服务器启动成功，端口: ${PORT}`);
});