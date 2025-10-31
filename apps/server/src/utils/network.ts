/**
 * 网络连接诊断和监控工具
 */

/**
 * 检查各种网络连接状态
 */
export const diagnoseNetworkIssues = async (): Promise<{
  openai: boolean;
  dns: boolean;
  internet: boolean;
  details: string[];
}> => {
  const results = {
    openai: false,
    dns: false,
    internet: false,
    details: [] as string[]
  };

  try {
    // 检查基本互联网连接
    results.internet = await checkInternetConnection();
    results.details.push(`互联网连接: ${results.internet ? '正常' : '异常'}`);

    // 检查DNS解析
    results.dns = await checkDNSResolution();
    results.details.push(`DNS解析: ${results.dns ? '正常' : '异常'}`);

    // 检查OpenAI连接
    results.openai = await checkOpenAIConnection();
    results.details.push(`OpenAI连接: ${results.openai ? '正常' : '异常'}`);

  } catch (error: any) {
    results.details.push(`网络诊断失败: ${error.message}`);
  }

  return results;
};

/**
 * 检查基本互联网连接
 */
const checkInternetConnection = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const http = require('http');
    const request = http.get('http://httpbin.org/get', (res: any) => {
      resolve(res.statusCode === 200);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(5000, () => {
      request.destroy();
      resolve(false);
    });
  });
};

/**
 * 检查DNS解析
 */
const checkDNSResolution = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const dns = require('dns');
    dns.lookup('api.openai.com', (err: any) => {
      resolve(!err);
    });
  });
};

/**
 * 检查OpenAI连接
 */
const checkOpenAIConnection = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const https = require('https');
    const request = https.get('https://api.openai.com/v1/models', (res: any) => {
      resolve(res.statusCode === 200 || res.statusCode === 401);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(10000, () => {
      request.destroy();
      resolve(false);
    });
  });
};

/**
 * 获取网络错误类型和建议
 */
export const getNetworkErrorSuggestion = (error: any): string => {
  const errorCode = error.code;
  const errorMessage = error.message;

  if (errorCode === 'ETIMEDOUT' || errorMessage?.includes('timeout')) {
    return `网络超时。建议检查:\n- 网络连接稳定性\n- 防火墙设置\n- DNS配置\n- 考虑使用VPN或代理`;
  }

  if (errorCode === 'ENOTFOUND' || errorMessage?.includes('getaddrinfo')) {
    return `DNS解析失败。建议:\n- 检查网络连接\n- 更换DNS服务器\n- 检查Hosts文件`;
  }

  if (errorCode === 'ECONNREFUSED') {
    return `连接被拒绝。建议:\n- 检查代理设置\n- 检查防火墙\n- 确认网络端口未被阻止`;
  }

  if (errorCode === 'ECONNRESET') {
    return `连接被重置。建议:\n- 检查网络稳定性\n- 尝试重新连接网络\n- 联系网络管理员`;
  }

  if (error.status === 429) {
    return `API调用频率限制。建议:\n- 减少调用频率\n- 等待一段时间后重试\n- 检查API配额`;
  }

  if (error.status >= 500) {
    return `OpenAI服务器错误。建议:\n- 稍后重试\n- 检查OpenAI状态页面\n- 等待服务器恢复`;
  }

  return `未知网络错误。建议:\n- 检查网络连接\n- 重新启动应用\n- 联系技术支持`;
};