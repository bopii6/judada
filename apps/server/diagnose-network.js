#!/usr/bin/env node

require('dotenv').config({ path: '../../.env' });

async function diagnoseNetwork() {
  console.log('🔍 网络连接诊断工具');
  console.log('==========================');

  try {
    const { diagnoseNetworkIssues, getNetworkErrorSuggestion } = require('./dist/utils/network');

    console.log('📡 开始网络诊断...\n');

    const results = await diagnoseNetworkIssues();

    console.log('📊 诊断结果:');
    console.log('-----------');
    results.details.forEach(detail => console.log(`  • ${detail}`));

    console.log('\n💡 网络状态汇总:');
    console.log(`  • 互联网连接: ${results.internet ? '✅ 正常' : '❌ 异常'}`);
    console.log(`  • DNS解析: ${results.dns ? '✅ 正常' : '❌ 异常'}`);
    console.log(`  • OpenAI连接: ${results.openai ? '✅ 正常' : '❌ 异常'}`);

    if (!results.openai) {
      console.log('\n🚨 OpenAI连接异常');
      console.log('\n📋 解决建议:');

      const mockError = { code: 'ETIMEDOUT', message: 'Connection error' };
      const suggestion = getNetworkErrorSuggestion(mockError);
      console.log(suggestion);
    } else {
      console.log('\n✅ 网络连接正常！');
    }

  } catch (error) {
    console.error('❌ 诊断过程出错:', error.message);
  }
}

diagnoseNetwork().catch(console.error);