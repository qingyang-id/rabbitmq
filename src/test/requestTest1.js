/**
 * @description
 * @author yq
 * @date 2018/6/27 下午5:23
 */
const request = require('request');
const Agent = require('socks5-https-client/lib/Agent');

function send() {
  // const proxyUrl = 'http://proxy.baibianip.com:8000';
  // request.defaults({ proxy: proxyUrl });
  const sendOpts = {
    method: 'GET',
    url: 'https://test.tokenclub.com/v1/oss/getsts',
    timeout: 60000,
    headers: {
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMzA1NywibmV3VXNlcklkIjoxMjMwNTcsInV1aWQiOiI2ZjQxY2Y2MC03MDNkLTExZTgtYWU4Mi1hYmE5NjVkM2E2ZGEiLCJpYXQiOjE1MjkwMzI3OTgsImV4cCI6MjQ3NTExMjc5OH0.5LHiWqMQ66aHShICs4W8qQC6qABWLMsmw2tBYl7ZTJ4'
    },
    json: true,
    // proxy: 'http://localhost:1080',
    agentClass: Agent,
    agentOptions: {
      socksHost: 'localhost', // Defaults to 'localhost'.
      socksPort: 1080 // Defaults to 1080.
    }
  };
  request(sendOpts, (err, response, body) => {
    if (err) {
      return console.error(err);
    }
    console.error(body);
  });
};

function send1() {
  // const proxyUrl = 'http://proxy.baibianip.com:8000';
  // request.defaults({ proxy: proxyUrl });
  const sendOpts = {
    method: 'GET',
    url: 'https://www.okcoin.com/api/v1/kline.do?symbol=tct_usd&type=5min',
    timeout: 60000,
    headers: {
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMzA1NywibmV3VXNlcklkIjoxMjMwNTcsInV1aWQiOiI2ZjQxY2Y2MC03MDNkLTExZTgtYWU4Mi1hYmE5NjVkM2E2ZGEiLCJpYXQiOjE1MjkwMzI3OTgsImV4cCI6MjQ3NTExMjc5OH0.5LHiWqMQ66aHShICs4W8qQC6qABWLMsmw2tBYl7ZTJ4'
    },
    json: true,
    // proxy: 'http://localhost:1080',
    agentClass: Agent,
    agentOptions: {
      socksHost: 'localhost', // Defaults to 'localhost'.
      socksPort: 1080 // Defaults to 1080.
    }
  };
  request(sendOpts, (err, response, body) => {
    if (err) {
      return console.error(err);
    }
    console.error(body);
  });
};

send();
