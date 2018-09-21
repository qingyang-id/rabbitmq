/**
 * @description okex账号测试
 * @author yq
 * @date 2018/8/14 上午10:25
 */
const HttpUtil = require('../utils/httpUtil');
const Md5Util = require('../utils/md5Util');
const OkexTest = require('./okexTest');
const Agent = require('socks5-https-client/lib/Agent');

// apiKey: c0f8e4ca-15ff-4335-9421-daa3d69884f5
// 备注名: trade-test-1
// 权限: 交易
// secretKey: 9BE2647489E8DC0C69EB9DA798145495

// apiKey: cdbe1128-a27b-4cf7-aba9-0b324d653d62
// 备注名: trade-test
// 权限: 提币交易
// secretKey: 0FCEB09E6E4275ABBC921EAD1F28ECD6


// apiKey:  72ef1805-ee50-456b-b019-1a6c87b78585
// 备注名:  TokenClub
// 权限: 交易
// secretKey: 04E2BE82D8458205C7FF4E8BD29FED20

const apiKey = 'c0f8e4ca-15ff-4335-9421-daa3d69884f5';
const secretKey = '9BE2647489E8DC0C69EB9DA798145495';
const host = 'https://www.okex.com';

// https://www.okex.com/api/v1/userinfo.do
const proxy = 'http://127.0.0.1:1080';
// const proxy = '';
async function send(opts, extras = { retryCount: 0, delayTime: 0 }) {
  // 公共参数
  const params = {
    api_key: apiKey,
  };
  // 全部参数
  // 请求参数排序字串
  const queryStr = Object.keys(params).sort().map((k) => {
    let v = params[k];
    if (v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))) v = '';
    return `${k}=${v}`;
  })
    .join('&');
  // 待签名文本
  const text = `${queryStr}&secret_key=${secretKey}`;
  // 签名
  const signature = Md5Util.md5(text);
  params.sign = signature.toUpperCase();
  console.log(params)
  const { body } = await HttpUtil.send({
    method: 'POST',
    baseUrl: host,
    url: '/api/v1/userinfo.do',
    form: params,
    json: true,
    headers: {
      'contentType': 'application/x-www-form-urlencoded',
      "User-Agent": "OKEX JavaScript API Wrapper"
    },
    // proxy,
    agentClass: Agent,
    agentOptions: {
      socksHost: 'localhost', // Defaults to 'localhost'.
      socksPort: 1080 // Defaults to 1080.
    }
  });
  console.warn('请求Okex服务参数：', params, '请求返回：', JSON.stringify(body));
  return body;
}
async function send1(opts, extras = { retryCount: 0, delayTime: 0 }) {
  // 公共参数
  const params = {
    api_key: apiKey,
  };
  // 全部参数
  // 请求参数排序字串
  const queryStr = Object.keys(params).sort().map((k) => {
    let v = params[k];
    if (v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))) v = '';
    return `${k}=${v}`;
  })
    .join('&');
  // 待签名文本
  const text = `${queryStr}&secret_key=${secretKey}`;
  // 签名
  const signature = Md5Util.md5(text);
  params.sign = signature.toUpperCase();
  console.log(params)
  const { body } = await HttpUtil.send({
    method: 'GET',
    baseUrl: host,
    url: '/api/v1/kline.do?symbol=tct_usdt&type=5min',
    // form: params,
    json: true,
    headers: {
      'contentType': 'application/x-www-form-urlencoded',
      "User-Agent": "OKEX JavaScript API Wrapper"
    },
    // proxy,
    agentClass: Agent,
    agentOptions: {
      socksHost: 'localhost', // Defaults to 'localhost'.
      socksPort: 1080 // Defaults to 1080.
    }
  });
  console.warn('请求Okex服务参数：', params, '请求返回：', JSON.stringify(body));
  return body;
}

send1().then((result) => {
  console.log('result:', result);
})
  .catch((err) => {
    console.error('错误：', err);
  });

// new OkexTest(apiKey, secretKey, host, 30000).getUserInfo((err, result) => {
//   console.log(err, result)
// })
