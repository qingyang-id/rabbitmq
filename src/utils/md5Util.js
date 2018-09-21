/**
 * @description md5工具类
 * @author yq
 * @date 2018/3/18 下午11:20
 */
const crypto = require('crypto');

class Md5Util {
  /**
   * md5 加密
   * @param digestType  加密类型 默认hex
   * @param encode  编码方式 默认utf8
   * @returns {*|PromiseLike<ArrayBuffer>}
   */
  static md5(content, digestType = 'hex', encode = 'utf8') {
    return crypto.createHash('md5')
      .update(content, encode)
      .digest(digestType);
  }

  /**
   * 加密
   * @param content 加密内容
   * @param hashType  hash方式 默认md5
   * @param digestType  加密类型 默认hex
   * @param encode  编码方式 默认utf8
   * @returns {*|PromiseLike<ArrayBuffer>}
   */
  static encryptByHash(content, hashType = 'md5', digestType = 'hex', encode = 'utf8') {
    return crypto.createHash(hashType)
      .update(content, encode)
      .digest(digestType);
  }
}

module.exports = Md5Util;
