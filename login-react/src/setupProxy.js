const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/attendance-dashboard/api',
    createProxyMiddleware({
      target: 'http://localhost',
      changeOrigin: true,
    })
  );
};
