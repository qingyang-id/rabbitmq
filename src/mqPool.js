/**
 * @description rabbitmq connection pool
 * @author yq
 * @date 2018/7/13 下午4:13
 */
const MqClient = require('./mqClient');

class MqPool {
  constructor() {
    /**
     * mq clients;
     */
    this.mqClients = [];
    // mq config
    this.mqs = [{
      protocol: 'amqp',
      hostname: 'localhost',
      port: 6672,
      username: 'guest',
      password: 'guest',
      heartbeat: 0,
      vhost: '/',
    }];
    // this.mqs = [{
    //   protocol: 'amqp',
    //   hostname: '47.91.173.253',
    //   port: 5672,
    //   username: 'dev',
    //   password: 'TokenClub2018',
    //   heartbeat: 0,
    //   vhost: '/',
    // }];
    this.connectStatus = 0; // 1连接创建中，2连接已建立
    this.init();
  }

  // 静态方法实现懒汉单例模式
  static getInstance() {
    if (!MqPool.instance) {
      console.log('初始化。。。。。')
      MqPool.instance = new MqPool();
    }
    return MqPool.instance;
  }

  /**
   * init client
   */
  init() {
    this.connectStatus = 1; // 连接建立中
    const mqClients = [];
    for (let i = 0; i < this.mqs.length; i += 1) {
      const client = new MqClient(this.mqs[i]);
      mqClients.push(client.createConnect());
      this.mqClients.push({
        name: `${this.mqs[i].hostname}:${this.mqs[i].port}}`,
        connectCount: 0, // The connect total count
        client
      });
    }
    Promise.all(mqClients)
      .then(() => {
        this.connectStatus = 2; // 已建立
      });
  }

  /**
   * 等待服务初始化完成
   * @param waitTime
   * @returns {*}
   * @private
   */
  async waitingCreate({ waitTime = 0 }) {
    // 服务已创建
    if (this.connectStatus === 2) {
      return null;
    }
    if (waitTime >= 30000) {
      throw new Error('请求超时，请检查mq是否正常启动');
    }
      await new Promise(((resolve, reject) => {
        setTimeout(() => {
          console.info(`等待服务建立连接，已等待${waitTime}秒`);
          this.waitingCreate({ waitTime: waitTime + 1000 })
            .then(resolve)
            .catch(reject);
        }, 1000);
      }));
  }

  /**
   * get mq client by local least connections
   * @returns {Promise<MqClient>}
   */
  async getClient() {
    let mqClient = null;
    if (this.connectStatus === 1) {
      await this.waitingCreate({ waitTime: 0 });
    }
    this.mqClients.forEach((item) => {
      // 判断是否存活
      if (!item.client.isConnected()) {
        return;
      }
      if (!mqClient) {
        mqClient = item;
      } else if (mqClient.connectCount < item.connectCount) {
        mqClient = item;
      }
    });
    if (!mqClient) {
      throw new Error('No available MQ client');
    }
    console.log('chose the server:[%s]', mqClient.id);
    mqClient.connectCount += 1;
    return mqClient.client;
  }

  /**
   * 释放连接
   * @param id
   */
  release(id) {
    const mqClient = this.mqClients.find(item => item.id === id);
    if (mqClient) mqClient.clientCount -= 1;
  }
}

module.exports = MqPool;
