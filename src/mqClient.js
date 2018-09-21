/**
 * @description rabbitmq client
 * @author yq
 * @date 2018/8/13 下午2:12
 */
const { EventEmitter } = require('events');
const amqp = require('amqplib');

// connect status
const CONNECT_STATUS = {
  // 被销毁
  destroyed: -10,
  // 未连接
  unconnected: 0,
  // 连接中
  connecting: 1,
  // 已连接
  connected: 10
};

const RETRY_COUNT = 1000;

class MqClient extends EventEmitter {
  constructor({
                protocol = 'amqp',
                hostname = 'localhost',
                port = 5672,
                username = 'guest',
                password = 'guest',
                heartbeat = 0,
                vhost = '/',
              }) {
    super();
    this.mqConnect = null; // rabbitmq connect
    this.status = CONNECT_STATUS.unconnected; // connection status
    this.reconnectCount = 0; // 重连次数
    this.protocol = protocol;
    // server id
    this.id = `${hostname}:${port}`;
    // server ip
    this.hostname = hostname;
    // server port
    this.port = port;
    // account
    this.username = username;
    // password
    this.password = password;
    this.heartbeat = heartbeat;
    this.vhost = vhost ? encodeURIComponent(vhost) : '/';
    this.queues = {}; // the queues
    this.channels = {}; // the channels
    this.consumes = {}; // the consumes
  }

  /**
   * is the client connected
   * @returns {boolean}
   */
  isConnected() {
    return this.status === CONNECT_STATUS.connected;
  }

  /**
   * connect listener
   */
  connectListener() {
    this.removeAllListeners();
    // monitory the retry connect event
    this.once('retryConnect', () => {
      if (this.reconnectCount >= RETRY_COUNT) {
        console.info(`MQ connect[${this.id}] connect failed and exceed the max retry times`);
        return;
      }
      console.info(`MQ connect[${this.id}] was disconnected and retry to connect again`);
      // 连接已建立
      if (this.status === CONNECT_STATUS.connected) {
        console.info('MQ connection has been connected and ignore this reconnection');
        return;
      }
      // 忽略被销毁的节点
      if (this.status === CONNECT_STATUS.destroyed) {
        console.info(`MQ connect[${this.id}] was destroyed and ignore this reconnection`);
        return;
      }
      // 忽略正在连接的节点
      if (this.status === CONNECT_STATUS.connecting) {
        console.info(`MQ connect[${this.id}] is connecting... and ignore this reconnection`);
        return;
      }
      this.status = CONNECT_STATUS.connecting;
      setTimeout(() => {
        this.reconnectCount += 1; // 重连次数加1
        this.createConnect().catch((err) => {
          console.error('create connection error:', err);
        });
      }, 1000 * this.reconnectCount);
    });
  }

  resetConnectStatus() {
    this.mqConnect = null;
    this.status = CONNECT_STATUS.unconnected;
    this.emit('retryConnect');
  }

  /**
   * 连接监听器
   */
  connectMonitor() {
    this.mqConnect.once('close', (err) => {
      console.error(`MQ connect closed:${err.message}`, err.stack || err);
      this.resetConnectStatus();
    });
    this.mqConnect.once('error', (err) => {
      console.error(`MQ connect error:${err.message}`, err.stack || err);
      this.resetConnectStatus();
    });
  }

  /**
   * 创建connect
   */
  async createConnect() {
    try {
      if (this.status === CONNECT_STATUS.destroyed) {
        console.info(`MQ connect[${this.id}] was destroyed.`);
        return;
      }
      if (this.status === CONNECT_STATUS.connected) {
        console.info(`MQ connect[${this.id}] is created.`);
        return;
      }
      console.info(`MQ connect[${this.id}] is creating.`);
      // 启动事件监听
      this.connectListener();
      // 创建连接
      this.mqConnect = await amqp.connect({
        protocol: this.protocol,
        hostname: this.hostname,
        port: this.port,
        username: this.username,
        password: this.password,
        heartbeat: this.heartbeat,
        vhost: this.vhost,
      });
      this.status = CONNECT_STATUS.connected;
      console.info(`MQ connect[${this.id}] is created.`);
      this.reconnectCount = 0; // 重置重连次数
      this.connectMonitor();
      // 重试初始化该链接下的所有channel
      this.resetChannels().catch((err) => {
        console.log('reset channel failed：', err);
      });
    } catch (err) {
      console.error(`MQ connect[${this.id}] error:${err.message}`, err.stack || err);
      this.status = CONNECT_STATUS.unconnected;
      this.emit('retryConnect');
    }
  }

  resetChannelStatus(channelName) {
    console.log('重置channel:', channelName);
    this.channels[channelName].status = CONNECT_STATUS.unconnected;
    // channel 出现问题延迟5秒重试，避免因连接错误引起的频繁重试
    setTimeout(() => this.retryCreateChannel(channelName), 5000);
  }

  /**
   * 新建channel实例
   *
   * @param channelName the channel name
   *
   * @returns {*}
   */
  async createChannel(channelName) {
    if (!this.mqConnect || this.status !== CONNECT_STATUS.connected) throw new Error('MQ is disconnected');
    this.channels[channelName] = this.channels[channelName] || {};
    if (this.status !== CONNECT_STATUS.connected) {
      throw new Error(`MQ connect[${this.id}] is closed and ignore this create channel.`);
    }
    if (this.channels[channelName].status === CONNECT_STATUS.connected) {
      console.log(`the channel [${channelName}] has been created`);
      return this.channels[channelName].channel;
    }
    if (this.channels[channelName].status === CONNECT_STATUS.connecting) {
      throw new Error(`the channel [${channelName}] is creating`);
    }
    try {
      console.info(`创建channel[${channelName}]`);
      this.channels[channelName].status = CONNECT_STATUS.connecting;
      this.channels[channelName].channel = await this.mqConnect.createChannel();
      this.channels[channelName].status = CONNECT_STATUS.connected;
      this.channels[channelName].channel.on('close', () => {
        console.error('the channel %s was closed!', channelName);
        this.resetChannelStatus(channelName);
      });
      this.channels[channelName].channel.on('error', (err) => {
        console.error('the channel %s error:', channelName, err);
        this.resetChannelStatus(channelName);
      });
      return this.channels[channelName].channel;
    } catch (err) {
      console.error(`create the channel[${channelName}] error:`, err);
      this.channels[channelName].status = CONNECT_STATUS.unconnected;
      throw err;
    }
  }

  /**
   * 新建channel实例
   *
   * @param channelName the channel name
   *
   * @returns {*}
   */
  async retryCreateChannel(channelName, extras = { retryCount: 0 }) {
    if (this.channels[channelName].status === CONNECT_STATUS.connected) {
      console.log(`the channel [${channelName}] has been created and ignore this retry create channel`);
      return;
    }
    try {
      await this.createChannel(channelName);
      // 重置channel下的queue
      this.resetQueues(channelName).catch((err) => {
        console.error('reset channel failed：', err);
      });
      // 重置channel下的consume
      this.resetConsumes(channelName).catch((err) => {
        console.error('reset channel successful：', err);
      });
    } catch (e) {
      if (this.channels[channelName].status === CONNECT_STATUS.connected) {
        console.error(`queue or consume of channel[${channelName}] create failed:`, e);
        return;
      }
      console.error(`channel[${channelName}] create failed:`, e);
      extras.retryCount = typeof extras.retryCount === 'number' ? extras.retryCount += 1 : 0;
      if (extras.retryCount > 10) {
        console.error(`channel[${channelName}] create failed and exceed the max retry times`);
        throw e;
      }
      await new Promise(resolve => setTimeout(resolve, extras.retryCount * 1000));
      await this.retryCreateChannel(channelName, extras);
    }
  }

  /**
   * 重置链接下channels
   * @returns {Promise<void>}
   */
  async resetChannels() {
    // 重试初始化该链接下的所有channel
    const channelPromises = [];
    const channelNames = Object.keys(this.channels);
    if (channelNames.length > 0) {
      for (const channelName of channelNames) {
        // 状态置为未连接
        this.channels[channelName].status = CONNECT_STATUS.unconnected;
        // 初始化队列
        channelPromises.push(this.retryCreateChannel(channelName)
          .catch((err) => {
            console.error('Create channel failed：', err);
          })
        );
      }
      await Promise.all(channelPromises)
        .then(() => {
          console.log('Reset channel successful');
        })
        .catch((err) => {
          console.error('Reset channel failed：', err);
        });
    }
  }

  /**
   * 新建队列
   * @param queueChannelName 队列channel名称
   * @param queueName 队列名称
   * @param config 队列配置信息
   * @returns {Promise<void>}
   */
  async createQueue(queueChannelName, queueName, queueConfig = {}) {
    this.queues[queueChannelName][queueName] = this.queues[queueChannelName][queueName] || {};
    if (this.queues[queueChannelName][queueName].status === CONNECT_STATUS.connected) {
      console.log(`the queue[${queueChannelName}-${queueName}] is created`);
      return;
    }
    if (this.queues[queueChannelName][queueName].status === CONNECT_STATUS.connecting) {
      throw new Error(`the queue[${queueChannelName}-${queueName}] is creating`);
    }
    try {
      this.queues[queueChannelName][queueName].queueConfig = queueConfig;
      this.queues[queueChannelName][queueName].status = CONNECT_STATUS.connecting;
      const channel = await this.createChannel(queueChannelName);
      await channel.assertQueue(queueName, queueConfig);
      this.queues[queueChannelName][queueName].status = CONNECT_STATUS.connected;
    } catch (err) {
      console.error(`create the queue[${queueChannelName}-${queueName}] error:`, err);
      this.queues[queueChannelName][queueName].status = CONNECT_STATUS.unconnected;
      throw err;
    }
  }

  /**
   * 重新新建队列
   *
   * @param channelName the channel name
   *
   * @returns {*}
   */
  async retryCreateQueue(channelName, queueName, extras = { retryCount: 0 }) {
    try {
      // 初始化队列
      const { queueConfig } = this.queues[channelName][queueName];
      await this.createQueue(channelName, queueName, queueConfig);
    } catch (e) {
      console.error(`queue[${channelName}-${queueName}] create failed:`, e);
      extras.retryCount = typeof extras.retryCount === 'number' ? extras.retryCount += 1 : 0;
      if (extras.retryCount > 10) {
        console.error(`queue[${channelName}-${queueName}] create failed and exceed the max retry times`);
        throw e;
      }
      await new Promise(resolve => setTimeout(resolve, extras.retryCount * 1000));
      await this.retryCreateQueue(channelName, queueName, extras);
    }
  }

  /**
   * 重置channel下的队列
   * @param channelName
   * @returns {Promise<void>}
   */
  async resetQueues(channelName) {
    if (!this.queues[channelName]) return;
    // 重试初始化该链接下的所有channel
    const queuePromises = [];
    const queueNames = Object.keys(this.queues[channelName]);
    if (queueNames.length > 0) {
      for (const queueName of queueNames) {
        if (this.queues[channelName][queueName].queueConfig && this.queues[channelName][queueName].queueConfig.durable) {
          // 持久化的队列不进行重建操作
          continue;
        }
        // 重置队列状态状态
        this.queues[channelName][queueName].status = CONNECT_STATUS.unconnected;
        // 初始化队列
        queuePromises.push(this.retryCreateQueue(channelName, queueName, this.queues[channelName][queueName].queueConfig)
          .catch((err) => {
            console.error('create queue failed：', err);
            this.queues[channelName][queueName].status = CONNECT_STATUS.unconnected;
          })
        );
      }
      if (queuePromises.length > 0) {
        await Promise.all(queuePromises)
          .then(() => {
            console.log('reset queue successful');
          })
          .catch((err) => {
            console.error('reset queue failed：', err);
          });
      }
    }
  }

  /**
   * 新建交换机
   * @param exchangeChannelName 队列channel名称
   * @param exchangeName 队列名称
   * @param config 队列配置信息
   * @returns {Promise<void>}
   */
  async createExchange(exchangeChannelName, exchangeName, exchangeConfig = {}) {
    this.exchanges[exchangeChannelName][exchangeName] = this.exchanges[exchangeChannelName][exchangeName] || {};
    if (this.exchanges[exchangeChannelName][exchangeName].status === CONNECT_STATUS.connected) {
      console.log(`the exchange[${exchangeChannelName}-${exchangeName}] is created`);
      return;
    }
    if (this.exchanges[exchangeChannelName][exchangeName].status === CONNECT_STATUS.connecting) {
      throw new Error(`the exchange[${exchangeChannelName}-${exchangeName}] is creating`);
    }
    try {
      this.exchanges[exchangeChannelName][exchangeName].exchangeConfig = exchangeConfig;
      this.exchanges[exchangeChannelName][exchangeName].status = CONNECT_STATUS.connecting;
      const channel = await this.createChannel(exchangeChannelName);
      await channel.assertQueue(exchangeName, exchangeConfig);
      this.exchanges[exchangeChannelName][exchangeName].status = CONNECT_STATUS.connected;
    } catch (err) {
      console.error(`create the exchange[${exchangeChannelName}-${exchangeName}] error:`, err);
      this.exchanges[exchangeChannelName][exchangeName].status = CONNECT_STATUS.unconnected;
      throw err;
    }
  }

  /**
   * 重新新建队列
   *
   * @param channelName the channel name
   *
   * @returns {*}
   */
  async retryCreateExchange(channelName, exchangeName, extras = { retryCount: 0 }) {
    try {
      // 初始化队列
      const { exchangeConfig } = this.exchanges[channelName][exchangeName];
      await this.createQueue(channelName, exchangeName, exchangeConfig);
    } catch (e) {
      console.error(`exchange[${channelName}-${exchangeName}] create failed:`, e);
      extras.retryCount = typeof extras.retryCount === 'number' ? extras.retryCount += 1 : 0;
      if (extras.retryCount > 10) {
        console.error(`exchange[${channelName}-${exchangeName}] create failed and exceed the max retry times`);
        throw e;
      }
      await new Promise(resolve => setTimeout(resolve, extras.retryCount * 1000));
      await this.retryCreateQueue(channelName, exchangeName, extras);
    }
  }

  /**
   * 重置channel下的队列
   * @param channelName
   * @returns {Promise<void>}
   */
  async resetExchanges(channelName) {
    if (!this.exchanges[channelName]) return;
    // 重试初始化该链接下的所有channel
    const exchangePromises = [];
    const exchangeNames = Object.keys(this.exchanges[channelName]);
    if (exchangeNames.length > 0) {
      for (const exchangeName of exchangeNames) {
        if (this.exchanges[channelName][exchangeName].exchangeConfig && this.exchanges[channelName][exchangeName].exchangeConfig.durable) {
          // 持久化的队列不进行重建操作
          continue;
        }
        // 重置队列状态状态
        this.exchanges[channelName][exchangeName].status = CONNECT_STATUS.unconnected;
        // 初始化队列
        exchangePromises.push(this.retryCreateQueue(channelName, exchangeName, this.exchanges[channelName][exchangeName].exchangeConfig)
          .catch((err) => {
            console.error('create exchange failed：', err);
            this.exchanges[channelName][exchangeName].status = CONNECT_STATUS.unconnected;
          })
        );
      }
      if (exchangePromises.length > 0) {
        await Promise.all(exchangePromises)
          .then(() => {
            console.log('reset exchange successful');
          })
          .catch((err) => {
            console.error('reset exchange failed：', err);
          });
      }
    }
  }

  async subscribe(exchangeName, callback) {
    const channel = this.createChannel(exchangeName + "-subscribe");
    opts.queueConfig = opts.queueConfig || { exclusive: false }; // 默认自动删除
    opts.exchangeConfig = opts.exchangeConfig || { durable: false }; // 默认不存储消息
    // durable 消息是否持久化
    await channel.assertExchange(exchangeName, exchangeType, opts.exchangeConfig);
    // exclusive 连接断掉，节点会不会自动删除
    const queueResult = await channel.assertQueue(opts.queueConfig.queueName, { exclusive: true });
    await channel.bindQueue(queueResult.queue, exchangeName, '');
  }

  /**
   * 新建消费者
   * @param queueName
   * @param opts
   * @param callback
   * @returns {Promise<void>}
   */
  async consume(queueName, opts = {}, callback) {
    const consumeChannelName = `${queueName}-consume`;
    this.consumes[consumeChannelName] = this.consumes[consumeChannelName] || {};
    if (this.consumes[consumeChannelName].status === CONNECT_STATUS.connected) {
      console.log(`the consume[${consumeChannelName}] is created`);
      return;
    }
    if (this.consumes[consumeChannelName].status === CONNECT_STATUS.connecting) {
      throw new Error(`the consume[${consumeChannelName}] is creating`);
    }
    try {
      Object.assign(this.consumes[consumeChannelName], {
        status: CONNECT_STATUS.connecting,
        queueName,
        prefetch: opts.prefetch,
        consumeConfig: opts.consumeConfig || {},
        callback: callback,
      });
      const channel = await this.createChannel(consumeChannelName);
      // 队列数
      if (opts.prefetch) {
        await channel.prefetch(opts.prefetch);
      }
      await channel.consume(queueName, msg => callback(channel, msg), this.consumes[consumeChannelName].consumeConfig);
      this.consumes[consumeChannelName].status = CONNECT_STATUS.connected;
    } catch (err) {
      console.error('create the consume error:', err);
      this.consumes[consumeChannelName].status = CONNECT_STATUS.unconnected;
      throw err;
    }
  }

  /**
   * 重新绑定consume
   *
   * @param channelName the channel name
   *
   * @returns {*}
   */
  async retryConsume(consumeName, extras = { retryCount: 0 }) {
    try {
      // 初始化队列
      const { queueName, prefetch, consumeConfig, callback } = this.consumes[consumeName];
      await this.consume(queueName, {
        prefetch,
        consumeConfig
      }, callback);
    } catch (e) {
      console.error(`consume[${consumeName}] create failed:`, e);
      extras.retryCount = typeof extras.retryCount === 'number' ? extras.retryCount += 1 : 0;
      if (extras.retryCount > 10) {
        console.error(`consume[${consumeName}] create failed and exceed the max retry times`);
        throw e;
      }
      await new Promise(resolve => setTimeout(resolve, extras.retryCount * 1000));
      await this.retryConsume(consumeName, extras);
    }
  }

  /**
   * 重置channel下的consume
   * @param channelName
   * @returns {Promise<void>}
   */
  async resetConsumes(channelName) {
    if (!this.consumes[channelName]) return;
    // 重置消费者状态
    this.consumes[channelName].status = CONNECT_STATUS.unconnected;
    // 初始化consume
    this.retryConsume(channelName)
      .catch((err) => {
        console.error('create consume failed：', err);
      });
  }

  /**
   * 删除客户端服务实例
   *
   * @param  {String} channelName 服务名称
   */
  removeChannel(channelName) {
    if (this.channels[channelName]) {
      delete this.channels[channelName];
    }
  }

  /**
   * 销毁实例
   */
  destroy() {
    try {
      console.debug(`Destroy the MQ connection: [${this.id}]`);
      // 置状态为删除
      this.status = CONNECT_STATUS.destroyed;
      // 清除所有监听器
      this.removeAllListeners();
      if (this.mqConnect) {
        this.channels = {};
        this.mqConnect.close();
      }
    } catch (err) {
      console.error(`Destroy the MQ connection [${this.id}] error：`, err.stack || err);
    }
  }
}

module.exports = MqClient;
