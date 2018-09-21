/**
 * @description 通用工具类
 * @author yq
 * @date 2018/7/5 下午9:55
 */
/**
 * 数字转字符串
 * @param num
 * @param precision
 * @returns {*}
 */
function numberToString(num, precision = 14) {
  if (typeof num !== 'number') return num;
  // 加入以下条件后，加减乘除之后的结果同样会丢失精度
  // if (num >= 0.000001) return num.toString();
  return num.toFixed(precision).replace(/0+?$/, '').replace(/\.$/, '');
}

/**
 * 数字向下取整保留指定小数
 * @param num 字符串
 * @param precision 3
 * @returns {*}
 */
function decimalRoundDown(num, precision = 2) {
  if (typeof num === 'number') num = numberToString(num);
  const end = num.indexOf('.');
  if (end === -1) return num;
  return num.substring(0, end + precision + 1);
}

module.exports = {
  numberToString,
  decimalRoundDown
};
