/**
 * @description
 * @author yq
 * @date 2018/7/14 下午12:39
 */
const MqPool = require('../../mqPool');
const MqClient = require('../../mqClient');
const msgMap = {};
const mqConfig = {
  protocol: 'amqp',
  hostname: 'localhost',
  port: 6672,
  username: 'guest',
  password: 'guest',
  heartbeat: 0,
  vhost: '/',
};

async function sendToQueueTest(i) {
  const mqClient = await MqPool.getInstance().getClient();
  const queueName = 'tasks';
  const channel = await mqClient.createChannel(queueName);
  await channel.assertQueue(queueName, { durable: true });
  await channel.sendToQueue(queueName, Buffer.from(JSON.stringify({
    id: i,
    content: 'message:' + i
  }), 'utf8'), { persistent: true });
}

const exchangeName = 'test';
async function publishTest() {
  const mqClient = await MqPool.getInstance().getClient();
  const queueName = 'queue-test';
  const channel = await mqClient.createChannel(queueName);
  // 交换机类型： direct, topic, header, fanout
  const queueType = 'fanout';
  await channel.assertExchange(exchangeName, queueType, { durable: false });
  await publish(channel, 0);
}

async function publish(channel, i) {
  if (i >= 1000) return;
  i += 1;
  await new Promise(resolve => setTimeout(resolve, 1000))
    .then(() => channel.publish(exchangeName, "", Buffer.from(JSON.stringify({
      id: i,
      content: 'message:' + i
    }), 'utf8'), { persistent: true }));
  await publish(channel, i);
}

async function subscribTest() {
  const mqClient = new MqClient(mqConfig);
  await mqClient.createConnect();
  const channel = await mqClient.createChannel('consume-task');
  // 交换机类型： direct, topic, header, fanout
  const queueType = 'fanout';
  // durable 消息是否持久化
  await channel.assertExchange(exchangeName, queueType, { durable: false });

  const queueName = 'test';
  // exclusive 连接断掉，节点会不会自动删除
  const queueResult = await channel.assertQueue(queueName, { exclusive: true });
  await channel.bindQueue(queueResult.queue, exchangeName, '');
  channel.prefetch(1);
  await channel.consume(queueResult.queue, (msg, ...args) => {
    console.log(" [x] %s", msg.content.toString(), Date.now(), args);
  }, {
    noAck: true
  });
}

async function consumeTest() {
  const mqClient = await MqPool.getInstance().getClient();
  await mqClient.consume('tasks', {
    prefetch: 1,
    consumeConfig: {
      noAck: true
    }
  }, function (channel, msg) {
    try {
      if (msg !== null) {
        try {
          // console.log(msg);
          const message = JSON.parse(msg.content && msg.content.toString() || '{}');
          msgMap[message.id] = message;
        } catch (e) {
          console.log('message error:', msg.content && msg.content.toString());
        }
        console.log(new Date(), 'consume msg: ', msg.content && msg.content.toString());
        // setTimeout(() => {
        //   try {
        //     channel.ack(msg)
        //   } catch (e) {
        //     console.error('消费确认失败：', e);
        //   }
        // }, 3000);
      } else {
        console.log('msg is null:');
      }
    } catch (e) {
      console.error('消费消息失败：', e);
    }
  });
}

async function whileSendToQueue(i) {
  if (i >= 1000) return;
  i += 1;
  await new Promise(resolve => setTimeout(resolve, 1000))
    .then(() => publishTest(i).then(() => {
      console.log('消息发送成功:', i)
    })
      .catch((err) => {
        console.error('消息发送失败：', err);
      }));
  await whileSendToQueue(i);
}
// whileSendToQueue(0).then(console.log).catch(console.error);
// consumeTest().then(console.log).catch(console.error);
publishTest(0).then(console.log).catch(console.error);
subscribTest().then(console.log).catch(console.error);
