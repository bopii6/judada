import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, Target, Star } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const features = [
  {
    icon: <BookOpen className="h-8 w-8 text-blue-600" />,
    title: '丰富的课程内容',
    description: '涵盖听说读写的全方位英语学习材料'
  },
  {
    icon: <Users className="h-8 w-8 text-green-600" />,
    title: '个性化学习路径',
    description: '根据你的水平定制专属学习计划'
  },
  {
    icon: <Target className="h-8 w-8 text-purple-600" />,
    title: '游戏化闯关',
    description: '通过趣味关卡提升学习兴趣'
  },
  {
    icon: <Star className="h-8 w-8 text-yellow-600" />,
    title: '实时进度跟踪',
    description: '详细记录学习成果和成长轨迹'
  }
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleGuestAccess = () => {
    // 创建一个游客用户信息
    const guestUser = {
      id: 'guest-user',
      nickname: '游客用户',
      loginType: 'device' as const,
      name: 'Guest User'
    };

    const authData = {
      user: guestUser,
      token: 'guest-token-' + Date.now()
    };

    login(authData);
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-12 items-center">
        {/* 左侧介绍 */}
        <div className="text-center lg:text-left">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            欢迎来到
            <span className="block text-blue-600">Jude English Lab</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            专业的英语学习平台，让学习变得更高效、更有趣
          </p>

          {/* 功能特性 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* 用户数据统计 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6 shadow-sm">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">10,000+</div>
                <div className="text-sm text-gray-600">活跃学员</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">500+</div>
                <div className="text-sm text-gray-600">精品课程</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">4.8</div>
                <div className="text-sm text-gray-600">用户评分</div>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧登录卡片 */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <BookOpen className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">立即开始学习</h2>
            <p className="text-gray-600">
              选择您喜欢的登录方式，开启英语学习之旅
            </p>
          </div>

          {/* 登录方式 */}
          <div className="space-y-4">
            {/* 游客体验 */}
            <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 bg-blue-50">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <span className="font-medium text-gray-900 text-lg">游客体验模式</span>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                无需注册登录，立即开始英语学习之旅。体验完整的课程内容和练习功能。
              </p>
              <button
                onClick={handleGuestAccess}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold shadow-md hover:shadow-lg"
              >
                立即开始学习
              </button>
            </div>

            {/* 提示信息 */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <div className="text-amber-600 text-sm">💡</div>
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">体验说明</p>
                  <ul className="space-y-1 text-xs">
                    <li>• 游客模式下可以体验所有课程内容</li>
                    <li>• 学习进度仅保存在本地浏览器</li>
                    <li>• 后期可升级为正式账号保存云端数据</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* 安全提示 */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">安全提示</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• 您的个人信息将得到严格保护</li>
              <li>• 登录后可保存学习进度和成就</li>
              <li>• 支持随时退出和切换账户</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;