import React, { useState } from "react";

const Login: React.FC = () => {
  const [email, setEmail] = useState("admin@democompany.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // IMPORTANT: page reload ko rokta hai
    setError(null);
    setLoading(true);

    console.log("🔐 Attempting login with:", email);

    try {
      const response = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      console.log("📡 Login API Response:", data);

      if (!response.ok || !data.success) {
        setError(data.error || "Invalid credentials");
        setLoading(false);
        return;
      }

      // Store token
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      console.log("✅ Login successful, redirecting…");

      // Redirect
      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("❌ Login error:", err);
      setError("Login failed. Check server and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>GST Billing</h1>
      <h3>Sign in to your account</h3>

      <form onSubmit={handleSubmit} style={{ maxWidth: 320 }}>
        <div style={{ marginBottom: 12 }}>
          <label>Email Address</label>
          <input
            type="email"
            value={email}
            style={{ width: "100%", padding: 8 }}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            style={{ width: "100%", padding: 8 }}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div style={{ color: "red", marginBottom: 12 }}>{error}</div>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div style={{ marginTop: 24 }}>
        <strong>Default credentials:</strong>
        <div>Email: admin@democompany.com</div>
        <div>Password: admin123</div>
      </div>
    </div>
  );
};

export default Login;
