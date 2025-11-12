import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./LoginPage.css";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, adminKey: storedAdminKey } = useAuth();

  const [name, setName] = useState("");
  const [adminKey, setAdminKey] = useState(storedAdminKey ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedKey = adminKey.trim();

    if (!trimmedName) {
      setError("请填写姓名，方便在后台标识你的账号。");
      return;
    }
    if (!trimmedKey) {
      setError("请填写管理员密钥（x-admin-key），否则无法访问接口。");
      return;
    }

    login({ name: trimmedName, adminKey: trimmedKey });
    navigate("/dashboard");
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">课程管理后台登录</h1>
        <p className="login-tip">输入姓名和管理员密钥即可进入后台，稍后可以换成正式的账号体系。</p>
        <div className="login-help">
          <strong>开发环境默认密钥：</strong> dev-admin-key
        </div>

        <label className="login-field">
          <span>姓名</span>
          <input value={name} onChange={event => setName(event.target.value)} placeholder="例如：张老师" />
        </label>

        <label className="login-field">
          <span>管理员密钥（x-admin-key）</span>
          <input
            value={adminKey}
            onChange={event => setAdminKey(event.target.value)}
            placeholder="例如：dev-admin-key"
          />
        </label>

        {error && <p className="login-error">{error}</p>}

        <button type="submit" className="login-submit">
          进入后台
        </button>
      </form>
    </div>
  );
};

