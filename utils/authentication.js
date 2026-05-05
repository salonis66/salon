import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
  try {
    // 🍪 token from cookie
    const token = req.cookies.token;
    console.log("Auth check - Cookies received:", !!req.cookies.token, "Token exists:", !!token);

    if (!token) {
      throw new Error("login or signup required");
    }

    // verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // attach user
    req.user = decoded;

    next();
  } catch (error) {
    console.log("JWT ERROR:", error.message);
    // Return 401 for auth failures instead of 500
    return res.status(401).json({
      success: false,
      message: error.message
    });
  }
};

export default auth;
